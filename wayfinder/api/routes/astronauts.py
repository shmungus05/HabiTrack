"""wayfinder.api.routes.astronauts: Cohort profile REST endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from wayfinder.api.deps import get_storage
from wayfinder.core.models import Astronaut
from wayfinder.core.storage import StorageManager

router = APIRouter(prefix="/api/astronauts", tags=["astronauts"])


@router.get("", response_model=List[Astronaut])
def list_astronauts(storage: StorageManager = Depends(get_storage)) -> List[Astronaut]:
    """Lists the registered astronaut cohort profiles."""
    return storage.list_astronauts()


@router.get("/{astronaut_id}", response_model=Astronaut)
def get_astronaut(
    astronaut_id: str, storage: StorageManager = Depends(get_storage)
) -> Astronaut:
    """Returns a single astronaut profile with baseline calibration stats."""
    astronaut = storage.get_astronaut(astronaut_id)
    if astronaut is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")
    return astronaut
