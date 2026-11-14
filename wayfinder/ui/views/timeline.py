"""
wayfinder.ui.views.timeline: Simultaneous 4-lane synchronized exposure timeline with LTTB decimation.
"""

from typing import Tuple, Union, Dict, List, Optional
import streamlit as st
import pandas as pd

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import HealthEvent, SymptomReport, Astronaut, CalibrationStatus, SeverityLevel
from wayfinder.core.baselines import (
    compute_circadian_hourly_bins,
    evaluate_measurement_deviations,
    get_resting_baseline,
    get_prior_std,
)
from wayfinder.ui.components.charts import (
    create_multi_lane_cohort_figure,
    create_dual_timeline_figure,
)


@st.cache_data(ttl=60)
def fetch_timeline_data(db_path: str, astronaut_id: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Caches expensive telemetry reads for 60 seconds per Section 2.4.4."""
    storage = StorageManager(db_path)
    env_df = storage.get_measurements_df(
        stream_ids=["stream_eda_co2", "stream_eda_temp", "stream_eda_pressure"]
    )
    vitals_df = storage.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"],
        astronaut_id=astronaut_id,
    )
    return env_df, vitals_df


def render_timeline_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None:
    """Renders the simultaneous 4-lane synchronized timeline viewport with LTTB decimation and zoom persistence."""
    if isinstance(astronaut_or_id, Astronaut):
        astronaut = astronaut_or_id
        astronaut_id = astronaut.astronaut_id
    else:
        astronaut_id = str(astronaut_or_id)
        fetched = storage_manager.get_astronaut(astronaut_id)
        astronaut = fetched if fetched else Astronaut(
            astronaut_id=astronaut_id,
            callsign=astronaut_id,
            mission_id="ISS-EXP-71",
            crew_role="Crewmember",
        )

    st.markdown('<h2 style="font-weight: 900; letter-spacing: -0.03em;">Simultaneous 4-Lane Exposure Timeline</h2>', unsafe_allow_html=True)
    st.markdown(
        f'<p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem;">'
        f'Synchronized 4-lane WebGL console displaying authentic ISS environmental telemetry, autonomic tone ribbons, '
        f'thermoregulation, and multi-signal concordance for <strong style="color: #f8fafc;">{astronaut.callsign}</strong> ({astronaut.astronaut_id}).'
        f'</p>',
        unsafe_allow_html=True,
    )

    # 1. Query raw environmental and physiological telemetry with 60s TTL cache
    env_df, vitals_df = fetch_timeline_data(storage_manager.db_path, astronaut_id)

    if env_df.empty and vitals_df.empty:
        st.warning("No telemetry measurements found in database. Ingest sample data from the sidebar to begin.")
        return

    # 2. Query symptoms and events for active astronaut
    with storage_manager.get_connection() as conn:
        sym_rows = conn.execute(
            "SELECT * FROM symptom_reports WHERE astronaut_id = ? ORDER BY occurred_at;",
            (astronaut_id,),
        ).fetchall()
        symptoms = [SymptomReport(**dict(r)) for r in sym_rows]

        evt_rows = conn.execute(
            "SELECT * FROM health_events WHERE astronaut_id = ? ORDER BY start_time;",
            (astronaut_id,),
        ).fetchall()
        events = [HealthEvent(**dict(r)) for r in evt_rows]

    # 3. Compute circadian hourly bins & baseline ribbons
    bin_stats = compute_circadian_hourly_bins(vitals_df, astronaut)

    baseline_envelopes: Dict[str, pd.DataFrame] = {}
    if not vitals_df.empty and "timestamp" in vitals_df.columns:
        dt_series = pd.to_datetime(vitals_df["timestamp"], utc=True)
        min_dt = dt_series.min().floor("h")
        max_dt = dt_series.max().ceil("h")
        hourly_dts = pd.date_range(min_dt, max_dt, freq="1h", tz="UTC")
        hourly_ts_strs = [d.strftime("%Y-%m-%dT%H:%M:%SZ") for d in hourly_dts]

        for stream_id in ["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"]:
            means, stds, uppers, lowers = [], [], [], []
            prior_s = get_prior_std(stream_id)
            for d in hourly_dts:
                b_stat = bin_stats.get((stream_id, d.hour))
                if b_stat:
                    m, s = b_stat.mean, b_stat.std
                    cal_status = b_stat.calibration_status
                else:
                    m = get_resting_baseline(astronaut, stream_id)
                    s = prior_s
                    cal_status = CalibrationStatus.CALIBRATING
                means.append(m)
                stds.append(s)

                # Spec line 254: Sparse-History Calibration Guard:
                # When CALIBRATING: widen visual ribbon to [mu +/- 3 * sigma_prior]
                # When CALIBRATED: standard visual ribbon [mu +/- 2 * sigma]
                if cal_status == CalibrationStatus.CALIBRATING:
                    uppers.append(m + 3.0 * prior_s)
                    lowers.append(m - 3.0 * prior_s)
                else:
                    uppers.append(m + 2.0 * s)
                    lowers.append(m - 2.0 * s)
            baseline_envelopes[stream_id] = pd.DataFrame({
                "timestamp": hourly_ts_strs,
                "mean": means,
                "std": stds,
                "upper": uppers,
                "lower": lowers,
            })

    # 4. Evaluate deviations across vitals
    deviations_df = evaluate_measurement_deviations(vitals_df, bin_stats, astronaut)

    # 5. Decimation performance metrics bar
    raw_env_count = len(env_df)
    raw_vitals_count = len(vitals_df)
    active_deviations_count = int(deviations_df["is_statistical_deviation"].sum()) if not deviations_df.empty else 0

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Environmental Points", f"{raw_env_count:,}", delta="Authentic ISS EDA")
    with col2:
        st.metric("Physiological Points", f"{raw_vitals_count:,}", delta="Autonomous Mock Vitals")
    with col3:
        st.metric("Statistical Deviations (|Z| ≥ 2)", f"{active_deviations_count:,}")
    with col4:
        st.metric("Active Correlated Events", len(events))

    # 6. Viewport Zoom Persistence Toolbar (derived dynamically from vitals timestamps)
    if not vitals_df.empty and "timestamp" in vitals_df.columns:
        v_min_dt = pd.to_datetime(vitals_df["timestamp"].min(), utc=True)
        v_max_dt = pd.to_datetime(vitals_df["timestamp"].max(), utc=True)
    elif not env_df.empty and "timestamp" in env_df.columns:
        v_min_dt = pd.to_datetime(env_df["timestamp"].min(), utc=True)
        v_max_dt = pd.to_datetime(env_df["timestamp"].max(), utc=True)
    else:
        v_min_dt = pd.to_datetime("2026-07-01T00:00:00Z", utc=True)
        v_max_dt = pd.to_datetime("2026-07-14T23:59:59Z", utc=True)

    # 72-Hour Focus Preset (dynamically derived)
    preset_72h_end = min(v_min_dt + pd.Timedelta(hours=72), v_max_dt)
    preset_72h = [
        v_min_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        preset_72h_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    ]

    # Excursion Focus Preset (dynamically centered on clinical event or mission midpoint)
    critical_events = [e for e in events if e.severity_level in (SeverityLevel.INVESTIGATE, SeverityLevel.OBSERVE)]
    if critical_events:
        center_dt = pd.to_datetime(critical_events[0].start_time, utc=True)
    elif symptoms:
        center_dt = pd.to_datetime(symptoms[0].occurred_at, utc=True)
    else:
        center_dt = v_min_dt + (v_max_dt - v_min_dt) / 2

    preset_excursion = [
        max(v_min_dt, center_dt - pd.Timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        min(v_max_dt, center_dt + pd.Timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    ]

    tb_col1, tb_col2, tb_col3, tb_col4 = st.columns([1.2, 1.2, 1.2, 2.4])
    with tb_col1:
        if st.button("Full Viewport", use_container_width=True):
            st.session_state["timeline_range"] = None
            st.rerun()
    with tb_col2:
        if st.button("Excursion Window", use_container_width=True):
            st.session_state["timeline_range"] = preset_excursion
            st.rerun()
    with tb_col3:
        if st.button("72-Hour Window", use_container_width=True):
            st.session_state["timeline_range"] = preset_72h
            st.rerun()
    with tb_col4:
        if st.session_state.get("timeline_range"):
            r_start, r_end = st.session_state["timeline_range"]
            st.caption(f"Persisted Viewport Zoom: `{r_start[:16]}` &rarr; `{r_end[:16]}`")
        else:
            st.caption("Temporal Viewport: Full Range (Unconstrained)")

    # 7. Render 4-Lane WebGL Figure
    fig = create_multi_lane_cohort_figure(
        env_df=env_df,
        vitals_df=vitals_df,
        deviations_df=deviations_df,
        baseline_envelopes=baseline_envelopes,
        events=events,
        symptoms=symptoms,
        active_astronaut=astronaut,
    )

    # Apply preserved zoom range if present
    if st.session_state.get("timeline_range"):
        fig.update_xaxes(range=st.session_state["timeline_range"])

    st.plotly_chart(fig, use_container_width=True)

    # 8. Timeline Legend & Interpretation Guide
    with st.expander("4-Lane Timeline Architecture & Operational Indicators Guide"):
        st.markdown(
            """
            * **Lane 1 (Cabin Atmosphere):** Authentic NASA ISS Cabin CO2 partial pressure ($P_{\\text{CO}_2}$, solid cyan) with red dashed $4.5\\,\\text{mmHg}$ threshold line, Cabin Temperature (solid blue), and gray diagonal hatched bands marking authentic ISS telemetry communication dropouts (`TELEMETRY GAP`).
            * **Lane 2 (Cardiovascular & Autonomic Tone):** Primary left y-axis: Heart Rate (bpm, amber dashed line `[◌ MOCK VITALS]`) bounded by $[\mu_{HR} \pm 2\sigma_{HR}]$ translucent shaded circadian baseline ribbon. Secondary right y-axis: RMSSD (ms, emerald dashed line `[◌ MOCK VITALS]`) bounded by $[\mu_{RMSSD} \pm 2\sigma_{RMSSD}]$ translucent ribbon.
            * **Lane 3 (Thermoregulation & Oxygenation):** Primary left y-axis: Core Body Temperature ($^\circ\\text{C}$, coral dashed line) with $[\mu \pm 2\sigma]$ ribbon. Secondary right y-axis: Blood Oxygen Saturation ($\text{SpO}_2\\,\\%$, royal blue dashed line) with $[\mu \pm 2\sigma]$ ribbon.
            * **Lane 4 (Deviation & Concordance Heatmap):** Colorblind-safe composite deviation heatmap ramp (`#334155` normal $|Z| < 2.0$, `#0ea5e9` elevated $|Z| \ge 2.0$, `#d946ef` critical $|Z| \ge 3.0$ or simultaneous autonomic shift). Upright violet diamond markers denote crew clinical symptom reports.
            * **Selective LTTB Decimation:** Decimation downsamples raw telemetry to 1,000 points per lane *only* when the raw point count exceeds 1,000. Hourly circadian baseline ribbons bypass decimation directly to preserve paired polygon bounds.
            """
        )
