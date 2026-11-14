"""
wayfinder.ui.views.symptoms: Structured crew symptom reporting form and exposure correlation trigger.
"""

from datetime import datetime, timezone
from typing import Union
import uuid
import streamlit as st
import pandas as pd

from wayfinder.core.storage import StorageManager
from wayfinder.core.models import SymptomReport, Astronaut
from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.ui.components.badges import render_provenance_badge


def render_symptoms_view(storage_manager: StorageManager, astronaut_or_id: Union[Astronaut, str]) -> None:
    """Renders crew symptom submission form and historical logs bound to the active astronaut."""
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

    st.markdown(f'<h2 style="font-weight: 900; letter-spacing: -0.03em;">Crew Clinical Symptom Logging — {astronaut.callsign}</h2>', unsafe_allow_html=True)
    st.markdown(
        f'<p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 2rem;">'
        f'Standardized crew clinical observation logging bound to profile <strong style="color: #f8fafc;">{astronaut.callsign}</strong> ({astronaut.astronaut_id}). '
        f'Submitting a symptom report automatically triggers multi-signal exposure correlation against environmental telemetry and personalized baseline.'
        f'</p>',
        unsafe_allow_html=True,
    )

    form_col, log_col = st.columns([1, 1], gap="large")

    with form_col:
        st.markdown(f'<h3 style="font-weight: 800;">Log Clinical Observation for {astronaut.callsign}</h3>', unsafe_allow_html=True)
        st.caption(f"Active Profile: {astronaut.astronaut_id} &bull; {astronaut.crew_role}")

        with st.form("symptom_reporting_form"):
            symptom_code = st.selectbox(
                "Symptom Code",
                ["HEADACHE", "FATIGUE", "DIZZINESS", "CONGESTION"],
                help="Select standard spaceflight symptom classification",
            )
            severity = st.slider("Severity Level (1 = Mild, 5 = Incapacitating)", min_value=1, max_value=5, value=3)
            
            # Default to MET Day 127 02:15:00
            occurred_date = st.date_input("Date of Onset (UTC)", value=datetime(2026, 5, 9).date())
            occurred_time = st.time_input("Time of Onset (UTC)", value=datetime(2026, 5, 9, 2, 15).time())
            
            cabin_module = st.selectbox(
                "Cabin Module Location",
                ["Node 2", "Columbus", "Node 3", "Destiny"],
                help="Module where symptom was experienced",
            )
            notes = st.text_area(
                "Clinical Notes & Context",
                value="Bilateral frontal throbbing, mild photophobia, no aura.",
                placeholder="Describe onset, quality, radiation, and activity prior to symptom...",
            )

            submitted = st.form_submit_button("Submit Symptom Log & Run Exposure Correlation")

            if submitted:
                occurred_dt = datetime.combine(occurred_date, occurred_time, tzinfo=timezone.utc)
                reported_dt = datetime.now(timezone.utc)
                report_id = f"SYM-{uuid.uuid4().hex[:8].upper()}"

                symptom = SymptomReport(
                    report_id=report_id,
                    astronaut_id=astronaut_id,
                    symptom_code=symptom_code,
                    severity=severity,
                    occurred_at=occurred_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    reported_at=reported_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    cabin_module=cabin_module,
                    notes=notes.strip(),
                    is_synthetic=False,
                )

                storage_manager.insert_symptom_report(symptom)

                # Synchronously trigger exposure correlation for active astronaut
                new_events = evaluate_exposure_events(astronaut_id, storage_manager)
                st.success(
                    f"Symptom '{symptom_code}' logged successfully for {astronaut.callsign} (Report ID: {report_id}). "
                    f"Generated {len(new_events)} exposure correlation health event(s)."
                )
                st.rerun()

    with log_col:
        st.markdown(f'<h3 style="font-weight: 800;">Logged Crew Reports — {astronaut.callsign}</h3>', unsafe_allow_html=True)
        with storage_manager.get_connection() as conn:
            s_rows = conn.execute(
                """
                SELECT * FROM symptom_reports 
                WHERE astronaut_id = ? 
                ORDER BY occurred_at DESC;
                """,
                (astronaut_id,),
            ).fetchall()

        if not s_rows:
            st.info(f"No symptoms logged yet for crewmember {astronaut.callsign} ({astronaut.astronaut_id}).")
        else:
            for s in s_rows:
                sev = s["severity"]
                sev_color = "#ef4444" if sev >= 4 else ("#f59e0b" if sev >= 3 else "#38bdf8")
                st.markdown(
                    f"""
                    <div style="background: #111827; border: 1px solid #1f2937; border-radius: 20px; padding: 1.2rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 800; font-size: 1.05rem; color: #f8fafc;">{s['symptom_code']}</span>
                            <span style="background: {sev_color}22; color: {sev_color}; border: 1px solid {sev_color}; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">
                                SEVERITY {sev}/5
                            </span>
                        </div>
                        <div style="font-size: 0.85rem; color: #94a3b8; margin: 0.4rem 0;">
                            <strong>Onset:</strong> {s['occurred_at']} | <strong>Reported:</strong> {s['reported_at']}
                        </div>
                        <div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 0.4rem;">
                            <strong>Module:</strong> {s['cabin_module']} — <em>{s['notes']}</em>
                        </div>
                        <div>{render_provenance_badge('CREW_REPORTED')}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
