"""Vercel Serverless Function entry point for WAYFINDER FastAPI backend."""

import os
import sys
from pathlib import Path

# Add project root to sys.path so 'wayfinder' is importable on Vercel
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# On Vercel / AWS Lambda, filesystem is read-only except /tmp
# Copy SQLite database to /tmp if needed so WAL mode and writes succeed
tmp_db = "/tmp/wayfinder.db"
base_db = ROOT_DIR / "data" / "wayfinder.db"
if not os.path.exists(tmp_db) and base_db.exists():
    import shutil
    try:
        shutil.copyfile(str(base_db), tmp_db)
        os.environ["WAYFINDER_DB_PATH"] = tmp_db
    except Exception as exc:
        print(f"Warning: could not copy database to /tmp: {exc}")

from wayfinder.api.server import app

# Vercel Serverless Python runtime looks for 'app' (ASGI)
