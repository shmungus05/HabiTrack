"""wayfinder.server: CLI entry point for the WAYFINDER V3 application service."""

from __future__ import annotations

import argparse
import os
import uvicorn


def main() -> None:
    """Runs the FastAPI application with Uvicorn on port 8000."""
    parser = argparse.ArgumentParser(description="WAYFINDER V3 application server")
    parser.add_argument(
        "--host",
        default=os.getenv("WAYFINDER_HOST", "0.0.0.0"),
        help="Host address to bind (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("WAYFINDER_PORT", "8000")),
        help="Port to bind (default: 8000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=os.getenv("WAYFINDER_RELOAD", "false").lower() in ("true", "1"),
        help="Enable auto-reload on code changes (watches wayfinder/ only)",
    )
    args = parser.parse_args()

    uvicorn.run(
        "wayfinder.api.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_dirs=["wayfinder"] if args.reload else None,
    )


if __name__ == "__main__":
    main()
