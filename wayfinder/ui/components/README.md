# wayfinder.ui.components

## Overview
Presentation-layer UI components and data visualization routines for the WAYFINDER Streamlit console. Provides epistemic provenance badges, calibration and clinical severity tags, and a synchronized 4-lane WebGL time-series visualization engine with circadian baseline envelopes and concordance heatmaps.

## Interface
- `render_provenance_badge(provenance: str, is_synthetic: bool = False) -> str`: Renders styled HTML tag indicating data origin (`AUTHENTIC NASA EDA`, `SIMULATED VITALS`, or `CREW REPORTED`).
- `render_quality_badge(quality: str) -> str`: Renders inline badge for telemetry data quality status (`VALID`, `SUSPECT`, `GAP`, `STALE`, `IMPUTED`).
- `render_severity_badge(severity: str) -> str`: Renders clinical priority tag (`INFO`, `OBSERVE`, `INVESTIGATE`).
- `render_uncertainty_badge(uncertainty: str) -> str`: Renders sensor and contextual confidence badge (`LOW`, `MODERATE`, `HIGH`).
- `render_review_badge(status: str) -> str`: Renders human-in-the-loop clinical review status (`PENDING`, `ACKNOWLEDGED`, `RESOLVED`).
- `render_calibration_badge(status: Union[CalibrationStatus, str]) -> str`: Renders baseline lifecycle state (`CALIBRATING` vs `CALIBRATED`).
- `create_dual_timeline_figure(env_df: pd.DataFrame, vitals_df: pd.DataFrame, events: Optional[List[HealthEvent]] = None, symptoms: Optional[List[SymptomReport]] = None) -> go.Figure`: Renders synchronized 2-lane Plotly WebGL timeline comparing cabin CO2 against heart rate / SpO2.
- `create_multi_lane_cohort_figure(env_df: pd.DataFrame, vitals_df: pd.DataFrame, deviations_df: Optional[pd.DataFrame] = None, baseline_envelopes: Optional[Dict[str, pd.DataFrame]] = None, events: Optional[List[HealthEvent]] = None, symptoms: Optional[List[SymptomReport]] = None, active_astronaut: Optional[Astronaut] = None) -> go.Figure`: Renders simultaneous 4-lane WebGL timeline with dual independent Y-axes on Lanes 2 & 3, translucent circadian ribbons $[\mu \pm 2\sigma]$, and colorblind-safe deviation heatmap.
- `_decimate_stream_if_needed(stream_df: pd.DataFrame, max_points: int = 1000) -> pd.DataFrame`: Downsamples high-frequency time-series streams using LTTB if sample count exceeds 1,000 points.

## Invariants
- Badge functions are stateless and return strict inline HTML strings without modifying external data structures.
- Telemetry points with `quality_status == QualityStatus.GAP` are filtered before continuous line rendering to prevent phantom interpolation across comm dropouts.
- Raw vitals streams exceeding 1,000 data points per lane must undergo LTTB decimation before rendering to guarantee 60 FPS browser interaction.
- Color palettes strictly adhere to accessible colorblind-safe contrast ratios and the dark minimalist Perplexity aesthetic.

## Side Effects
- None. All functions are pure visual constructors returning HTML spans or Plotly `go.Figure` instances with no disk, network, or database mutations.

## Verification
- Run: `python -m pytest tests/test_components.py`
