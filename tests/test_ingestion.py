"""
tests.test_ingestion: Unit tests for NASA ISS EDA telemetry ingestion and quality classification.
"""

import os
import pytest
import pandas as pd
from wayfinder.core.ingestion import (
    calculate_co2_partial_pressure,
    ingest_eda_csv,
    DataIngestionError,
    SchemaMismatchError,
)
from wayfinder.core.models import QualityStatus


def test_calculate_co2_partial_pressure():
    # At standard 101.325 kPa, 7600 ppm should be approx 5.776 mmHg
    p_co2 = calculate_co2_partial_pressure(7600.0, 101.325)
    assert abs(p_co2 - 5.776) < 1e-3

    # Default pressure (760 mmHg) with 4000 ppm
    p_co2_default = calculate_co2_partial_pressure(4000.0)
    assert abs(p_co2_default - 3.04) < 1e-3


def test_ingest_eda_csv_nominal(temp_db):
    temp_db.ensure_initialized()
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sample_eda_iss_co2_temp.csv")
    assert os.path.exists(csv_path), "Bundled sample EDA CSV must exist"

    inserted = ingest_eda_csv(csv_path, temp_db)
    assert inserted > 0

    co2_df = temp_db.get_measurements_df(["stream_eda_co2"])
    assert len(co2_df) > 800
    assert (co2_df["is_synthetic"] == 0).all()
    assert (co2_df["stream_id"] == "stream_eda_co2").all()

    # Verify peak excursion exceeds 5.0 mmHg
    max_co2 = co2_df["value"].max()
    assert max_co2 >= 5.0, f"Expected peak CO2 excursion >= 5.0 mmHg, got {max_co2}"

    # Verify GAP marker was inserted
    gap_rows = co2_df[co2_df["quality_status"] == QualityStatus.GAP.value]
    assert len(gap_rows) > 0, "GAP marker should be inserted for dropped interval"


def test_ingest_eda_csv_gap_and_suspect_detection(tmp_path, temp_db):
    temp_db.ensure_initialized()

    test_csv = tmp_path / "test_eda.csv"
    data = [
        # Normal rows
        {"timestamp_utc": "2026-05-07T00:00:00Z", "cabin_co2_ppm": 3500.0, "cabin_temp_c": 22.0, "cabin_pressure_kpa": 101.3, "module_id": "Node 2"},
        {"timestamp_utc": "2026-05-07T00:05:00Z", "cabin_co2_ppm": 3510.0, "cabin_temp_c": 22.1, "cabin_pressure_kpa": 101.3, "module_id": "Node 2"},
        {"timestamp_utc": "2026-05-07T00:10:00Z", "cabin_co2_ppm": 3520.0, "cabin_temp_c": 22.2, "cabin_pressure_kpa": 101.3, "module_id": "Node 2"},
        # 30-minute GAP (sampling rate = 5m, gap = 30m > 15m)
        {"timestamp_utc": "2026-05-07T00:40:00Z", "cabin_co2_ppm": -100.0, "cabin_temp_c": 22.0, "cabin_pressure_kpa": 101.3, "module_id": "Node 2"}, # SUSPECT CO2
        {"timestamp_utc": "2026-05-07T00:45:00Z", "cabin_co2_ppm": 3500.0, "cabin_temp_c": 45.0, "cabin_pressure_kpa": 101.3, "module_id": "Node 2"}, # SUSPECT Temp
    ]
    # Add 12 stale rows for temp
    for i in range(12):
        min_offset = 50 + i * 5
        data.append({
            "timestamp_utc": f"2026-05-07T01:{min_offset:02d}:00Z" if min_offset < 60 else f"2026-05-07T02:{min_offset-60:02d}:00Z",
            "cabin_co2_ppm": 3500.0 + i,
            "cabin_temp_c": 21.0,  # Constant value
            "cabin_pressure_kpa": 101.3,
            "module_id": "Node 2",
        })

    pd.DataFrame(data).to_csv(test_csv, index=False)

    inserted = ingest_eda_csv(test_csv, temp_db)
    assert inserted > 0

    all_meas = temp_db.get_measurements_df(["stream_eda_co2", "stream_eda_temp"])
    
    # GAP check
    gap_count = (all_meas["quality_status"] == QualityStatus.GAP.value).sum()
    assert gap_count >= 2  # At least 1 for CO2 and 1 for Temp

    # SUSPECT check
    suspect_rows = all_meas[all_meas["quality_status"] == QualityStatus.SUSPECT.value]
    assert len(suspect_rows) >= 2

    # STALE check
    stale_rows = all_meas[all_meas["quality_status"] == QualityStatus.STALE.value]
    assert len(stale_rows) > 0


def test_ingest_eda_tsv_and_exceptions(tmp_path, temp_db):
    temp_db.ensure_initialized()

    # 1. Non-existent file raises DataIngestionError
    with pytest.raises(DataIngestionError):
        ingest_eda_csv(tmp_path / "non_existent.csv", temp_db)

    # 2. Schema mismatch raises SchemaMismatchError
    bad_csv = tmp_path / "bad_schema.csv"
    pd.DataFrame([{"wrong_column": 123}]).to_csv(bad_csv, index=False)
    with pytest.raises(SchemaMismatchError):
        ingest_eda_csv(bad_csv, temp_db)

    # 3. TSV ingestion works seamlessly
    tsv_file = tmp_path / "sample.tsv"
    tsv_data = [
        {"timestamp_utc": "2026-05-07T00:00:00Z", "cabin_co2_ppm": 3500.0, "cabin_temp_c": 22.0, "cabin_pressure_kpa": 101.3},
        {"timestamp_utc": "2026-05-07T00:05:00Z", "cabin_co2_ppm": 3510.0, "cabin_temp_c": 22.1, "cabin_pressure_kpa": 101.3},
    ]
    pd.DataFrame(tsv_data).to_csv(tsv_file, sep="\t", index=False)
    inserted = ingest_eda_csv(tsv_file, temp_db)
    assert inserted == 6  # 2 rows * 3 streams


def test_ingest_eda_imputed_smoothing(tmp_path, temp_db):
    temp_db.ensure_initialized()

    # Create dataset with a small gap of 10 min (sampling interval = 5 min -> missing 1 step at 00:05)
    csv_file = tmp_path / "smoothing.csv"
    data = [
        {"timestamp_utc": "2026-05-07T00:00:00Z", "cabin_co2_ppm": 3000.0, "cabin_temp_c": 22.0, "cabin_pressure_kpa": 101.3},
        {"timestamp_utc": "2026-05-07T00:10:00Z", "cabin_co2_ppm": 3200.0, "cabin_temp_c": 22.2, "cabin_pressure_kpa": 101.3},
        {"timestamp_utc": "2026-05-07T00:15:00Z", "cabin_co2_ppm": 3250.0, "cabin_temp_c": 22.3, "cabin_pressure_kpa": 101.3},
    ]
    pd.DataFrame(data).to_csv(csv_file, index=False)

    inserted = ingest_eda_csv(csv_file, temp_db, enable_smoothing=True)
    all_meas = temp_db.get_measurements_df(["stream_eda_co2"])
    
    imputed_rows = all_meas[all_meas["quality_status"] == QualityStatus.IMPUTED.value]
    assert len(imputed_rows) == 1
    assert imputed_rows.iloc[0]["timestamp"] == "2026-05-07T00:05:00Z"
