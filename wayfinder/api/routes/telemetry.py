"""wayfinder.api.routes.telemetry: Cohort-scoped decimated telemetry and baseline envelopes."""

from __future__ import annotations

import re
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from wayfinder.api.deps import get_storage
from wayfinder.core.analytics import decimate_time_series
from wayfinder.core.baselines import compute_circadian_hourly_bins
from wayfinder.core.models import Measurement
from wayfinder.core.storage import StorageManager

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

TELEMETRY_STREAMS = [
    "stream_eda_co2",
    "stream_eda_temp",
    "stream_eda_pressure",
    "stream_sim_hr",
    "stream_sim_hrv",
    "stream_sim_spo2",
    "stream_sim_temp",
]


_CANONICAL_TS = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")


def _iso_timestamp(value: Any) -> str:
    """Normalizes DB/datetime timestamps to the canonical UTC string format.

    Most rows already hold the canonical form, so return those untouched.
    Parsing each one through pandas costs ~1.5 ms per row and dominated the
    endpoint's response time at 7k points.
    """
    if isinstance(value, str):
        if len(value) == 20 and _CANONICAL_TS.fullmatch(value):
            return value
        try:
            return pd.to_datetime(value, utc=True).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, TypeError):
            return value
    return pd.to_datetime(value, utc=True).strftime("%Y-%m-%dT%H:%M:%SZ")


def _latest_timestamp(storage: StorageManager, astronaut_id: str) -> str | None:
    placeholders = ",".join("?" for _ in TELEMETRY_STREAMS)
    with storage.get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT MAX(timestamp) AS latest
            FROM measurements
            WHERE stream_id IN ({placeholders})
              AND (astronaut_id = ? OR astronaut_id IS NULL);
            """,
            (*TELEMETRY_STREAMS, astronaut_id),
        ).fetchone()
    return row["latest"] if row and row["latest"] else None


@router.get("/measurements", response_model=List[Measurement])
def get_measurements(
    astronaut_id: str = Query(..., description="Cohort astronaut identifier"),
    window_hours: int = Query(72, ge=1, le=24 * 365),
    max_points: int = Query(1000, ge=3, le=10000),
    storage: StorageManager = Depends(get_storage),
) -> List[Measurement]:
    """Returns LTTB-decimated environmental and physiological telemetry traces."""
    if storage.get_astronaut(astronaut_id) is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    latest = _latest_timestamp(storage, astronaut_id)
    if latest is None:
        return []

    end_time = pd.to_datetime(latest, utc=True)
    start_time = end_time - pd.Timedelta(hours=window_hours)
    frame = storage.get_measurements_df(
        TELEMETRY_STREAMS,
        start_time=start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end_time=end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        astronaut_id=astronaut_id,
    )
    if frame.empty:
        return []

    measurements: List[Measurement] = []
    for stream_id, group in frame.groupby("stream_id", sort=True):
        decimated = decimate_time_series(group, max_points=max_points)
        for record in decimated.to_dict("records"):
            astronaut_value = record.get("astronaut_id")
            if astronaut_value is None or pd.isna(astronaut_value):
                astronaut_value = None
            measurements.append(
                Measurement(
                    id=int(record["id"]) if record.get("id") is not None else None,
                    stream_id=stream_id,
                    astronaut_id=astronaut_value,
                    timestamp=_iso_timestamp(record["timestamp"]),
                    value=float(record["value"]),
                    quality_status=record["quality_status"],
                    is_synthetic=bool(record["is_synthetic"]),
                )
            )

    return sorted(measurements, key=lambda item: (item.stream_id, item.timestamp))


@router.get("/baselines", response_model=Dict[str, List[Dict[str, Any]]])
def get_baselines(
    astronaut_id: str = Query(..., description="Cohort astronaut identifier"),
    storage: StorageManager = Depends(get_storage),
) -> Dict[str, List[Dict[str, Any]]]:
    """Returns hourly circadian envelopes (mu +/- 2 sigma) per stream."""
    astronaut = storage.get_astronaut(astronaut_id)
    if astronaut is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    frame = storage.get_measurements_df(TELEMETRY_STREAMS, astronaut_id=astronaut_id)
    if frame.empty:
        return {}

    bins = compute_circadian_hourly_bins(frame, astronaut)
    envelopes: Dict[str, List[Dict[str, Any]]] = {}
    for (stream_id, hour_bin), stats in sorted(bins.items()):
        if stats.sample_count <= 0:
            continue
        envelopes.setdefault(stream_id, []).append(
            {
                "hour_bin": hour_bin,
                "timestamp": f"1970-01-01T{hour_bin:02d}:00:00Z",
                "mean": float(stats.mean),
                "std": float(stats.std),
                "upper": float(stats.mean + 2.0 * stats.std),
                "lower": float(stats.mean - 2.0 * stats.std),
                "sample_count": int(stats.sample_count),
                "distinct_days": int(stats.distinct_days),
                "calibration_status": stats.calibration_status.value,
            }
        )

    return envelopes
