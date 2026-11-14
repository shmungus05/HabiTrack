"""
wayfinder.ui.components.badges: Visual provenance and clinical status badges.
"""

from typing import Optional, Union
from wayfinder.core.models import (
    CalibrationStatus,
    ProvenanceCategory,
    QualityStatus,
    SeverityLevel,
    UncertaintyLevel,
    ReviewStatus,
)


def render_provenance_badge(provenance: str, is_synthetic: bool = False) -> str:
    """Renders HTML badge for data provenance."""
    if provenance == ProvenanceCategory.AUTHENTIC_NASA_EDA.value or (not is_synthetic and "EDA" in str(provenance)):
        return (
            '<span style="background-color: #062a36; color: #38bdf8; border: 1px solid #0284c7; '
            'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; '
            'letter-spacing: 0.05em; text-transform: uppercase;">'
            '● AUTHENTIC NASA EDA</span>'
        )
    elif provenance == ProvenanceCategory.SYNTHETIC_SIMULATION.value or is_synthetic:
        return (
            '<span style="background-color: #3b2806; color: #fbbf24; border: 1px dashed #d97706; '
            'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; '
            'letter-spacing: 0.05em; text-transform: uppercase;">'
            '◌ SIMULATED VITALS</span>'
        )
    elif provenance == ProvenanceCategory.CREW_REPORTED.value or "CREW" in str(provenance):
        return (
            '<span style="background-color: #2b123d; color: #c084fc; border: 1px solid #9333ea; '
            'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; '
            'letter-spacing: 0.05em; text-transform: uppercase;">'
            '▲ CREW REPORTED</span>'
        )
    return f'<span style="background-color: #333; color: #ccc; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">{provenance}</span>'


def render_quality_badge(quality: str) -> str:
    """Renders HTML badge for data quality status."""
    q_upper = quality.upper()
    colors = {
        QualityStatus.VALID.value: ("#052e16", "#4ade80", "#16a34a"),
        QualityStatus.SUSPECT.value: ("#3f1014", "#f87171", "#dc2626"),
        QualityStatus.GAP.value: ("#262626", "#a3a3a3", "#525252"),
        QualityStatus.STALE.value: ("#3a2208", "#fb923c", "#ea580c"),
        QualityStatus.IMPUTED.value: ("#28103c", "#c084fc", "#9333ea"),
    }
    bg, fg, border = colors.get(q_upper, ("#262626", "#e5e5e5", "#737373"))
    return (
        f'<span style="background-color: {bg}; color: {fg}; border: 1px solid {border}; '
        f'padding: 1px 6px; border-radius: 8px; font-size: 0.7rem; font-weight: 500;">{q_upper}</span>'
    )


def render_severity_badge(severity: str) -> str:
    """Renders HTML badge for clinical event severity."""
    s_upper = severity.upper()
    colors = {
        SeverityLevel.INFO.value: ("#0c2838", "#38bdf8", "#0284c7"),
        SeverityLevel.OBSERVE.value: ("#3a2608", "#fbbf24", "#d97706"),
        SeverityLevel.INVESTIGATE.value: ("#450a0a", "#f87171", "#ef4444"),
    }
    bg, fg, border = colors.get(s_upper, ("#262626", "#e5e5e5", "#737373"))
    return (
        f'<span style="background-color: {bg}; color: {fg}; border: 1px solid {border}; '
        f'padding: 3px 10px; border-radius: 14px; font-size: 0.8rem; font-weight: 700; '
        f'letter-spacing: 0.05em;">{s_upper}</span>'
    )


def render_uncertainty_badge(uncertainty: str) -> str:
    """Renders HTML badge for spatial / sensor uncertainty."""
    u_upper = uncertainty.upper()
    colors = {
        UncertaintyLevel.LOW.value: ("#052e16", "#4ade80", "#16a34a"),
        UncertaintyLevel.MODERATE.value: ("#3a2608", "#fbbf24", "#d97706"),
        UncertaintyLevel.HIGH.value: ("#3f1014", "#f87171", "#dc2626"),
    }
    bg, fg, border = colors.get(u_upper, ("#262626", "#e5e5e5", "#737373"))
    return (
        f'<span style="background-color: {bg}; color: {fg}; border: 1px solid {border}; '
        f'padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">'
        f'{u_upper} UNCERTAINTY</span>'
    )


def render_review_badge(status: str) -> str:
    """Renders HTML badge for CMO review status."""
    st_upper = status.upper()
    colors = {
        ReviewStatus.PENDING.value: ("#292524", "#fbbf24", "#78716c"),
        ReviewStatus.ACKNOWLEDGED.value: ("#082f49", "#38bdf8", "#0284c7"),
        ReviewStatus.RESOLVED.value: ("#052e16", "#4ade80", "#16a34a"),
    }
    bg, fg, border = colors.get(st_upper, ("#262626", "#e5e5e5", "#737373"))
    return (
        f'<span style="background-color: {bg}; color: {fg}; border: 1px solid {border}; '
        f'padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">'
        f'{st_upper}</span>'
    )


def render_calibration_badge(status: Union[CalibrationStatus, str]) -> str:
    """Renders HTML badge for circadian baseline calibration status."""
    st_val = status.value if hasattr(status, "value") else str(status)
    st_upper = st_val.upper()
    if st_upper == CalibrationStatus.CALIBRATING.value or st_upper == "CALIBRATING":
        return (
            '<span style="background-color: #3b2806; color: #f59e0b; border: 1px solid #d97706; '
            'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; '
            'letter-spacing: 0.05em; text-transform: uppercase;">'
            'CALIBRATING</span>'
        )
    elif st_upper == CalibrationStatus.CALIBRATED.value or st_upper == "CALIBRATED":
        return (
            '<span style="background-color: #052e16; color: #10b981; border: 1px solid #16a34a; '
            'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; '
            'letter-spacing: 0.05em; text-transform: uppercase;">'
            'CALIBRATED</span>'
        )
    return (
        f'<span style="background-color: #262626; color: #e5e5e5; border: 1px solid #737373; '
        f'padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">{st_upper}</span>'
    )
