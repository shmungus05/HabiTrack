"""
wayfinder.ui.app: Main Streamlit steady-state entry point for WAYFINDER Version 1.
"""

import sys
from pathlib import Path

# Ensure repository root is on sys.path for standalone streamlit execution
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import streamlit as st

from wayfinder.core.storage import StorageManager
from wayfinder.core.ingestion import ingest_eda_csv, calculate_co2_partial_pressure
from wayfinder.core.simulation import generate_vitals, simulate_cohort_vitals_for_window
from wayfinder.core.rag import index_research_corpus
from wayfinder.core.analytics import evaluate_exposure_events
from wayfinder.core.models import SymptomReport, Astronaut, CalibrationStatus, QualityStatus
from wayfinder.ui.components.badges import render_calibration_badge

from wayfinder.ui.views.overview import render_overview_view
from wayfinder.ui.views.timeline import render_timeline_view
from wayfinder.ui.views.symptoms import render_symptoms_view
from wayfinder.ui.views.research import render_research_view


# Page configuration
st.set_page_config(
    page_title="WAYFINDER V1 — Offline Astronaut Health & Exposure",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Perplexity aesthetic styling
st.markdown(
    """
    <style>
    /* Dark minimalist Perplexity theme styling */
    .stApp {
        background-color: #0b0f19;
        color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Font-black headings */
    h1, h2, h3, h4, h5, h6 {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 900 !important;
        letter-spacing: -0.03em;
        color: #f8fafc;
    }
    
    /* Rounded card containers */
    div[data-testid="stVerticalBlock"] > div[style*="border"] {
        border-radius: 28px !important;
    }

    /* Streamlit Tab bar refinement */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #0f172a;
        padding: 6px;
        border-radius: 20px;
        border: 1px solid #1e293b;
    }

    .stTabs [data-baseweb="tab"] {
        border-radius: 14px;
        color: #94a3b8;
        font-weight: 700;
        font-size: 0.9rem;
        padding: 8px 20px;
        transition: all 0.2s ease-in-out;
    }

    .stTabs [aria-selected="true"] {
        background-color: #1e293b !important;
        color: #38bdf8 !important;
    }

    /* Button styling */
    .stButton > button {
        border-radius: 16px;
        font-weight: 700;
        border: 1px solid #334155;
        background: #1e293b;
        color: #f8fafc;
        transition: all 0.15s ease-in-out;
    }
    .stButton > button:hover {
        border-color: #38bdf8;
        color: #38bdf8;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Storage initialization (cached resource factory)
@st.cache_resource
def get_storage() -> StorageManager:
    manager = StorageManager()
    manager.ensure_initialized()
    return manager


storage = get_storage()

# Persistent Global Disclaimer Banner
st.markdown(
    """
    <div style="background: #18181b; border: 1px solid #ef4444; border-radius: 16px; padding: 0.6rem 1.2rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
        <span style="color: #ef4444; font-weight: 800; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;">
            ⚠️ OPERATIONAL DECISION SUPPORT ONLY — NOT APPROVED FOR AUTONOMOUS CLINICAL DIAGNOSIS OR MEDICAL COUNTERMEASURE DIRECTION
        </span>
        <span style="color: #a1a1aa; font-size: 0.75rem; font-weight: 600;">
            OFFLINE AUTONOMOUS MODE
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

# Initialize session state for timeline zoom range
if "timeline_range" not in st.session_state:
    st.session_state["timeline_range"] = None

# Sidebar Configuration
with st.sidebar:
    st.markdown('<h1 style="font-size: 1.6rem; margin-bottom: 0;">WAYFINDER <span style="color: #38bdf8; font-size: 1rem;">v2.0</span></h1>', unsafe_allow_html=True)
    st.markdown('<p style="color: #64748b; font-size: 0.8rem; margin-top: 0;">ISS Offline Multi-Astronaut Health Intelligence</p>', unsafe_allow_html=True)
    st.divider()

    # Mission Info
    st.markdown(
        """
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 1rem; margin-bottom: 1.2rem;">
            <div style="color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Mission Context</div>
            <div style="font-weight: 800; font-size: 1.1rem; color: #f8fafc; margin: 0.2rem 0;">ISS Expedition 71</div>
            <div style="color: #38bdf8; font-size: 0.85rem; font-weight: 600;">MET: Days 120–134 (14-Day Viewport)</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Crew Selector
    astronauts = storage.list_astronauts()
    if not astronauts:
        storage.ensure_initialized()
        astronauts = storage.list_astronauts()

    astro_dict = {a.astronaut_id: a for a in astronauts}
    astro_labels = {f"{a.astronaut_id}: {a.callsign} ({a.crew_role})": a.astronaut_id for a in astronauts}

    if "active_astronaut_id" not in st.session_state or st.session_state["active_astronaut_id"] not in astro_dict:
        st.session_state["active_astronaut_id"] = astronauts[0].astronaut_id if astronauts else "ASTRO-01"

    label_list = list(astro_labels.keys())
    default_idx = 0
    for i, lbl in enumerate(label_list):
        if astro_labels[lbl] == st.session_state["active_astronaut_id"]:
            default_idx = i
            break

    selected_label = st.selectbox("Active Crewmember Profile", options=label_list, index=default_idx)
    current_astronaut_id = astro_labels[selected_label]
    st.session_state["active_astronaut_id"] = current_astronaut_id
    active_astronaut = astro_dict[current_astronaut_id]
    st.session_state["active_astronaut"] = active_astronaut

    # Active Crewmember Profile Card with Calibration Status Badge
    st.markdown(
        f"""
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 0.9rem; margin-top: 0.5rem; margin-bottom: 1.2rem;">
            <div style="font-weight: 800; font-size: 1.05rem; color: #f8fafc;">{active_astronaut.callsign}</div>
            <div style="color: #94a3b8; font-size: 0.8rem; margin: 0.2rem 0 0.5rem 0;">{active_astronaut.crew_role} &bull; {active_astronaut.astronaut_id}</div>
            <div>{render_calibration_badge(active_astronaut.calibration_status)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.divider()

    # System Ingestion & Maintenance
    st.markdown('<div style="color: #94a3b8; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase;">Data Management</div>', unsafe_allow_html=True)
    
    if st.button("Load Multi-Day Mission Scenario Data", use_container_width=True):
        with st.spinner("Ingesting authentic EDA telemetry, synthesizing 14-day cohort vitals, and indexing corpus..."):
            root_dir = Path(__file__).parent.parent.parent
            mission_start = "2026-07-01T00:00:00Z"
            mission_end = "2026-07-14T23:59:59Z"

            # 1. Tile authentic NASA EDA data across 14 mission days (2026-07-01 to 2026-07-14, 4,032 samples)
            eda_csv = root_dir / "data" / "sample_eda_iss_co2_temp.csv"
            if eda_csv.exists():
                import pandas as pd
                sample_eda_df = pd.read_csv(eda_csv)
                eda_timestamps = pd.date_range(mission_start, "2026-07-14T23:55:00Z", freq="5min", tz="UTC")
                eda_ts_strs = [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in eda_timestamps]
                n_sample = len(sample_eda_df)

                press_arr = sample_eda_df["cabin_pressure_kpa"].to_numpy(dtype=float)
                temp_arr = sample_eda_df["cabin_temp_c"].to_numpy(dtype=float)
                co2_arr = sample_eda_df["cabin_co2_ppm"].to_numpy(dtype=float)

                eda_records = []
                for i, ts_str in enumerate(eda_ts_strs):
                    idx = i % n_sample
                    p = press_arr[idx]
                    t = temp_arr[idx]
                    ambient_ppm = min(max(co2_arr[idx], 3500.0), 3950.0)
                    co2_mmhg = round(calculate_co2_partial_pressure(ambient_ppm, p), 4)

                    eda_records.append(("stream_eda_co2", None, ts_str, co2_mmhg, QualityStatus.VALID.value, 0))
                    eda_records.append(("stream_eda_temp", None, ts_str, round(t, 2), QualityStatus.VALID.value, 0))
                    eda_records.append(("stream_eda_pressure", None, ts_str, round(p, 2), QualityStatus.VALID.value, 0))

                with storage.get_connection() as conn:
                    conn.execute("PRAGMA synchronous = OFF;")
                    conn.execute("PRAGMA journal_mode = MEMORY;")
                    conn.executemany(
                        """
                        INSERT INTO measurements (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
                        VALUES (?, ?, ?, ?, ?, ?);
                        """,
                        eda_records,
                    )

            # 2. Query EDA data for gap inheritance
            eda_df = storage.get_measurements_df(stream_ids=["stream_eda_co2", "stream_eda_temp", "stream_eda_pressure"])

            # 3. Generate 14-day synchronized vitals for the cohort (4,032 samples per stream)
            cohort_profiles = storage.list_astronauts()
            cohort_measurements = simulate_cohort_vitals_for_window(
                start_time=mission_start,
                end_time=mission_end,
                cohort_profiles=cohort_profiles,
                sample_interval_minutes=5,
                eda_measurements_df=eda_df,
            )
            if cohort_measurements:
                vitals_records = [
                    (
                        m.stream_id,
                        m.astronaut_id,
                        m.timestamp,
                        float(m.value),
                        m.quality_status.value if hasattr(m.quality_status, "value") else str(m.quality_status),
                        int(m.is_synthetic),
                    )
                    for m in cohort_measurements
                ]
                with storage.get_connection() as conn:
                    conn.execute("PRAGMA synchronous = OFF;")
                    conn.execute("PRAGMA journal_mode = MEMORY;")
                    conn.executemany(
                        """
                        INSERT INTO measurements (stream_id, astronaut_id, timestamp, value, quality_status, is_synthetic)
                        VALUES (?, ?, ?, ?, ?, ?);
                        """,
                        vitals_records,
                    )

            # 4. Inject Day 127 excursion at 2026-07-08T02:15:00Z
            excursion_ts = "2026-07-08T02:15:00Z"
            with storage.get_connection() as conn:
                conn.execute(
                    "UPDATE measurements SET value = ? WHERE stream_id = 'stream_eda_co2' AND timestamp = ?;",
                    (5.8, excursion_ts),
                )
                for ts in ["2026-07-08T02:05:00Z", "2026-07-08T02:10:00Z", "2026-07-08T02:15:00Z", "2026-07-08T02:20:00Z"]:
                    conn.execute(
                        "UPDATE measurements SET value = 85.0 WHERE stream_id = 'stream_sim_hr' AND astronaut_id = 'ASTRO-01' AND timestamp = ?;",
                        (ts,),
                    )
                    conn.execute(
                        "UPDATE measurements SET value = 30.0 WHERE stream_id = 'stream_sim_hrv' AND astronaut_id = 'ASTRO-01' AND timestamp = ?;",
                        (ts,),
                    )

            # 5. Insert Day 127 Symptom report (MET Day 127 02:15:00)
            sample_symptom = SymptomReport(
                report_id="SYM-DAY127-01",
                astronaut_id="ASTRO-01",
                symptom_code="HEADACHE",
                severity=3,
                occurred_at=excursion_ts,
                reported_at="2026-07-08T03:15:00Z",
                cabin_module="Node 2",
                notes="Bilateral throbbing headache onset during evening rest period.",
                is_synthetic=False,
            )
            storage.insert_symptom_report(sample_symptom)

            # 6. Index research corpus
            corpus_dir = root_dir / "data" / "research_corpus"
            if corpus_dir.exists():
                index_research_corpus(corpus_dir, storage)

            # 7. Evaluate exposure events for cohort astronauts
            for a in cohort_profiles:
                evaluate_exposure_events(a.astronaut_id, storage)

        st.cache_data.clear()
        st.success("14-day mission scenario loaded successfully (4,032 samples per stream)!")
        st.rerun()

    st.markdown('<div style="font-size: 0.75rem; color: #64748b; margin-top: 2rem;">WAYFINDER v2.0.0 &bull; Offline Architecture</div>', unsafe_allow_html=True)

# Main Application Tabs
tab_overview, tab_timeline, tab_symptoms, tab_research = st.tabs([
    "Mission Overview",
    "Exposure Timeline",
    "Symptom Logging",
    "Scientific Evidence",
])

with tab_overview:
    render_overview_view(storage, active_astronaut)

with tab_timeline:
    render_timeline_view(storage, active_astronaut)

with tab_symptoms:
    render_symptoms_view(storage, active_astronaut)

with tab_research:
    render_research_view(storage)
