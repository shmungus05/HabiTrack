"""
wayfinder.ui.components.charts: Interactive Plotly WebGL dual-timeline and 4-lane cohort visualization components.
"""

from typing import Dict, List, Optional
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from wayfinder.core.models import (
    Astronaut,
    HealthEvent,
    SymptomReport,
    QualityStatus,
    SeverityLevel,
    CalibrationStatus,
)
from wayfinder.core.analytics import decimate_time_series


def create_dual_timeline_figure(
    env_df: pd.DataFrame,
    vitals_df: pd.DataFrame,
    events: Optional[List[HealthEvent]] = None,
    symptoms: Optional[List[SymptomReport]] = None,
) -> go.Figure:
    """
    Renders a synchronized dual-lane Plotly WebGL chart comparing authentic environmental
    exposure against autonomous physiological vitals.
    """
    fig = make_subplots(
        rows=2,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.08,
        subplot_titles=(
            "Environmental Telemetry — Cabin CO2 Partial Pressure [AUTHENTIC NASA EDA]",
            "Autonomous Physiological Vitals — Heart Rate & SpO2 [SIMULATED VITALS]",
        ),
        row_heights=[0.5, 0.5],
    )

    # 1. Environmental Telemetry (Lane 1)
    if not env_df.empty:
        co2_data = env_df[env_df["stream_id"] == "stream_eda_co2"].sort_values("timestamp")
        # Filter out gap values for line drawing
        valid_co2 = co2_data[co2_data["quality_status"] != QualityStatus.GAP.value]
        
        if not valid_co2.empty:
            fig.add_trace(
                go.Scattergl(
                    x=valid_co2["timestamp"],
                    y=valid_co2["value"],
                    mode="lines",
                    name="Cabin CO2 (mmHg)",
                    line=dict(color="#38bdf8", width=2),
                    hovertemplate="%{x}<br>P_CO2: %{y:.2f} mmHg<extra></extra>",
                ),
                row=1,
                col=1,
            )

            # Highlight suspect points if any
            suspect_co2 = valid_co2[valid_co2["quality_status"] == QualityStatus.SUSPECT.value]
            if not suspect_co2.empty:
                fig.add_trace(
                    go.Scattergl(
                        x=suspect_co2["timestamp"],
                        y=suspect_co2["value"],
                        mode="markers",
                        name="Suspect Reading",
                        marker=dict(color="#ef4444", size=8, symbol="x"),
                    ),
                    row=1,
                    col=1,
                )

    # Threshold horizontal reference lines on Lane 1
    fig.add_hline(
        y=3.0,
        line_dash="dot",
        line_color="#22c55e",
        annotation_text="3.0 mmHg Nominal Limit",
        annotation_position="top left",
        row=1,
        col=1,
    )
    fig.add_hline(
        y=4.0,
        line_dash="dash",
        line_color="#f59e0b",
        annotation_text="4.0 mmHg Elevated Limit",
        annotation_position="top left",
        row=1,
        col=1,
    )
    fig.add_hline(
        y=4.5,
        line_dash="dash",
        line_color="#ef4444",
        annotation_text="4.5 mmHg Headache Excursion Threshold",
        annotation_position="bottom left",
        row=1,
        col=1,
    )

    # 2. Physiological Vitals (Lane 2)
    if not vitals_df.empty:
        hr_data = vitals_df[vitals_df["stream_id"] == "stream_sim_hr"].sort_values("timestamp")
        valid_hr = hr_data[hr_data["quality_status"] != QualityStatus.GAP.value]
        if not valid_hr.empty:
            fig.add_trace(
                go.Scattergl(
                    x=valid_hr["timestamp"],
                    y=valid_hr["value"],
                    mode="lines",
                    name="Heart Rate (bpm)",
                    line=dict(color="#fbbf24", width=2),
                    hovertemplate="%{x}<br>Heart Rate: %{y:.1f} bpm<extra></extra>",
                ),
                row=2,
                col=1,
            )

        spo2_data = vitals_df[vitals_df["stream_id"] == "stream_sim_spo2"].sort_values("timestamp")
        valid_spo2 = spo2_data[spo2_data["quality_status"] != QualityStatus.GAP.value]
        if not valid_spo2.empty:
            fig.add_trace(
                go.Scattergl(
                    x=valid_spo2["timestamp"],
                    y=valid_spo2["value"],
                    mode="lines",
                    name="SpO2 (%)",
                    line=dict(color="#34d399", width=1.5, dash="dot"),
                    hovertemplate="%{x}<br>SpO2: %{y:.1f}%<extra></extra>",
                ),
                row=2,
                col=1,
            )

    # 3. Exposure Event Shaded Regions
    if events:
        for evt in events:
            fill_color = "rgba(239, 68, 68, 0.12)" if evt.severity_level == SeverityLevel.INVESTIGATE else "rgba(245, 158, 11, 0.10)"
            fig.add_vrect(
                x0=evt.start_time,
                x1=evt.end_time,
                fillcolor=fill_color,
                layer="below",
                line_width=1,
                line_dash="dot",
                line_color="#f87171" if evt.severity_level == SeverityLevel.INVESTIGATE else "#fbbf24",
                annotation_text=f"Event Window ({evt.severity_level.value})",
                annotation_position="top left",
            )

    # 4. Symptom Marker Vertical Lines
    if symptoms:
        for sym in symptoms:
            fig.add_vline(
                x=sym.occurred_at,
                line_width=2,
                line_dash="solid",
                line_color="#c084fc",
                annotation_text=f"Symptom: {sym.symptom_code} (Sev {sym.severity})",
                annotation_position="bottom right",
            )

    # 5. Gap Interval Overlays
    if not env_df.empty:
        gap_rows = env_df[env_df["quality_status"] == QualityStatus.GAP.value]
        for _, g in gap_rows.iterrows():
            fig.add_vline(
                x=g["timestamp"],
                line_width=3,
                line_dash="dot",
                line_color="#64748b",
                annotation_text="Sensor Gap",
                annotation_position="top",
            )

    # Chart Layout
    fig.update_layout(
        template="plotly_dark",
        plot_bgcolor="#0b0f19",
        paper_bgcolor="#0b0f19",
        height=580,
        margin=dict(l=50, r=30, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1.0),
        hovermode="x unified",
    )

    fig.update_yaxes(title_text="P_CO2 (mmHg)", row=1, col=1, gridcolor="#1e293b")
    fig.update_yaxes(title_text="Vitals (bpm / %)", row=2, col=1, gridcolor="#1e293b")
    fig.update_xaxes(title_text="Timestamp (UTC)", row=2, col=1, gridcolor="#1e293b")

    return fig


def _decimate_stream_if_needed(stream_df: pd.DataFrame, max_points: int = 1000) -> pd.DataFrame:
    """Downsamples stream DataFrame using LTTB only if length exceeds max_points."""
    if stream_df.empty or len(stream_df) <= max_points:
        return stream_df
    return decimate_time_series(stream_df, max_points=max_points)


def create_multi_lane_cohort_figure(
    env_df: pd.DataFrame,
    vitals_df: pd.DataFrame,
    deviations_df: Optional[pd.DataFrame] = None,
    baseline_envelopes: Optional[Dict[str, pd.DataFrame]] = None,
    events: Optional[List[HealthEvent]] = None,
    symptoms: Optional[List[SymptomReport]] = None,
    active_astronaut: Optional[Astronaut] = None,
) -> go.Figure:
    """
    Renders a simultaneous 4-lane synchronized Plotly WebGL timeline viewport with dual y-axes,
    baseline circadian ribbons, and concordance deviation heatmap.
    """
    callsign = active_astronaut.callsign if active_astronaut else "Crewmember"

    fig = make_subplots(
        rows=4,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.06,
        subplot_titles=(
            "Lane 1: Cabin Atmosphere — ISS Environmental Telemetry [AUTHENTIC NASA EDA]",
            f"Lane 2: Cardiovascular & Autonomic Tone — {callsign} [SIMULATED VITALS]",
            f"Lane 3: Thermoregulation & Oxygenation — {callsign} [SIMULATED VITALS]",
            "Lane 4: Statistical Deviation & Concordance Heatmap [MULTI-SIGNAL CONCORDANCE]",
        ),
        specs=[
            [{"secondary_y": False}],
            [{"secondary_y": True}],
            [{"secondary_y": True}],
            [{"secondary_y": False}],
        ],
        row_heights=[0.25, 0.25, 0.25, 0.25],
    )

    baseline_envelopes = baseline_envelopes or {}

    # -------------------------------------------------------------
    # Lane 1: Cabin Atmosphere (Authentic NASA EDA)
    # -------------------------------------------------------------
    if not env_df.empty and "stream_id" in env_df.columns:
        co2_data = env_df[env_df["stream_id"] == "stream_eda_co2"].sort_values("timestamp")
        valid_co2 = co2_data[co2_data["quality_status"] != QualityStatus.GAP.value]
        dec_co2 = _decimate_stream_if_needed(valid_co2, 1000)
        if not dec_co2.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_co2["timestamp"],
                    y=dec_co2["value"],
                    mode="lines",
                    name="Cabin P_CO2 (mmHg)",
                    line=dict(color="#06b6d4", width=2),
                    hovertemplate="%{x}<br>P_CO2: %{y:.2f} mmHg<extra></extra>",
                ),
                row=1,
                col=1,
                secondary_y=False,
            )

        temp_data = env_df[env_df["stream_id"] == "stream_eda_temp"].sort_values("timestamp")
        valid_temp = temp_data[temp_data["quality_status"] != QualityStatus.GAP.value]
        dec_temp = _decimate_stream_if_needed(valid_temp, 1000)
        if not dec_temp.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_temp["timestamp"],
                    y=dec_temp["value"],
                    mode="lines",
                    name="Cabin Temp (°C)",
                    line=dict(color="#3b82f6", width=2),
                    hovertemplate="%{x}<br>Cabin Temp: %{y:.1f} °C<extra></extra>",
                ),
                row=1,
                col=1,
                secondary_y=False,
            )

        # EDA Gap Hatched Overlays on Lane 1
        gap_rows = env_df[env_df["quality_status"] == QualityStatus.GAP.value].sort_values("timestamp")
        if not gap_rows.empty:
            gap_ts_list = pd.to_datetime(gap_rows["timestamp"], utc=True).drop_duplicates().tolist()
            if gap_ts_list:
                gap_spans = []
                curr_start = gap_ts_list[0]
                prev_ts = gap_ts_list[0]
                for ts in gap_ts_list[1:]:
                    if (ts - prev_ts).total_seconds() > 3600:
                        gap_spans.append((curr_start, prev_ts + pd.Timedelta(minutes=5)))
                        curr_start = ts
                    prev_ts = ts
                gap_spans.append((curr_start, prev_ts + pd.Timedelta(minutes=5)))

                for s_start, s_end in gap_spans:
                    fig.add_vrect(
                        x0=s_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        x1=s_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        fillcolor="rgba(100, 116, 139, 0.25)",
                        layer="below",
                        line_width=1,
                        line_dash="dot",
                        line_color="#64748b",
                        annotation_text="TELEMETRY GAP",
                        annotation_position="top left",
                        row=1,
                        col=1,
                    )

    # 4.5 mmHg threshold line on Lane 1
    fig.add_hline(
        y=4.5,
        line_dash="dash",
        line_color="#ef4444",
        annotation_text="4.5 mmHg Headache Excursion Threshold",
        annotation_position="bottom left",
        row=1,
        col=1,
    )

    is_calibrating = (
        active_astronaut.calibration_status == CalibrationStatus.CALIBRATING
        if active_astronaut is not None
        else False
    )

    # -------------------------------------------------------------
    # Lane 2: Cardiovascular & Autonomic Tone
    # Left y-axis: Heart Rate (bpm); Right y-axis: RMSSD (ms)
    # -------------------------------------------------------------
    # 2a. Baseline Ribbons (bypass decimation)
    if "stream_sim_hr" in baseline_envelopes:
        hr_env = baseline_envelopes["stream_sim_hr"]
        if not hr_env.empty:
            if "upper" in hr_env.columns and "lower" in hr_env.columns:
                u_hr = hr_env["upper"]
                l_hr = hr_env["lower"]
            else:
                hr_sigma = 4.0 if is_calibrating else (hr_env["std"] if "std" in hr_env.columns else 4.0)
                hr_mult = 3.0 if is_calibrating else 2.0
                u_hr = hr_env["mean"] + hr_mult * hr_sigma
                l_hr = hr_env["mean"] - hr_mult * hr_sigma
            fig.add_trace(
                go.Scattergl(
                    x=hr_env["timestamp"],
                    y=u_hr,
                    mode="lines",
                    line=dict(width=0),
                    showlegend=False,
                    hoverinfo="skip",
                ),
                row=2,
                col=1,
                secondary_y=False,
            )
            fig.add_trace(
                go.Scattergl(
                    x=hr_env["timestamp"],
                    y=l_hr,
                    mode="lines",
                    line=dict(width=0),
                    fill="tonexty",
                    fillcolor="rgba(245, 158, 11, 0.18)",
                    name="HR Baseline [μ ± 3σ_prior]" if is_calibrating else "HR Baseline [μ ± 2σ]",
                    hoverinfo="skip",
                ),
                row=2,
                col=1,
                secondary_y=False,
            )

    if "stream_sim_hrv" in baseline_envelopes:
        rmssd_env = baseline_envelopes["stream_sim_hrv"]
        if not rmssd_env.empty:
            if "upper" in rmssd_env.columns and "lower" in rmssd_env.columns:
                u_rmssd = rmssd_env["upper"]
                l_rmssd = rmssd_env["lower"]
            else:
                rmssd_sigma = 6.0 if is_calibrating else (rmssd_env["std"] if "std" in rmssd_env.columns else 6.0)
                rmssd_mult = 3.0 if is_calibrating else 2.0
                u_rmssd = rmssd_env["mean"] + rmssd_mult * rmssd_sigma
                l_rmssd = rmssd_env["mean"] - rmssd_mult * rmssd_sigma
            fig.add_trace(
                go.Scattergl(
                    x=rmssd_env["timestamp"],
                    y=u_rmssd,
                    mode="lines",
                    line=dict(width=0),
                    showlegend=False,
                    hoverinfo="skip",
                ),
                row=2,
                col=1,
                secondary_y=True,
            )
            fig.add_trace(
                go.Scattergl(
                    x=rmssd_env["timestamp"],
                    y=l_rmssd,
                    mode="lines",
                    line=dict(width=0),
                    fill="tonexty",
                    fillcolor="rgba(16, 185, 129, 0.18)",
                    name="RMSSD Baseline [μ ± 3σ_prior]" if is_calibrating else "RMSSD Baseline [μ ± 2σ]",
                    hoverinfo="skip",
                ),
                row=2,
                col=1,
                secondary_y=True,
            )

    # 2b. Vitals Traces (LTTB decimated if > 1,000 points)
    if not vitals_df.empty and "stream_id" in vitals_df.columns:
        hr_data = vitals_df[vitals_df["stream_id"] == "stream_sim_hr"].sort_values("timestamp")
        valid_hr = hr_data[hr_data["quality_status"] != QualityStatus.GAP.value]
        dec_hr = _decimate_stream_if_needed(valid_hr, 1000)
        if not dec_hr.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_hr["timestamp"],
                    y=dec_hr["value"],
                    mode="lines",
                    name="Heart Rate (bpm) [◌ MOCK VITALS]",
                    line=dict(color="#fbbf24", width=2, dash="dash"),
                    hovertemplate="%{x}<br>Heart Rate: %{y:.1f} bpm<extra></extra>",
                ),
                row=2,
                col=1,
                secondary_y=False,
            )

        rmssd_data = vitals_df[vitals_df["stream_id"] == "stream_sim_hrv"].sort_values("timestamp")
        valid_rmssd = rmssd_data[rmssd_data["quality_status"] != QualityStatus.GAP.value]
        dec_rmssd = _decimate_stream_if_needed(valid_rmssd, 1000)
        if not dec_rmssd.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_rmssd["timestamp"],
                    y=dec_rmssd["value"],
                    mode="lines",
                    name="RMSSD (ms) [◌ MOCK VITALS]",
                    line=dict(color="#10b981", width=2, dash="dash"),
                    hovertemplate="%{x}<br>RMSSD: %{y:.1f} ms<extra></extra>",
                ),
                row=2,
                col=1,
                secondary_y=True,
            )

    # -------------------------------------------------------------
    # Lane 3: Thermoregulation & Oxygenation
    # Left y-axis: Core Temp (°C); Right y-axis: SpO2 (%)
    # -------------------------------------------------------------
    # 3a. Baseline Ribbons (bypass decimation)
    if "stream_sim_temp" in baseline_envelopes:
        temp_env = baseline_envelopes["stream_sim_temp"]
        if not temp_env.empty:
            if "upper" in temp_env.columns and "lower" in temp_env.columns:
                u_temp = temp_env["upper"]
                l_temp = temp_env["lower"]
            else:
                temp_sigma = 0.2 if is_calibrating else (temp_env["std"] if "std" in temp_env.columns else 0.2)
                temp_mult = 3.0 if is_calibrating else 2.0
                u_temp = temp_env["mean"] + temp_mult * temp_sigma
                l_temp = temp_env["mean"] - temp_mult * temp_sigma
            fig.add_trace(
                go.Scattergl(
                    x=temp_env["timestamp"],
                    y=u_temp,
                    mode="lines",
                    line=dict(width=0),
                    showlegend=False,
                    hoverinfo="skip",
                ),
                row=3,
                col=1,
                secondary_y=False,
            )
            fig.add_trace(
                go.Scattergl(
                    x=temp_env["timestamp"],
                    y=l_temp,
                    mode="lines",
                    line=dict(width=0),
                    fill="tonexty",
                    fillcolor="rgba(244, 63, 94, 0.18)",
                    name="Core Temp Baseline [μ ± 3σ_prior]" if is_calibrating else "Core Temp Baseline [μ ± 2σ]",
                    hoverinfo="skip",
                ),
                row=3,
                col=1,
                secondary_y=False,
            )

    if "stream_sim_spo2" in baseline_envelopes:
        spo2_env = baseline_envelopes["stream_sim_spo2"]
        if not spo2_env.empty:
            if "upper" in spo2_env.columns and "lower" in spo2_env.columns:
                u_spo2 = spo2_env["upper"]
                l_spo2 = spo2_env["lower"]
            else:
                spo2_sigma = 0.6 if is_calibrating else (spo2_env["std"] if "std" in spo2_env.columns else 0.6)
                spo2_mult = 3.0 if is_calibrating else 2.0
                u_spo2 = spo2_env["mean"] + spo2_mult * spo2_sigma
                l_spo2 = spo2_env["mean"] - spo2_mult * spo2_sigma
            fig.add_trace(
                go.Scattergl(
                    x=spo2_env["timestamp"],
                    y=u_spo2,
                    mode="lines",
                    line=dict(width=0),
                    showlegend=False,
                    hoverinfo="skip",
                ),
                row=3,
                col=1,
                secondary_y=True,
            )
            fig.add_trace(
                go.Scattergl(
                    x=spo2_env["timestamp"],
                    y=l_spo2,
                    mode="lines",
                    line=dict(width=0),
                    fill="tonexty",
                    fillcolor="rgba(59, 130, 246, 0.18)",
                    name="SpO2 Baseline [μ ± 3σ_prior]" if is_calibrating else "SpO2 Baseline [μ ± 2σ]",
                    hoverinfo="skip",
                ),
                row=3,
                col=1,
                secondary_y=True,
            )

    # 3b. Vitals Traces (LTTB decimated if > 1,000 points)
    if not vitals_df.empty and "stream_id" in vitals_df.columns:
        core_temp_data = vitals_df[vitals_df["stream_id"] == "stream_sim_temp"].sort_values("timestamp")
        valid_core_temp = core_temp_data[core_temp_data["quality_status"] != QualityStatus.GAP.value]
        dec_core_temp = _decimate_stream_if_needed(valid_core_temp, 1000)
        if not dec_core_temp.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_core_temp["timestamp"],
                    y=dec_core_temp["value"],
                    mode="lines",
                    name="Core Temp (°C) [◌ MOCK VITALS]",
                    line=dict(color="#f43f5e", width=2, dash="dash"),
                    hovertemplate="%{x}<br>Core Temp: %{y:.2f} °C<extra></extra>",
                ),
                row=3,
                col=1,
                secondary_y=False,
            )

        spo2_data = vitals_df[vitals_df["stream_id"] == "stream_sim_spo2"].sort_values("timestamp")
        valid_spo2 = spo2_data[spo2_data["quality_status"] != QualityStatus.GAP.value]
        dec_spo2 = _decimate_stream_if_needed(valid_spo2, 1000)
        if not dec_spo2.empty:
            fig.add_trace(
                go.Scattergl(
                    x=dec_spo2["timestamp"],
                    y=dec_spo2["value"],
                    mode="lines",
                    name="SpO2 (%) [◌ MOCK VITALS]",
                    line=dict(color="#3b82f6", width=2, dash="dash"),
                    hovertemplate="%{x}<br>SpO2: %{y:.1f}%<extra></extra>",
                ),
                row=3,
                col=1,
                secondary_y=True,
            )

    # -------------------------------------------------------------
    # Lane 4: Statistical Deviation & Concordance Heatmap
    # -------------------------------------------------------------
    has_lane4_content = False
    if deviations_df is not None and not deviations_df.empty:
        # Pivot deviations by timestamp and stream_id
        pivot_z = deviations_df.pivot_table(
            index="timestamp",
            columns="stream_id",
            values="z_score",
            aggfunc="first",
        ).reset_index()

        abs_hr = pivot_z["stream_sim_hr"].abs() if "stream_sim_hr" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)
        abs_rmssd = pivot_z["stream_sim_hrv"].abs() if "stream_sim_hrv" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)
        abs_temp = pivot_z["stream_sim_temp"].abs() if "stream_sim_temp" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)
        abs_spo2 = pivot_z["stream_sim_spo2"].abs() if "stream_sim_spo2" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)

        composite_z = pd.concat([abs_hr, abs_rmssd, abs_temp, abs_spo2], axis=1).max(axis=1)
        pivot_z["composite_z"] = composite_z

        z_hr = pivot_z["stream_sim_hr"] if "stream_sim_hr" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)
        z_rmssd = pivot_z["stream_sim_hrv"] if "stream_sim_hrv" in pivot_z.columns else pd.Series(0.0, index=pivot_z.index)
        autonomic_shift = (z_hr >= 2.0) & (z_rmssd <= -2.0)

        critical_mask = (composite_z >= 3.0) | autonomic_shift
        elevated_mask = (composite_z >= 2.0) & (~critical_mask)

        scores = np.zeros(len(pivot_z), dtype=int)
        scores[elevated_mask] = 1
        scores[critical_mask] = 2

        fig.add_trace(
            go.Heatmap(
                x=pivot_z["timestamp"],
                y=["Concordance"],
                z=[scores.tolist()],
                colorscale=[
                    [0.0, "#334155"],
                    [0.33, "#334155"],
                    [0.34, "#0ea5e9"],
                    [0.66, "#0ea5e9"],
                    [0.67, "#d946ef"],
                    [1.0, "#d946ef"],
                ],
                zmin=0,
                zmax=2,
                showscale=False,
                name="Deviation Ramp",
                hovertemplate="%{x}<br>Composite |Z|: %{customdata:.2f}<extra></extra>",
                customdata=composite_z.tolist(),
            ),
            row=4,
            col=1,
            secondary_y=False,
        )
        has_lane4_content = True

        # Render glyph markers on Lane 4
        elevated_pts = pivot_z[elevated_mask]
        if not elevated_pts.empty:
            fig.add_trace(
                go.Scattergl(
                    x=elevated_pts["timestamp"],
                    y=["Concordance"] * len(elevated_pts),
                    mode="markers",
                    marker=dict(symbol="triangle-up", color="#0ea5e9", size=10),
                    name="Elevated Deviation (|Z| ≥ 2.0)",
                    hovertemplate="%{x}<br>Elevated |Z|: %{customdata:.2f}<extra></extra>",
                    customdata=elevated_pts["composite_z"],
                ),
                row=4,
                col=1,
                secondary_y=False,
            )

        critical_pts = pivot_z[critical_mask]
        if not critical_pts.empty:
            fig.add_trace(
                go.Scattergl(
                    x=critical_pts["timestamp"],
                    y=["Concordance"] * len(critical_pts),
                    mode="markers",
                    marker=dict(symbol="diamond", color="#d946ef", size=12),
                    name="Critical Concordance (|Z| ≥ 3.0)",
                    hovertemplate="%{x}<br>Critical Concordance (|Z|: %{customdata:.2f})<extra></extra>",
                    customdata=critical_pts["composite_z"],
                ),
                row=4,
                col=1,
                secondary_y=False,
            )

    # Symptom upright violet diamond markers on Lane 4
    if symptoms:
        sym_x = [s.occurred_at for s in symptoms]
        sym_text = [
            f"Symptom: {s.symptom_code} (Severity {s.severity}/5, {s.cabin_module or 'ISS'})"
            for s in symptoms
        ]
        fig.add_trace(
            go.Scatter(
                x=sym_x,
                y=["Concordance"] * len(symptoms),
                mode="markers",
                marker=dict(
                    symbol="diamond",
                    color="#a855f7",
                    size=13,
                    line=dict(color="#ffffff", width=1.5),
                ),
                name="Crew Symptom Report",
                hovertemplate="%{x}<br>%{text}<extra></extra>",
                text=sym_text,
            ),
            row=4,
            col=1,
            secondary_y=False,
        )
        has_lane4_content = True

        for sym in symptoms:
            fig.add_vline(
                x=sym.occurred_at,
                line_width=1.5,
                line_dash="dot",
                line_color="#c084fc",
                annotation_text=f"Symptom: {sym.symptom_code} (Sev {sym.severity})",
                annotation_position="bottom right",
            )

    # If Lane 4 had neither deviations nor symptoms, provide a placeholder trace to ensure subplot layout stability
    if not has_lane4_content:
        fig.add_trace(
            go.Scatter(
                x=[],
                y=[],
                mode="markers",
                name="Nominal Deviation",
                showlegend=False,
            ),
            row=4,
            col=1,
            secondary_y=False,
        )

    # -------------------------------------------------------------
    # Exposure Event Shaded Regions
    # -------------------------------------------------------------
    if events:
        for evt in events:
            fill_color = (
                "rgba(239, 68, 68, 0.12)"
                if evt.severity_level == SeverityLevel.INVESTIGATE
                else "rgba(245, 158, 11, 0.10)"
            )
            line_color = (
                "#f87171"
                if evt.severity_level == SeverityLevel.INVESTIGATE
                else "#fbbf24"
            )
            fig.add_vrect(
                x0=evt.start_time,
                x1=evt.end_time,
                fillcolor=fill_color,
                layer="below",
                line_width=1,
                line_dash="dot",
                line_color=line_color,
                annotation_text=f"Event Window ({evt.severity_level.value})",
                annotation_position="top left",
            )

    # -------------------------------------------------------------
    # Overall Layout & Per-Axis Scaling
    # -------------------------------------------------------------
    fig.update_layout(
        template="plotly_dark",
        plot_bgcolor="#0b0f19",
        paper_bgcolor="#0b0f19",
        height=850,
        margin=dict(l=60, r=60, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1.0),
        hovermode="x unified",
    )

    # Row 1
    fig.update_yaxes(title_text="P_CO2 (mmHg) / °C", row=1, col=1, gridcolor="#1e293b")
    # Row 2
    fig.update_yaxes(title_text="Heart Rate (bpm)", row=2, col=1, secondary_y=False, gridcolor="#1e293b")
    fig.update_yaxes(title_text="RMSSD (ms)", row=2, col=1, secondary_y=True, gridcolor="#1e293b")
    # Row 3
    fig.update_yaxes(title_text="Core Temp (°C)", range=[35.5, 39.0], row=3, col=1, secondary_y=False, gridcolor="#1e293b")
    fig.update_yaxes(title_text="SpO2 (%)", range=[88.0, 101.0], row=3, col=1, secondary_y=True, gridcolor="#1e293b")
    # Row 4
    fig.update_yaxes(title_text="Deviation", row=4, col=1, gridcolor="#1e293b")
    # Shared X Axis
    fig.update_xaxes(title_text="Timestamp (UTC)", row=4, col=1, gridcolor="#1e293b")

    return fig
