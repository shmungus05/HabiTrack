"""wayfinder.api.routes.events: Concordance event listing and CMO review endpoints."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from wayfinder.api.deps import get_storage
from wayfinder.core.models import (
    HealthEvent,
    ReviewEventRequest,
    SeverityLevel,
)
from wayfinder.core.storage import StorageManager

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[HealthEvent])
def list_events(
    astronaut_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    storage: StorageManager = Depends(get_storage),
) -> List[HealthEvent]:
    """Lists evaluated multi-signal concordance events for the active cohort."""
    if astronaut_id is not None and storage.get_astronaut(astronaut_id) is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    severity_filter: Optional[SeverityLevel] = None
    if severity is not None:
        try:
            severity_filter = SeverityLevel(severity.upper())
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid severity '{severity}'. Use INFO, OBSERVE, or INVESTIGATE.",
            )

    events = storage.list_health_events(astronaut_id)
    if severity_filter is not None:
        events = [event for event in events if event.severity_level is severity_filter]
    return events


@router.post("/{event_id}/review", response_model=HealthEvent)
def review_event(
    event_id: str,
    request: ReviewEventRequest,
    storage: StorageManager = Depends(get_storage),
) -> HealthEvent:
    """Updates the flight-surgeon review status for a concordance event."""
    if storage.get_health_event(event_id) is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

    storage.update_health_event_review(
        event_id, request.review_status, request.review_notes
    )
    updated = storage.get_health_event(event_id)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return updated
