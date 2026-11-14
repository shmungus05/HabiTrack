"""
wayfinder.core.simulation: Autonomous deterministic physiological vitals simulator.
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict
import numpy as np
import pandas as pd

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import (
    Astronaut,
    Measurement,
    QualityStatus,
    ProvenanceCategory,
)


def _derive_seed(astronaut_id: str, start_time: str) -> int:
    """Derives a deterministic 32-bit unsigned integer seed from astronaut ID and start time."""
    key = f"{astronaut_id}:{start_time}".encode("utf-8")
    digest = hashlib.sha256(key).digest()
    return int.from_bytes(digest[:4], byteorder="big")


def _compute_vitals_for_timestamp(
    dt: pd.Timestamp,
    astronaut: Astronaut,
    rng: np.random.RandomState,
) -> Dict[str, float]:
    """
    Computes deterministic physiological vitals for a single timestamp based on
    circadian diurnal models, scheduled countermeasure workouts, and resting baseline.
    """
    phi = astronaut.circadian_phase_shift_hours
    hour_of_day = dt.hour + dt.minute / 60.0 + dt.second / 3600.0

    # Scheduled 90-minute countermeasure workout (14:00 to 15:30 UTC for phi=0)
    delta_minutes = ((hour_of_day - (14.0 + phi)) % 24.0) * 60.0
    if 0.0 <= delta_minutes <= 90.0:
        delta_exertion = 65.0 * np.sin(np.pi * delta_minutes / 90.0)
    else:
        delta_exertion = 0.0

    # 1. Heart Rate (bpm): RestHR + 10.0*sin(2*pi*(hour - phi - 6)/24) + delta_exertion + eta_hr
    hr_noise = rng.normal(0.0, 1.0)
    hr_val = astronaut.resting_hr + 10.0 * np.sin(2.0 * np.pi * (hour_of_day - phi - 6.0) / 24.0) + delta_exertion + hr_noise
    hr_val = round(float(hr_val), 1)

    # 2. Non-Linear Inverse Autonomic RMSSD Coupling (ms):
    # RMSSD = RestRMSSD * exp(-0.012 * delta_exertion) - 8.0 * sin(2*pi*(hour - phi - 6)/24) + eta_rmssd, clamped to [15.0, 140.0]
    rmssd_noise = rng.normal(0.0, 1.5)
    rmssd_raw = (
        astronaut.resting_rmssd * np.exp(-0.012 * delta_exertion)
        - 8.0 * np.sin(2.0 * np.pi * (hour_of_day - phi - 6.0) / 24.0)
        + rmssd_noise
    )
    rmssd_val = round(float(np.clip(rmssd_raw, 15.0, 140.0)), 1)

    # 3. Core Body Temperature (degC):
    # Temp = RestTemp + 0.35 * sin(2*pi*(hour - phi - 9)/24) + 0.008 * delta_exertion + eta_temp
    temp_noise = rng.normal(0.0, 0.03)
    temp_raw = (
        astronaut.resting_temp
        + 0.35 * np.sin(2.0 * np.pi * (hour_of_day - phi - 9.0) / 24.0)
        + 0.008 * delta_exertion
        + temp_noise
    )
    temp_val = round(float(temp_raw), 2)

    # 4. Blood Oxygen Saturation (SpO2 %):
    # SpO2 = min(100.0, RestSpO2 - 0.4 * cos(2*pi*(hour - phi)/24) - 0.015 * delta_exertion + eta_spo2), clamped to [90.0, 100.0]
    spo2_noise = rng.normal(0.0, 0.2)
    spo2_raw = (
        astronaut.resting_spo2
        - 0.4 * np.cos(2.0 * np.pi * (hour_of_day - phi) / 24.0)
        - 0.015 * delta_exertion
        + spo2_noise
    )
    spo2_val = round(float(np.clip(spo2_raw, 90.0, 100.0)), 1)

    return {
        "stream_sim_hr": hr_val,
        "stream_sim_hrv": rmssd_val,
        "stream_sim_temp": temp_val,
        "stream_sim_spo2": spo2_val,
    }


def simulate_cohort_vitals_for_window(
    start_time: str,
    end_time: str,
    cohort_profiles: List[Astronaut],
    sample_interval_minutes: int = 5,
    eda_measurements_df: Optional[pd.DataFrame] = None,
) -> List[Measurement]:
    """
    Simulates multi-day deterministic physiological vitals for a cohort of astronauts.
    Generates 4 continuous streams per astronaut:
      - stream_sim_hr (bpm)
      - stream_sim_hrv (ms)
      - stream_sim_temp (degC)
      - stream_sim_spo2 (%)
    Synchronizes with EDA telemetry if provided, inheriting data gaps.
    """
    start_dt = pd.to_datetime(start_time, utc=True)
    end_dt = pd.to_datetime(end_time, utc=True)

    dt_range = pd.date_range(start=start_dt, end=end_dt, freq=f"{sample_interval_minutes}min", tz="UTC")
    timestamps = list(dt_range)
    ts_strs = [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in timestamps]

    gap_timestamps = set()
    if eda_measurements_df is not None and len(eda_measurements_df) > 0:
        gap_mask = eda_measurements_df["quality_status"].astype(str).str.upper() == QualityStatus.GAP.value
        gap_rows = eda_measurements_df[gap_mask]
        for ts in gap_rows["timestamp"]:
            gap_timestamps.add(pd.to_datetime(ts, utc=True).strftime("%Y-%m-%dT%H:%M:%SZ"))

    measurements: List[Measurement] = []

    for astronaut in cohort_profiles:
        seed = _derive_seed(astronaut.astronaut_id, start_time)
        rng = np.random.RandomState(seed)

        for dt, ts_str in zip(timestamps, ts_strs):
            is_gap = ts_str in gap_timestamps

            if is_gap:
                for stream_id in ["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"]:
                    measurements.append(
                        Measurement.model_construct(
                            stream_id=stream_id,
                            astronaut_id=astronaut.astronaut_id,
                            timestamp=ts_str,
                            value=0.0,
                            quality_status=QualityStatus.GAP,
                            is_synthetic=True,
                            provenance_category=ProvenanceCategory.SYNTHETIC_SIMULATION,
                        )
                    )
                continue

            vitals = _compute_vitals_for_timestamp(dt, astronaut, rng)

            for stream_id in ["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"]:
                measurements.append(
                    Measurement.model_construct(
                        stream_id=stream_id,
                        astronaut_id=astronaut.astronaut_id,
                        timestamp=ts_str,
                        value=vitals[stream_id],
                        quality_status=QualityStatus.VALID,
                        is_synthetic=True,
                        provenance_category=ProvenanceCategory.SYNTHETIC_SIMULATION,
                    )
                )

    return measurements


def generate_vitals(
    astronaut_id: str,
    start_time: str,
    end_time: str,
    seed: int = 42,
    storage_manager: Optional[StorageManager] = None,
) -> pd.DataFrame:
    """
    Generates deterministic physiological vitals (Heart Rate, HRV, SpO2, Core Temperature)
    driven by circadian rhythm and resting baseline for a single astronaut.
    Preserves backward compatibility with V1 API.
    """
    rng = np.random.RandomState(seed)

    start_dt = pd.to_datetime(start_time, utc=True)
    end_dt = pd.to_datetime(end_time, utc=True)

    astronaut: Optional[Astronaut] = None
    if storage_manager is not None:
        astronaut = storage_manager.get_astronaut(astronaut_id)

    if astronaut is None:
        astronaut = Astronaut(
            astronaut_id=astronaut_id,
            callsign=astronaut_id,
            mission_id="Ex-71",
            crew_role="Crew",
            resting_hr=65.0,
            resting_rmssd=55.0,
            resting_spo2=98.0,
            resting_temp=37.0,
            circadian_phase_shift_hours=0.0,
        )

    timestamps: List[pd.Timestamp] = []
    gap_flags: List[bool] = []

    if storage_manager is not None:
        eda_df = storage_manager.get_measurements_df(
            stream_ids=["stream_eda_co2"],
            start_time=start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end_time=end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
        if len(eda_df) > 0:
            eda_df = eda_df.sort_values("timestamp").reset_index(drop=True)
            for _, row in eda_df.iterrows():
                dt = pd.to_datetime(row["timestamp"], utc=True)
                timestamps.append(dt)
                gap_flags.append(str(row["quality_status"]).upper() == QualityStatus.GAP.value)

    if len(timestamps) == 0:
        dt_range = pd.date_range(start=start_dt, end=end_dt, freq="5min", tz="UTC")
        timestamps = list(dt_range)
        gap_flags = [False] * len(timestamps)

    records: List[Dict] = []

    for dt, is_gap in zip(timestamps, gap_flags):
        ts_str = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        if is_gap:
            for stream_id in ["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"]:
                records.append({
                    "stream_id": stream_id,
                    "astronaut_id": astronaut_id,
                    "timestamp": ts_str,
                    "value": 0.0,
                    "quality_status": QualityStatus.GAP.value,
                    "is_synthetic": 1,
                })
            continue

        vitals = _compute_vitals_for_timestamp(dt, astronaut, rng)

        for stream_id in ["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"]:
            records.append({
                "stream_id": stream_id,
                "astronaut_id": astronaut_id,
                "timestamp": ts_str,
                "value": vitals[stream_id],
                "quality_status": QualityStatus.VALID.value,
                "is_synthetic": 1,
            })

    vitals_df = pd.DataFrame(records)

    if storage_manager is not None and len(vitals_df) > 0:
        storage_manager.insert_measurements_df(vitals_df)

    return vitals_df
