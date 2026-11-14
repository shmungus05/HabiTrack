"""wayfinder.api.deps: Shared FastAPI dependencies for application state access."""

from __future__ import annotations

from fastapi import Request

from wayfinder.core.rag import VectorStoreManager
from wayfinder.core.storage import StorageManager


def get_storage(request: Request) -> StorageManager:
    """Returns the lifespan-initialized storage manager."""
    return request.app.state.storage


def get_vector_store(request: Request) -> VectorStoreManager:
    """Returns the lifespan-initialized in-memory vector store."""
    return request.app.state.vector_store
