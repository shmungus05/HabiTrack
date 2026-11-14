# wayfinder.api

## Overview
FastAPI application service for WAYFINDER V3. It exposes the cohort-scoped REST interface consumed by the React console and serves the compiled SPA from `web/dist/`. The package owns HTTP concerns only: validation, routing, status codes, CORS, and audit persistence boundaries. All analytics and retrieval remain in `wayfinder.core`.

## Interface
- **`server.py`**
  - `create_app(storage: Optional[StorageManager] = None) -> FastAPI`: builds the application, registers routers, adds permissive CORS for local development, and installs the SPA catch-all.
  - Lifespan: initializes `StorageManager`, calls `ensure_initialized()`, and constructs `VectorStoreManager` once per application instance.
  - Module-level `app = create_app()` for `uvicorn wayfinder.api.server:app`.
- **`deps.py`**
  - Accessors that resolve the lifespan-scoped `StorageManager` and `VectorStoreManager` from `request.app.state`.
- **`routes/health.py`**: `GET /api/health` → `HealthStatus` (version `3.0.0`, Ollama probe, vector chunk count).
- **`routes/astronauts.py`**: `GET /api/astronauts`, `GET /api/astronauts/{astronaut_id}`.
- **`routes/telemetry.py`**: `GET /api/telemetry/measurements` (LTTB decimation, cohort filter), `GET /api/telemetry/baselines` (24 hourly envelopes).
- **`routes/events.py`**: `GET /api/events`, `POST /api/events/{event_id}/review`.
- **`routes/symptoms.py`**: `GET /api/symptoms`, `POST /api/symptoms`.
- **`routes/assistant.py`**: `POST /api/assistant/explain`, `POST /api/assistant/query`. Both persist a row to `assistant_audit_logs` with retrieval mode, generation mode, cited doc IDs, tripwire flag, and latency.

## Static serving contract
1. If `web/dist/assets/` exists, it is mounted at `/assets`.
2. Unknown non-`/api` paths return `web/dist/index.html`, enabling client-side routes such as `/timeline`.
3. Existing files under `web/dist/` are returned directly, but path traversal outside the dist root is rejected.
4. If the SPA was never built, the catch-all returns diagnostic JSON rather than a 500.

## Invariants
- Routers depend on `app.state`; they never construct their own `StorageManager` or `VectorStoreManager` outside the lifespan.
- Assistant endpoints must persist an audit row for every successful interaction, including guardrail trips.
- All cohort-scoped endpoints must reject or return empty data for unknown `astronaut_id` values rather than leaking another crew member's rows.
- `/api/*` must never fall through to the SPA index; unknown API routes return JSON `404`.

## Side Effects
- Opens SQLite through the injected `StorageManager`.
- Appends to `assistant_audit_logs` on assistant interactions.
- Reads compiled assets from `web/dist/`.
- Binds `0.0.0.0:8000` when launched via `python -m wayfinder.server`.

## Verification
```powershell
python -m pytest tests/test_api.py tests/test_scenario_v3.py -v
python -m wayfinder.server   # then GET http://localhost:8000/api/health
```
