"""
tests.test_simulation: Unit tests for autonomous deterministic physiological vitals simulator.
"""

import pytest
import pandas as pd
import numpy as np
from wayfinder.core.simulation import generate_vitals, simulate_cohort_vitals_for_window
from wayfinder.core.models import (
    Astronaut,
    QualityStatus,
    ProvenanceCategory,
    CalibrationStatus,
)


@pytest.fixture
def cohort():
    astro1 = Astronaut(
        astronaut_id="ASTRO-01",
        callsign="CDR M. Vance",
        mission_id="Ex-71",
        crew_role="Commander",
        resting_hr=65.0,
        resting_rmssd=55.0,
        resting_spo2=98.0,
        resting_temp=37.0,
        circadian_phase_shift_hours=0.0,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    astro2 = Astronaut(
        astronaut_id="ASTRO-02",
        callsign="FE-1 Dr. S. Patel",
        mission_id="Ex-71",
        crew_role="Flight Engineer 1",
        resting_hr=52.0,
        resting_rmssd=75.0,
        resting_spo2=98.5,
        resting_temp=36.9,
        circadian_phase_shift_hours=-1.0,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    astro3 = Astronaut(
        astronaut_id="ASTRO-03",
        callsign="MS-1 K. Lindgren",
        mission_id="Ex-71",
        crew_role="Mission Specialist",
        resting_hr=72.0,
        resting_rmssd=38.0,
        resting_spo2=97.5,
        resting_temp=37.1,
        circadian_phase_shift_hours=1.5,
        calibration_status=CalibrationStatus.CALIBRATED,
    )
    return [astro1, astro2, astro3]


def test_simulation_determinism():
    start_time = "2026-05-07T00:00:00Z"
    end_time = "2026-05-07T12:00:00Z"

    df1 = generate_vitals("ASTRO-01", start_time, end_time, seed=42)
    df2 = generate_vitals("ASTRO-01", start_time, end_time, seed=42)
    df3 = generate_vitals("ASTRO-01", start_time, end_time, seed=999)

    pd.testing.assert_frame_equal(df1, df2)
    assert not df1.equals(df3), "Different seeds should produce different noise realizations"


def test_simulation_gap_inheritance_and_persistence(temp_db):
    temp_db.ensure_initialized()

    # Pre-insert an EDA measurement with a GAP
    eda_records = pd.DataFrame([
        {
            "stream_id": "stream_eda_co2",
            "astronaut_id": None,
            "timestamp": "2026-05-07T02:00:00Z",
            "value": 3.2,
            "quality_status": QualityStatus.VALID.value,
            "is_synthetic": 0,
        },
        {
            "stream_id": "stream_eda_co2",
            "astronaut_id": None,
            "timestamp": "2026-05-07T02:05:00Z",
            "value": 0.0,
            "quality_status": QualityStatus.GAP.value,
            "is_synthetic": 0,
        },
        {
            "stream_id": "stream_eda_co2",
            "astronaut_id": None,
            "timestamp": "2026-05-07T02:10:00Z",
            "value": 3.4,
            "quality_status": QualityStatus.VALID.value,
            "is_synthetic": 0,
        },
    ])
    temp_db.insert_measurements_df(eda_records)

    # Generate vitals synchronized with DB
    vitals_df = generate_vitals(
        "ASTRO-01",
        start_time="2026-05-07T01:55:00Z",
        end_time="2026-05-07T02:15:00Z",
        seed=42,
        storage_manager=temp_db,
    )

    # Verify gap inheritance
    gap_rows = vitals_df[vitals_df["quality_status"] == QualityStatus.GAP.value]
    assert len(gap_rows) >= 3  # HR, SpO2, Temp (and optional HRV)
    assert (gap_rows["timestamp"] == "2026-05-07T02:05:00Z").all()

    # Verify database persistence
    db_vitals = temp_db.get_measurements_df(["stream_sim_hr"], astronaut_id="ASTRO-01")
    assert len(db_vitals) == 3


def test_cohort_simulation_determinism(cohort):
    start_time = "2026-05-07T00:00:00Z"
    end_time = "2026-05-08T00:00:00Z"

    # Determinism across multiple runs with identical arguments
    run1 = simulate_cohort_vitals_for_window(start_time, end_time, cohort)
    run2 = simulate_cohort_vitals_for_window(start_time, end_time, cohort)

    assert len(run1) == len(run2)
    assert len(run1) > 0
    assert run1 == run2

    # Different time window produces different values
    run3 = simulate_cohort_vitals_for_window("2026-05-08T00:00:00Z", "2026-05-09T00:00:00Z", cohort)
    assert run1 != run3


def test_cohort_simulation_physiological_bounds(cohort):
    start_time = "2026-05-07T00:00:00Z"
    end_time = "2026-05-09T00:00:00Z"  # 48 hours = 2 full circadian cycles

    measurements = simulate_cohort_vitals_for_window(start_time, end_time, cohort)
    assert len(measurements) > 0

    hr_vals = [m.value for m in measurements if m.stream_id == "stream_sim_hr"]
    hrv_vals = [m.value for m in measurements if m.stream_id == "stream_sim_hrv"]
    temp_vals = [m.value for m in measurements if m.stream_id == "stream_sim_temp"]
    spo2_vals = [m.value for m in measurements if m.stream_id == "stream_sim_spo2"]

    # Heart Rate bounds: baseline ~52-72 bpm, workout peaks ~130-145 bpm, sleep nadir ~40 bpm
    assert min(hr_vals) >= 38.0, f"HR min too low: {min(hr_vals)}"
    assert max(hr_vals) <= 160.0, f"HR max too high: {max(hr_vals)}"

    # RMSSD bounds: clamped strictly to [15.0, 140.0] ms
    assert min(hrv_vals) >= 15.0, f"RMSSD min violated: {min(hrv_vals)}"
    assert max(hrv_vals) <= 140.0, f"RMSSD max violated: {max(hrv_vals)}"

    # Core Temperature bounds: baseline 36.9-37.1 C + workout + noise
    assert min(temp_vals) >= 36.0, f"Temp min violated: {min(temp_vals)}"
    assert max(temp_vals) <= 38.5, f"Temp max violated: {max(temp_vals)}"

    # SpO2 bounds: clamped to [90.0, 100.0] %
    assert min(spo2_vals) >= 90.0, f"SpO2 min violated: {min(spo2_vals)}"
    assert max(spo2_vals) <= 100.0, f"SpO2 max violated: {max(spo2_vals)}"

    # Synthetic and provenance flags
    assert all(m.is_synthetic is True for m in measurements)
    assert all(m.provenance_category == ProvenanceCategory.SYNTHETIC_SIMULATION for m in measurements)


def test_inverse_autonomic_rmssd_coupling(cohort):
    # Focus on ASTRO-01 across a single day with 90-minute workout window (14:00 to 15:30 UTC)
    astro1 = cohort[0]
    start_time = "2026-05-07T00:00:00Z"
    end_time = "2026-05-07T23:55:00Z"

    measurements = simulate_cohort_vitals_for_window(start_time, end_time, [astro1])

    hr_by_time = {m.timestamp: m.value for m in measurements if m.stream_id == "stream_sim_hr"}
    hrv_by_time = {m.timestamp: m.value for m in measurements if m.stream_id == "stream_sim_hrv"}

    # Workout peak occurs around 14:45 UTC (Delta_t = 45 min into 90 min workout)
    peak_workout_ts = "2026-05-07T14:45:00Z"
    peak_hr = hr_by_time[peak_workout_ts]
    nadir_hrv = hrv_by_time[peak_workout_ts]

    # Verification: HR rises to > 120 bpm during peak countermeasure workout
    assert peak_hr > 120.0, f"Expected peak HR > 120 bpm during workout, got {peak_hr}"

    # Verification: Inverse RMSSD autonomic suppression (< 25 ms, significantly below 55 ms baseline)
    assert nadir_hrv < 25.0, f"Expected RMSSD suppression < 25 ms, got {nadir_hrv}"
    # Verification: Non-linear response avoids hard clipping floor (15.0 ms)
    assert nadir_hrv > 15.0, f"Expected RMSSD to remain strictly above hard clamp 15.0 ms, got {nadir_hrv}"

    # Rest / nocturnal state: early morning (e.g. 05:00 UTC)
    rest_ts = "2026-05-07T05:00:00Z"
    rest_hr = hr_by_time[rest_ts]
    rest_hrv = hrv_by_time[rest_ts]

    assert rest_hr < 65.0, f"Resting HR should be low, got {rest_hr}"
    assert rest_hrv > 50.0, f"Resting RMSSD should be high, got {rest_hrv}"


def test_gap_inheritance_from_eda(cohort):
    start_time = "2026-05-07T02:00:00Z"
    end_time = "2026-05-07T02:30:00Z"

    # Simulate an EDA telemetry gap at 02:15:00Z
    eda_df = pd.DataFrame([
        {"timestamp": "2026-05-07T02:00:00Z", "quality_status": "VALID", "value": 3.1},
        {"timestamp": "2026-05-07T02:05:00Z", "quality_status": "VALID", "value": 3.2},
        {"timestamp": "2026-05-07T02:10:00Z", "quality_status": "VALID", "value": 3.0},
        {"timestamp": "2026-05-07T02:15:00Z", "quality_status": "GAP", "value": 0.0},
        {"timestamp": "2026-05-07T02:20:00Z", "quality_status": "VALID", "value": 3.3},
    ])

    measurements = simulate_cohort_vitals_for_window(
        start_time=start_time,
        end_time=end_time,
        cohort_profiles=[cohort[0]],
        eda_measurements_df=eda_df,
    )

    gap_measurements = [m for m in measurements if m.timestamp == "2026-05-07T02:15:00Z"]
    assert len(gap_measurements) == 4
    for m in gap_measurements:
        assert m.quality_status == QualityStatus.GAP
        assert m.value == 0.0

    valid_measurements = [m for m in measurements if m.timestamp == "2026-05-07T02:05:00Z"]
    assert len(valid_measurements) == 4
    for m in valid_measurements:
        assert m.quality_status == QualityStatus.VALID
        assert m.value > 0.0


def test_chronotype_shift(cohort):
    # ASTRO-01 has phi = 0.0 -> workout 14:00 to 15:30 (peak at 14:45)
    # ASTRO-03 has phi = +1.5 -> workout 15:30 to 17:00 (peak at 16:15)
    astro1 = cohort[0]
    astro3 = cohort[2]

    start_time = "2026-05-07T12:00:00Z"
    end_time = "2026-05-07T18:00:00Z"

    meas = simulate_cohort_vitals_for_window(start_time, end_time, [astro1, astro3])

    hr_a1 = {m.timestamp: m.value for m in meas if m.stream_id == "stream_sim_hr" and m.astronaut_id == "ASTRO-01"}
    hr_a3 = {m.timestamp: m.value for m in meas if m.stream_id == "stream_sim_hr" and m.astronaut_id == "ASTRO-03"}

    # At 14:45 UTC, ASTRO-01 is at workout peak while ASTRO-03 has not started workout yet
    assert hr_a1["2026-05-07T14:45:00Z"] > 120.0
    assert hr_a3["2026-05-07T14:45:00Z"] < 90.0

    # At 16:15 UTC (14:45 + 1.5h), ASTRO-03 is at workout peak while ASTRO-01 has finished workout
    assert hr_a3["2026-05-07T16:15:00Z"] > 120.0
    assert hr_a1["2026-05-07T16:15:00Z"] < 90.0
