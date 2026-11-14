"""
tests.test_analytics: Unit tests for time-series LTTB decimation and symmetric tripartite exposure concordance analytics.
"""

import pytest
import numpy as np
import pandas as pd
from wayfinder.core.analytics import (
    decimate_time_series,
    coalesce_autonomic_intervals,
    evaluate_exposure_events,
    MANDATORY_DISCLAIMER,
)
from wayfinder.core.models import (
    Astronaut,
    SymptomReport,
    SeverityLevel,
    UncertaintyLevel,
    QualityStatus,
)


def test_decimate_time_series_passthrough():
    small_df = pd.DataFrame({
        "timestamp": ["2026-05-07T00:00:00Z", "2026-05-07T00:05:00Z"],
        "value": [3.2, 3.4],
    })
    result = decimate_time_series(small_df, max_points=100)
    assert len(result) == 2


def test_decimate_time_series_downsampling():
    n = 2500
    timestamps = pd.date_range("2026-05-07", periods=n, freq="1min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    values = np.sin(np.linspace(0, 20 * np.pi, n))
    peak_idx = 1250
    values[peak_idx] = 99.9

    df = pd.DataFrame({
        "timestamp": timestamps,
        "value": values,
        "stream_id": ["stream_eda_co2"] * n,
    })

    decimated = decimate_time_series(df, max_points=500)
    assert len(decimated) == 500
    # First and last points preserved
    assert decimated.iloc[0]["timestamp"] == df.iloc[0]["timestamp"]
    assert decimated.iloc[-1]["timestamp"] == df.iloc[-1]["timestamp"]
    # Peak preserved
    assert decimated["value"].max() == pytest.approx(99.9, rel=1e-4)


def test_evaluate_exposure_events(temp_db):
    temp_db.ensure_initialized()

    # Insert test measurements around Day 127: Peak CO2 of 5.6 mmHg
    timestamps = pd.date_range("2026-05-09T00:00:00Z", periods=12, freq="30min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    co2_values = [3.2, 3.4, 4.0, 4.8, 5.6, 5.2, 4.6, 4.1, 3.8, 3.5, 3.3, 3.2]

    records = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": timestamps,
        "value": co2_values,
        "quality_status": QualityStatus.VALID.value,
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(records)

    # Insert symptom report in Node 2 (aligned module -> LOW uncertainty)
    symptom_node2 = SymptomReport(
        report_id="SYM-001",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:00:00Z",
        reported_at="2026-05-09T03:30:00Z",
        cabin_module="Node 2",
        notes="Bilateral throbbing",
        is_synthetic=False,
    )
    temp_db.insert_symptom_report(symptom_node2)

    events = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    assert len(events) >= 1
    event = next(e for e in events if e.symptom_report_id == "SYM-001")

    assert event.severity_level == SeverityLevel.INVESTIGATE
    assert event.uncertainty_level == UncertaintyLevel.LOW
    assert "Temporal overlap indicates co-occurrence only, not clinical causation" in event.rationale
    assert "WAYFINDER does not diagnose pathologies or prescribe countermeasures" in event.rationale
    assert "peak of 5.60 mmHg" in event.rationale

    # Insert symptom in Columbus (misaligned module -> HIGH uncertainty)
    symptom_columbus = SymptomReport(
        report_id="SYM-002",
        astronaut_id="ASTRO-01",
        symptom_code="FATIGUE",
        severity=3,
        occurred_at="2026-05-09T02:15:00Z",
        reported_at="2026-05-09T03:00:00Z",
        cabin_module="Columbus",
        notes="Exhaustion",
        is_synthetic=False,
    )
    temp_db.insert_symptom_report(symptom_columbus)

    events_2 = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    columbus_evt = next(e for e in events_2 if e.symptom_report_id == "SYM-002")
    assert columbus_evt.uncertainty_level == UncertaintyLevel.HIGH


def test_evaluate_standalone_environmental_excursion(temp_db):
    temp_db.ensure_initialized()

    # Create standalone CO2 excursion without any symptoms logged
    timestamps = pd.date_range("2026-05-15T00:00:00Z", periods=6, freq="10min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    co2_values = [3.2, 4.1, 4.3, 4.2, 3.8, 3.5]
    records = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": timestamps,
        "value": co2_values,
        "quality_status": QualityStatus.VALID.value,
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(records)

    # Without symptoms, this should generate an INFO event
    events = evaluate_exposure_events("ASTRO-01", temp_db)
    assert len(events) >= 1
    info_event = next(e for e in events if e.severity_level == SeverityLevel.INFO)
    assert info_event.event_type == "EXPOSURE_ELEVATED_CO2"
    assert "without coincident symptoms" in info_event.rationale


# --- Epic 4: Tripartite Concordance & Coalescence Analytics Unit Tests ---


def test_coalesce_autonomic_intervals():
    """
    WAYFINDER-V2-010: Verifies 90-minute countermeasure workout (18 samples at 5-min steps)
    coalesces into exactly 1 consolidated interval with correct peak/nadir metrics,
    and isolates transient (< 15 min / < 3 samples) spikes.
    """
    # 18 contiguous 5-minute workout samples: 14:00 to 15:25 UTC (85 min span)
    workout_ts = pd.date_range("2026-05-09T14:00:00Z", periods=18, freq="5min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Half-sine exertion profile
    sine_wave = np.sin(np.linspace(0.1, np.pi - 0.1, 18))
    z_hr = 2.0 + 1.2 * sine_wave
    hr_vals = 65.0 + 65.0 * sine_wave
    z_rmssd = -2.0 - 0.8 * sine_wave
    rmssd_vals = 55.0 * np.exp(-0.012 * (65.0 * sine_wave))

    hr_rows = pd.DataFrame({
        "timestamp": workout_ts,
        "stream_id": "stream_sim_hr",
        "astronaut_id": "ASTRO-01",
        "value": hr_vals,
        "expected_mean": 65.0,
        "expected_std": 5.0,
        "z_score": z_hr,
        "is_statistical_deviation": True,
        "calibration_status": "CALIBRATED",
    })
    rmssd_rows = pd.DataFrame({
        "timestamp": workout_ts,
        "stream_id": "stream_sim_hrv",
        "astronaut_id": "ASTRO-01",
        "value": rmssd_vals,
        "expected_mean": 55.0,
        "expected_std": 6.0,
        "z_score": z_rmssd,
        "is_statistical_deviation": True,
        "calibration_status": "CALIBRATED",
    })

    # Isolated transient spike at 18:00 (1 sample: duration 0, count 1 -> must be excluded)
    transient_ts = ["2026-05-09T18:00:00Z"]
    transient_hr = pd.DataFrame({
        "timestamp": transient_ts,
        "stream_id": "stream_sim_hr",
        "astronaut_id": "ASTRO-01",
        "value": [115.0],
        "expected_mean": [65.0],
        "expected_std": [5.0],
        "z_score": [2.6],
        "is_statistical_deviation": [True],
        "calibration_status": ["CALIBRATED"],
    })
    transient_rmssd = pd.DataFrame({
        "timestamp": transient_ts,
        "stream_id": "stream_sim_hrv",
        "astronaut_id": "ASTRO-01",
        "value": [22.0],
        "expected_mean": [55.0],
        "expected_std": [6.0],
        "z_score": [-2.5],
        "is_statistical_deviation": [True],
        "calibration_status": ["CALIBRATED"],
    })

    deviations_df = pd.concat([hr_rows, rmssd_rows, transient_hr, transient_rmssd], ignore_index=True)

    intervals = coalesce_autonomic_intervals(deviations_df, max_gap_minutes=10.0, min_duration_minutes=15.0)

    # Assert exactly 1 interval coalesced (isolated transient excluded)
    assert len(intervals) == 1
    workout = intervals[0]

    assert workout["event_id"] == "EVT-EXERTION-20260509T140000Z"
    assert workout["start_time"] == "2026-05-09T14:00:00Z"
    assert workout["end_time"] == "2026-05-09T15:25:00Z"
    assert workout["duration_minutes"] == pytest.approx(85.0)
    assert workout["sample_count"] == 18
    assert workout["peak_z_hr"] == pytest.approx(float(np.max(z_hr)), rel=1e-3)
    assert workout["peak_hr_value"] == pytest.approx(float(np.max(hr_vals)), rel=1e-3)
    assert workout["nadir_z_rmssd"] == pytest.approx(float(np.min(z_rmssd)), rel=1e-3)
    assert workout["nadir_rmssd_value"] == pytest.approx(float(np.min(rmssd_vals)), rel=1e-3)

    # Wide format input compatibility test
    wide_df = pd.DataFrame({
        "timestamp": workout_ts,
        "z_score_hr": z_hr,
        "value_hr": hr_vals,
        "z_score_rmssd": z_rmssd,
        "value_rmssd": rmssd_vals,
    })
    wide_intervals = coalesce_autonomic_intervals(wide_df)
    assert len(wide_intervals) == 1
    assert wide_intervals[0]["event_id"] == "EVT-EXERTION-20260509T140000Z"
    assert wide_intervals[0]["sample_count"] == 18


def test_tripartite_concordance_investigate(temp_db):
    """
    WAYFINDER-V2-011: Excursion (PCO2 >= 4.5 mmHg) + Crew Symptom (severity >= 3)
    + Coincident Autonomic Shift interval produces INVESTIGATE event with 3 modality markers.
    """
    temp_db.ensure_initialized()

    # Step 1: Pre-seed 7-day historical vitals so baseline is CALIBRATED
    hist_ts = pd.date_range("2026-05-02T00:00:00Z", "2026-05-09T00:00:00Z", freq="30min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    hist_meas = []
    for ts in hist_ts:
        hist_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 65.0, "quality_status": "VALID", "is_synthetic": 1})
        hist_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 55.0, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(hist_meas))

    # Step 2: Ingest environmental CO2 excursion at Day 127 02:00 UTC (peak 5.82 mmHg >= 4.5)
    env_ts = pd.date_range("2026-05-09T01:00:00Z", "2026-05-09T04:00:00Z", freq="15min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    co2_values = [3.2, 3.6, 4.2, 5.0, 5.82, 5.4, 4.8, 4.2, 3.8, 3.5, 3.3, 3.2, 3.1]
    env_df = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": env_ts,
        "value": co2_values,
        "quality_status": "VALID",
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(env_df)

    # Step 3: Ingest coincident autonomic shift vitals around 02:15 UTC (3 samples: 02:10, 02:15, 02:20)
    shift_ts = ["2026-05-09T02:10:00Z", "2026-05-09T02:15:00Z", "2026-05-09T02:20:00Z"]
    shift_meas = []
    for ts in shift_ts:
        shift_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 83.4, "quality_status": "VALID", "is_synthetic": 1})
        shift_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 32.9, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(shift_meas))

    # Step 4: Crew symptom report at 02:15 UTC
    symptom = SymptomReport(
        report_id="SYM-TRIPARTITE-01",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:15:00Z",
        reported_at="2026-05-09T03:00:00Z",
        cabin_module="Node 2",
        notes="Moderate throbbing",
        is_synthetic=False,
    )
    temp_db.insert_symptom_report(symptom)

    # Step 5: Evaluate exposure events
    events = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    assert len(events) >= 1
    inv_event = next(e for e in events if e.symptom_report_id == "SYM-TRIPARTITE-01")

    # Assert INVESTIGATE severity
    assert inv_event.severity_level == SeverityLevel.INVESTIGATE
    assert "[OPERATIONAL HEALTH EVENT: INVESTIGATE]" in inv_event.rationale

    # Assert all 3 tripartite modalities referenced
    assert "[AUTHENTIC NASA EDA]" in inv_event.rationale
    assert "[SIMULATED VITALS]" in inv_event.rationale
    assert "[CREW REPORTED]" in inv_event.rationale
    assert "Cabin PCO2 reached peak of 5.82 mmHg" in inv_event.rationale
    assert "Heart Rate Z=" in inv_event.rationale
    assert "RMSSD Z=" in inv_event.rationale
    assert "HEADACHE (Severity 3/5, Node 2)" in inv_event.rationale

    # Assert mandatory non-causal disclaimer
    assert MANDATORY_DISCLAIMER in inv_event.rationale
    assert "Temporal overlap indicates co-occurrence only, not clinical causation" in inv_event.rationale


def test_nominal_co2_symptom_vital_observe(temp_db):
    """
    WAYFINDER-V2-011: Crew Symptom (severity >= 3) + Coincident Autonomic Shift
    during nominal atmosphere (PCO2 < 4.5 mmHg) produces OBSERVE event.
    """
    temp_db.ensure_initialized()

    # Pre-seed 7-day historical vitals for ASTRO-01
    hist_ts = pd.date_range("2026-05-02T00:00:00Z", "2026-05-09T00:00:00Z", freq="30min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    hist_meas = []
    for ts in hist_ts:
        hist_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 65.0, "quality_status": "VALID", "is_synthetic": 1})
        hist_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 55.0, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(hist_meas))

    # Nominal CO2 telemetry: peak 2.4 mmHg (< 4.5 mmHg)
    env_ts = pd.date_range("2026-05-09T01:00:00Z", "2026-05-09T04:00:00Z", freq="15min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    env_df = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": env_ts,
        "value": [2.1, 2.2, 2.4, 2.3, 2.2, 2.1, 2.0, 2.1, 2.2, 2.3, 2.2, 2.1, 2.0],
        "quality_status": "VALID",
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(env_df)

    # Coincident autonomic shift: HR 85 bpm (Z >= 2.0), RMSSD 30 ms (Z <= -2.0)
    shift_ts = ["2026-05-09T02:10:00Z", "2026-05-09T02:15:00Z", "2026-05-09T02:20:00Z"]
    shift_meas = []
    for ts in shift_ts:
        shift_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 85.0, "quality_status": "VALID", "is_synthetic": 1})
        shift_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 30.0, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(shift_meas))

    # Severe headache symptom
    symptom = SymptomReport(
        report_id="SYM-NOMINAL-OBSERVE",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:15:00Z",
        reported_at="2026-05-09T03:00:00Z",
        cabin_module="Node 2",
        notes="Throbbing in nominal air",
        is_synthetic=False,
    )
    temp_db.insert_symptom_report(symptom)

    events = evaluate_exposure_events("ASTRO-01", temp_db, window_hours=4.0)
    target_event = next(e for e in events if e.symptom_report_id == "SYM-NOMINAL-OBSERVE")

    # Assert OBSERVE severity
    assert target_event.severity_level == SeverityLevel.OBSERVE
    assert "[OPERATIONAL HEALTH EVENT: OBSERVE]" in target_event.rationale
    assert MANDATORY_DISCLAIMER in target_event.rationale


def test_workout_during_co2_excursion_single_observe(temp_db):
    """
    WAYFINDER-V2-011: Contiguous 90-minute workout during authentic high CO2 excursion (>= 4.5 mmHg)
    produces exactly 1 OBSERVE event (not 18 individual events), spanning the full workout bout.
    """
    temp_db.ensure_initialized()

    # Pre-seed 7-day historical vitals for ASTRO-01
    hist_ts = pd.date_range("2026-05-02T00:00:00Z", "2026-05-09T00:00:00Z", freq="30min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    hist_meas = []
    for ts in hist_ts:
        hist_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 65.0, "quality_status": "VALID", "is_synthetic": 1})
        hist_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 55.0, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(hist_meas))

    # Ingest 90-minute workout (18 samples at 5 min): 14:00 to 15:25 UTC
    workout_ts = pd.date_range("2026-05-09T14:00:00Z", periods=18, freq="5min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    sine_wave = np.sin(np.linspace(0.1, np.pi - 0.1, 18))
    hr_vals = 65.0 + 65.0 * sine_wave
    rmssd_vals = 55.0 * np.exp(-0.012 * (65.0 * sine_wave))

    workout_meas = []
    for ts, hr, rmssd in zip(workout_ts, hr_vals, rmssd_vals):
        workout_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": hr, "quality_status": "VALID", "is_synthetic": 1})
        workout_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": rmssd, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(workout_meas))

    # Ingest elevated CO2 excursion coinciding with workout: peak 5.1 mmHg
    env_df = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": workout_ts,
        "value": [4.6 + 0.5 * s for s in sine_wave],
        "quality_status": "VALID",
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(env_df)

    # No symptoms reported
    events = evaluate_exposure_events("ASTRO-01", temp_db)

    # Filter workout events
    workout_events = [e for e in events if e.event_id.startswith("EVT-EXERTION-")]

    # Assert exactly 1 coalesced event produced for the workout bout
    assert len(workout_events) == 1
    w_event = workout_events[0]

    assert w_event.severity_level == SeverityLevel.OBSERVE
    assert w_event.event_type == "EXPOSURE_WORKOUT_DURING_CO2_EXCURSION"
    assert w_event.start_time == "2026-05-09T14:00:00Z"
    assert w_event.end_time == "2026-05-09T15:25:00Z"
    assert "Cabin PCO2 reached peak" in w_event.rationale
    assert "Heart Rate Z=" in w_event.rationale
    assert "RMSSD Z=" in w_event.rationale
    assert "without coincident symptoms" in w_event.rationale
    assert MANDATORY_DISCLAIMER in w_event.rationale


def test_non_causal_disclaimer_presence(temp_db):
    """
    WAYFINDER-V2-011 / WAYFINDER-V2-012: Verifies all generated HealthEvents across all
    severity levels (INVESTIGATE, OBSERVE, INFO) carry the non-causal decision-support disclaimer.
    """
    temp_db.ensure_initialized()

    # Create standalone excursion (INFO)
    timestamps = pd.date_range("2026-05-15T00:00:00Z", periods=6, freq="10min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    records = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": timestamps,
        "value": [3.2, 4.1, 4.2, 4.1, 3.8, 3.5],
        "quality_status": "VALID",
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(records)

    events = evaluate_exposure_events("ASTRO-01", temp_db)
    assert len(events) >= 1

    for evt in events:
        assert "Temporal overlap indicates co-occurrence only, not clinical causation" in evt.rationale
        assert "WAYFINDER does not diagnose pathologies or prescribe countermeasures" in evt.rationale


def test_routine_workout_in_nominal_co2_logged_as_info(temp_db):
    """
    V2 Spec Section 4.5 (lines 312-314): Routine scheduled countermeasure workout
    (Z_HR >= +2.0, Z_RMSSD <= -2.0, duration >= 15 min) occurring in nominal cabin atmosphere
    (P_CO2 < 4.5 mmHg) without coincident symptoms logs a single coalesced INFO event.
    """
    temp_db.ensure_initialized()

    # Pre-seed 7-day historical resting vitals for ASTRO-01 (May 2 - May 9)
    hist_ts = pd.date_range("2026-05-02T00:00:00Z", "2026-05-09T00:00:00Z", freq="30min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    hist_meas = []
    for ts in hist_ts:
        hist_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 65.0, "quality_status": "VALID", "is_synthetic": 1})
        hist_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": 55.0, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(hist_meas))

    # Ingest 90-minute workout on May 9: 14:00 to 15:25 UTC
    workout_ts = pd.date_range("2026-05-09T14:00:00Z", periods=18, freq="5min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    sine_wave = np.sin(np.linspace(0.1, np.pi - 0.1, 18))
    hr_vals = 65.0 + 65.0 * sine_wave
    rmssd_vals = 55.0 * np.exp(-0.012 * (65.0 * sine_wave))

    workout_meas = []
    for ts, hr, rmssd in zip(workout_ts, hr_vals, rmssd_vals):
        workout_meas.append({"stream_id": "stream_sim_hr", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": hr, "quality_status": "VALID", "is_synthetic": 1})
        workout_meas.append({"stream_id": "stream_sim_hrv", "astronaut_id": "ASTRO-01", "timestamp": ts, "value": rmssd, "quality_status": "VALID", "is_synthetic": 1})
    temp_db.insert_measurements_df(pd.DataFrame(workout_meas))

    # Ingest nominal ambient CO2 (2.2 - 2.8 mmHg, strictly < 4.5 mmHg)
    env_df = pd.DataFrame({
        "stream_id": "stream_eda_co2",
        "astronaut_id": None,
        "timestamp": workout_ts,
        "value": [2.2 + 0.3 * s for s in sine_wave],
        "quality_status": "VALID",
        "is_synthetic": 0,
    })
    temp_db.insert_measurements_df(env_df)

    # Evaluate exposure events without symptoms
    events = evaluate_exposure_events("ASTRO-01", temp_db)

    # Filter workout exertion events
    workout_events = [e for e in events if e.event_id.startswith("EVT-EXERTION-")]
    assert len(workout_events) == 1
    w_evt = workout_events[0]

    assert w_evt.severity_level == SeverityLevel.INFO
    assert w_evt.event_type == "AUTONOMIC_EXERTION"
    assert w_evt.start_time == "2026-05-09T14:00:00Z"
    assert w_evt.end_time == "2026-05-09T15:25:00Z"
    assert "Nominal cabin atmosphere" in w_evt.rationale
    assert "routine scheduled countermeasure exercise" in w_evt.rationale
    assert "Heart Rate Z=" in w_evt.rationale
    assert "RMSSD Z=" in w_evt.rationale
    assert MANDATORY_DISCLAIMER in w_evt.rationale

