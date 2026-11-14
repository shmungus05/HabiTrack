"""
Unit tests for Authentic NASA EDA Telemetry Ingestion and Mathematical Invariants.
Verifies dataset integrity, sequential record ordering, and environmental bounds.
"""

import json
from pathlib import Path
import pytest

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "nasaEdaRealData.json"


def test_nasa_eda_dataset_exists_and_parses():
    assert DATA_FILE.exists(), "nasaEdaRealData.json must exist in data/"
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "metadata" in data
    assert "records" in data
    metadata = data["metadata"]
    assert metadata["source"] == "NASA Environmental Data Application (EDA)"
    assert metadata["totalPoints"] == 180
    assert len(data["records"]) == 180


def test_nasa_eda_records_invariants():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data["records"]
    for i, record in enumerate(records):
        assert record["index"] == i
        # CO2 within spaceflight physiological ranges (1000 - 8000 PPM)
        assert 1000 <= record["co2"] <= 8000, f"CO2 out of range at index {i}: {record['co2']}"
        # Cabin temperature in Celsius (18 - 32 °C)
        assert 18.0 <= record["temp"] <= 32.0, f"Temp out of range at index {i}: {record['temp']}"
        # Relative humidity in percentage (20 - 90 %)
        assert 20 <= record["humidity"] <= 90, f"Humidity out of range at index {i}: {record['humidity']}"
        # Radiation dose rate in mGy/day (0.05 - 1.5 mGy/day)
        assert 0.05 <= record["radiation"] <= 1.5, f"Radiation out of range at index {i}: {record['radiation']}"
        assert "module" in record
        assert "fullTimestamp" in record


def test_co2_partial_pressure_conversion():
    # Test conversion: ppCO2 (mmHg) = (PPM / 1,000,000) * 758.0 mmHg
    ppm = 3197
    total_pressure = 758.0
    expected_mmhg = round((ppm / 1_000_000) * total_pressure, 2)
    assert expected_mmhg == 2.42
