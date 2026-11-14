"""wayfinder.api.server: FastAPI application shell, CORS, lifespan, and SPA mount."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from wayfinder.core.rag import VectorStoreManager
from wayfinder.core.storage import StorageManager
from wayfinder.api.routes import assistant, astronauts, events, health, symptoms, telemetry

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_DIST_DIR = REPO_ROOT / "dist" if (REPO_ROOT / "dist").exists() else (REPO_ROOT / "web" / "dist")
WEB_INDEX_FILE = WEB_DIST_DIR / "index.html"


def _diagnostic_payload() -> dict:
    return {
        "status": "WAYFINDER V3 API Online",
        "version": "3.0.0",
        "spa_compiled": False,
        "message": (
            "React production assets were not found. Build the console with "
            "`cd web && npm install && npm run build`, or run `npm run dev` for "
            "the Vite development server."
        ),
        "api_docs": "/docs",
    }


def create_app(storage: Optional[StorageManager] = None) -> FastAPI:
    """Creates the FastAPI application with injectable storage for tests."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if getattr(app.state, "storage", None) is None:
            app.state.storage = StorageManager()
        app.state.storage.ensure_initialized()
        app.state.vector_store = VectorStoreManager(app.state.storage)
        yield

    app = FastAPI(
        title="WAYFINDER Mission Health API",
        version="3.0.0",
        lifespan=lifespan,
    )
    app.state.storage = storage

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Telemetry JSON is ~1.3 MB (7k points) and compresses ~8x on the wire.
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    app.include_router(health.router)
    app.include_router(astronauts.router)
    app.include_router(telemetry.router)
    app.include_router(events.router)
    app.include_router(symptoms.router)
    app.include_router(assistant.router)

    if WEB_DIST_DIR.exists():
        assets_dir = WEB_DIST_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request):
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(
                {"detail": "Not Found", "path": f"/{full_path}"}, status_code=404
            )

        if WEB_INDEX_FILE.exists():
            candidate = (WEB_DIST_DIR / full_path).resolve()
            if (
                full_path
                and candidate.is_file()
                and WEB_DIST_DIR.resolve() in candidate.parents
            ):
                return FileResponse(candidate)
            return FileResponse(WEB_INDEX_FILE)

        return JSONResponse(_diagnostic_payload())

    return app


app = create_app()
