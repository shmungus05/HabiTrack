"""wayfinder.provision: bootstrap the Expedition 71 demonstration dataset.

The V3 application service serves whatever is stored in ``data/wayfinder.db``;
it never synthesizes telemetry on request. A database that was only partially
seeded (for example by a single-cohort test run or an older V1 session) leaves
``ASTRO-02`` and ``ASTRO-03`` without simulated vitals, so switching cohorts in
the console renders empty KPI cards, empty timeline lanes, and no RMSSD trace.

This module provisions the canonical 14-day Expedition 71 scenario used by the
V2/V3 test harnesses:

1. Tiles the authentic NASA EDA sample across MET Days 120-134.
2. Deterministically simulates 5-minute HR, RMSSD, SpO2, and core temperature
   for the full three-person cohort.
3. Injects the Day 127 02:15 UTC cabin P_CO2 excursion, the Commander's
   coincident autonomic shift, and the crew-reported headache.
4. Evaluates tripartite concordance so ``/api/events`` returns persisted events.
5. Rebuilds the FTS5 research index.

Usage::

    python -m wayfinder.provision            # reseed data/wayfinder.db
    python -m wayfinder.provision --keep-existing
    python -m wayfinder.provision --db other.db --no-backup
"""

from __future__ import annotations

import argparse
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import pandas as pd

from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.core.flight_rules import seed_flight_rules
from wayfinder.core.ingestion import calculate_co2_partial_pressure
from wayfinder.core.models import Astronaut, QualityStatus, SymptomReport
from wayfinder.core.rag import index_research_corpus
from wayfinder.core.simulation import simulate_cohort_vitals_for_window
from wayfinder.core.storage import DEFAULT_DB_PATH, StorageManager

REPO_ROOT = Path(__file__).resolve().parents[1]
EDA_CSV_PATH = REPO_ROOT / "data" / "sample_eda_iss_co2_temp.csv"
RESEARCH_CORPUS_DIR = REPO_ROOT / "data" / "research_corpus"

MISSION_START = "2026-07-01T00:00:00Z"
MISSION_END = "2026-07-14T23:59:59Z"
EXCURSION_TIMESTAMP = "2026-07-08T02:15:00Z"
EXCURSION_CO2_MMHG = 5.8
EXCURSION_MODULE = "Node 2"
SAMPLE_INTERVAL_MINUTES = 5

COHORT_IDS = ("ASTRO-01", "ASTRO-02", "ASTRO-03")
VITALS_STREAMS = (
    "stream_sim_hr",
    "stream_sim_hrv",
    "stream_sim_temp",
    "stream_sim_spo2",
)


@dataclass
class ProvisionSummary:
    """Counts describing what the provisioning run wrote to the database."""

    environment_rows: int
    vitals_rows: int
    events: int
    symptoms: int
    indexed_documents: int


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def backup_database(db_path: str | Path) -> Optional[Path]:
    """Copies an existing SQLite database (WAL-safe) next to the original."""
    source = Path(db_path)
    if not source.exists():
        return None
    destination = source.with_name(f"{source.name}.bak-{_utc_stamp()}")
    with sqlite3.connect(source) as src, sqlite3.connect(destination) as dst:
        src.backup(dst)
    return destination


def reset_mission_data(storage: StorageManager) -> None:
    """Clears derived mission data while preserving profiles and vector seeds."""
    with storage.get_connection() as conn:
        conn.execute("DELETE FROM assistant_audit_logs;")
        conn.execute("DELETE FROM health_events;")
        conn.execute("DELETE FROM symptom_reports;")
        conn.execute("DELETE FROM measurements;")


def _cohort_profiles(storage: StorageManager) -> List[Astronaut]:
    cohort = [storage.get_astronaut(astronaut_id) for astronaut_id in COHORT_IDS]
    missing = [astronaut_id for astronaut_id, profile in zip(COHORT_IDS, cohort) if profile is None]
    if missing:
        raise RuntimeError(
            "Authoritative cohort profiles are missing from storage: "
            + ", ".join(missing)
        )
    return [profile for profile in cohort if profile is not None]


def _tile_environment_telemetry(storage: StorageManager) -> int:
    """Tiles the authentic EDA sample across the 14-day mission window."""
    sample = pd.read_csv(EDA_CSV_PATH)
    timestamps = pd.date_range(
        MISSION_START,
        "2026-07-14T23:55:00Z",
        freq=f"{SAMPLE_INTERVAL_MINUTES}min",
        tz="UTC",
    )
    pressure = sample["cabin_pressure_kpa"].to_numpy(dtype=float)
    temperature = sample["cabin_temp_c"].to_numpy(dtype=float)
    co2_ppm = sample["cabin_co2_ppm"].to_numpy(dtype=float)
    sample_count = len(sample)

    records = []
    for index, timestamp in enumerate(timestamps):
        sample_index = index % sample_count
        cabin_pressure = pressure[sample_index]
        ambient_ppm = min(max(co2_ppm[sample_index], 3500.0), 3950.0)
        co2_mmhg = round(
            calculate_co2_partial_pressure(ambient_ppm, cabin_pressure), 4
        )
        stamp = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")

        records.append(
            ("stream_eda_co2", None, stamp, co2_mmhg, QualityStatus.VALID.value, 0)
        )
        records.append(
            (
                "stream_eda_temp",
                None,
                stamp,
                round(temperature[sample_index], 2),
                QualityStatus.VALID.value,
                0,
            )
        )
        records.append(
            (
                "stream_eda_pressure",
                None,
                stamp,
                round(cabin_pressure, 2),
                QualityStatus.VALID.value,
                0,
            )
        )

    with storage.get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO measurements
            (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            records,
        )
    return len(records)


def _simulate_cohort_vitals(storage: StorageManager) -> int:
    """Generates deterministic 5-minute vitals for every cohort member."""
    measurements = simulate_cohort_vitals_for_window(
        start_time=MISSION_START,
        end_time=MISSION_END,
        cohort_profiles=_cohort_profiles(storage),
        sample_interval_minutes=SAMPLE_INTERVAL_MINUTES,
    )
    records = [
        (
            item.stream_id,
            item.astronaut_id,
            item.timestamp,
            float(item.value),
            item.quality_status.value
            if hasattr(item.quality_status, "value")
            else str(item.quality_status),
            int(item.is_synthetic),
        )
        for item in measurements
    ]
    with storage.get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO measurements
            (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            records,
        )
    return len(records)


def _inject_day127_excursion(storage: StorageManager) -> SymptomReport:
    """Writes the Day 127 cabin excursion, autonomic shift, and symptom report."""
    shift_timestamps = [
        "2026-07-08T02:05:00Z",
        "2026-07-08T02:10:00Z",
        "2026-07-08T02:15:00Z",
        "2026-07-08T02:20:00Z",
    ]
    with storage.get_connection() as conn:
        conn.execute(
            """
            UPDATE measurements
            SET value = ?
            WHERE stream_id = 'stream_eda_co2' AND timestamp = ?;
            """,
            (EXCURSION_CO2_MMHG, EXCURSION_TIMESTAMP),
        )
        for timestamp in shift_timestamps:
            conn.execute(
                """
                UPDATE measurements
                SET value = 85.0
                WHERE stream_id = 'stream_sim_hr'
                  AND astronaut_id = 'ASTRO-01'
                  AND timestamp = ?;
                """,
                (timestamp,),
            )
            conn.execute(
                """
                UPDATE measurements
                SET value = 30.0
                WHERE stream_id = 'stream_sim_hrv'
                  AND astronaut_id = 'ASTRO-01'
                  AND timestamp = ?;
                """,
                (timestamp,),
            )

    symptom = SymptomReport(
        report_id="SYM-DAY127-01",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at=EXCURSION_TIMESTAMP,
        reported_at="2026-07-08T03:15:00Z",
        cabin_module=EXCURSION_MODULE,
        notes="Bilateral throbbing headache onset during evening rest period.",
        is_synthetic=False,
    )
    storage.insert_symptom_report(symptom)
    return symptom


def _evaluate_concordance(storage: StorageManager) -> int:
    """Persists derived concordance events for every cohort member."""
    total = 0
    for astronaut_id in COHORT_IDS:
        total += len(evaluate_exposure_events(astronaut_id, storage, window_hours=4.0))
    return total


def provision_mission(storage: StorageManager, reset: bool = True) -> ProvisionSummary:
    """Provisions the full Expedition 71 scenario into ``storage``."""
    storage.ensure_initialized()
    if reset:
        reset_mission_data(storage)

    environment_rows = _tile_environment_telemetry(storage)
    vitals_rows = _simulate_cohort_vitals(storage)
    symptom = _inject_day127_excursion(storage)
    events = _evaluate_concordance(storage)
    indexed_documents = index_research_corpus(RESEARCH_CORPUS_DIR, storage)
    seed_flight_rules(storage)

    return ProvisionSummary(
        environment_rows=environment_rows,
        vitals_rows=vitals_rows,
        events=events,
        symptoms=1 if symptom else 0,
        indexed_documents=indexed_documents,
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Provision the WAYFINDER Expedition 71 demonstration dataset."
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Append to existing mission data instead of clearing it first.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip the automatic pre-reseed database backup.",
    )
    args = parser.parse_args(argv)

    backup_path: Optional[Path] = None
    if not args.keep_existing and not args.no_backup:
        backup_path = backup_database(args.db)
        if backup_path is not None:
            print(f"Backed up existing database to {backup_path}")

    storage = StorageManager(db_path=args.db)
    summary = provision_mission(storage, reset=not args.keep_existing)

    print(f"Database:            {args.db}")
    print(f"Environment rows:    {summary.environment_rows}")
    print(f"Vitals rows:         {summary.vitals_rows}")
    print(f"Concordance events:  {summary.events}")
    print(f"Symptom reports:     {summary.symptoms}")
    print(f"Indexed documents:   {summary.indexed_documents}")
    print("Expedition 71 dataset provisioned. Start the console with:")
    print("  python -m wayfinder.server")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
