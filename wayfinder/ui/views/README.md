# wayfinder.ui.views

## Overview
Operational view modules corresponding to the four primary navigation tabs within the WAYFINDER console. Orchestrates data retrieval from authoritative SQLite persistence, binds telemetry and events to active cohort astronaut profiles, and presents clinical summaries, time-series viewports, crew symptom input forms, and scientific evidence retrieval.

## Interface
- `render_overview_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None`: Renders mission overview dashboard featuring active crewmember calibration state, vital KPI cards, active concordance events table, and clinical review controls.
- `fetch_overview_metrics(db_path: str, astronaut_id: str)`: Streamlit-cached query helper retrieving latest environmental and vitals measurements, open concordance alerts, and 24-hour baseline deviations.
- `render_timeline_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None`: Renders the interactive 4-lane synchronized WebGL time-series viewport with baseline ribbons, concordance heatmaps, decimation toggles, and viewport zoom persistence.
- `fetch_timeline_data(db_path: str, astronaut_id: str) -> Tuple[pd.DataFrame, pd.DataFrame]`: Streamlit-cached helper retrieving environmental telemetry and cohort vitals dataframes.
- `render_symptoms_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None`: Renders structured symptom logging form allowing crew to record discomfort events tagged with timestamp, severity rating (1–5), and clinical notes.
- `render_research_view(storage_manager: StorageManager) -> None`: Renders offline scientific research browser allowing crew and flight surgeons to execute BM25 full-text queries over indexed NASA spaceflight publications.

## Invariants
- Multi-tenant cohort isolation is strictly enforced: all vitals, symptoms, and concordance events rendered within views are filtered exclusively by `astronaut_id`.
- Functions accepting `astronaut_or_id` must gracefully handle both fully materialized `Astronaut` Pydantic models and raw string identifiers.
- Viewport zoom ranges in the timeline are cached in `st.session_state["timeline_relayout_range"]` to prevent camera resets during Streamlit reruns.
- All clinical findings and event summaries must display non-causal decision support disclaimers and epistemic provenance tags.
- Research queries must function completely offline against local SQLite FTS5 without external network calls.

## Side Effects
- Mutates Streamlit UI state, rendering HTML, charts, metrics, and data tables to the browser DOM.
- Mutates SQLite database state via `storage_manager.insert_symptom_report` when crew submits symptom reports.
- Mutates event review status via `storage_manager.update_health_event_review` when clinical review status is modified.
- Reads and updates Streamlit session state keys (`st.session_state["active_astronaut_id"]`, `st.session_state["timeline_relayout_range"]`).

## Verification
- Run: `python -m pytest tests/test_components.py tests/test_scenario_v2.py`
