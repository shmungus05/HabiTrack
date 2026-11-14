"""
wayfinder.core.analytics: Time-series decimation (LTTB) and symmetric tripartite exposure concordance analytics.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict
import numpy as np
import pandas as pd

from wayfinder.core.models import (
    Astronaut,
    CalibrationStatus,
    HealthEvent,
    SeverityLevel,
    UncertaintyLevel,
    ReviewStatus,
    QualityStatus,
    CoalescedAutonomicInterval,
)
from wayfinder.core.storage import StorageManager
from wayfinder.core.baselines import (
    compute_circadian_hourly_bins,
    evaluate_measurement_deviations,
    get_stream_type,
)

MANDATORY_DISCLAIMER = (
    "Temporal overlap indicates co-occurrence only, not clinical causation. "
    "WAYFINDER does not diagnose pathologies or prescribe countermeasures."
)


def decimate_time_series(df: pd.DataFrame, max_points: int = 1000) -> pd.DataFrame:
    """
    Downsamples a time-series DataFrame using the Largest Triangle Three Buckets (LTTB) algorithm.
    Preserves first point, last point, and local extrema, capping the total points to max_points.
    """
    if len(df) <= max_points or max_points < 3:
        return df.copy()

    # Ensure chronological ordering
    working_df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(working_df["timestamp"]):
        working_df["_dt_sec"] = pd.to_datetime(working_df["timestamp"], utc=True).astype("int64") // 10**9
    else:
        working_df["_dt_sec"] = working_df["timestamp"].astype("int64") // 10**9

    x = working_df["_dt_sec"].to_numpy(dtype=np.float64)
    y = working_df["value"].to_numpy(dtype=np.float64)
    n = len(df)

    # Output indices to retain
    sampled_indices = [0]

    # Split into (max_points - 2) buckets
    bucket_size = (n - 2) / (max_points - 2)
    a = 0  # Previously selected point index

    for i in range(max_points - 2):
        # Current bucket range
        curr_start = int(np.floor((i + 0) * bucket_size)) + 1
        curr_end = int(np.floor((i + 1) * bucket_size)) + 1
        curr_end = min(curr_end, n - 1)

        # Next bucket range (for centroid)
        next_start = int(np.floor((i + 1) * bucket_size)) + 1
        next_end = int(np.floor((i + 2) * bucket_size)) + 1
        next_end = min(next_end, n)

        # Calculate centroid of next bucket
        if next_start < next_end:
            avg_x = np.mean(x[next_start:next_end])
            avg_y = np.mean(y[next_start:next_end])
        else:
            avg_x = x[-1]
            avg_y = y[-1]

        x_a = x[a]
        y_a = y[a]

        best_area = -1.0
        best_idx = curr_start

        for idx in range(curr_start, curr_end):
            area = abs((x_a - avg_x) * (y[idx] - y_a) - (x_a - x[idx]) * (avg_y - y_a)) * 0.5
            if area > best_area:
                best_area = area
                best_idx = idx

        sampled_indices.append(best_idx)
        a = best_idx

    sampled_indices.append(n - 1)
    
    result_df = working_df.iloc[sampled_indices].drop(columns=["_dt_sec"], errors="ignore")
    return result_df


def coalesce_autonomic_intervals(
    deviations_df: pd.DataFrame,
    max_gap_minutes: float = 10.0,
    min_duration_minutes: float = 15.0,
) -> List[CoalescedAutonomicInterval]:
    """
    Coalesces contiguous autonomic shift observations into consolidated interval episodes.
    Filters for concurrent autonomic shifts: Z_HR >= +2.0 AND Z_RMSSD <= -2.0 at identical timestamps.
    Consecutive points separated by <= max_gap_minutes are clustered into intervals [t_start, t_end].
    Only intervals spanning >= min_duration_minutes (or >= 3 consecutive samples) are retained.
    """
    if deviations_df is None or deviations_df.empty:
        return []

    df = deviations_df.copy()

    # Filter out GAP records if quality_status column is present
    if "quality_status" in df.columns:
        df = df[df["quality_status"].astype(str) != QualityStatus.GAP.value]
        if df.empty:
            return []

    # Harmonize Long vs Wide input formats
    if "stream_id" in df.columns:
        st = df["stream_id"].astype(str).apply(get_stream_type)
        hr_df = df[st == "hr"].copy()
        rmssd_df = df[st == "rmssd"].copy()

        if hr_df.empty or rmssd_df.empty:
            return []

        hr_df["_dt"] = pd.to_datetime(hr_df["timestamp"], utc=True)
        rmssd_df["_dt"] = pd.to_datetime(rmssd_df["timestamp"], utc=True)

        hr_cols = ["_dt", "timestamp", "value", "z_score"]
        if "expected_mean" in hr_df.columns:
            hr_cols.append("expected_mean")
        if "astronaut_id" in hr_df.columns:
            hr_cols.append("astronaut_id")

        rmssd_cols = ["_dt", "value", "z_score"]
        if "expected_mean" in rmssd_df.columns:
            rmssd_cols.append("expected_mean")

        merged = pd.merge(
            hr_df[hr_cols],
            rmssd_df[rmssd_cols],
            on="_dt",
            suffixes=("_hr", "_rmssd"),
        )
    else:
        # Wide DataFrame input
        merged = df.copy()
        merged["_dt"] = pd.to_datetime(merged["timestamp"], utc=True)

        z_hr_col = "z_hr" if "z_hr" in merged.columns else ("z_score_hr" if "z_score_hr" in merged.columns else "z_score")
        z_rmssd_col = "z_rmssd" if "z_rmssd" in merged.columns else ("z_score_rmssd" if "z_score_rmssd" in merged.columns else "z_score")
        val_hr_col = "hr_value" if "hr_value" in merged.columns else ("value_hr" if "value_hr" in merged.columns else ("hr" if "hr" in merged.columns else "value"))
        val_rmssd_col = "rmssd_value" if "rmssd_value" in merged.columns else ("value_rmssd" if "value_rmssd" in merged.columns else ("rmssd" if "rmssd" in merged.columns else "value"))

        merged["value_hr"] = merged[val_hr_col]
        merged["z_score_hr"] = merged[z_hr_col]
        merged["value_rmssd"] = merged[val_rmssd_col]
        merged["z_score_rmssd"] = merged[z_rmssd_col]

    # Filter for concurrent autonomic shift: Z_HR >= +2.0 AND Z_RMSSD <= -2.0
    concurrent = merged[
        (merged["z_score_hr"] >= 2.0) & (merged["z_score_rmssd"] <= -2.0)
    ].copy()

    if concurrent.empty:
        return []

    concurrent = concurrent.sort_values("_dt").reset_index(drop=True)

    # Cluster contiguous points where Delta_t <= max_gap_minutes
    clusters = []
    current_cluster = []

    for _, row in concurrent.iterrows():
        if not current_cluster:
            current_cluster.append(row)
        else:
            gap_minutes = (row["_dt"] - current_cluster[-1]["_dt"]).total_seconds() / 60.0
            if gap_minutes <= max_gap_minutes:
                current_cluster.append(row)
            else:
                clusters.append(pd.DataFrame(current_cluster))
                current_cluster = [row]

    if current_cluster:
        clusters.append(pd.DataFrame(current_cluster))

    intervals: List[CoalescedAutonomicInterval] = []
    for cl in clusters:
        start_dt = cl.iloc[0]["_dt"]
        end_dt = cl.iloc[-1]["_dt"]
        duration_minutes = (end_dt - start_dt).total_seconds() / 60.0
        sample_count = len(cl)

        # Retain intervals whose duration >= min_duration_minutes OR >= 3 samples
        if duration_minutes >= min_duration_minutes or sample_count >= 3:
            start_ts = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            end_ts = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            event_id = f"EVT-EXERTION-{start_ts.replace(':', '').replace('-', '')}"

            peak_hr_idx = cl["z_score_hr"].idxmax()
            peak_z_hr = float(cl.loc[peak_hr_idx, "z_score_hr"])
            peak_hr_value = float(cl.loc[peak_hr_idx, "value_hr"])

            nadir_rmssd_idx = cl["z_score_rmssd"].idxmin()
            nadir_z_rmssd = float(cl.loc[nadir_rmssd_idx, "z_score_rmssd"])
            nadir_rmssd_value = float(cl.loc[nadir_rmssd_idx, "value_rmssd"])

            peak_hr_diff = float(peak_hr_value - cl.loc[peak_hr_idx, "expected_mean_hr"]) if "expected_mean_hr" in cl.columns else None
            nadir_rmssd_diff = float(nadir_rmssd_value - cl.loc[nadir_rmssd_idx, "expected_mean_rmssd"]) if "expected_mean_rmssd" in cl.columns else None
            astro_id = str(cl["astronaut_id"].dropna().iloc[0]) if ("astronaut_id" in cl.columns and not cl["astronaut_id"].dropna().empty) else None

            interval_obj = CoalescedAutonomicInterval(
                event_id=event_id,
                start_time=start_ts,
                end_time=end_ts,
                duration_minutes=float(duration_minutes),
                sample_count=int(sample_count),
                peak_z_hr=peak_z_hr,
                peak_hr_value=peak_hr_value,
                nadir_z_rmssd=nadir_z_rmssd,
                nadir_rmssd_value=nadir_rmssd_value,
                peak_hr_diff=peak_hr_diff,
                nadir_rmssd_diff=nadir_rmssd_diff,
                astronaut_id=astro_id,
            )
            intervals.append(interval_obj)

    return intervals


def evaluate_exposure_events(
    astronaut_id: str,
    storage_manager: StorageManager,
    window_hours: float = 4.0,
) -> List[HealthEvent]:
    """
    Evaluates environmental and physiological exposure around astronaut symptom reports
    and autonomous excursions using a symmetric tripartite concordance decision matrix.
    Generates explainable HealthEvent decision-support alerts.
    """
    events_generated: List[HealthEvent] = []

    # Step 1: Retrieve astronaut profile
    astronaut = storage_manager.get_astronaut(astronaut_id)
    if astronaut is None:
        astronaut = Astronaut(
            astronaut_id=astronaut_id,
            callsign=astronaut_id,
            mission_id="ISS-EXP-71",
            crew_role="Crew Member",
        )

    # Step 2: Fetch symptom reports for this astronaut
    with storage_manager.get_connection() as conn:
        symptom_rows = conn.execute(
            """
            SELECT * FROM symptom_reports 
            WHERE astronaut_id = ? 
            ORDER BY occurred_at DESC;
            """,
            (astronaut_id,),
        ).fetchall()

    # Step 3: Query historical physiological vitals for this astronaut
    vitals_history_df = storage_manager.get_measurements_df(
        stream_ids=["stream_sim_hr", "stream_sim_hrv", "stream_sim_temp", "stream_sim_spo2"],
        astronaut_id=astronaut_id,
    )
    if vitals_history_df.empty:
        all_v = storage_manager.get_measurements_df(stream_ids=["stream_sim_hr", "stream_sim_hrv"])
        if not all_v.empty:
            vitals_history_df = all_v[
                all_v["astronaut_id"].isna() | (all_v["astronaut_id"] == "") | (all_v["astronaut_id"] == astronaut_id)
            ]

    has_vitals = (vitals_history_df is not None and not vitals_history_df.empty)
    if has_vitals:
        vitals_history_df["_dt"] = pd.to_datetime(vitals_history_df["timestamp"], utc=True)

    covered_intervals = []
    covered_workout_event_ids = set()

    # 1. Evaluate Symptom-Driven Exposure Windows
    for s_row in symptom_rows:
        report_id = s_row["report_id"]
        symptom_code = s_row["symptom_code"]
        severity = s_row["severity"]
        occurred_at_str = s_row["occurred_at"]
        cabin_module = s_row["cabin_module"] or "Node 2"

        occurred_dt = pd.to_datetime(occurred_at_str, utc=True)
        w_start_dt = occurred_dt - pd.Timedelta(hours=window_hours)
        w_end_dt = occurred_dt + pd.Timedelta(hours=window_hours)
        window_start = w_start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        window_end = w_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        covered_intervals.append((w_start_dt, w_end_dt))

        # Query environmental measurements in active window
        co2_df = storage_manager.get_measurements_df(
            stream_ids=["stream_eda_co2"],
            start_time=window_start,
            end_time=window_end,
        )

        valid_co2 = co2_df[co2_df["quality_status"] != QualityStatus.GAP.value] if not co2_df.empty else pd.DataFrame()
        max_co2 = float(valid_co2["value"].max()) if not valid_co2.empty else 0.0
        mean_co2 = float(valid_co2["value"].mean()) if not valid_co2.empty else 0.0

        total_meas = len(co2_df)
        gap_meas = len(co2_df[co2_df["quality_status"] == QualityStatus.GAP.value]) if total_meas > 0 else 0
        gap_pct = (gap_meas / total_meas * 100.0) if total_meas > 0 else 0.0

        # Evaluate physiological deviations and autonomic shifts
        coincident_interval = None
        is_calibrated = False

        if has_vitals:
            # Historical window [occurred_dt - 7 days, occurred_dt]
            hist_start_dt = occurred_dt - pd.Timedelta(days=7)
            v_hist = vitals_history_df[
                (vitals_history_df["_dt"] >= hist_start_dt)
                & (vitals_history_df["_dt"] <= occurred_dt)
            ]

            bin_stats = compute_circadian_hourly_bins(
                v_hist,
                astronaut,
                evaluation_time=occurred_at_str,
                window_days=7,
            )
            is_calibrated = any(b.calibration_status == CalibrationStatus.CALIBRATED for b in bin_stats.values())

            # Active window vitals
            v_window = vitals_history_df[
                (vitals_history_df["_dt"] >= w_start_dt)
                & (vitals_history_df["_dt"] <= w_end_dt)
            ]
            if not v_window.empty:
                deviations_df = evaluate_measurement_deviations(v_window, bin_stats, astronaut)
                intervals = coalesce_autonomic_intervals(deviations_df)
                if intervals:
                    coincident_interval = intervals[0]
                    covered_workout_event_ids.add(coincident_interval.event_id)

        has_autonomic_shift = (coincident_interval is not None)
        is_co2_excursion = (max_co2 >= 4.5)
        is_severe_symptom = (severity >= 3)

        # Symmetric Tripartite Decision Matrix
        if is_co2_excursion:
            if is_severe_symptom:
                if has_autonomic_shift:
                    severity_level = SeverityLevel.INVESTIGATE
                else:
                    # Graceful fallback for legacy scenarios without baseline data or legacy format
                    is_legacy = (not has_vitals)
                    if astronaut.baseline_parameters is not None:
                        bp_str = str(astronaut.baseline_parameters).lower()
                        if "resting_rmssd" not in bp_str and "rmssd" not in bp_str:
                            is_legacy = True

                    if is_legacy:
                        severity_level = SeverityLevel.INVESTIGATE
                    else:
                        severity_level = SeverityLevel.OBSERVE
            else:
                severity_level = SeverityLevel.OBSERVE if has_autonomic_shift else SeverityLevel.INFO
        else:
            if is_severe_symptom:
                if has_autonomic_shift:
                    severity_level = SeverityLevel.OBSERVE
                elif max_co2 >= 4.0:
                    severity_level = SeverityLevel.OBSERVE
                else:
                    severity_level = SeverityLevel.INFO
            else:
                severity_level = SeverityLevel.INFO

        # Telemetry gap percentage / module for uncertainty quantification
        if cabin_module.strip().lower() != "node 2" or gap_pct > 20.0:
            uncertainty_level = UncertaintyLevel.HIGH
        elif gap_pct >= 5.0:
            uncertainty_level = UncertaintyLevel.MODERATE
        else:
            uncertainty_level = UncertaintyLevel.LOW

        # Format Canonical Rendered Operational Rationale Exemplar
        if max_co2 >= 4.5:
            env_line = (
                f"• Environmental Telemetry: Cabin PCO2 reached peak of {max_co2:.2f} mmHg "
                f"(Threshold >= 4.5 mmHg, {cabin_module}) [AUTHENTIC NASA EDA]"
            )
        else:
            env_line = (
                f"• Environmental Telemetry: Cabin PCO2 peak of {max_co2:.2f} mmHg "
                f"({gap_pct:.1f}% telemetry gaps, {cabin_module}) [AUTHENTIC NASA EDA]"
            )

        if coincident_interval is not None:
            p_z_hr = coincident_interval.peak_z_hr
            p_hr_val = coincident_interval.peak_hr_value
            n_z_rmssd = coincident_interval.nadir_z_rmssd
            n_rmssd_val = coincident_interval.nadir_rmssd_value
            hr_diff_str = (
                f"{coincident_interval.peak_hr_diff:+.1f} bpm above circadian baseline"
                if coincident_interval.peak_hr_diff is not None
                else f"{p_hr_val:.1f} bpm"
            )
            rmssd_diff_str = (
                f"{coincident_interval.nadir_rmssd_diff:+.1f} ms below circadian baseline"
                if coincident_interval.nadir_rmssd_diff is not None
                else f"{n_rmssd_val:.1f} ms"
            )
            auto_line = (
                f"• Autonomic Deviation: Heart Rate Z={p_z_hr:+.2f} ({hr_diff_str}), "
                f"RMSSD Z={n_z_rmssd:+.2f} ({rmssd_diff_str}) [SIMULATED VITALS]"
            )
        elif has_vitals:
            auto_line = "• Autonomic Deviation: Nominal (No statistically significant circadian deviation detected) [SIMULATED VITALS]"
        else:
            auto_line = "• Autonomic Deviation: No telemetry available [SIMULATED VITALS]"

        crew_line = f"• Crew Symptom: {symptom_code} (Severity {severity}/5, {cabin_module}) reported at {occurred_at_str} [CREW REPORTED]"
        notice_line = f"• Operational Decision Support Notice: {MANDATORY_DISCLAIMER}"

        rationale = (
            f"[OPERATIONAL HEALTH EVENT: {severity_level.value}]\n"
            f"{env_line}\n"
            f"{auto_line}\n"
            f"{crew_line}\n"
            f"{notice_line}"
        )

        event_id = f"EVT-{report_id[:8]}"
        contributing_streams = "stream_eda_co2"
        if coincident_interval is not None:
            contributing_streams = "stream_eda_co2,stream_sim_hr,stream_sim_hrv"

        event = HealthEvent(
            event_id=event_id,
            astronaut_id=astronaut_id,
            event_type=f"EXPOSURE_CORRELATION_{symptom_code}",
            severity_level=severity_level,
            start_time=window_start,
            end_time=window_end,
            contributing_stream_ids=contributing_streams,
            symptom_report_id=report_id,
            rationale=rationale,
            uncertainty_level=uncertainty_level,
            review_status=ReviewStatus.PENDING,
            review_notes=None,
        )

        _upsert_health_event(storage_manager, event)
        events_generated.append(event)

    # 2. High CO2 Environmental Excursions & Coincident Workouts
    co2_excursions = storage_manager.get_measurements_df(stream_ids=["stream_eda_co2"])
    if not co2_excursions.empty:
        high_co2 = co2_excursions[
            (co2_excursions["value"] >= 4.0) & 
            (co2_excursions["quality_status"] != QualityStatus.GAP.value)
        ].copy()

        if not high_co2.empty:
            high_co2["dt"] = pd.to_datetime(high_co2["timestamp"], utc=True)
            high_co2 = high_co2.sort_values("dt").reset_index(drop=True)

            # Find clusters of excursions outside covered symptom intervals
            uncovered_peaks = []
            for _, row in high_co2.iterrows():
                dt = row["dt"]
                is_covered = any(start <= dt <= end for start, end in covered_intervals)
                if not is_covered:
                    uncovered_peaks.append(row)

            if uncovered_peaks:
                uncovered_df = pd.DataFrame(uncovered_peaks)
                peak_row = uncovered_df.loc[uncovered_df["value"].idxmax()]
                peak_dt = peak_row["dt"]
                peak_co2 = float(peak_row["value"])

                excursion_start_dt = peak_dt - pd.Timedelta(hours=window_hours)
                excursion_end_dt = peak_dt + pd.Timedelta(hours=window_hours)
                excursion_start = excursion_start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                excursion_end = excursion_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

                # Check if coincident coalesced workout exists in this excursion window
                coincident_workout = None
                if has_vitals:
                    hist_start_dt = excursion_start_dt - pd.Timedelta(days=7)
                    v_hist = vitals_history_df[
                        (vitals_history_df["_dt"] >= hist_start_dt)
                        & (vitals_history_df["_dt"] < excursion_start_dt)
                    ]
                    v_window = vitals_history_df[
                        (vitals_history_df["_dt"] >= excursion_start_dt)
                        & (vitals_history_df["_dt"] <= excursion_end_dt)
                    ]
                    if not v_window.empty:
                        bin_stats_exc = compute_circadian_hourly_bins(
                            v_hist if not v_hist.empty else vitals_history_df,
                            astronaut,
                            evaluation_time=excursion_start,
                            window_days=7,
                        )
                        deviations_exc = evaluate_measurement_deviations(v_window, bin_stats_exc, astronaut)
                        exc_intervals = coalesce_autonomic_intervals(deviations_exc)
                        if exc_intervals:
                            coincident_workout = exc_intervals[0]

                if coincident_workout is not None:
                    # EDA Excursion + Coalesced Autonomic Workout, No Symptom -> OBSERVE
                    sev_level = SeverityLevel.OBSERVE if peak_co2 >= 4.5 else SeverityLevel.INFO
                    evt_type = "EXPOSURE_WORKOUT_DURING_CO2_EXCURSION" if peak_co2 >= 4.5 else "EXPOSURE_COALESCED_EXERTION"
                    event_id = coincident_workout.event_id
                    event_start = coincident_workout.start_time
                    event_end = coincident_workout.end_time

                    p_z_hr = coincident_workout.peak_z_hr
                    p_hr_val = coincident_workout.peak_hr_value
                    n_z_rmssd = coincident_workout.nadir_z_rmssd
                    n_rmssd_val = coincident_workout.nadir_rmssd_value
                    hr_diff_str = (
                        f"{coincident_workout.peak_hr_diff:+.1f} bpm above circadian baseline"
                        if coincident_workout.peak_hr_diff is not None
                        else f"{p_hr_val:.1f} bpm"
                    )
                    rmssd_diff_str = (
                        f"{coincident_workout.nadir_rmssd_diff:+.1f} ms below circadian baseline"
                        if coincident_workout.nadir_rmssd_diff is not None
                        else f"{n_rmssd_val:.1f} ms"
                    )

                    thresh_quote = "Threshold >= 4.5 mmHg" if peak_co2 >= 4.5 else "Threshold >= 4.0 mmHg"
                    env_line = f"• Environmental Telemetry: Cabin PCO2 reached peak of {peak_co2:.2f} mmHg ({thresh_quote}) [AUTHENTIC NASA EDA]"
                    auto_line = (
                        f"• Autonomic Deviation: Heart Rate Z={p_z_hr:+.2f} ({hr_diff_str}), "
                        f"RMSSD Z={n_z_rmssd:+.2f} ({rmssd_diff_str}) [SIMULATED VITALS]"
                    )
                    crew_line = "• Crew Symptom: None reported (without coincident symptoms) [CREW REPORTED]"
                    notice_line = f"• Operational Decision Support Notice: {MANDATORY_DISCLAIMER}"

                    rat = (
                        f"[OPERATIONAL HEALTH EVENT: {sev_level.value}]\n"
                        f"{env_line}\n"
                        f"{auto_line}\n"
                        f"{crew_line}\n"
                        f"{notice_line}"
                    )

                    evt = HealthEvent(
                        event_id=event_id,
                        astronaut_id=astronaut_id,
                        event_type=evt_type,
                        severity_level=sev_level,
                        start_time=event_start,
                        end_time=event_end,
                        contributing_stream_ids="stream_eda_co2,stream_sim_hr,stream_sim_hrv",
                        symptom_report_id=None,
                        rationale=rat,
                        uncertainty_level=UncertaintyLevel.LOW,
                        review_status=ReviewStatus.PENDING,
                        review_notes=None,
                    )
                    _upsert_health_event(storage_manager, evt)
                    events_generated.append(evt)
                    covered_intervals.append((excursion_start_dt, excursion_end_dt))
                    covered_workout_event_ids.add(event_id)
                else:
                    # Standalone Environmental Excursion (without workout or symptoms)
                    hr_df = storage_manager.get_measurements_df(
                        stream_ids=["stream_sim_hr"],
                        start_time=excursion_start,
                        end_time=excursion_end,
                        astronaut_id=astronaut_id,
                    )
                    valid_hr = hr_df[hr_df["quality_status"] != QualityStatus.GAP.value] if not hr_df.empty else pd.DataFrame()
                    max_hr = float(valid_hr["value"].max()) if not valid_hr.empty else 65.0

                    if max_hr > 85.0:
                        sev_level = SeverityLevel.OBSERVE
                        evt_type = "EXPOSURE_ELEVATED_CO2_WITH_ELEVATED_HR"
                    else:
                        sev_level = SeverityLevel.INFO
                        evt_type = "EXPOSURE_ELEVATED_CO2"

                    thresh_quote = "Threshold >= 4.5 mmHg" if peak_co2 >= 4.5 else "Threshold >= 4.0 mmHg"
                    env_line = f"• Environmental Telemetry: Elevated cabin PCO2 reached peak of {peak_co2:.2f} mmHg ({thresh_quote}) [AUTHENTIC NASA EDA]"
                    auto_line = (
                        f"• Autonomic Deviation: Elevated heart rate ({max_hr:.1f} bpm) observed [SIMULATED VITALS]"
                        if max_hr > 85.0
                        else "• Autonomic Deviation: Nominal (No coincident vital excursion) [SIMULATED VITALS]"
                    )
                    crew_line = "• Crew Symptom: None reported (without coincident symptoms) [CREW REPORTED]"
                    notice_line = f"• Operational Decision Support Notice: {MANDATORY_DISCLAIMER}"

                    rat = (
                        f"[OPERATIONAL HEALTH EVENT: {sev_level.value}]\n"
                        f"{env_line}\n"
                        f"{auto_line}\n"
                        f"{crew_line}\n"
                        f"{notice_line}"
                    )

                    event_id = f"EVT-ENV-{peak_dt.strftime('%m%d%H%M')}"
                    evt = HealthEvent(
                        event_id=event_id,
                        astronaut_id=astronaut_id,
                        event_type=evt_type,
                        severity_level=sev_level,
                        start_time=excursion_start,
                        end_time=excursion_end,
                        contributing_stream_ids="stream_eda_co2" if sev_level == SeverityLevel.INFO else "stream_eda_co2,stream_sim_hr",
                        symptom_report_id=None,
                        rationale=rat,
                        uncertainty_level=UncertaintyLevel.LOW,
                        review_status=ReviewStatus.PENDING,
                        review_notes=None,
                    )
                    _upsert_health_event(storage_manager, evt)
                    events_generated.append(evt)
                    covered_intervals.append((excursion_start_dt, excursion_end_dt))

    # 3. Routine Workouts in Nominal Cabin Atmosphere (Leaf 7: Spec lines 312-314)
    # Detect coalesced autonomic workout intervals (Z_HR >= 2.0, Z_RMSSD <= -2.0, dur >= 15m)
    # occurring during nominal cabin atmosphere (P_CO2 < 4.5 mmHg) without coincident symptoms.
    if has_vitals:
        hr_meas = vitals_history_df[vitals_history_df["stream_id"] == "stream_sim_hr"].sort_values("_dt")
        rmssd_meas = vitals_history_df[vitals_history_df["stream_id"] == "stream_sim_hrv"].sort_values("_dt")

        if not hr_meas.empty and not rmssd_meas.empty:
            merged_v = pd.merge(
                hr_meas[["_dt", "timestamp", "value", "quality_status"]],
                rmssd_meas[["_dt", "value", "quality_status"]],
                on="_dt",
                suffixes=("_hr", "_rmssd"),
            )
            merged_v = merged_v[
                (merged_v["quality_status_hr"] != QualityStatus.GAP.value) &
                (merged_v["quality_status_rmssd"] != QualityStatus.GAP.value)
            ]

            # Candidate autonomic exertion points: substantial heart rate rise and RMSSD drop
            # HR >= baseline + 5 bpm, RMSSD <= baseline - 4 ms
            candidates = merged_v[
                (merged_v["value_hr"] >= astronaut.resting_hr + 5.0) &
                (merged_v["value_rmssd"] <= astronaut.resting_rmssd - 4.0)
            ].sort_values("_dt")

            if not candidates.empty:
                # Group contiguous candidate points (gap <= 10 min)
                workout_clusters = []
                cur_cluster = []
                for _, r in candidates.iterrows():
                    if not cur_cluster:
                        cur_cluster.append(r)
                    else:
                        gap_m = (r["_dt"] - cur_cluster[-1]["_dt"]).total_seconds() / 60.0
                        if gap_m <= 10.0:
                            cur_cluster.append(r)
                        else:
                            workout_clusters.append(pd.DataFrame(cur_cluster))
                            cur_cluster = [r]
                if cur_cluster:
                    workout_clusters.append(pd.DataFrame(cur_cluster))

                for w_cl in workout_clusters:
                    w_start_dt = w_cl.iloc[0]["_dt"]
                    w_end_dt = w_cl.iloc[-1]["_dt"]
                    duration_m = (w_end_dt - w_start_dt).total_seconds() / 60.0

                    if duration_m >= 15.0 or len(w_cl) >= 3:
                        # Check if already covered by symptom or high CO2 window
                        is_covered = any(
                            (start <= w_start_dt <= end) or (start <= w_end_dt <= end)
                            for start, end in covered_intervals
                        )
                        if is_covered:
                            continue

                        # Evaluate deviations in this window against baseline prior to workout
                        w_start_iso = w_start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                        w_end_iso = w_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                        hist_w = vitals_history_df[
                            (vitals_history_df["_dt"] >= w_start_dt - pd.Timedelta(days=7)) &
                            (vitals_history_df["_dt"] < w_start_dt)
                        ]
                        bin_stats_w = compute_circadian_hourly_bins(
                            hist_w if not hist_w.empty else vitals_history_df,
                            astronaut,
                            evaluation_time=w_start_iso,
                            window_days=7,
                        )
                        v_win = vitals_history_df[
                            (vitals_history_df["_dt"] >= w_start_dt) &
                            (vitals_history_df["_dt"] <= w_end_dt)
                        ]
                        devs_w = evaluate_measurement_deviations(v_win, bin_stats_w, astronaut)
                        w_intervals = coalesce_autonomic_intervals(devs_w)

                        for w_int in w_intervals:
                            if w_int.event_id in covered_workout_event_ids:
                                continue

                            # Query environmental CO2 in this workout interval (+/- 30 min)
                            w_int_start_dt = pd.to_datetime(w_int.start_time, utc=True)
                            w_int_end_dt = pd.to_datetime(w_int.end_time, utc=True)
                            co2_check = storage_manager.get_measurements_df(
                                stream_ids=["stream_eda_co2"],
                                start_time=(w_int_start_dt - pd.Timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                end_time=(w_int_end_dt + pd.Timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                            )
                            valid_co2 = co2_check[co2_check["quality_status"] != QualityStatus.GAP.value] if not co2_check.empty else pd.DataFrame()
                            w_peak_co2 = float(valid_co2["value"].max()) if not valid_co2.empty else 0.0

                            # Leaf 7: Routine workout in nominal cabin atmosphere (< 4.5 mmHg)
                            if w_peak_co2 < 4.5:
                                p_z_hr = w_int.peak_z_hr
                                p_hr_val = w_int.peak_hr_value
                                n_z_rmssd = w_int.nadir_z_rmssd
                                n_rmssd_val = w_int.nadir_rmssd_value
                                hr_diff_str = (
                                    f"{w_int.peak_hr_diff:+.1f} bpm above circadian baseline"
                                    if w_int.peak_hr_diff is not None
                                    else f"{p_hr_val:.1f} bpm"
                                )
                                rmssd_diff_str = (
                                    f"{w_int.nadir_rmssd_diff:+.1f} ms below circadian baseline"
                                    if w_int.nadir_rmssd_diff is not None
                                    else f"{n_rmssd_val:.1f} ms"
                                )

                                if w_peak_co2 > 0.0:
                                    env_line = f"• Environmental Telemetry: Nominal cabin atmosphere (peak PCO2 {w_peak_co2:.2f} mmHg, below 4.5 mmHg threshold) [AUTHENTIC NASA EDA]"
                                else:
                                    env_line = "• Environmental Telemetry: Nominal cabin atmosphere (PCO2 < 4.5 mmHg) [AUTHENTIC NASA EDA]"

                                auto_line = (
                                    f"• Autonomic Deviation: Heart Rate Z={p_z_hr:+.2f} ({hr_diff_str}), "
                                    f"RMSSD Z={n_z_rmssd:+.2f} ({rmssd_diff_str}) [SIMULATED VITALS]"
                                )
                                crew_line = "• Crew Symptom: None reported (routine scheduled countermeasure exercise) [CREW REPORTED]"
                                notice_line = f"• Operational Decision Support Notice: {MANDATORY_DISCLAIMER}"

                                rat = (
                                    f"[OPERATIONAL HEALTH EVENT: INFO]\n"
                                    f"{env_line}\n"
                                    f"{auto_line}\n"
                                    f"{crew_line}\n"
                                    f"{notice_line}"
                                )

                                evt = HealthEvent(
                                    event_id=w_int.event_id,
                                    astronaut_id=astronaut_id,
                                    event_type="AUTONOMIC_EXERTION",
                                    severity_level=SeverityLevel.INFO,
                                    start_time=w_int.start_time,
                                    end_time=w_int.end_time,
                                    contributing_stream_ids="stream_sim_hr,stream_sim_hrv",
                                    symptom_report_id=None,
                                    rationale=rat,
                                    uncertainty_level=UncertaintyLevel.LOW,
                                    review_status=ReviewStatus.PENDING,
                                    review_notes=None,
                                )
                                _upsert_health_event(storage_manager, evt)
                                events_generated.append(evt)
                                covered_intervals.append((w_int_start_dt, w_int_end_dt))
                                covered_workout_event_ids.add(w_int.event_id)

    return events_generated


# Export alias per V2 spec
detect_exposure_concordance_events = evaluate_exposure_events


def _upsert_health_event(storage_manager: StorageManager, event: HealthEvent) -> None:
    """Helper to upsert a HealthEvent record."""
    with storage_manager.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO health_events (
                event_id, astronaut_id, event_type, severity_level,
                start_time, end_time, contributing_stream_ids,
                symptom_report_id, rationale, uncertainty_level, review_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(event_id) DO UPDATE SET
                severity_level=excluded.severity_level,
                rationale=excluded.rationale,
                uncertainty_level=excluded.uncertainty_level;
            """,
            (
                event.event_id,
                event.astronaut_id,
                event.event_type,
                event.severity_level.value,
                event.start_time,
                event.end_time,
                event.contributing_stream_ids,
                event.symptom_report_id,
                event.rationale,
                event.uncertainty_level.value,
                event.review_status.value,
            ),
        )
