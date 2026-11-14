"""
wayfinder.ui.views.overview: Mission Overview, personalized astronaut baselines, active clinical findings, and event review acknowledgment.
"""

from typing import List, Optional, Union
import streamlit as st
import pandas as pd

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import HealthEvent, ReviewStatus, SeverityLevel, Astronaut
from wayfinder.ui.components.badges import (
    render_provenance_badge,
    render_severity_badge,
    render_uncertainty_badge,
    render_review_badge,
    render_calibration_badge,
)


@st.cache_data(ttl=60)
def fetch_overview_metrics(db_path: str, astronaut_id: str):
    """Caches latest telemetry summary values for 60s per Section 2.4.4."""
    storage = StorageManager(db_path)
    with storage.get_connection() as conn:
        latest_co2_row = conn.execute(
            """
            SELECT value, timestamp, quality_status FROM measurements 
            WHERE stream_id = 'stream_eda_co2' 
            ORDER BY timestamp DESC LIMIT 1;
            """
        ).fetchone()

        latest_hr_row = conn.execute(
            """
            SELECT value, timestamp, quality_status FROM measurements 
            WHERE stream_id = 'stream_sim_hr' AND astronaut_id = ?
            ORDER BY timestamp DESC LIMIT 1;
            """,
            (astronaut_id,),
        ).fetchone()

        latest_rmssd_row = conn.execute(
            """
            SELECT value, timestamp, quality_status FROM measurements 
            WHERE stream_id = 'stream_sim_hrv' AND astronaut_id = ?
            ORDER BY timestamp DESC LIMIT 1;
            """,
            (astronaut_id,),
        ).fetchone()

        latest_temp_row = conn.execute(
            """
            SELECT value, timestamp, quality_status FROM measurements 
            WHERE stream_id = 'stream_sim_temp' AND astronaut_id = ?
            ORDER BY timestamp DESC LIMIT 1;
            """,
            (astronaut_id,),
        ).fetchone()

        latest_spo2_row = conn.execute(
            """
            SELECT value, timestamp, quality_status FROM measurements 
            WHERE stream_id = 'stream_sim_spo2' AND astronaut_id = ?
            ORDER BY timestamp DESC LIMIT 1;
            """,
            (astronaut_id,),
        ).fetchone()

    co2_val = float(latest_co2_row["value"]) if latest_co2_row else 3.2
    hr_val = float(latest_hr_row["value"]) if latest_hr_row else 65.0
    rmssd_val = float(latest_rmssd_row["value"]) if latest_rmssd_row else 55.0
    temp_val = float(latest_temp_row["value"]) if latest_temp_row else 37.0
    spo2_val = float(latest_spo2_row["value"]) if latest_spo2_row else 98.0

    return co2_val, hr_val, rmssd_val, temp_val, spo2_val


def render_overview_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None:
    """Renders the Mission Overview KPI dashboard and Clinical Review Audit trail."""
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

    st.markdown('<h2 style="font-weight: 900; letter-spacing: -0.03em;">Mission Telemetry & Clinical Overview</h2>', unsafe_allow_html=True)
    st.markdown(
        f'<p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem;">'
        f'Continuous environmental surveillance synchronized with personalized circadian baseline for '
        f'<strong style="color: #f8fafc;">{astronaut.callsign}</strong> ({astronaut.crew_role}).'
        f'</p>',
        unsafe_allow_html=True,
    )

    # 1. Fetch latest telemetry measurements with 60s TTL cache
    latest_co2, latest_hr, latest_rmssd, latest_temp, latest_spo2 = fetch_overview_metrics(storage_manager.db_path, astronaut_id)

    with storage_manager.get_connection() as conn:
        events_rows = conn.execute(
            """
            SELECT * FROM health_events 
            WHERE astronaut_id = ? 
            ORDER BY start_time DESC;
            """,
            (astronaut_id,),
        ).fetchall()

    events = [HealthEvent(**dict(r)) for r in events_rows]

    # 2. Concordance Status Indicator Banner
    has_investigate = any(e.severity_level == SeverityLevel.INVESTIGATE for e in events)
    has_observe = any(e.severity_level == SeverityLevel.OBSERVE for e in events)

    if has_investigate:
        st.markdown(
            """
            <div style="background: #450a0a; border: 1px solid #ef4444; border-radius: 20px; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="color: #fca5a5; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                            ⚠️ Operational Decision Support Event &bull; High Priority
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #ffffff; margin-top: 0.2rem;">
                            Tripartite Concordance Excursion Detected
                        </div>
                        <div style="color: #fecaca; font-size: 0.9rem; margin-top: 0.2rem;">
                            Cabin P_CO2 excursion coincident with crew clinical symptoms and autonomic tone shift (elevated HR, depressed RMSSD).
                        </div>
                    </div>
                    <div>
                        <span style="background-color: #ef4444; color: #ffffff; font-weight: 800; padding: 6px 14px; border-radius: 12px; font-size: 0.85rem;">
                            INVESTIGATE
                        </span>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    elif has_observe:
        st.markdown(
            """
            <div style="background: #3a2608; border: 1px solid #f59e0b; border-radius: 20px; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="color: #fde68a; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                            ⚡ Operational Health Observation
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #ffffff; margin-top: 0.2rem;">
                            Atmospheric Excursion or Clinical Discomfort Logged
                        </div>
                        <div style="color: #fef3c7; font-size: 0.9rem; margin-top: 0.2rem;">
                            Telemetry shows environmental or autonomic excursion without complete tripartite convergence. Continued observation advised.
                        </div>
                    </div>
                    <div>
                        <span style="background-color: #f59e0b; color: #000000; font-weight: 800; padding: 6px 14px; border-radius: 12px; font-size: 0.85rem;">
                            OBSERVE
                        </span>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            """
            <div style="background: #052e16; border: 1px solid #16a34a; border-radius: 20px; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="color: #86efac; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                            ● Nominal Concordance Status
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #ffffff; margin-top: 0.2rem;">
                            Physiological Vitals Tracking Circadian Baseline
                        </div>
                        <div style="color: #bbf7d0; font-size: 0.9rem; margin-top: 0.2rem;">
                            No discordant environmental excursions or unmanaged physiological transients detected.
                        </div>
                    </div>
                    <div>
                        <span style="background-color: #16a34a; color: #ffffff; font-weight: 800; padding: 6px 14px; border-radius: 12px; font-size: 0.85rem;">
                            NOMINAL
                        </span>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # 3. Personalized KPI Cards (Perplexity aesthetic, rounded-[24px])
    st.markdown('<div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.8rem; color: #f8fafc;">Personalized Physiological Baselines & Mission KPIs</div>', unsafe_allow_html=True)
    kpi_col1, kpi_col2, kpi_col3, kpi_col4 = st.columns(4)

    with kpi_col1:
        st.markdown(
            f"""
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 1.5rem; text-align: left;">
                <div style="color: #9ca3af; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">Cabin CO2 (P_CO2)</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: #f8fafc; margin: 0.4rem 0;">{latest_co2:.2f} <span style="font-size: 1rem; color: #64748b;">mmHg</span></div>
                <div>{render_provenance_badge('AUTHENTIC_NASA_EDA')}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with kpi_col2:
        st.markdown(
            f"""
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 1.5rem; text-align: left;">
                <div style="color: #9ca3af; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">Resting HR (Baseline: {astronaut.resting_hr:.0f})</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: #f8fafc; margin: 0.4rem 0;">{latest_hr:.0f} <span style="font-size: 1rem; color: #64748b;">bpm</span></div>
                <div>{render_provenance_badge('SYNTHETIC_SIMULATION', is_synthetic=True)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with kpi_col3:
        st.markdown(
            f"""
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 1.5rem; text-align: left;">
                <div style="color: #9ca3af; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">Resting RMSSD (Baseline: {astronaut.resting_rmssd:.0f})</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: #f8fafc; margin: 0.4rem 0;">{latest_rmssd:.0f} <span style="font-size: 1rem; color: #64748b;">ms</span></div>
                <div>{render_provenance_badge('SYNTHETIC_SIMULATION', is_synthetic=True)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with kpi_col4:
        st.markdown(
            f"""
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 1.5rem; text-align: left;">
                <div style="color: #9ca3af; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">Chronotype & Calibration</div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #f8fafc; margin: 0.4rem 0;">{astronaut.circadian_phase_shift_hours:+.1f}h <span style="font-size: 0.9rem; color: #64748b;">Phase Shift</span></div>
                <div>{render_calibration_badge(astronaut.calibration_status)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Sub-row for Active Module & Clinical Findings
    sub_col1, sub_col2 = st.columns(2)
    with sub_col1:
        st.markdown(
            f"""
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 1.1rem; margin-top: 1rem;">
                <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Active ECLSS Module:</span>
                <span style="font-weight: 800; font-size: 1rem; color: #f8fafc; margin-left: 0.5rem;">Node 2 Harmony &bull; Continuous Atmosphere Monitoring</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with sub_col2:
        pending_count = sum(1 for e in events if e.review_status == ReviewStatus.PENDING)
        badge_color = "#ef4444" if pending_count > 0 else "#22c55e"
        st.markdown(
            f"""
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 1.1rem; margin-top: 1rem;">
                <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Clinical Decision Findings:</span>
                <span style="font-weight: 800; font-size: 1rem; color: {badge_color}; margin-left: 0.5rem;">{pending_count} Pending Review</span>
                <span style="color: #64748b; font-size: 0.85rem; margin-left: 0.5rem;">({len(events)} Total Generated for {astronaut.astronaut_id})</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown('<div style="margin-top: 2.5rem;"></div>', unsafe_allow_html=True)

    # 4. Health Events Audit List (strictly filtered to active astronaut)
    st.markdown(f'<h3 style="font-weight: 900; letter-spacing: -0.02em;">Clinical Exposure Correlation Events — {astronaut.callsign}</h3>', unsafe_allow_html=True)

    if not events:
        st.info(f"No active health events generated for crewmember {astronaut.callsign} ({astronaut.astronaut_id}). Nominal mission status.")
        return

    for evt in events:
        with st.container():
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 1.5rem; margin-bottom: 1.2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                        <span style="font-weight: 800; font-size: 1.1rem; color: #f8fafc;">{evt.event_type} ({evt.event_id})</span>
                        <div>
                            {render_severity_badge(evt.severity_level.value)}
                            &nbsp;
                            {render_uncertainty_badge(evt.uncertainty_level.value)}
                            &nbsp;
                            {render_review_badge(evt.review_status.value)}
                        </div>
                    </div>
                    <div style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; margin-bottom: 0.8rem;">
                        {evt.rationale}
                    </div>
                    <div style="color: #64748b; font-size: 0.8rem;">
                        <span><strong>Window:</strong> {evt.start_time} — {evt.end_time}</span> | 
                        <span><strong>Streams:</strong> {evt.contributing_stream_ids}</span> | 
                        <span><strong>Review Notes:</strong> {evt.review_notes or 'None recorded'}</span>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # 5. Flight Surgeon / CMO Review Action Form (strictly filtered to active astronaut)
    st.markdown('<div style="margin-top: 1.5rem;"></div>', unsafe_allow_html=True)
    st.markdown(f'<h4 style="font-weight: 800;">Flight Surgeon / CMO Review Action — {astronaut.callsign}</h4>', unsafe_allow_html=True)

    pending_events = [e for e in events if e.review_status == ReviewStatus.PENDING]
    target_event_list = pending_events if pending_events else events

    with st.form("clinical_event_review_form"):
        event_options = {f"{e.event_id} — {e.event_type} ({e.severity_level.value})": e.event_id for e in target_event_list}
        selected_display = st.selectbox("Select Event to Review", options=list(event_options.keys()))
        selected_event_id = event_options[selected_display]

        new_status = st.selectbox("Action Decision", [ReviewStatus.ACKNOWLEDGED.value, ReviewStatus.RESOLVED.value])
        notes = st.text_area("Clinical Notes & Operational Direction", placeholder="Enter crew assessment notes, verification details, or countermeasure guidance...")
        
        submitted = st.form_submit_button("Submit Clinical Acknowledgment")
        if submitted:
            with storage_manager.get_connection() as conn:
                conn.execute(
                    """
                    UPDATE health_events 
                    SET review_status = ?, review_notes = ? 
                    WHERE event_id = ?;
                    """,
                    (new_status, notes.strip(), selected_event_id),
                )
            st.success(f"Event {selected_event_id} updated to {new_status}.")
            st.rerun()
