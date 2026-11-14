"""
tests.test_components: Unit tests for visual provenance badges and Plotly chart generation.
"""

import pandas as pd
import plotly.graph_objects as go
from wayfinder.ui.components.badges import (
    render_provenance_badge,
    render_quality_badge,
    render_severity_badge,
    render_uncertainty_badge,
    render_calibration_badge,
)
from wayfinder.ui.components.charts import (
    create_dual_timeline_figure,
    create_multi_lane_cohort_figure,
)
from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    HealthEvent,
    SymptomReport,
    SeverityLevel,
    UncertaintyLevel,
)


def test_render_badges():
    assert "AUTHENTIC NASA EDA" in render_provenance_badge("AUTHENTIC_NASA_EDA")
    assert "SIMULATED VITALS" in render_provenance_badge("SYNTHETIC_SIMULATION")
    assert "CREW REPORTED" in render_provenance_badge("CREW_REPORTED")

    assert "VALID" in render_quality_badge("VALID")
    assert "GAP" in render_quality_badge("GAP")

    assert "INVESTIGATE" in render_severity_badge("INVESTIGATE")
    assert "HIGH" in render_uncertainty_badge("HIGH")


def test_render_calibration_badge():
    # Test CALIBRATING with Enum and str
    badge_calibrating = render_calibration_badge(CalibrationStatus.CALIBRATING)
    assert "CALIBRATING" in badge_calibrating
    assert "#f59e0b" in badge_calibrating
    assert "#3b2806" in badge_calibrating
    assert "#d97706" in badge_calibrating

    badge_calibrating_str = render_calibration_badge("CALIBRATING")
    assert "CALIBRATING" in badge_calibrating_str
    assert "#f59e0b" in badge_calibrating_str

    # Test CALIBRATED with Enum and str
    badge_calibrated = render_calibration_badge(CalibrationStatus.CALIBRATED)
    assert "CALIBRATED" in badge_calibrated
    assert "#10b981" in badge_calibrated
    assert "#052e16" in badge_calibrated
    assert "#16a34a" in badge_calibrated

    badge_calibrated_str = render_calibration_badge("CALIBRATED")
    assert "CALIBRATED" in badge_calibrated_str
    assert "#10b981" in badge_calibrated_str


def test_create_dual_timeline_figure():
    env_df = pd.DataFrame({
        "stream_id": ["stream_eda_co2", "stream_eda_co2", "stream_eda_co2"],
        "timestamp": ["2026-05-09T00:00:00Z", "2026-05-09T00:30:00Z", "2026-05-09T01:00:00Z"],
        "value": [3.2, 0.0, 5.8],
        "quality_status": ["VALID", "GAP", "VALID"],
    })
    vitals_df = pd.DataFrame({
        "stream_id": ["stream_sim_hr", "stream_sim_hr"],
        "timestamp": ["2026-05-09T00:00:00Z", "2026-05-09T01:00:00Z"],
        "value": [68.0, 72.0],
        "quality_status": ["VALID", "VALID"],
    })
    event = HealthEvent(
        event_id="EVT-01",
        astronaut_id="ASTRO-01",
        event_type="EXPOSURE",
        severity_level=SeverityLevel.INVESTIGATE,
        start_time="2026-05-08T22:00:00Z",
        end_time="2026-05-09T04:00:00Z",
        contributing_stream_ids="stream_eda_co2",
        rationale="Excursion noted",
        uncertainty_level=UncertaintyLevel.LOW,
    )
    symptom = SymptomReport(
        report_id="SYM-01",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:00:00Z",
        reported_at="2026-05-09T03:00:00Z",
    )

    fig = create_dual_timeline_figure(env_df, vitals_df, events=[event], symptoms=[symptom])
    assert isinstance(fig, go.Figure)
    assert len(fig.data) >= 2


def test_create_multi_lane_cohort_figure():
    astronaut = Astronaut(
        astronaut_id="ASTRO-01",
        callsign="CDR A. Vance",
        mission_id="ISS-EXP-71",
        crew_role="Commander",
        resting_hr=65.0,
        resting_rmssd=55.0,
        resting_spo2=98.0,
        resting_temp=37.0,
        calibration_status=CalibrationStatus.CALIBRATED,
    )

    timestamps = [
        "2026-05-09T00:00:00Z",
        "2026-05-09T01:00:00Z",
        "2026-05-09T02:00:00Z",
        "2026-05-09T03:00:00Z",
    ]

    env_df = pd.DataFrame({
        "stream_id": ["stream_eda_co2"] * 4 + ["stream_eda_temp"] * 4,
        "timestamp": timestamps * 2,
        "value": [3.2, 4.6, 5.8, 0.0, 21.5, 22.0, 22.1, 21.8],
        "quality_status": ["VALID", "VALID", "VALID", "GAP", "VALID", "VALID", "VALID", "VALID"],
        "is_synthetic": [False] * 8,
    })

    vitals_df = pd.DataFrame({
        "stream_id": (
            ["stream_sim_hr"] * 4
            + ["stream_sim_hrv"] * 4
            + ["stream_sim_temp"] * 4
            + ["stream_sim_spo2"] * 4
        ),
        "timestamp": timestamps * 4,
        "value": (
            [65.0, 68.0, 85.0, 66.0]
            + [55.0, 52.0, 28.0, 54.0]
            + [37.0, 37.1, 37.4, 37.0]
            + [98.0, 98.0, 96.0, 98.0]
        ),
        "quality_status": ["VALID"] * 16,
        "is_synthetic": [True] * 16,
    })

    deviations_df = pd.DataFrame({
        "timestamp": timestamps * 4,
        "stream_id": (
            ["stream_sim_hr"] * 4
            + ["stream_sim_hrv"] * 4
            + ["stream_sim_temp"] * 4
            + ["stream_sim_spo2"] * 4
        ),
        "astronaut_id": ["ASTRO-01"] * 16,
        "value": [65.0, 68.0, 85.0, 66.0, 55.0, 52.0, 28.0, 54.0, 37.0, 37.1, 37.4, 37.0, 98.0, 98.0, 96.0, 98.0],
        "expected_mean": [65.0] * 4 + [55.0] * 4 + [37.0] * 4 + [98.0] * 4,
        "expected_std": [4.0] * 4 + [6.0] * 4 + [0.2] * 4 + [0.6] * 4,
        "z_score": [0.0, 0.75, 5.0, 0.25, 0.0, -0.5, -4.5, -0.16, 0.0, 0.5, 2.0, 0.0, 0.0, 0.0, -3.33, 0.0],
        "is_statistical_deviation": [False, False, True, False, False, False, True, False, False, False, True, False, False, False, True, False],
        "calibration_status": ["CALIBRATED"] * 16,
    })

    baseline_envelopes = {
        "stream_sim_hr": pd.DataFrame({
            "timestamp": timestamps,
            "mean": [65.0] * 4,
            "upper": [73.0] * 4,
            "lower": [57.0] * 4,
        }),
        "stream_sim_hrv": pd.DataFrame({
            "timestamp": timestamps,
            "mean": [55.0] * 4,
            "upper": [67.0] * 4,
            "lower": [43.0] * 4,
        }),
        "stream_sim_temp": pd.DataFrame({
            "timestamp": timestamps,
            "mean": [37.0] * 4,
            "upper": [37.4] * 4,
            "lower": [36.6] * 4,
        }),
        "stream_sim_spo2": pd.DataFrame({
            "timestamp": timestamps,
            "mean": [98.0] * 4,
            "upper": [99.2] * 4,
            "lower": [96.8] * 4,
        }),
    }

    event = HealthEvent(
        event_id="EVT-01",
        astronaut_id="ASTRO-01",
        event_type="EXPOSURE",
        severity_level=SeverityLevel.INVESTIGATE,
        start_time="2026-05-09T01:30:00Z",
        end_time="2026-05-09T02:30:00Z",
        contributing_stream_ids="stream_eda_co2,stream_sim_hr",
        rationale="Tripartite Concordance",
        uncertainty_level=UncertaintyLevel.LOW,
    )
    symptom = SymptomReport(
        report_id="SYM-01",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-05-09T02:15:00Z",
        reported_at="2026-05-09T03:00:00Z",
        cabin_module="Node 2",
    )

    fig = create_multi_lane_cohort_figure(
        env_df=env_df,
        vitals_df=vitals_df,
        deviations_df=deviations_df,
        baseline_envelopes=baseline_envelopes,
        events=[event],
        symptoms=[symptom],
        active_astronaut=astronaut,
    )

    assert isinstance(fig, go.Figure)
    # Check that layout has 4 subplots and dual secondary y-axes
    # Plotly subplots generate yaxis, yaxis2, yaxis3, yaxis4, yaxis5, yaxis6
    layout_keys = list(fig.layout.to_plotly_json().keys())
    assert "yaxis" in layout_keys
    assert "yaxis2" in layout_keys
    assert "yaxis3" in layout_keys
    assert "yaxis4" in layout_keys
    # Hover mode is x unified
    assert fig.layout.hovermode == "x unified"
    # Ensure traces exist for multiple lanes
    assert len(fig.data) >= 8


def test_create_multi_lane_cohort_figure_lttb_decimation():
    """Verify that >1,000 raw vitals points triggers selective LTTB decimation."""
    astronaut = Astronaut(
        astronaut_id="ASTRO-01",
        callsign="CDR A. Vance",
        mission_id="ISS-EXP-71",
        crew_role="Commander",
    )

    # Generate 1,500 points for stream_sim_hr
    n_points = 1500
    dates = pd.date_range("2026-05-01T00:00:00Z", periods=n_points, freq="5min", tz="UTC")
    ts_strs = [d.strftime("%Y-%m-%dT%H:%M:%SZ") for d in dates]

    vitals_df = pd.DataFrame({
        "stream_id": ["stream_sim_hr"] * n_points,
        "timestamp": ts_strs,
        "value": [65.0 + (i % 20) for i in range(n_points)],
        "quality_status": ["VALID"] * n_points,
        "is_synthetic": [True] * n_points,
    })

    fig = create_multi_lane_cohort_figure(
        env_df=pd.DataFrame(columns=["stream_id", "timestamp", "value", "quality_status"]),
        vitals_df=vitals_df,
        deviations_df=None,
        baseline_envelopes={},
        events=[],
        symptoms=[],
        active_astronaut=astronaut,
    )

    assert isinstance(fig, go.Figure)
    # Find the trace for HR
    hr_traces = [t for t in fig.data if "Heart Rate" in (t.name or "")]
    assert len(hr_traces) == 1
    # Trace points should be decimated to <= 1000
    assert len(hr_traces[0].x) <= 1000

