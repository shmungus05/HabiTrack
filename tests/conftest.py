"""
tests/conftest.py: Shared pytest fixtures for WAYFINDER Version 1.
"""

import os
import tempfile
import pytest
import pandas as pd
from wayfinder.core.storage import StorageManager
from wayfinder.core.models import (
    Astronaut,
    SymptomReport,
)


@pytest.fixture
def temp_db():
    """Provides a fresh StorageManager connected to an isolated temporary SQLite database."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    storage = StorageManager(db_path=path)
    storage.ensure_initialized()
    yield storage
    try:
        os.remove(path)
    except OSError:
        pass


@pytest.fixture
def sample_astronaut():
    """Default test astronaut fixture."""
    return Astronaut(
        astronaut_id="ASTRO-01",
        callsign="CDR M. Vance",
        mission_id="ISS-EXP-71",
        crew_role="Commander",
        baseline_calibrated_at="2026-03-01T00:00:00Z",
        baseline_parameters='{"resting_hr": 65.0, "resting_spo2": 98.0}',
    )


@pytest.fixture
def sample_eda_df():
    """Minimal DataFrame matching authentic EDA CSV structure."""
    return pd.DataFrame({
        "timestamp_utc": [
            "2026-07-01T00:00:00Z",
            "2026-07-01T00:01:00Z",
            "2026-07-01T00:02:00Z",
            "2026-07-01T00:03:00Z",
        ],
        "cabin_co2_ppm": [4000.0, 4200.0, 5800.0, 4100.0],
        "cabin_temp_c": [22.5, 22.6, 22.7, 22.5],
        "cabin_pressure_kpa": [101.3, 101.3, 101.3, 101.3],
        "module_id": ["Columbus", "Columbus", "Columbus", "Columbus"],
    })


@pytest.fixture
def sample_symptom():
    """Default test symptom report fixture."""
    return SymptomReport(
        report_id="SYM-001",
        astronaut_id="ASTRO-01",
        symptom_code="HEADACHE",
        severity=3,
        occurred_at="2026-07-01T00:02:00Z",
        reported_at="2026-07-01T01:45:00Z",
        cabin_module="Columbus",
        notes="Moderate throbbing headache after exercise protocol.",
        is_synthetic=False,
    )


@pytest.fixture
def api_client(temp_db):
    """Provides a TestClient bound to an isolated temporary database."""
    from fastapi.testclient import TestClient
    from wayfinder.api.server import create_app

    app = create_app(storage=temp_db)
    with TestClient(app) as client:
        yield client

