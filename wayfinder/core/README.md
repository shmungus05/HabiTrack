# wayfinder.core

## Overview
Headless analytical engine and authoritative data layer for WAYFINDER. Implements telemetry ingestion, deterministic multi-day vitals simulation, pure-Python circadian baseline modeling, pre-severity interval coalescence, tripartite concordance analysis, deterministic 384-dimensional embeddings, in-process hybrid vector retrieval, canonical event archetype resolution, the epistemic guardrail, and extractive research synthesis. Maintains complete architectural independence from the Streamlit, FastAPI, and React presentation layers.

## Interface
- **Domain Models & Enums (`models.py`)**:
  - `Astronaut`, `DataSource`, `TelemetryStream`, `Measurement`, `SymptomReport`, `HealthEvent`, `ResearchDocument`, `CircadianBinStats`, `BaselineDeviation`, `CoalescedAutonomicInterval`.
  - `CalibrationStatus`, `ProvenanceCategory`, `QualityStatus`, `MetricCategory`, `SeverityLevel`, `UncertaintyLevel`, `ReviewStatus`.
- **Authoritative Persistence (`storage.py`)**:
  - `StorageManager(db_path: str)`: Manages SQLite database in WAL mode with foreign key enforcement.
  - `ensure_initialized() -> None`: Idempotently applies DDL schema migrations, seeds default streams, and seeds Expedition 71 crew profiles.
  - `insert_astronaut(astronaut: Astronaut) -> None`, `get_astronaut(astronaut_id: str) -> Optional[Astronaut]`, `list_astronauts() -> List[Astronaut]`.
  - `insert_measurements_df(df: pd.DataFrame) -> int`, `get_measurements_df(...) -> pd.DataFrame`.
  - `insert_symptom_report(report: SymptomReport) -> None`, `list_symptom_reports(astronaut_id: Optional[str] = None) -> List[SymptomReport]`.
  - `insert_health_event(event: HealthEvent) -> None`, `update_health_event_review(...) -> None`, `list_health_events(astronaut_id: Optional[str] = None) -> List[HealthEvent]`.
- **Telemetry Ingestion & Quality Checks (`ingestion.py`)**:
  - `calculate_co2_partial_pressure(ppm: float, pressure_kpa: Optional[float] = None) -> float`: Computes CO2 partial pressure in mmHg using STP barometric conversion.
  - `ingest_eda_csv(csv_path: Union[str, Path], storage_manager: StorageManager, batch_size: int = 5000) -> int`: Ingests authentic NASA ISS EDA logs with data quality classification (`VALID`, `SUSPECT`, `STALE`, `GAP`).
- **Autonomous Cohort Simulation (`simulation.py`)**:
  - `simulate_cohort_vitals_for_window(astronaut: Astronaut, start_time: str, duration_hours: int, sampling_interval_seconds: int = 60, inherit_eda_gaps: bool = True, eda_df: Optional[pd.DataFrame] = None) -> pd.DataFrame`: Deterministic multi-day simulation with non-linear inverse RMSSD coupling, circadian cycles, daily workouts, and comm gap inheritance.
  - `generate_vitals(...) -> pd.DataFrame`: Legacy single-astronaut vitals generator.
- **Circadian Baseline Engine (`baselines.py`)**:
  - `compute_circadian_hourly_bins(history_df: pd.DataFrame, astronaut: Astronaut, stream_id: str, min_days: int = 3) -> Dict[int, CircadianBinStats]`: Calculates hourly bin parameters ($b \in [0, 23]$), enforces physiological variance floors, and evaluates calibration status.
  - `evaluate_measurement_deviations(measurements_df: pd.DataFrame, baselines: Dict[int, CircadianBinStats], stream_id: str) -> List[BaselineDeviation]`: Computes instantaneous $Z$-score deviations against circadian baseline bins.
- **Analytics & Concordance Engine (`analytics.py`)**:
  - `decimate_time_series(df: pd.DataFrame, max_points: int = 1000) -> pd.DataFrame`: Downsamples time-series streams using the Largest Triangle Three Buckets (LTTB) algorithm.
  - `coalesce_autonomic_intervals(deviations: List[BaselineDeviation], time_gap_threshold_minutes: int = 10, min_duration_minutes: int = 15) -> List[CoalescedAutonomicInterval]`: Clusters contiguous excursion samples into coalesced intervals before severity assignment.
  - `evaluate_exposure_events(storage_manager: StorageManager, astronaut: Astronaut, window_hours: int = 72) -> List[HealthEvent]`: Evaluates symmetric tripartite concordance across environmental exposure ($P_{\text{CO}_2} \ge 4.5\,\text{mmHg}$), crew symptoms, and autonomic shifts into `INVESTIGATE`, `OBSERVE`, or `INFO`.
  - `_upsert_health_event(storage_manager: StorageManager, event: HealthEvent) -> None`: Idempotently persists evaluated health events.
- **Offline Research Retrieval & Grounding (`rag.py`)**:
  - `index_research_corpus(corpus_dir: Union[str, Path], storage_manager: StorageManager) -> int`: Indexes curated NASA HRR/OSDR publications into SQLite FTS5 index `research_knowledge_fts`.
  - `search_knowledge(query: str, storage_manager: StorageManager, top_k: int = 5) -> List[ResearchDocument]`: Executes offline BM25 full-text search.
  - `synthesize_with_ollama(query: str, documents: List[ResearchDocument], model_name: str = "llama3:latest", timeout_seconds: float = 30.0) -> Optional[str]`: Hook for local LLM evidence synthesis with graceful timeout handling.
- **Deterministic Embeddings (`embeddings.py`)**:
  - `embed_text(text: str) -> np.ndarray`: Offline deterministic 384-dimensional float32 encoder pinned to the `all-minilm` contract; returns a unit-normalized vector for any input string.
- **Vector Store & Hybrid RRF (`rag.py`, Version 3)**:
  - `VectorStoreManager(storage)`: Caches passage embeddings in a contiguous `(N, 384)` float32 `corpus_matrix` with empty-store protection and thread-safe `reload_corpus()`.
  - `search_dense(query_vector, top_k) -> List[Tuple[str, float]]`: NumPy dot-product cosine search.
  - `search_hybrid_rrf(query_text, query_vector, top_k) -> Tuple[List[CitedEvidence], str]`: Fuses dense and FTS5 BM25 rankings via Reciprocal Rank Fusion and returns normalized `[0, 100]` relevance with the active mode (`HYBRID_RRF`, `DENSE_COSINE`, or `LEXICAL_BM25`).
  - `resolve_archetype_id(event) -> str`: Deterministic event-signature mapping.
  - `get_archetype_vector(storage_manager, archetype_id) -> np.ndarray`: Loads the archetype embedding with a deterministic fallback.
- **Assistant & Guardrail (`assistant.py`, Version 3)**:
  - `query_generative_assistant(prompt, evidence, event, astronaut_id)`: Probes local Ollama, validates JSON, applies the guardrail, and transparently falls back to `ExtractiveResearchSynthesizer` on any HTTP, timeout, or parse failure.
  - `apply_epistemic_guardrail(...)`: Rejects generated text containing `PROHIBITED_CAUSAL_TERMS` and returns the extractive fallback with `tripwire_triggered=True`.
  - `MANDATORY_DISCLAIMER`: Non-causal decision-support text attached to every response.

## Invariants
- Zero presentation dependencies: `wayfinder.core` must never import Streamlit, Plotly, FastAPI, or React/UI modules.
- Multi-astronaut isolation: database operations and analytical baselines must partition vitals and events strictly by `astronaut_id`.
- Division-by-zero protection: circadian baseline bins must apply physiological variance floors ($\sigma_{\min, \text{HR}}=1.0\,\text{bpm}, \sigma_{\min, \text{RMSSD}}=2.0\,\text{ms}, \sigma_{\min, \text{Temp}}=0.10\,^\circ\text{C}, \sigma_{\min, \text{SpO}_2}=0.50\,\%$).
- Sparse-history safety: profiles with $< 3$ distinct calendar days ($|K| < 36$) remain tagged as `CALIBRATING` with expanded priors and `HIGH` uncertainty.
- Pre-severity interval coalescence: autonomic deviation samples must be clustered ($\Delta t \le 10\,\text{min}$, duration $\ge 15\,\text{min}$) prior to severity assignment to prevent alarm fatigue from daily countermeasure workouts.
- Epistemic provenance immutability: every telemetry point and event must preserve its provenance category (`AUTHENTIC_NASA_EDA`, `SYNTHETIC_SIMULATION`, or `CREW_REPORTED`).
- Offline vector determinism: embeddings are produced only by `embed_text()` or loaded from `data/research_embeddings_seed.json`; no external embedding service is called.
- Guardrail authority: generated text containing a prohibited causal or clinical-intervention stem is discarded and replaced by deterministic extractive synthesis.

## Side Effects
- Reads and writes to SQLite database (`data/wayfinder.db`) via thread-safe WAL mode connections.
- Ingests CSV telemetry logs from local filesystem (`data/sample_eda_iss_co2_temp.csv`).
- Reads Markdown files from curated NASA research directory (`data/research_corpus/`).
- Seeds `research_vectors`, `event_archetype_vectors`, and `assistant_audit_logs` from `data/research_embeddings_seed.json` on first initialization.
- Optionally sends local HTTP requests to `localhost:11434` when the Ollama path is enabled; failures fall back without raising.

## Verification
- Run: `python -m pytest tests/test_models.py tests/test_storage.py tests/test_ingestion.py tests/test_simulation.py tests/test_baselines.py tests/test_analytics.py tests/test_rag.py tests/test_vectors.py tests/test_assistant.py`
