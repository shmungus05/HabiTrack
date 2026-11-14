"""
wayfinder.core.baselines: Pure-Python circadian baseline engine.

Computes rolling hourly statistical distributions (mean, sample std, sample count, distinct days)
and evaluates continuous Z-score deviations against domain-calibrated physiological variance floors.
Zero cloud dependencies, zero external ML framework overhead.
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd

from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    CircadianBinStats,
    QualityStatus,
)

# Standard physiological streams tracked in WAYFINDER V2
DEFAULT_STREAMS: List[str] = [
    "stream_sim_hr",
    "stream_sim_hrv",
    "stream_sim_spo2",
    "stream_sim_temp",
]

# Prior standard deviations for fallback when sample size is insufficient (|K| <= 1)
PRIOR_STD: Dict[str, float] = {
    "hr": 4.0,       # bpm
    "rmssd": 6.0,    # ms
    "temp": 0.2,     # degC
    "spo2": 0.6,     # %
}
DEFAULT_PRIOR_STD: float = 1.0

# Physiological variance floors bounding min denominator to prevent runaway division-by-zero
PHYSIOLOGICAL_VARIANCE_FLOORS: Dict[str, float] = {
    "hr": 1.0,       # bpm
    "rmssd": 2.0,    # ms
    "temp": 0.10,    # degC
    "spo2": 0.50,    # %
}
DEFAULT_VARIANCE_FLOOR: float = 0.10

DEVIATION_Z_THRESHOLD: float = 2.0


def get_stream_type(stream_id: str) -> str:
    """Classifies a telemetry stream identifier into its physiological category."""
    s = stream_id.lower()
    if "rmssd" in s or "hrv" in s:
        return "rmssd"
    elif "hr" in s or "heart_rate" in s:
        return "hr"
    elif "spo2" in s:
        return "spo2"
    elif "temp" in s:
        return "temp"
    return "default"


def get_resting_baseline(astronaut: Astronaut, stream_id: str) -> float:
    """Retrieves an astronaut's individual resting baseline for a given stream."""
    st = get_stream_type(stream_id)
    if st == "hr":
        return float(astronaut.resting_hr)
    elif st == "rmssd":
        return float(astronaut.resting_rmssd)
    elif st == "spo2":
        return float(astronaut.resting_spo2)
    elif st == "temp":
        return float(astronaut.resting_temp)
    return 0.0


def get_prior_std(stream_id: str) -> float:
    """Retrieves domain prior standard deviation for a given stream."""
    st = get_stream_type(stream_id)
    return PRIOR_STD.get(st, DEFAULT_PRIOR_STD)


def get_variance_floor(stream_id: str) -> float:
    """Retrieves domain physiological variance floor for continuous Z-score evaluation."""
    st = get_stream_type(stream_id)
    return PHYSIOLOGICAL_VARIANCE_FLOORS.get(st, DEFAULT_VARIANCE_FLOOR)


def compute_circadian_hourly_bins(
    measurements_df: pd.DataFrame,
    astronaut: Astronaut,
    evaluation_time: Optional[str] = None,
    window_days: int = 7,
) -> Dict[Tuple[str, int], CircadianBinStats]:
    """
    Computes rolling circadian hourly statistical distributions across a historical window
    [T - W, T) for all telemetry streams of an astronaut.

    Parameters:
        measurements_df: Telemetry observations with columns [timestamp, stream_id, value, quality_status, astronaut_id].
        astronaut: Astronaut profile containing resting baselines and astronaut_id.
        evaluation_time: Evaluation anchor timestamp T (ISO string). If None, defaults to max(timestamp).
        window_days: Rolling historical window length W in calendar days (default: 7).

    Returns:
        Dict mapping (stream_id, hour_bin) -> CircadianBinStats for all 24 hours of each stream.
    """
    result: Dict[Tuple[str, int], CircadianBinStats] = {}

    # Identify candidate streams to evaluate
    if measurements_df is not None and not measurements_df.empty and "stream_id" in measurements_df.columns:
        raw_streams = measurements_df["stream_id"].dropna().unique().tolist()
        target_streams = sorted([str(s) for s in raw_streams if str(s).strip()])
        if not target_streams:
            target_streams = list(DEFAULT_STREAMS)
    else:
        target_streams = list(DEFAULT_STREAMS)

    # Short-circuit on empty input
    if measurements_df is None or measurements_df.empty or "timestamp" not in measurements_df.columns:
        for stream_id in target_streams:
            for h in range(24):
                result[(stream_id, h)] = CircadianBinStats(
                    stream_id=stream_id,
                    astronaut_id=astronaut.astronaut_id,
                    hour_bin=h,
                    mean=get_resting_baseline(astronaut, stream_id),
                    std=get_prior_std(stream_id),
                    sample_count=0,
                    distinct_days=0,
                    calibration_status=CalibrationStatus.CALIBRATING,
                )
        return result

    df = measurements_df.copy()
    df["_dt"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.dropna(subset=["_dt", "value"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["value"])

    if df.empty:
        for stream_id in target_streams:
            for h in range(24):
                result[(stream_id, h)] = CircadianBinStats(
                    stream_id=stream_id,
                    astronaut_id=astronaut.astronaut_id,
                    hour_bin=h,
                    mean=get_resting_baseline(astronaut, stream_id),
                    std=get_prior_std(stream_id),
                    sample_count=0,
                    distinct_days=0,
                    calibration_status=CalibrationStatus.CALIBRATING,
                )
        return result

    # Determine evaluation anchor T and window [T - W, T)
    if evaluation_time is not None:
        eval_dt = pd.to_datetime(evaluation_time, utc=True)
        window_start = eval_dt - pd.Timedelta(days=window_days)
        time_mask = (df["_dt"] >= window_start) & (df["_dt"] < eval_dt)
    else:
        eval_dt = df["_dt"].max()
        window_start = eval_dt - pd.Timedelta(days=window_days)
        time_mask = (df["_dt"] >= window_start) & (df["_dt"] <= eval_dt)

    # Filter quality_status == 'VALID'
    if "quality_status" in df.columns:
        quality_mask = df["quality_status"].astype(str) == QualityStatus.VALID.value
    else:
        quality_mask = pd.Series(True, index=df.index)

    # Filter astronaut_id
    if "astronaut_id" in df.columns:
        astro_mask = (
            df["astronaut_id"].isna()
            | (df["astronaut_id"] == "")
            | (df["astronaut_id"].astype(str) == astronaut.astronaut_id)
        )
    else:
        astro_mask = pd.Series(True, index=df.index)

    filtered = df[time_mask & quality_mask & astro_mask].copy()

    # If stream_id exists in filtered, extract hours and dates
    computed_bins: Dict[Tuple[str, int], CircadianBinStats] = {}
    if not filtered.empty and "stream_id" in filtered.columns:
        filtered["_hour"] = filtered["_dt"].dt.hour
        filtered["_date"] = filtered["_dt"].dt.date

        grouped = filtered.groupby(["stream_id", "_hour"])
        for (sid, h_bin), grp in grouped:
            stream_id_str = str(sid)
            hour_int = int(h_bin)
            sample_count = len(grp)
            distinct_days = int(grp["_date"].nunique())
            mean_val = float(grp["value"].mean())

            if sample_count > 1:
                sample_std = float(grp["value"].std(ddof=1))
                std_val = get_prior_std(stream_id_str) if np.isnan(sample_std) else sample_std
            else:
                std_val = get_prior_std(stream_id_str)

            if distinct_days >= 3 and sample_count >= 36:
                status = CalibrationStatus.CALIBRATED
            else:
                status = CalibrationStatus.CALIBRATING

            computed_bins[(stream_id_str, hour_int)] = CircadianBinStats(
                stream_id=stream_id_str,
                astronaut_id=astronaut.astronaut_id,
                hour_bin=hour_int,
                mean=mean_val,
                std=std_val,
                sample_count=sample_count,
                distinct_days=distinct_days,
                calibration_status=status,
            )

    # Ensure all 24 hour bins exist across all target streams
    for stream_id in target_streams:
        for h in range(24):
            key = (stream_id, h)
            if key in computed_bins:
                result[key] = computed_bins[key]
            else:
                result[key] = CircadianBinStats(
                    stream_id=stream_id,
                    astronaut_id=astronaut.astronaut_id,
                    hour_bin=h,
                    mean=get_resting_baseline(astronaut, stream_id),
                    std=get_prior_std(stream_id),
                    sample_count=0,
                    distinct_days=0,
                    calibration_status=CalibrationStatus.CALIBRATING,
                )

    return result


def evaluate_measurement_deviations(
    measurements_df: pd.DataFrame,
    bin_stats: Dict[Tuple[str, int], CircadianBinStats],
    astronaut: Astronaut,
) -> pd.DataFrame:
    """
    Enriches telemetry measurements with expected hourly circadian mean, standard deviation,
    instantaneous Z-score against domain physiological variance floors, and deviation boolean flag.

    Parameters:
        measurements_df: Observations DataFrame.
        bin_stats: Circadian hourly statistics mapping (stream_id, hour_bin) -> CircadianBinStats.
        astronaut: Astronaut profile providing fallback parameters.

    Returns:
        DataFrame enriched with [expected_mean, expected_std, z_score, is_statistical_deviation, calibration_status].
    """
    expected_cols = [
        "timestamp",
        "stream_id",
        "astronaut_id",
        "value",
        "expected_mean",
        "expected_std",
        "z_score",
        "is_statistical_deviation",
        "calibration_status",
    ]

    if measurements_df is None or measurements_df.empty:
        return pd.DataFrame(columns=expected_cols)

    df = measurements_df.copy()
    if "astronaut_id" not in df.columns:
        df["astronaut_id"] = astronaut.astronaut_id
    else:
        df["astronaut_id"] = df["astronaut_id"].fillna(astronaut.astronaut_id)

    dt_series = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    hours = dt_series.dt.hour.fillna(0).astype(int)
    stream_ids = df["stream_id"].astype(str)
    values = pd.to_numeric(df["value"], errors="coerce").fillna(0.0).to_numpy(dtype=float)

    n_rows = len(df)
    exp_means = np.zeros(n_rows, dtype=float)
    exp_stds = np.zeros(n_rows, dtype=float)
    floors = np.zeros(n_rows, dtype=float)
    cal_statuses = []

    for i, (sid, h) in enumerate(zip(stream_ids, hours)):
        stat = bin_stats.get((sid, h))
        if stat is not None:
            exp_means[i] = stat.mean
            exp_stds[i] = stat.std
            cal_statuses.append(
                stat.calibration_status.value
                if hasattr(stat.calibration_status, "value")
                else str(stat.calibration_status)
            )
        else:
            exp_means[i] = get_resting_baseline(astronaut, sid)
            exp_stds[i] = get_prior_std(sid)
            cal_statuses.append(CalibrationStatus.CALIBRATING.value)
        floors[i] = get_variance_floor(sid)

    effective_stds = np.maximum(exp_stds, floors)
    z_scores = (values - exp_means) / effective_stds
    is_deviations = np.abs(z_scores) >= DEVIATION_Z_THRESHOLD

    df["expected_mean"] = exp_means
    df["expected_std"] = exp_stds
    df["z_score"] = z_scores
    df["is_statistical_deviation"] = is_deviations
    df["calibration_status"] = cal_statuses

    return df
