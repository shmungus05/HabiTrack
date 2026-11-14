"""
tests.test_baselines: Comprehensive unit test suite for the pure-Python circadian baseline engine.
Covers hourly binning distributions, rolling window exclusions, fallback priors,
sparse-history calibration guard transitions, and physiological variance floor clamping.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta

from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    CircadianBinStats,
    QualityStatus,
)
from wayfinder.core.baselines import (
    compute_circadian_hourly_bins,
    evaluate_measurement_deviations,
    get_variance_floor,
    get_prior_std,
    get_resting_baseline,
)


@pytest.fixture
def default_astronaut() -> Astronaut:
    return Astronaut(
        astronaut_id="ASTRO-01",
        callsign="CDR M. Vance",
        mission_id="EXP-71",
        crew_role="Commander",
        resting_hr=65.0,
        resting_rmssd=55.0,
        resting_spo2=98.0,
        resting_temp=37.0,
        circadian_phase_shift_hours=0.0,
        baseline_window_days=7,
        calibration_status=CalibrationStatus.CALIBRATING,
    )


def test_hourly_binning_distribution(default_astronaut):
    """Verify measurements at 02:15 and 02:45 map to hour bin 2 with correct mean and sample std."""
    df = pd.DataFrame([
        {
            "timestamp": "2026-05-01T02:15:00Z",
            "stream_id": "stream_sim_hr",
            "value": 70.0,
            "quality_status": QualityStatus.VALID.value,
            "astronaut_id": "ASTRO-01",
        },
        {
            "timestamp": "2026-05-01T02:45:00Z",
            "stream_id": "stream_sim_hr",
            "value": 74.0,
            "quality_status": QualityStatus.VALID.value,
            "astronaut_id": "ASTRO-01",
        },
    ])

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time="2026-05-01T03:00:00Z",
        window_days=7,
    )

    # Bin for hour 2 should have mean = 72.0 and sample std (ddof=1) = sqrt(( (70-72)^2 + (74-72)^2 ) / 1) = sqrt(8) ~ 2.8284
    bin_2 = bins[("stream_sim_hr", 2)]
    assert bin_2.sample_count == 2
    assert bin_2.distinct_days == 1
    assert bin_2.mean == pytest.approx(72.0, rel=1e-4)
    assert bin_2.std == pytest.approx(np.sqrt(8.0), rel=1e-4)
    assert bin_2.calibration_status == CalibrationStatus.CALIBRATING

    # Bin for hour 0 should exist with fallback values
    bin_0 = bins[("stream_sim_hr", 0)]
    assert bin_0.sample_count == 0
    assert bin_0.distinct_days == 0
    assert bin_0.mean == default_astronaut.resting_hr
    assert bin_0.std == 4.0
    assert bin_0.calibration_status == CalibrationStatus.CALIBRATING


def test_rolling_window_exclusion(default_astronaut):
    """Confirm measurements outside [T - W, T) are excluded, preventing historical decay and future leakage."""
    eval_time = "2026-05-08T12:00:00Z"  # T
    # Window W = 7 days => [2026-05-01T12:00:00Z, 2026-05-08T12:00:00Z)

    df = pd.DataFrame([
        # 8 days prior: outside window (< T - W) -> EXCLUDED
        {
            "timestamp": "2026-04-30T11:59:59Z",
            "stream_id": "stream_sim_hr",
            "value": 120.0,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        },
        # Exactly at T - W: INCLUDED
        {
            "timestamp": "2026-05-01T12:00:00Z",
            "stream_id": "stream_sim_hr",
            "value": 68.0,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        },
        # Inside window: INCLUDED
        {
            "timestamp": "2026-05-05T12:30:00Z",
            "stream_id": "stream_sim_hr",
            "value": 72.0,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        },
        # Exactly at evaluation time T: EXCLUDED (strict upper bound t < T)
        {
            "timestamp": "2026-05-08T12:00:00Z",
            "stream_id": "stream_sim_hr",
            "value": 130.0,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        },
        # Future timestamp > T: EXCLUDED
        {
            "timestamp": "2026-05-08T13:00:00Z",
            "stream_id": "stream_sim_hr",
            "value": 140.0,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        },
    ])

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time=eval_time,
        window_days=7,
    )

    bin_12 = bins[("stream_sim_hr", 12)]
    # Only 2 measurements inside window at hour 12: 68.0 and 72.0
    assert bin_12.sample_count == 2
    assert bin_12.mean == pytest.approx(70.0, rel=1e-4)

    # Hour 13 should have 0 samples because 13:00 was future data
    bin_13 = bins[("stream_sim_hr", 13)]
    assert bin_13.sample_count == 0


def test_resting_fallbacks_and_priors(default_astronaut):
    """Empty dataset defaults to astronaut resting baselines and domain-specified prior stds."""
    empty_df = pd.DataFrame(columns=["timestamp", "stream_id", "value", "quality_status", "astronaut_id"])

    bins = compute_circadian_hourly_bins(
        measurements_df=empty_df,
        astronaut=default_astronaut,
    )

    # Standard streams must all have 24 bins
    expected_streams = ["stream_sim_hr", "stream_sim_hrv", "stream_sim_spo2", "stream_sim_temp"]
    for stream_id in expected_streams:
        for hour in range(24):
            key = (stream_id, hour)
            assert key in bins
            b = bins[key]
            assert b.sample_count == 0
            assert b.distinct_days == 0
            assert b.calibration_status == CalibrationStatus.CALIBRATING

    # Check resting baselines and priors
    assert bins[("stream_sim_hr", 0)].mean == default_astronaut.resting_hr
    assert bins[("stream_sim_hr", 0)].std == 4.0

    assert bins[("stream_sim_hrv", 0)].mean == default_astronaut.resting_rmssd
    assert bins[("stream_sim_hrv", 0)].std == 6.0

    assert bins[("stream_sim_spo2", 0)].mean == default_astronaut.resting_spo2
    assert bins[("stream_sim_spo2", 0)].std == 0.6

    assert bins[("stream_sim_temp", 0)].mean == default_astronaut.resting_temp
    assert bins[("stream_sim_temp", 0)].std == 0.2


def test_single_sample_prior_std_fallback(default_astronaut):
    """When an hour bin contains exactly one observation (|K|=1), std falls back to prior std."""
    df = pd.DataFrame([
        {
            "timestamp": "2026-05-02T04:10:00Z",
            "stream_id": "stream_sim_hr",
            "value": 82.5,
            "quality_status": "VALID",
            "astronaut_id": "ASTRO-01",
        }
    ])

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time="2026-05-02T05:00:00Z",
    )

    bin_4 = bins[("stream_sim_hr", 4)]
    assert bin_4.sample_count == 1
    assert bin_4.distinct_days == 1
    assert bin_4.mean == 82.5
    # For HR, prior std is 4.0
    assert bin_4.std == 4.0
    assert bin_4.calibration_status == CalibrationStatus.CALIBRATING


def test_sparse_history_calibrating_status(default_astronaut):
    """Window with < 3 distinct days or < 36 samples remains in CALIBRATING status."""
    # Case A: 40 samples but only across 2 distinct days
    day1_times = pd.date_range("2026-05-01T10:00:00Z", periods=20, freq="2min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    day2_times = pd.date_range("2026-05-02T10:00:00Z", periods=20, freq="2min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    
    rows_a = [
        {"timestamp": t, "stream_id": "stream_sim_hr", "value": 65.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"}
        for t in list(day1_times) + list(day2_times)
    ]
    df_a = pd.DataFrame(rows_a)

    bins_a = compute_circadian_hourly_bins(
        measurements_df=df_a,
        astronaut=default_astronaut,
        evaluation_time="2026-05-03T00:00:00Z",
    )
    # Hour 10 has 40 samples, but only 2 distinct days -> CALIBRATING
    assert bins_a[("stream_sim_hr", 10)].sample_count == 40
    assert bins_a[("stream_sim_hr", 10)].distinct_days == 2
    assert bins_a[("stream_sim_hr", 10)].calibration_status == CalibrationStatus.CALIBRATING

    # Case B: 3 distinct days, but only 10 samples total (< 36)
    rows_b = [
        {"timestamp": "2026-05-01T10:00:00Z", "stream_id": "stream_sim_hr", "value": 65.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-02T10:00:00Z", "stream_id": "stream_sim_hr", "value": 66.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-03T10:00:00Z", "stream_id": "stream_sim_hr", "value": 67.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"},
    ]
    df_b = pd.DataFrame(rows_b)
    bins_b = compute_circadian_hourly_bins(
        measurements_df=df_b,
        astronaut=default_astronaut,
        evaluation_time="2026-05-04T00:00:00Z",
    )
    assert bins_b[("stream_sim_hr", 10)].sample_count == 3
    assert bins_b[("stream_sim_hr", 10)].distinct_days == 3
    assert bins_b[("stream_sim_hr", 10)].calibration_status == CalibrationStatus.CALIBRATING


def test_calibrated_status_transition(default_astronaut):
    """Window with >= 3 distinct days AND >= 36 samples transitions to CALIBRATED."""
    # 12 samples per day across 3 distinct days in hour 14 = 36 samples, 3 days
    times = []
    for day in [1, 2, 3]:
        d_times = pd.date_range(f"2026-05-0{day}T14:00:00Z", periods=12, freq="4min", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
        times.extend(list(d_times))

    rows = [
        {"timestamp": t, "stream_id": "stream_sim_hr", "value": 65.0 + (i % 5), "quality_status": "VALID", "astronaut_id": "ASTRO-01"}
        for i, t in enumerate(times)
    ]
    df = pd.DataFrame(rows)

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time="2026-05-04T00:00:00Z",
    )

    bin_14 = bins[("stream_sim_hr", 14)]
    assert bin_14.sample_count == 36
    assert bin_14.distinct_days == 3
    assert bin_14.calibration_status == CalibrationStatus.CALIBRATED


def test_quality_status_filtering(default_astronaut):
    """Only VALID telemetry is incorporated into baseline estimates; SUSPECT/GAP/STALE are dropped."""
    df = pd.DataFrame([
        {"timestamp": "2026-05-01T08:00:00Z", "stream_id": "stream_sim_hr", "value": 70.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-01T08:10:00Z", "stream_id": "stream_sim_hr", "value": 180.0, "quality_status": "SUSPECT", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-01T08:20:00Z", "stream_id": "stream_sim_hr", "value": 0.0, "quality_status": "GAP", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-01T08:30:00Z", "stream_id": "stream_sim_hr", "value": 190.0, "quality_status": "STALE", "astronaut_id": "ASTRO-01"},
    ])

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time="2026-05-01T09:00:00Z",
    )

    bin_8 = bins[("stream_sim_hr", 8)]
    assert bin_8.sample_count == 1
    assert bin_8.mean == 70.0


def test_astronaut_cohort_isolation(default_astronaut):
    """Measurements belonging to a different astronaut are strictly filtered out."""
    df = pd.DataFrame([
        {"timestamp": "2026-05-01T09:00:00Z", "stream_id": "stream_sim_hr", "value": 60.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"},
        {"timestamp": "2026-05-01T09:10:00Z", "stream_id": "stream_sim_hr", "value": 95.0, "quality_status": "VALID", "astronaut_id": "ASTRO-02"},
        {"timestamp": "2026-05-01T09:20:00Z", "stream_id": "stream_sim_hr", "value": 62.0, "quality_status": "VALID", "astronaut_id": None},
    ])

    bins = compute_circadian_hourly_bins(
        measurements_df=df,
        astronaut=default_astronaut,
        evaluation_time="2026-05-01T10:00:00Z",
    )

    bin_9 = bins[("stream_sim_hr", 9)]
    # ASTRO-01 (60.0) and unassigned None (62.0) are included; ASTRO-02 (95.0) is excluded
    assert bin_9.sample_count == 2
    assert bin_9.mean == pytest.approx(61.0, rel=1e-4)


def test_variance_floor_clamping(default_astronaut):
    """Zero-variance series bounds std by physiological variance floors, preventing division-by-zero."""
    # HR variance floor is 1.0 bpm
    assert get_variance_floor("stream_sim_hr") == 1.0
    assert get_variance_floor("stream_sim_hrv") == 2.0
    assert get_variance_floor("stream_sim_temp") == 0.10
    assert get_variance_floor("stream_sim_spo2") == 0.50

    # 5 identical samples in hour 11 -> std = 0.0
    df_hist = pd.DataFrame([
        {"timestamp": f"2026-05-01T11:{10+i*5:02d}:00Z", "stream_id": "stream_sim_hr", "value": 70.0, "quality_status": "VALID", "astronaut_id": "ASTRO-01"}
        for i in range(5)
    ])
    bins = compute_circadian_hourly_bins(df_hist, default_astronaut, evaluation_time="2026-05-01T12:00:00Z")
    assert bins[("stream_sim_hr", 11)].std == 0.0

    # Evaluate new observation at 11:30 with value 73.0
    eval_df = pd.DataFrame([
        {"timestamp": "2026-05-01T11:30:00Z", "stream_id": "stream_sim_hr", "value": 73.0, "astronaut_id": "ASTRO-01"}
    ])
    dev_df = evaluate_measurement_deviations(eval_df, bins, default_astronaut)

    # Z = (73.0 - 70.0) / max(0.0, 1.0) = 3.0
    assert len(dev_df) == 1
    row = dev_df.iloc[0]
    assert row["expected_mean"] == 70.0
    assert row["expected_std"] == 0.0
    assert row["z_score"] == pytest.approx(3.0, rel=1e-4)
    assert row["is_statistical_deviation"] is True or row["is_statistical_deviation"] == 1


def test_statistical_deviation_thresholds(default_astronaut):
    """Z-scores with |Z| >= 2.0 flag is_statistical_deviation as True; |Z| < 2.0 flag as False."""
    bin_stats = {
        ("stream_sim_hr", 12): CircadianBinStats(
            stream_id="stream_sim_hr",
            astronaut_id="ASTRO-01",
            hour_bin=12,
            mean=70.0,
            std=5.0,
            sample_count=50,
            distinct_days=5,
            calibration_status=CalibrationStatus.CALIBRATED,
        )
    }

    test_df = pd.DataFrame([
        {"timestamp": "2026-05-08T12:00:00Z", "stream_id": "stream_sim_hr", "value": 75.0, "astronaut_id": "ASTRO-01"}, # Z = +1.0 -> False
        {"timestamp": "2026-05-08T12:10:00Z", "stream_id": "stream_sim_hr", "value": 80.0, "astronaut_id": "ASTRO-01"}, # Z = +2.0 -> True
        {"timestamp": "2026-05-08T12:20:00Z", "stream_id": "stream_sim_hr", "value": 59.0, "astronaut_id": "ASTRO-01"}, # Z = -2.2 -> True
    ])

    enriched = evaluate_measurement_deviations(test_df, bin_stats, default_astronaut)
    assert len(enriched) == 3
    assert enriched.iloc[0]["is_statistical_deviation"] == False
    assert enriched.iloc[1]["is_statistical_deviation"] == True
    assert enriched.iloc[2]["is_statistical_deviation"] == True
