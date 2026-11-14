"""
Unit tests for NASA Open Science Catalog Metadata & DOI Integrity.
"""

import pytest

DATASETS = [
    {
        "id": "NASA-EDA-ISS-EXP72",
        "doi": "10.26030/iss-eda-2024-exp72",
        "category": "Cabin Telemetry & Environmental Sensors",
    },
    {
        "id": "NASA-RADLAB-ISS-DOSIMETRY",
        "doi": "10.26030/radlab-iss-dosimetry-v3",
        "category": "Space Radiation & Dosimetry",
    },
    {
        "id": "NASA-LSDA-HRP-CO2-HEADACHE",
        "doi": "10.1097/JOM.0000000000000059",
        "category": "Human Spaceflight Health & Epidemiology",
    },
    {
        "id": "NASA-OSDR-458",
        "doi": "10.26030/osdr-458-circadian",
        "category": "Circadian Biology & Sleep Microenvironment",
    },
]


def test_dataset_catalog_entries():
    assert len(DATASETS) == 4
    for ds in DATASETS:
        assert ds["id"].startswith("NASA-")
        assert ds["doi"].startswith("10.")
        assert len(ds["category"]) > 5
