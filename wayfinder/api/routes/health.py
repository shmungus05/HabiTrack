"""wayfinder.api.routes.health: Service health and vector-store readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from wayfinder.api.deps import get_vector_store
from wayfinder.core.assistant import is_ollama_available
from wayfinder.core.models import HealthStatus
from wayfinder.core.rag import VectorStoreManager

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthStatus)
async def get_health(
    vector_store: VectorStoreManager = Depends(get_vector_store),
) -> HealthStatus:
    """Reports service version, Ollama availability, and vector-store size."""
    return HealthStatus(
        status="ok",
        version="3.0.0",
        ollama_online=await is_ollama_available(),
        vector_store_chunks=len(vector_store.chunk_ids),
    )
