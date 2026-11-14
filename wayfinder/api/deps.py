"""wayfinder.api.deps: Shared FastAPI dependencies for application state access."""

from __future__ import annotations

from fastapi import Request

from wayfinder.core.rag import VectorStoreManager
from wayfinder.core.storage import StorageManager


def get_storage(request: Request) -> StorageManager:
    """Returns the storage manager, lazily initializing if lifespan was skipped."""
    storage = getattr(request.app.state, "storage", None)
    if storage is None:
        storage = StorageManager()
        storage.ensure_initialized()
        request.app.state.storage = storage
    return storage


def get_vector_store(request: Request) -> VectorStoreManager:
    """Returns the in-memory vector store, lazily initializing if lifespan was skipped."""
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store is None:
        storage = get_storage(request)
        vector_store = VectorStoreManager(storage)
        request.app.state.vector_store = vector_store
    return vector_store
