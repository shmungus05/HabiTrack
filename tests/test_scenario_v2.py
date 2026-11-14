"""
tests/test_scenario_v2.py: End-to-end integration scenario verifying the Day 120-134
Expedition 71 mission scenario (Tickets WAYFINDER-V2-016 and WAYFINDER-V2-017).

Verifies:
- 14-day mission environment provisioning (< 5.0 seconds).
- Authoritative cohort seeding (ASTRO-01, ASTRO-02, ASTRO-03).
- Rolling circadian baseline calibration convergence (Day 1 CALIBRATING vs Day 4 CALIBRATED).
- Symmetric tripartite concordance detection (PCO2 >= 4.5 mmHg + severe headache + autonomic shift).
- Mandatory non-causal operational decision-support disclaimer integrity.
- Strict cohort profile isolation (0 INVESTIGATE events for ASTRO-02 and ASTRO-03).
"""

import time
from pathlib import Path
from typing import List, Optional
import pytest
import pandas as pd

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    HealthEvent,
    QualityStatus,
    ReviewStatus,
    SeverityLevel,
    SymptomReport,
    UncertaintyLevel,
)
from wayfinder.core.simulation import simulate_cohort_vitals_for_window
from wayfinder.core.baselines import (
    compute_circadian_hourly_bins,
    evaluate_measurement_deviations,
)
from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.core.ingestion import calculate_co2_partial_pressure


MISSION_START = "2026-07-01T00:00:00Z"
MISSION_END = "2026-07-14T23:59:59Z"
EXCURSION_TIMESTAMP = "2026-07-08T02:15:00Z"
EXCURSION_CO2_MMHG = 5.8
EXCURSION_MODULE = "Node 2"


def provision_14day_mission_environment(temp_storage: StorageManager) -> StorageManager:
    """
    Provisions a 14-day Expedition 71 mission environment (MET Days 120-134):
    1. Initializes SQLite storage and default metadata / 3 cohort astronauts.
    2. Ingests authentic NASA EDA telemetry, tiling across 14 days with normal cabin pressure
       (~101.3 kPa) and ambient CO2 (2.5-3.0 mmHg).
    3. Deterministically simulates 14 days of synchronized 5-minute vitals for ASTRO-01,
       ASTRO-02, and ASTRO-03 via simulate_cohort_vitals_for_window.
    4. Injects acute exposure excursion at Day 127 02:15 UTC (2026-07-08T02:15:00Z):
       - Cabin P_CO2 = 5.8 mmHg in Node 2.
       - ASTRO-01 severe headache symptom report (severity 3/5, Node 2, reported 1h later).
       - ASTRO-01 coincident autonomic shift (Z_HR >= +2.5, Z_RMSSD <= -2.0).
       - ASTRO-02 and ASTRO-03 maintain nominal vitals with NO symptoms logged.

    Execution completes in < 5.0 seconds.
    """
    temp_storage.ensure_initialized()

    # Retrieve 3 authoritative cohort astronauts
    cohort: List[Astronaut] = [
        temp_storage.get_astronaut("ASTRO-01"),
        temp_storage.get_astronaut("ASTRO-02"),
        temp_storage.get_astronaut("ASTRO-03"),
    ]
    if any(a is None for a in cohort):
        raise ValueError("Authoritative cohort astronauts must be seeded in storage")

    # 1. Tile authentic NASA EDA data across 14 mission days (2026-07-01 to 2026-07-14)
    eda_csv_path = Path(__file__).parent.parent / "data" / "sample_eda_iss_co2_temp.csv"
    if not eda_csv_path.exists():
        raise FileNotFoundError(f"Authentic sample EDA CSV not found: {eda_csv_path}")

    sample_eda_df = pd.read_csv(eda_csv_path)

    # 14 days with 5-minute intervals = 4,032 timestamps
    eda_timestamps = pd.date_range(MISSION_START, "2026-07-14T23:55:00Z", freq="5min", tz="UTC")
    eda_ts_strs = [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in eda_timestamps]
    n_sample = len(sample_eda_df)

    press_arr = sample_eda_df["cabin_pressure_kpa"].to_numpy(dtype=float)
    temp_arr = sample_eda_df["cabin_temp_c"].to_numpy(dtype=float)
    co2_arr = sample_eda_df["cabin_co2_ppm"].to_numpy(dtype=float)

    eda_records = []
    for i, ts_str in enumerate(eda_ts_strs):
        idx = i % n_sample
        press_kpa = press_arr[idx]
        temp_c = temp_arr[idx]
        ambient_ppm = min(max(co2_arr[idx], 3500.0), 3950.0)
        co2_mmhg = round(calculate_co2_partial_pressure(ambient_ppm, press_kpa), 4)

        eda_records.append(("stream_eda_co2", None, ts_str, co2_mmhg, QualityStatus.VALID.value, 0))
        eda_records.append(("stream_eda_temp", None, ts_str, round(temp_c, 2), QualityStatus.VALID.value, 0))
        eda_records.append(("stream_eda_pressure", None, ts_str, round(press_kpa, 2), QualityStatus.VALID.value, 0))

    with temp_storage.get_connection() as conn:
        conn.execute("PRAGMA synchronous = OFF;")
        conn.execute("PRAGMA journal_mode = MEMORY;")
        conn.executemany(
            """
            INSERT INTO measurements (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            eda_records,
        )

    # 2. Simulate 14 days of synchronized 5-minute vitals for all 3 cohort astronauts
    vitals_measurements = simulate_cohort_vitals_for_window(
        start_time=MISSION_START,
        end_time=MISSION_END,
        cohort_profiles=cohort,
        sample_interval_minutes=5,
    )

    vitals_records = [
        (
            m.stream_id,
            m.astronaut_id,
            m.timestamp,
            float(m.value),
            m.quality_status.value if hasattr(m.quality_status, "value") else str(m.quality_status),
            int(m.is_synthetic),
        )
        for m in vitals_measurements
    ]

    with temp_storage.get_connection() as conn:
        conn.execute("PRAGMA synchronous = OFF;")
        conn.execute("PRAGMA journal_mode = MEMORY;")
        conn.executemany(
            """
            INSERT INTO measurements (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            vitals_records,
        )

    # 3. Inject acute exposure excursion at Day 127 02:15 UTC (2026-07-08T02:15:00Z)
    # Cabin P_CO2 = 5.8 mmHg in Node 2
    with temp_storage.get_connection() as conn:
        conn.execute(
            """
            UPDATE measurements 
            SET value = ? 
            WHERE stream_id = 'stream_eda_co2' AND timestamp = ?;
            """,
            (EXCURSION_CO2_MMHG, EXCURSION_TIMESTAMP),
        )

    # Ingest coincident autonomic shift for ASTRO-01 around 02:15 UTC
    # 4 contiguous samples (02:05 to 02:20 UTC) ensuring cluster duration >= 15 min and sample_count >= 3
    # Values chosen so Z_HR >= +2.5 (e.g. 85.0 bpm vs baseline ~57 bpm, Z ~ +28)
    # and Z_RMSSD <= -2.0 (e.g. 30.0 ms vs baseline ~61 ms, Z ~ -15)
    shift_timestamps = [
        "2026-07-08T02:05:00Z",
        "2026-07-08T02:10:00Z",
        "2026-07-08T02:15:00Z",
        "2026-07-08T02:20:00Z",
    ]
    with temp_storage.get_connection() as conn:
        for ts in shift_timestamps:
            conn.execute(
                """
                UPDATE measurements 
                SET value = 85.0 
                WHERE stream_id = 'stream_sim_hr' AND astronaut_id = 'ASTRO-01' AND timestamp = ?;
                """,
                (ts,),
            )
            conn.execute(
                """
                UPDATE measurements 
                SET value = 30.0 
                WHERE stream_id = 'stream_sim_hrv' AND astronaut_id = 'ASTRO-01' AND timestamp = ?;
                """,
                (ts,),
            )

    # Ingest ASTRO-01 severe headache symptom report (severity 3/5, Node 2, reported 1h later at 03:15 UTC)
    symptom = SymptomReport(
        report_id="SYM-DAY127-E2E",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at=EXCURSION_TIMESTAMP,
        reported_at="2026-07-08T03:15:00Z",
        cabin_module=EXCURSION_MODULE,
        notes="Severe frontal throbbing headache in Node 2 with acute onset; visual strain noted.",
        is_synthetic=False,
    )
    temp_storage.insert_symptom_report(symptom)

    return temp_storage


@pytest.fixture
def provisioned_scenario_storage(temp_db: StorageManager) -> StorageManager:
    """Fixture providing a provisioned 14-day mission scenario database."""
    return provision_14day_mission_environment(temp_db)


def test_provision_14day_mission_environment_benchmark(temp_db: StorageManager):
    """
    WAYFINDER-V2-016 Acceptance Test:
    Verifies that provision_14day_mission_environment builds a 14-day SQLite
    mission database with 3 populated astronauts, 14 days of EDA telemetry,
    and 14 days of simulated vitals in < 5.0 seconds.
    """
    t_start = time.time()
    db = provision_14day_mission_environment(temp_db)
    elapsed = time.time() - t_start

    assert elapsed < 5.0, f"Provisioning exceeded 5.0s benchmark: {elapsed:.2f}s"

    # Verify 3 astronauts populated
    astronauts = db.list_astronauts()
    assert len(astronauts) == 3
    astro_ids = {a.astronaut_id for a in astronauts}
    assert astro_ids == {"ASTRO-01", "ASTRO-02", "ASTRO-03"}

    # Verify 14 days of EDA telemetry (4,032 samples * 3 streams = 12,096 records)
    eda_df = db.get_measurements_df(["stream_eda_co2", "stream_eda_temp", "stream_eda_pressure"])
    assert len(eda_df) >= 12000

    # Verify 14 days of simulated vitals (4 streams * 4,032 samples * 3 astronauts = 48,384 records)
    vitals_df = db.get_measurements_df(["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"])
    assert len(vitals_df) >= 48000

    # Verify peak CO2 at Day 127 02:15 UTC is 5.8 mmHg
    co2_at_excursion = db.get_measurements_df(
        stream_ids=["stream_eda_co2"],
        start_time=EXCURSION_TIMESTAMP,
        end_time=EXCURSION_TIMESTAMP,
    )
    assert len(co2_at_excursion) == 1
    assert co2_at_excursion["value"].iloc[0] == pytest.approx(5.8, rel=1e-3)


def test_expedition71_14day_scenario(temp_db: StorageManager):
    """
    WAYFINDER-V2-017 Acceptance Test:
    Executes end-to-end mission verification scenario across the 14-day
    Expedition 71 timeline (MET Days 120-134):
    - Assertion 1 (Cohort Seeding): ASTRO-01=65.0, ASTRO-02=52.0, ASTRO-03=72.0 resting HR.
    - Assertion 2 (Baseline Calibration Convergence): Day 1 CALIBRATING vs Day 4 CALIBRATED.
    - Assertion 3 (Concordance Detection): evaluate_exposure_events("ASTRO-01") logs exactly 1 INVESTIGATE event.
    - Assertion 4 (Disclaimer Integrity): Non-causal decision-support disclaimer is present.
    - Assertion 5 (Profile Isolation): evaluate_exposure_events for ASTRO-02 and ASTRO-03 returns 0 INVESTIGATE events.
    """
    provision_14day_mission_environment(temp_db)

    # -------------------------------------------------------------------------
    # Assertion 1: Cohort Seeding
    # -------------------------------------------------------------------------
    astro_01 = temp_db.get_astronaut("ASTRO-01")
    astro_02 = temp_db.get_astronaut("ASTRO-02")
    astro_03 = temp_db.get_astronaut("ASTRO-03")

    assert astro_01 is not None, "ASTRO-01 profile must exist"
    assert astro_02 is not None, "ASTRO-02 profile must exist"
    assert astro_03 is not None, "ASTRO-03 profile must exist"

    assert astro_01.resting_hr == 65.0, f"Expected ASTRO-01 resting_hr == 65.0, got {astro_01.resting_hr}"
    assert astro_02.resting_hr == 52.0, f"Expected ASTRO-02 resting_hr == 52.0, got {astro_02.resting_hr}"
    assert astro_03.resting_hr == 72.0, f"Expected ASTRO-03 resting_hr == 72.0, got {astro_03.resting_hr}"

    # -------------------------------------------------------------------------
    # Assertion 2: Baseline Calibration Convergence
    # Day 1 (1 calendar day): N_days = 1 < 3 => CALIBRATING
    # Day 4 (4 calendar days): N_days = 4 >= 3 => CALIBRATED
    # -------------------------------------------------------------------------
    vitals_day1 = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr"],
        start_time="2026-07-01T00:00:00Z",
        end_time="2026-07-01T23:59:59Z",
        astronaut_id="ASTRO-01",
    )
    bins_day1 = compute_circadian_hourly_bins(
        vitals_day1,
        astro_01,
        evaluation_time="2026-07-02T00:00:00Z",
        window_days=7,
    )
    # Every hour bin with 1 day of data must be CALIBRATING
    for (sid, h_bin), b_stat in bins_day1.items():
        assert b_stat.calibration_status == CalibrationStatus.CALIBRATING, (
            f"Hour {h_bin} expected CALIBRATING on Day 1, got {b_stat.calibration_status}"
        )
        assert b_stat.distinct_days <= 1

    vitals_day4 = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr"],
        start_time="2026-07-01T00:00:00Z",
        end_time="2026-07-04T23:59:59Z",
        astronaut_id="ASTRO-01",
    )
    bins_day4 = compute_circadian_hourly_bins(
        vitals_day4,
        astro_01,
        evaluation_time="2026-07-05T00:00:00Z",
        window_days=7,
    )
    # Every hour bin with 4 distinct days (48 samples >= 36) must transition to CALIBRATED
    for (sid, h_bin), b_stat in bins_day4.items():
        assert b_stat.calibration_status == CalibrationStatus.CALIBRATED, (
            f"Hour {h_bin} expected CALIBRATED on Day 4, got {b_stat.calibration_status}"
        )
        assert b_stat.distinct_days >= 3

    # -------------------------------------------------------------------------
    # Autonomic Deviation Verification at Excursion Timestamp
    # -------------------------------------------------------------------------
    # Retrieve 7-day vitals up to excursion timestamp to build calibrated baseline
    vitals_7d = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv"],
        start_time="2026-07-01T00:00:00Z",
        end_time="2026-07-08T02:00:00Z",
        astronaut_id="ASTRO-01",
    )
    baseline_bins = compute_circadian_hourly_bins(
        vitals_7d,
        astro_01,
        evaluation_time=EXCURSION_TIMESTAMP,
        window_days=7,
    )
    excursion_meas = temp_db.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv"],
        start_time=EXCURSION_TIMESTAMP,
        end_time=EXCURSION_TIMESTAMP,
        astronaut_id="ASTRO-01",
    )
    deviations_df = evaluate_measurement_deviations(excursion_meas, baseline_bins, astro_01)
    hr_row = deviations_df[deviations_df["stream_id"] == "stream_sim_hr"].iloc[0]
    rmssd_row = deviations_df[deviations_df["stream_id"] == "stream_sim_hrv"].iloc[0]

    assert hr_row["z_score"] >= 2.5, f"Expected Z_HR >= +2.5, got {hr_row['z_score']}"
    assert rmssd_row["z_score"] <= -2.0, f"Expected Z_RMSSD <= -2.0, got {rmssd_row['z_score']}"

    # -------------------------------------------------------------------------
    # Assertion 3: Concordance Detection
    # -------------------------------------------------------------------------
    events_astro1 = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    investigate_events = [e for e in events_astro1 if e.severity_level == SeverityLevel.INVESTIGATE]

    assert len(investigate_events) == 1, (
        f"Expected exactly 1 INVESTIGATE event for ASTRO-01, got {len(investigate_events)}"
    )
    target_event = investigate_events[0]
    assert target_event.astronaut_id == "ASTRO-01"
    assert target_event.symptom_report_id == "SYM-DAY127-E2E"
    assert target_event.uncertainty_level == UncertaintyLevel.LOW
    assert target_event.review_status == ReviewStatus.PENDING

    # -------------------------------------------------------------------------
    # Assertion 4: Disclaimer Integrity
    # -------------------------------------------------------------------------
    assert (
        "WAYFINDER does not diagnose pathologies or prescribe countermeasures"
        in target_event.rationale
    ), "Rationale must contain mandatory non-causal disclaimer"
    assert (
        "Temporal overlap indicates co-occurrence only, not clinical causation"
        in target_event.rationale
    ), "Rationale must contain non-causation co-occurrence notice"

    # -------------------------------------------------------------------------
    # Assertion 5: Profile Isolation
    # ASTRO-02 and ASTRO-03 have nominal baselines and no symptoms logged,
    # so neither should produce any INVESTIGATE health events.
    # -------------------------------------------------------------------------
    events_astro2 = evaluate_exposure_events("ASTRO-02", temp_db, window_hours=4.0)
    investigate_astro2 = [e for e in events_astro2 if e.severity_level == SeverityLevel.INVESTIGATE]
    assert len(investigate_astro2) == 0, (
        f"ASTRO-02 must produce 0 INVESTIGATE events, got {len(investigate_astro2)}"
    )

    events_astro3 = evaluate_exposure_events("ASTRO-03", temp_db, window_hours=4.0)
    investigate_astro3 = [e for e in events_astro3 if e.severity_level == SeverityLevel.INVESTIGATE]
    assert len(investigate_astro3) == 0, (
        f"ASTRO-03 must produce 0 INVESTIGATE events, got {len(investigate_astro3)}"
    )
