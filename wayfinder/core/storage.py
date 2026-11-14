"""
wayfinder.core.storage: Thread-safe SQLite persistence manager and DDL migrations for WAYFINDER.
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
import logging
import numpy as np
import pandas as pd
from wayfinder.core.models import (
    Astronaut,
    AssistantAuditLog,
    CalibrationStatus,
    DataSource,
    TelemetryStream,
    Measurement,
    SymptomReport,
    HealthEvent,
    ProvenanceCategory,
    QualityStatus,
    MetricCategory,
    SeverityLevel,
    UncertaintyLevel,
    ReviewStatus,
    FlightRule,
    ChecklistStep,
    SeverityTrigger,
)

_BASE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "wayfinder.db")
_ENV_DB_PATH = os.environ.get("WAYFINDER_DB_PATH")

if _ENV_DB_PATH:
    DEFAULT_DB_PATH = _ENV_DB_PATH
elif os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    _TMP_DB = "/tmp/wayfinder.db"
    if not os.path.exists(_TMP_DB) and os.path.exists(_BASE_DB_PATH):
        import shutil
        try:
            shutil.copyfile(_BASE_DB_PATH, _TMP_DB)
        except Exception:
            pass
    DEFAULT_DB_PATH = _TMP_DB if os.path.exists(_TMP_DB) else _BASE_DB_PATH
else:
    DEFAULT_DB_PATH = _BASE_DB_PATH



class StorageManager:
    """Encapsulates SQLite persistence with thread-safe connection pooling and WAL mode."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)

    @contextmanager
    def get_connection(self):
        """Yields a thread-safe SQLite connection with WAL mode and foreign keys enabled."""
        conn = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA foreign_keys = ON;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def ensure_initialized(self) -> None:
        """Executes DDL statements and idempotently seeds default metadata."""
        with self.get_connection() as conn:
            # 1. Astronauts
            conn.execute("""
            CREATE TABLE IF NOT EXISTS astronauts (
                astronaut_id TEXT PRIMARY KEY,
                callsign TEXT NOT NULL,
                mission_id TEXT NOT NULL,
                crew_role TEXT NOT NULL,
                baseline_calibrated_at TIMESTAMP,
                baseline_parameters TEXT,
                resting_hr REAL DEFAULT 65.0,
                resting_rmssd REAL DEFAULT 55.0,
                resting_spo2 REAL DEFAULT 98.0,
                resting_temp REAL DEFAULT 37.0,
                circadian_phase_shift_hours REAL DEFAULT 0.0,
                baseline_window_days INTEGER DEFAULT 7,
                calibration_status TEXT DEFAULT 'CALIBRATING'
            );
            """)

            # Migration: non-destructive ALTER TABLE for missing columns on legacy databases
            existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(astronauts);").fetchall()}
            cols_to_add = {
                "resting_hr": "REAL DEFAULT 65.0",
                "resting_rmssd": "REAL DEFAULT 55.0",
                "resting_spo2": "REAL DEFAULT 98.0",
                "resting_temp": "REAL DEFAULT 37.0",
                "circadian_phase_shift_hours": "REAL DEFAULT 0.0",
                "baseline_window_days": "INTEGER DEFAULT 7",
                "calibration_status": "TEXT DEFAULT 'CALIBRATING'",
            }
            for col_name, col_def in cols_to_add.items():
                if col_name not in existing_cols:
                    conn.execute(f"ALTER TABLE astronauts ADD COLUMN {col_name} {col_def};")

            # 2. Data Sources
            conn.execute("""
            CREATE TABLE IF NOT EXISTS data_sources (
                source_id TEXT PRIMARY KEY,
                source_name TEXT NOT NULL,
                provenance_category TEXT NOT NULL CHECK(provenance_category IN ('AUTHENTIC_NASA_EDA', 'SYNTHETIC_SIMULATION', 'CREW_REPORTED')),
                dataset_identifier TEXT,
                sampling_frequency_hz REAL
            );
            """)

            # 3. Telemetry Streams
            conn.execute("""
            CREATE TABLE IF NOT EXISTS telemetry_streams (
                stream_id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL REFERENCES data_sources(source_id),
                metric_name TEXT NOT NULL,
                metric_category TEXT NOT NULL CHECK(metric_category IN ('ENVIRONMENTAL', 'PHYSIOLOGICAL')),
                unit TEXT NOT NULL,
                nominal_min REAL,
                nominal_max REAL
            );
            """)

            # 4. Measurements
            conn.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stream_id TEXT NOT NULL REFERENCES telemetry_streams(stream_id),
                astronaut_id TEXT REFERENCES astronauts(astronaut_id),
                timestamp TIMESTAMP NOT NULL,
                value REAL NOT NULL,
                quality_status TEXT NOT NULL DEFAULT 'VALID' CHECK(quality_status IN ('VALID', 'SUSPECT', 'IMPUTED', 'STALE', 'GAP')),
                is_synthetic BOOLEAN NOT NULL DEFAULT 0
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_measurements_stream_time ON measurements(stream_id, timestamp);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_measurements_astro_time ON measurements(astronaut_id, timestamp);")

            # 5. Symptom Reports
            conn.execute("""
            CREATE TABLE IF NOT EXISTS symptom_reports (
                report_id TEXT PRIMARY KEY,
                astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
                symptom_code TEXT NOT NULL,
                severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 5),
                occurred_at TIMESTAMP NOT NULL,
                reported_at TIMESTAMP NOT NULL,
                cabin_module TEXT,
                notes TEXT,
                is_synthetic BOOLEAN NOT NULL DEFAULT 0
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symptoms_occurred ON symptom_reports(astronaut_id, occurred_at);")

            # 6. Health Events
            conn.execute("""
            CREATE TABLE IF NOT EXISTS health_events (
                event_id TEXT PRIMARY KEY,
                astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
                event_type TEXT NOT NULL,
                severity_level TEXT NOT NULL CHECK(severity_level IN ('INFO', 'OBSERVE', 'INVESTIGATE')),
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                contributing_stream_ids TEXT NOT NULL,
                symptom_report_id TEXT REFERENCES symptom_reports(report_id),
                rationale TEXT NOT NULL,
                uncertainty_level TEXT NOT NULL CHECK(uncertainty_level IN ('LOW', 'MODERATE', 'HIGH')),
                review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED')),
                review_notes TEXT
            );
            """)

            # Migration: non-destructive ALTER TABLE for V3 deviation magnitude on legacy databases
            existing_event_cols = {
                row["name"] for row in conn.execute("PRAGMA table_info(health_events);").fetchall()
            }
            if "peak_deviation_sigma" not in existing_event_cols:
                conn.execute("ALTER TABLE health_events ADD COLUMN peak_deviation_sigma REAL;")

            # 7. Research Documents (FTS5)
            conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS research_knowledge_fts USING fts5(
                doc_id,
                title,
                section_heading,
                content,
                doi_citation,
                source_repository
            );
            """)

            # 8. Embedded Research Vectors
            conn.execute("""
            CREATE TABLE IF NOT EXISTS research_vectors (
                chunk_id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                title TEXT NOT NULL,
                authors TEXT,
                report_identifier TEXT,
                section_heading TEXT NOT NULL,
                content TEXT NOT NULL,
                doi_citation TEXT,
                source_repository TEXT,
                embedding BLOB NOT NULL,
                embedding_model TEXT NOT NULL
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_vectors_doc ON research_vectors(doc_id);")

            # Migration: non-destructive ALTER TABLE for missing columns on research_vectors
            existing_vector_cols = {row["name"] for row in conn.execute("PRAGMA table_info(research_vectors);").fetchall()}
            vector_cols_to_add = {
                "corpus_type": "TEXT NOT NULL DEFAULT 'RESEARCH'",
                "rule_id": "TEXT",
                "sha256_hash": "TEXT",
            }
            for col_name, col_def in vector_cols_to_add.items():
                if col_name not in existing_vector_cols:
                    conn.execute(f"ALTER TABLE research_vectors ADD COLUMN {col_name} {col_def};")

            # 9. Pre-computed Canonical Event Archetype Vectors
            conn.execute("""
            CREATE TABLE IF NOT EXISTS event_archetype_vectors (
                archetype_id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                embedding BLOB NOT NULL
            );
            """)

            # 10. Assistant Interaction Audit Trail
            conn.execute("""
            CREATE TABLE IF NOT EXISTS assistant_audit_logs (
                log_id TEXT PRIMARY KEY,
                event_id TEXT REFERENCES health_events(event_id),
                astronaut_id TEXT REFERENCES astronauts(astronaut_id),
                query_text TEXT NOT NULL,
                retrieval_mode TEXT NOT NULL CHECK(retrieval_mode IN ('HYBRID_RRF', 'LEXICAL_BM25', 'DENSE_COSINE')),
                generation_mode TEXT NOT NULL CHECK(generation_mode IN ('OLLAMA_GENERATIVE', 'EXTRACTIVE_FALLBACK')),
                response_text TEXT NOT NULL,
                cited_doc_ids TEXT NOT NULL,
                tripwire_triggered BOOLEAN NOT NULL DEFAULT 0,
                latency_ms REAL NOT NULL,
                created_at TIMESTAMP NOT NULL,
                trace_id TEXT,
                flight_rule_cited TEXT,
                rule_sha256 TEXT,
                stt_confidence REAL,
                stt_duration_sec REAL,
                tripwire_match_term TEXT,
                provider_used TEXT
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_astronaut ON assistant_audit_logs(astronaut_id);")

            # Migration: non-destructive ALTER TABLE for missing columns on assistant_audit_logs
            existing_audit_cols = {row["name"] for row in conn.execute("PRAGMA table_info(assistant_audit_logs);").fetchall()}
            audit_cols_to_add = {
                "trace_id": "TEXT",
                "flight_rule_cited": "TEXT",
                "rule_sha256": "TEXT",
                "stt_confidence": "REAL",
                "stt_duration_sec": "REAL",
                "tripwire_match_term": "TEXT",
                "provider_used": "TEXT",
            }
            for col_name, col_def in audit_cols_to_add.items():
                if col_name not in existing_audit_cols:
                    conn.execute(f"ALTER TABLE assistant_audit_logs ADD COLUMN {col_name} {col_def};")

            # 11. Operational Flight Rules & Contingency Checklists
            conn.execute("""
            CREATE TABLE IF NOT EXISTS flight_rules (
                rule_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subsystem TEXT NOT NULL,
                revision_date TEXT NOT NULL,
                severity_trigger TEXT NOT NULL CHECK(severity_trigger IN ('INFO', 'OBSERVE', 'INVESTIGATE', 'EMERGENCY')),
                condition_threshold TEXT NOT NULL,
                verbatim_text TEXT NOT NULL,
                sha256_hash TEXT NOT NULL,
                checklist_steps_json TEXT NOT NULL,
                reference_docs_json TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_flight_rules_subsystem ON flight_rules(subsystem);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_flight_rules_severity ON flight_rules(severity_trigger);")

            # Idempotent default seeding - 3 Authoritative Cohort Astronauts
            conn.execute("""
            INSERT OR IGNORE INTO astronauts (
                astronaut_id, callsign, mission_id, crew_role,
                baseline_calibrated_at, baseline_parameters,
                resting_hr, resting_rmssd, resting_spo2, resting_temp,
                circadian_phase_shift_hours, baseline_window_days, calibration_status
            )
            VALUES 
                (
                    'ASTRO-01', 'CDR M. Vance', 'ISS-EXP-71', 'Commander',
                    '2026-03-01T00:00:00Z', '{"resting_hr": 65.0, "resting_spo2": 98.0, "resting_temp": 37.0}',
                    65.0, 55.0, 98.0, 37.0, 0.0, 7, 'CALIBRATING'
                ),
                (
                    'ASTRO-02', 'FE-1 Dr. S. Patel', 'ISS-EXP-71', 'Flight Engineer',
                    NULL, NULL,
                    52.0, 75.0, 98.5, 36.8, -1.0, 7, 'CALIBRATING'
                ),
                (
                    'ASTRO-03', 'MS-1 K. Lindgren', 'ISS-EXP-71', 'Mission Specialist',
                    NULL, NULL,
                    72.0, 38.0, 97.8, 37.1, 1.5, 7, 'CALIBRATING'
                );
            """)

            conn.execute("""
            INSERT OR IGNORE INTO data_sources (source_id, source_name, provenance_category, dataset_identifier, sampling_frequency_hz)
            VALUES 
                ('SRC_NASA_EDA', 'NASA ISS Environmental Data Application', 'AUTHENTIC_NASA_EDA', 'ISS-EDA-CO2-EXP71', 0.0167),
                ('SRC_SIM_VITALS', 'Autonomous Vitals Simulator', 'SYNTHETIC_SIMULATION', 'SIM-BIO-V1', 0.0167),
                ('SRC_CREW', 'Astronaut Symptom Logger', 'CREW_REPORTED', 'CREW-LOG-V1', NULL);
            """)

            conn.execute("""
            INSERT OR IGNORE INTO telemetry_streams (stream_id, source_id, metric_name, metric_category, unit, nominal_min, nominal_max)
            VALUES 
                ('stream_eda_co2', 'SRC_NASA_EDA', 'cabin_co2', 'ENVIRONMENTAL', 'mmHg', 0.0, 3.0),
                ('stream_eda_temp', 'SRC_NASA_EDA', 'cabin_temp', 'ENVIRONMENTAL', 'degC', 18.0, 26.0),
                ('stream_eda_pressure', 'SRC_NASA_EDA', 'cabin_pressure', 'ENVIRONMENTAL', 'kPa', 95.0, 105.0),
                ('stream_sim_hr', 'SRC_SIM_VITALS', 'heart_rate', 'PHYSIOLOGICAL', 'bpm', 50.0, 90.0),
                ('stream_sim_spo2', 'SRC_SIM_VITALS', 'spo2', 'PHYSIOLOGICAL', 'percent', 95.0, 100.0),
                ('stream_sim_temp', 'SRC_SIM_VITALS', 'core_temp', 'PHYSIOLOGICAL', 'degC', 36.5, 37.5),
                ('stream_sim_hrv', 'SRC_SIM_VITALS', 'rmssd', 'PHYSIOLOGICAL', 'ms', 15.0, 140.0);
            """)

        # V3: idempotently bundle offline research + archetype embeddings on cold start.
        self.seed_research_vectors_if_empty()

    def seed_research_vectors_if_empty(self, seed_path: Optional[Path] = None) -> None:
        """Seeds research vectors and canonical archetypes when the store is empty.

        The seed asset is bundled with the repo so air-gapped deployments retain
        dense retrieval without a running Ollama daemon or network access. A
        missing or malformed asset logs a warning instead of blocking startup.
        """
        with self.get_connection() as conn:
            existing = conn.execute("SELECT COUNT(*) AS total FROM research_vectors;").fetchone()
            if existing and int(existing["total"]) > 0:
                return

        path = seed_path or (Path(__file__).resolve().parents[2] / "data" / "research_embeddings_seed.json")
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
            chunks = payload.get("chunks", [])
            archetypes = payload.get("archetypes", [])
        except (OSError, ValueError, TypeError) as exc:
            logging.warning("Unable to load research embedding seed asset %s: %s", path, exc)
            return

        chunk_rows = [
            (
                item["chunk_id"],
                item["doc_id"],
                item["title"],
                item.get("authors"),
                item.get("report_identifier"),
                item["section_heading"],
                item["content"],
                item.get("doi_citation"),
                item.get("source_repository"),
                np.array(item["embedding"], dtype=np.float32).tobytes(),
                item.get("embedding_model", "all-minilm"),
            )
            for item in chunks
        ]
        archetype_rows = [
            (
                item["archetype_id"],
                item["description"],
                np.array(item["embedding"], dtype=np.float32).tobytes(),
            )
            for item in archetypes
        ]

        with self.get_connection() as conn:
            conn.executemany(
                """
                INSERT OR IGNORE INTO research_vectors
                (chunk_id, doc_id, title, authors, report_identifier, section_heading,
                 content, doi_citation, source_repository, embedding, embedding_model)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                chunk_rows,
            )
            conn.executemany(
                """
                INSERT OR IGNORE INTO event_archetype_vectors
                (archetype_id, description, embedding)
                VALUES (?, ?, ?);
                """,
                archetype_rows,
            )

    def list_all_vector_chunks(self) -> List[sqlite3.Row]:
        """Returns every persisted research vector chunk for in-memory caching."""
        with self.get_connection() as conn:
            return conn.execute(
                "SELECT * FROM research_vectors ORDER BY doc_id, section_heading;"
            ).fetchall()

    def get_health_event(self, event_id: str) -> Optional[HealthEvent]:
        """Retrieves a single HealthEvent by event_id, returning None if absent."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM health_events WHERE event_id = ? LIMIT 1;",
                (event_id,),
            ).fetchone()
            return HealthEvent(**dict(row)) if row else None

    def insert_assistant_audit_log(self, log: AssistantAuditLog) -> None:
        """Persists an assistant interaction and safety audit record."""
        with self.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO assistant_audit_logs (
                    log_id, event_id, astronaut_id, query_text, retrieval_mode,
                    generation_mode, response_text, cited_doc_ids, tripwire_triggered,
                    latency_ms, created_at, trace_id, flight_rule_cited, rule_sha256,
                    stt_confidence, stt_duration_sec, tripwire_match_term, provider_used
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    log.log_id,
                    log.event_id,
                    log.astronaut_id,
                    log.query_text,
                    log.retrieval_mode,
                    log.generation_mode,
                    log.response_text,
                    log.cited_doc_ids,
                    int(log.tripwire_triggered),
                    log.latency_ms,
                    log.created_at,
                    log.trace_id,
                    log.flight_rule_cited,
                    log.rule_sha256,
                    log.stt_confidence,
                    log.stt_duration_sec,
                    log.tripwire_match_term,
                    log.provider_used,
                ),
            )

    def insert_flight_rule(self, rule: FlightRule) -> None:
        """Inserts or replaces an operational flight rule and its procedural checklist."""
        steps_json = json.dumps([step.model_dump() for step in rule.checklist_steps])
        docs_json = json.dumps(rule.reference_docs)
        severity_val = rule.severity_trigger.value if hasattr(rule.severity_trigger, "value") else str(rule.severity_trigger)
        with self.get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO flight_rules (
                    rule_id, title, subsystem, revision_date, severity_trigger,
                    condition_threshold, verbatim_text, sha256_hash,
                    checklist_steps_json, reference_docs_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    rule.rule_id,
                    rule.title,
                    rule.subsystem,
                    rule.revision_date,
                    severity_val,
                    rule.condition_threshold,
                    rule.verbatim_text,
                    rule.sha256_hash,
                    steps_json,
                    docs_json,
                ),
            )

    @staticmethod
    def _row_to_flight_rule(row: sqlite3.Row) -> FlightRule:
        data = dict(row)
        steps_raw = json.loads(data["checklist_steps_json"]) if isinstance(data["checklist_steps_json"], str) else data["checklist_steps_json"]
        docs_raw = json.loads(data["reference_docs_json"]) if isinstance(data["reference_docs_json"], str) else data["reference_docs_json"]
        checklist_steps = [ChecklistStep(**step) for step in steps_raw]
        return FlightRule(
            rule_id=data["rule_id"],
            title=data["title"],
            subsystem=data["subsystem"],
            revision_date=data["revision_date"],
            severity_trigger=SeverityTrigger(data["severity_trigger"]),
            condition_threshold=data["condition_threshold"],
            verbatim_text=data["verbatim_text"],
            sha256_hash=data["sha256_hash"],
            checklist_steps=checklist_steps,
            reference_docs=docs_raw,
        )

    def get_flight_rule(self, rule_id: str) -> Optional[FlightRule]:
        """Retrieves an operational flight rule by rule_id."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM flight_rules WHERE rule_id = ? LIMIT 1;",
                (rule_id,),
            ).fetchone()
            return self._row_to_flight_rule(row) if row else None

    def list_flight_rules(
        self, subsystem: Optional[str] = None, severity: Optional[str] = None
    ) -> List[FlightRule]:
        """Lists operational flight rules with optional subsystem and severity filtering."""
        query = "SELECT * FROM flight_rules WHERE 1=1"
        params: List[Any] = []
        if subsystem:
            query += " AND (subsystem = ? OR subsystem LIKE '%' || ? || '%')"
            params.extend([subsystem, subsystem])
        if severity:
            query += " AND severity_trigger = ?"
            params.append(severity)
        query += " ORDER BY rule_id ASC;"
        with self.get_connection() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
            return [self._row_to_flight_rule(row) for row in rows]

    @staticmethod
    def _row_to_astronaut(row: sqlite3.Row) -> Astronaut:
        data = dict(row)
        if "calibration_status" in data and data["calibration_status"] is not None:
            if isinstance(data["calibration_status"], str):
                data["calibration_status"] = CalibrationStatus(data["calibration_status"])
        clean_data = {k: v for k, v in data.items() if v is not None}
        return Astronaut(**clean_data)

    def insert_astronaut(self, astronaut: Astronaut) -> None:
        """Inserts an astronaut profile with all 13 columns."""
        calibration_status_val = (
            astronaut.calibration_status.value
            if hasattr(astronaut.calibration_status, "value")
            else str(astronaut.calibration_status)
        )
        with self.get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO astronauts 
                (astronaut_id, callsign, mission_id, crew_role, baseline_calibrated_at, baseline_parameters,
                 resting_hr, resting_rmssd, resting_spo2, resting_temp,
                 circadian_phase_shift_hours, baseline_window_days, calibration_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    astronaut.astronaut_id,
                    astronaut.callsign,
                    astronaut.mission_id,
                    astronaut.crew_role,
                    astronaut.baseline_calibrated_at,
                    astronaut.baseline_parameters,
                    float(astronaut.resting_hr),
                    float(astronaut.resting_rmssd),
                    float(astronaut.resting_spo2),
                    float(astronaut.resting_temp),
                    float(astronaut.circadian_phase_shift_hours),
                    int(astronaut.baseline_window_days),
                    calibration_status_val,
                ),
            )

    def get_astronaut(self, astronaut_id: str) -> Optional[Astronaut]:
        """Retrieves an astronaut by ID."""
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM astronauts WHERE astronaut_id = ?;", (astronaut_id,)).fetchone()
            if not row:
                return None
            return self._row_to_astronaut(row)

    def list_astronauts(self) -> List[Astronaut]:
        """Lists all registered astronaut profiles."""
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM astronauts ORDER BY astronaut_id;").fetchall()
            return [self._row_to_astronaut(row) for row in rows]

    def insert_measurements_df(self, df: pd.DataFrame) -> int:
        """Efficiently batch-inserts measurements from a DataFrame into SQLite."""
        required_cols = {"stream_id", "timestamp", "value", "quality_status", "is_synthetic"}
        if not required_cols.issubset(df.columns):
            raise ValueError(f"DataFrame missing required measurement columns: {required_cols - set(df.columns)}")

        records = []
        for _, row in df.iterrows():
            astro_id = row.get("astronaut_id")
            if pd.isna(astro_id):
                astro_id = None
            records.append((
                row["stream_id"],
                astro_id,
                row["timestamp"],
                float(row["value"]),
                row["quality_status"],
                int(bool(row["is_synthetic"])),
            ))

        with self.get_connection() as conn:
            conn.executemany(
                """
                INSERT INTO measurements (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                records,
            )
        return len(records)

    def get_measurements_df(
        self,
        stream_ids: List[str],
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        astronaut_id: Optional[str] = None,
        astronaut_ids: Optional[List[str]] = None,
    ) -> pd.DataFrame:
        """Queries time-series measurements as a DataFrame."""
        if not stream_ids:
            return pd.DataFrame(
                columns=["id", "stream_id", "astronaut_id", "timestamp", "value", "quality_status", "is_synthetic"]
            )

        query = "SELECT * FROM measurements WHERE stream_id IN ({})".format(
            ",".join("?" for _ in stream_ids)
        )
        params: List[Any] = list(stream_ids)

        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time)

        if astronaut_ids is not None:
            if not astronaut_ids:
                return pd.DataFrame(
                    columns=["id", "stream_id", "astronaut_id", "timestamp", "value", "quality_status", "is_synthetic"]
                )
            placeholders = ",".join("?" for _ in astronaut_ids)
            query += f" AND (astronaut_id IN ({placeholders}) OR astronaut_id IS NULL)"
            params.extend(astronaut_ids)
        elif astronaut_id:
            query += " AND (astronaut_id = ? OR astronaut_id IS NULL)"
            params.append(astronaut_id)

        query += " ORDER BY timestamp ASC;"

        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            if not rows:
                return pd.DataFrame(columns=["id", "stream_id", "astronaut_id", "timestamp", "value", "quality_status", "is_synthetic"])
            return pd.DataFrame([dict(r) for r in rows])

    def insert_symptom_report(self, report: SymptomReport) -> None:
        """Records a crew symptom report."""
        with self.get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO symptom_reports 
                (report_id, astronaut_id, symptom_code, severity, occurred_at, reported_at, cabin_module, notes, is_synthetic)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    report.report_id,
                    report.astronaut_id,
                    report.symptom_code,
                    report.severity,
                    report.occurred_at,
                    report.reported_at,
                    report.cabin_module,
                    report.notes,
                    int(report.is_synthetic),
                ),
            )

    def list_symptom_reports(self, astronaut_id: Optional[str] = None) -> List[SymptomReport]:
        """Lists logged symptom reports."""
        query = "SELECT * FROM symptom_reports"
        params = []
        if astronaut_id:
            query += " WHERE astronaut_id = ?"
            params.append(astronaut_id)
        query += " ORDER BY occurred_at DESC;"

        with self.get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [SymptomReport(**dict(r)) for r in rows]

    def insert_health_event(self, event: HealthEvent) -> None:
        """Records a detected exposure correlation event."""
        with self.get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO health_events
                (event_id, astronaut_id, event_type, severity_level, start_time, end_time, 
                 contributing_stream_ids, symptom_report_id, rationale, uncertainty_level, review_status, review_notes,
                 peak_deviation_sigma)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    event.event_id,
                    event.astronaut_id,
                    event.event_type,
                    event.severity_level.value,
                    event.start_time,
                    event.end_time,
                    event.contributing_stream_ids,
                    event.symptom_report_id,
                    event.rationale,
                    event.uncertainty_level.value,
                    event.review_status.value,
                    event.review_notes,
                    event.peak_deviation_sigma,
                ),
            )

    def update_health_event_review(self, event_id: str, review_status: ReviewStatus, review_notes: Optional[str] = None) -> None:
        """Updates review status and notes for an event."""
        with self.get_connection() as conn:
            conn.execute(
                """
                UPDATE health_events
                SET review_status = ?, review_notes = COALESCE(?, review_notes)
                WHERE event_id = ?;
                """,
                (review_status.value, review_notes, event_id),
            )

    def list_health_events(self, astronaut_id: Optional[str] = None) -> List[HealthEvent]:
        """Lists detected health events."""
        query = "SELECT * FROM health_events"
        params = []
        if astronaut_id:
            query += " WHERE astronaut_id = ?"
            params.append(astronaut_id)
        query += " ORDER BY start_time DESC;"

        with self.get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [HealthEvent(**dict(r)) for r in rows]
