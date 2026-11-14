"""wayfinder.api.routes.symptoms: Crew symptom report listing and submission endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from wayfinder.api.deps import get_storage
from wayfinder.core.models import SymptomReport, SymptomReportRequest
from wayfinder.core.storage import StorageManager

router = APIRouter(prefix="/api/symptoms", tags=["symptoms"])


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("", response_model=List[SymptomReport])
def list_symptoms(
    astronaut_id: Optional[str] = Query(None),
    storage: StorageManager = Depends(get_storage),
) -> List[SymptomReport]:
    """Lists crew-reported symptoms for the active cohort."""
    if astronaut_id is not None and storage.get_astronaut(astronaut_id) is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")
    return storage.list_symptom_reports(astronaut_id)


@router.post("", response_model=SymptomReport, status_code=201)
def submit_symptom(
    request: SymptomReportRequest,
    storage: StorageManager = Depends(get_storage),
) -> SymptomReport:
    """Validates and persists a structured crew symptom report."""
    if storage.get_astronaut(request.astronaut_id) is None:
        raise HTTPException(
            status_code=404, detail=f"Astronaut {request.astronaut_id} not found"
        )

    reported_at = _utc_now_iso()
    report = SymptomReport(
        report_id=str(uuid.uuid4()),
        astronaut_id=request.astronaut_id,
        symptom_code=request.symptom_code,
        severity=request.severity,
        occurred_at=request.occurred_at or reported_at,
        reported_at=reported_at,
        cabin_module=request.cabin_module,
        notes=request.notes,
        is_synthetic=False,
    )
    storage.insert_symptom_report(report)
    return report
