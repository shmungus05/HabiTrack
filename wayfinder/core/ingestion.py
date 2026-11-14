"""
wayfinder.core.ingestion: NASA ISS Environmental Data Application (EDA) ingestion and quality classifier.
"""

from pathlib import Path
from typing import Optional, Union, List, Dict
import pandas as pd
import numpy as np

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import QualityStatus


class DataIngestionError(Exception):
    """Base exception for data ingestion failures."""
    pass


class SchemaMismatchError(DataIngestionError):
    """Raised when an ingested file fails to match expected columns or formats."""
    pass


def calculate_co2_partial_pressure(ppm: float, pressure_kpa: Optional[float] = None) -> float:
    """
    Converts CO2 concentration (ppm) to partial pressure (mmHg) at cabin pressure (or standard 101.325 kPa).
    P_CO2 (mmHg) = P_total (mmHg) * ppm * 1e-6
    """
    if pressure_kpa is not None and not np.isnan(pressure_kpa) and pressure_kpa > 0:
        p_total_mmhg = pressure_kpa * (760.0 / 101.325)
    else:
        p_total_mmhg = 760.0
    return float(p_total_mmhg * ppm * 1e-6)


def ingest_eda_csv(
    file_path: Union[str, Path],
    storage_manager: StorageManager,
    astronaut_id: Optional[str] = None,
    enable_smoothing: bool = False,
) -> int:
    """
    Ingests an authentic NASA ISS EDA CSV or TSV file, applies STP conversion, detects gaps & anomalies,
    optionally performs linear interpolation for small gaps (IMPUTED), and inserts records into SQLite.
    """
    f_path = Path(file_path)
    if not f_path.exists():
        raise DataIngestionError(f"Ingestion file not found: {file_path}")

    # Format flexibility: CSV or TSV
    sep = "\t" if f_path.suffix.lower() == ".tsv" else ","
    try:
        df = pd.read_csv(f_path, sep=sep)
    except Exception as e:
        raise DataIngestionError(f"Failed to read file {file_path}: {e}") from e

    required_cols = {"timestamp_utc", "cabin_co2_ppm", "cabin_temp_c", "cabin_pressure_kpa"}
    if not required_cols.issubset(df.columns):
        raise SchemaMismatchError(f"File missing required columns: {required_cols - set(df.columns)}")

    # Ensure ISO 8601 UTC timestamps
    df["dt"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    df = df.sort_values("dt").reset_index(drop=True)
    df["timestamp"] = df["dt"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    if len(df) == 0:
        return 0

    # Calculate nominal sampling delta in seconds (use 25th percentile or min to resist gap skew)
    if len(df) > 1:
        deltas = df["dt"].diff().dropna().dt.total_seconds()
        pos_deltas = deltas[deltas > 0]
        if len(pos_deltas) > 0:
            nominal_delta = float(pos_deltas.min())
        else:
            nominal_delta = 300.0
        if nominal_delta <= 0:
            nominal_delta = 300.0  # fallback to 5 minutes
    else:
        nominal_delta = 300.0

    # Build measurement records
    records: List[Dict] = []
    
    # Track consecutive identical values for stale detection (threshold = 10 samples)
    stale_thresh = 10
    co2_repeat_count = 0
    temp_repeat_count = 0
    last_co2 = None
    last_temp = None

    for i in range(len(df)):
        row = df.iloc[i]
        curr_dt = row["dt"]
        ts_str = row["timestamp"]

        # Current row values
        raw_co2_ppm = float(row["cabin_co2_ppm"])
        raw_press_kpa = float(row["cabin_pressure_kpa"])
        raw_temp_c = float(row["cabin_temp_c"])
        co2_mmhg = calculate_co2_partial_pressure(raw_co2_ppm, raw_press_kpa)

        # Check for gap between previous and current timestamp
        if i > 0:
            prev_dt = df.iloc[i - 1]["dt"]
            prev_row = df.iloc[i - 1]
            prev_co2_ppm = float(prev_row["cabin_co2_ppm"])
            prev_press_kpa = float(prev_row["cabin_pressure_kpa"])
            prev_temp_c = float(prev_row["cabin_temp_c"])
            prev_co2_mmhg = calculate_co2_partial_pressure(prev_co2_ppm, prev_press_kpa)

            time_gap = (curr_dt - prev_dt).total_seconds()
            
            # If explicit smoothing is enabled and gap is small (1 or 2 missing steps <= 3 * nominal_delta)
            if enable_smoothing and (1.5 * nominal_delta < time_gap <= 3.0 * nominal_delta):
                missing_steps = int(round(time_gap / nominal_delta)) - 1
                for step in range(1, missing_steps + 1):
                    frac = step / (missing_steps + 1)
                    imputed_dt = prev_dt + pd.Timedelta(seconds=frac * time_gap)
                    imputed_ts = imputed_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

                    imputed_co2 = prev_co2_mmhg + frac * (co2_mmhg - prev_co2_mmhg)
                    imputed_temp = prev_temp_c + frac * (raw_temp_c - prev_temp_c)
                    imputed_press = prev_press_kpa + frac * (raw_press_kpa - prev_press_kpa)

                    records.append({
                        "stream_id": "stream_eda_co2",
                        "astronaut_id": astronaut_id,
                        "timestamp": imputed_ts,
                        "value": round(float(imputed_co2), 4),
                        "quality_status": QualityStatus.IMPUTED.value,
                        "is_synthetic": 0,
                    })
                    records.append({
                        "stream_id": "stream_eda_temp",
                        "astronaut_id": astronaut_id,
                        "timestamp": imputed_ts,
                        "value": round(float(imputed_temp), 2),
                        "quality_status": QualityStatus.IMPUTED.value,
                        "is_synthetic": 0,
                    })
                    records.append({
                        "stream_id": "stream_eda_pressure",
                        "astronaut_id": astronaut_id,
                        "timestamp": imputed_ts,
                        "value": round(float(imputed_press), 2),
                        "quality_status": QualityStatus.IMPUTED.value,
                        "is_synthetic": 0,
                    })

            elif time_gap > 3.0 * nominal_delta:
                # Insert GAP marker row at midpoint of missing interval
                gap_ts = (prev_dt + pd.Timedelta(seconds=time_gap / 2)).strftime("%Y-%m-%dT%H:%M:%SZ")
                for stream_id in ["stream_eda_co2", "stream_eda_temp", "stream_eda_pressure"]:
                    records.append({
                        "stream_id": stream_id,
                        "astronaut_id": astronaut_id,
                        "timestamp": gap_ts,
                        "value": 0.0,
                        "quality_status": QualityStatus.GAP.value,
                        "is_synthetic": 0,
                    })

        # Quality check CO2
        if raw_co2_ppm < 0 or co2_mmhg < 0 or co2_mmhg > 20.0:
            co2_quality = QualityStatus.SUSPECT.value
        elif last_co2 is not None and abs(raw_co2_ppm - last_co2) < 1e-5:
            co2_repeat_count += 1
            co2_quality = QualityStatus.STALE.value if co2_repeat_count >= stale_thresh else QualityStatus.VALID.value
        else:
            co2_repeat_count = 0
            co2_quality = QualityStatus.VALID.value
        last_co2 = raw_co2_ppm

        # Quality check Temp
        if raw_temp_c < 10.0 or raw_temp_c > 40.0:
            temp_quality = QualityStatus.SUSPECT.value
        elif last_temp is not None and abs(raw_temp_c - last_temp) < 1e-5:
            temp_repeat_count += 1
            temp_quality = QualityStatus.STALE.value if temp_repeat_count >= stale_thresh else QualityStatus.VALID.value
        else:
            temp_repeat_count = 0
            temp_quality = QualityStatus.VALID.value
        last_temp = raw_temp_c

        # Quality check Pressure
        if raw_press_kpa < 70.0 or raw_press_kpa > 130.0:
            press_quality = QualityStatus.SUSPECT.value
        else:
            press_quality = QualityStatus.VALID.value

        # Append standard streams
        records.append({
            "stream_id": "stream_eda_co2",
            "astronaut_id": astronaut_id,
            "timestamp": ts_str,
            "value": round(co2_mmhg, 4),
            "quality_status": co2_quality,
            "is_synthetic": 0,
        })
        records.append({
            "stream_id": "stream_eda_temp",
            "astronaut_id": astronaut_id,
            "timestamp": ts_str,
            "value": round(raw_temp_c, 2),
            "quality_status": temp_quality,
            "is_synthetic": 0,
        })
        records.append({
            "stream_id": "stream_eda_pressure",
            "astronaut_id": astronaut_id,
            "timestamp": ts_str,
            "value": round(raw_press_kpa, 2),
            "quality_status": press_quality,
            "is_synthetic": 0,
        })

    measurements_df = pd.DataFrame(records)
    inserted_count = storage_manager.insert_measurements_df(measurements_df)
    return inserted_count
