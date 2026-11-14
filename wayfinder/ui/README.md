# wayfinder.ui

## Overview
Presentation tier and interactive web workstation for WAYFINDER built with Streamlit. Implements a high-end, minimalist Perplexity-inspired aesthetic with dark backgrounds, font-black typography, and rounded containers. Features multi-astronaut cohort switching, real-time tab dispatching, and persistent session state management.

## Local Interface & Invariants
- `get_storage() -> StorageManager`: Streamlit-cached singleton resource initializing and providing access to the authoritative SQLite storage manager.
- Application shell configuration:
  - Enforces page title `WAYFINDER V1 — Offline Astronaut Health & Exposure`, wide layout, and expanded sidebar.
  - Injects global custom CSS enforcing dark palette (`#0b0f19`), rounded cards, custom tab styling, and font-black headings.
  - Renders sidebar cohort switcher allowing instantaneous switching between Expedition 71 crewmembers (`ASTRO-01` Commander Vance, `ASTRO-02` Flight Engineer Patel, `ASTRO-03` Mission Specialist Lindgren).
  - Dispatches to 4 dedicated viewports: Overview, 4-Lane Timeline, Symptoms, and Research.

## Subdirectories & Boundaries
- [components](./components/README.md): Epistemic provenance badges, calibration/severity tags, and Plotly WebGL 4-lane cohort timeline charts.
- [views](./views/README.md): Operational view controllers for mission overview KPIs, interactive time-series timeline, cohort symptom reporting, and offline research browser.

## Invariants
- `st.set_page_config` must be executed prior to any other Streamlit UI element or layout call.
- The repository root must be registered in `sys.path` to allow standalone execution via `streamlit run wayfinder/ui/app.py`.
- Switching cohorts updates `st.session_state["active_astronaut_id"]` and immediately refreshes downstream views without leaking cross-crew telemetry.
- All rendered telemetry must reflect strict epistemic provenance tags without claiming autonomous medical diagnosis.

## Side Effects
- Spawns and manages Streamlit web server process (default `http://localhost:8501`).
- Initializes database schema and default astronaut cohort seeds on cold start.
- Modifies Streamlit session state and DOM tree.

## Verification
- Run: `python -m pytest tests/test_components.py`
- Launch Interactive Console: `streamlit run wayfinder/ui/app.py`
