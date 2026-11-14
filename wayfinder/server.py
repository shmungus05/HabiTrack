"""wayfinder.server: CLI entry point for the WAYFINDER V3 application service."""

from __future__ import annotations

import uvicorn


def main() -> None:
    """Runs the FastAPI application with Uvicorn on port 8000."""
    uvicorn.run(
        "wayfinder.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    main()
