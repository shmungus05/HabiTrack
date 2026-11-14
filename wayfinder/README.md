# wayfinder

## Overview
Root Python package for WAYFINDER V3: Evidence-Grounded Local Health Intelligence & Environmental Exposure Analysis. The package is split into three strictly decoupled layers:

- `wayfinder.core` — headless, pure-Python engine for ingestion, deterministic simulation, circadian baselines, tripartite concordance analytics, deterministic 384-d embeddings, hybrid vector retrieval, archetype resolution, epistemic guardrails, and extractive synthesis. It imports no UI, web, or service framework code.
- `wayfinder.api` — FastAPI application service exposing cohort-scoped REST endpoints, persisted assistant audit logs, and the compiled React SPA.
- `wayfinder.ui` — the original Streamlit console, preserved in maintenance mode on port 8501 as a visual-regression reference.

## Single-command launch
```powershell
python -m wayfinder.server
```

`wayfinder/server.py` runs Uvicorn against `wayfinder.api.server:app` on `0.0.0.0:8000`. The same process serves:

- `/api/*` — JSON REST endpoints (see below)
- `/assets/*` — compiled Vite assets from `web/dist/assets/`
- `/`, `/timeline`, `/symptoms`, `/research` — SPA history fallback to `web/dist/index.html`
- `/docs` — OpenAPI / Swagger UI

If `web/dist/` is missing, the catch-all returns a diagnostic JSON payload describing how to build the console.

## API surface (`wayfinder.api`)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Status, `3.0.0` version, Ollama availability, vector chunk count |
| `GET` | `/api/astronauts` | Cohort profiles and calibration state |
| `GET` | `/api/astronauts/{id}` | Single astronaut profile and resting baselines |
| `GET` | `/api/telemetry/measurements` | LTTB-decimated, cohort-scoped measurements |
| `GET` | `/api/telemetry/baselines` | Hourly circadian `μ ± 2σ` envelopes |
| `GET` | `/api/events` | Concordance events filtered by cohort/severity |
| `POST` | `/api/events/{id}/review` | Flight-surgeon review state transition |
| `GET` | `/api/symptoms` | Crew symptom reports |
| `POST` | `/api/symptoms` | Structured symptom submission |
| `POST` | `/api/assistant/explain` | 1-click citation-grounded event explanation |
| `POST` | `/api/assistant/query` | Ad-hoc hybrid research query |

`create_app(storage: Optional[StorageManager] = None)` allows tests to inject an isolated database. The lifespan handler initializes storage, seeds vectors, and constructs a `VectorStoreManager` exactly once.

## Subdirectories & Boundaries
- [core](./core/README.md): Headless analytical core, Pydantic domain models, authoritative SQLite persistence, telemetry ingestion, multi-day vitals simulation, circadian baselines, tripartite concordance, deterministic embeddings, vector RAG, and the epistemic assistant engine.
- [api](./api/README.md): FastAPI application shell, lifespan dependencies, REST routers, SPA mount, and assistant audit persistence.
- [ui](./ui/README.md): Streamlit reference console (maintenance mode, port 8501), WebGL timeline components, provenance badges, and cohort-aware review views.

## Version 3 core additions

- `wayfinder/core/embeddings.py`
  - `embed_text(text: str) -> np.ndarray`: deterministic, offline 384-dimensional float32 encoder pinned to the `all-minilm` contract; identical text always yields an identical unit-normalized vector.
- `wayfinder/core/rag.py`
  - `VectorStoreManager(storage)`: caches all passage embeddings in a contiguous `(N, 384)` float32 `corpus_matrix`, exposes `search_dense()`, thread-safe `reload_corpus()`, and `search_hybrid_rrf()`.
  - `index_research_corpus(corpus_dir, storage_manager) -> int`: indexes the NASA HRR/OSDR corpus into the FTS5 `research_knowledge_fts` table. Vector rows are seeded separately from `data/research_embeddings_seed.json`.
- `wayfinder/core/assistant.py`
  - `resolve_archetype_id(event) -> str`: deterministic event-signature mapping to one of four canonical archetypes.
  - `get_archetype_vector(storage_manager, archetype_id) -> np.ndarray`: loads the matching archetype query vector, with a deterministic `embed_text()` fallback.
  - `query_generative_assistant(prompt, evidence, event=None, astronaut_id=None)`: probes Ollama, calls `/api/generate`, validates JSON, applies the guardrail, and falls back to `ExtractiveResearchSynthesizer` on any failure.
  - `apply_epistemic_guardrail(...)`: rejects generated text containing prohibited causal/clinical stems and re-synthesizes with `tripwire_triggered=True`.
  - `ExtractiveResearchSynthesizer`: deterministic evidence-grounded response builder for events and ad-hoc queries.
  - `MANDATORY_DISCLAIMER`: the non-causal decision-support text attached to every response.

## Invariants
- **No UI imports in core:** `wayfinder.core` must never import Streamlit, Plotly, FastAPI, or React assets.
- **Cohort isolation:** every query and analytical path is scoped by `astronaut_id`; the assistant drawer store additionally purges context on cohort switch.
- **Offline determinism:** embeddings come from checked-in seed data or the deterministic `embed_text()` encoder; no external vector service or embedding API is called.
- **Guardrail authority:** any generated text containing a prohibited causal/clinical stem is discarded, replaced by extractive synthesis, and persisted with `tripwire_triggered = 1`.
- **Non-causal decision support:** every assistant response and event rationale carries the mandatory disclaimer and never asserts diagnosis.

## Side Effects
- Opens the authoritative SQLite database at `data/wayfinder.db` in WAL mode.
- Idempotently seeds `research_vectors`, `event_archetype_vectors`, and `assistant_audit_logs`.
- Optionally probes and calls a local Ollama daemon at `http://localhost:11434` with fast-fail and timeout guards.
- Binds the FastAPI service to port `8000`; the Streamlit reference console binds `8501`.

## Verification
```powershell
python -m pytest tests/ -q
python -m pytest tests/test_vectors.py tests/test_assistant.py tests/test_api.py tests/test_scenario_v3.py -v
```
