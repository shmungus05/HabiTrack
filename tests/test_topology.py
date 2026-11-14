"""
Unit tests for ISS Spacecraft Compartment Topology and Sensor Allocations.
"""

import pytest

ISS_MODULES = [
    {"id": "node2", "name": "Node 2 (Harmony)", "sensors": ["MCA ppCO2-N2", "THC-Temp-2", "AQM-2"]},
    {"id": "destiny", "name": "US Laboratory (Destiny)", "sensors": ["ARS-CO2-Dest", "Lab-THC-1", "TEPC-Radiation"]},
    {"id": "columbus", "name": "Columbus Orbital Facility", "sensors": ["COL-ECLSS-1", "COL-Temp-A", "RAM-04"]},
    {"id": "kibo", "name": "JEM Kibo", "sensors": ["JEM-ECLSS-CO2", "JEM-THC-1", "RAM-05"]},
    {"id": "node1", "name": "Node 1 (Unity)", "sensors": ["Unity-ARS-CO2", "Unity-THC-1", "RAM-02"]},
    {"id": "cupola", "name": "Cupola Observation Module", "sensors": ["Cupola-THC-Aux", "RAM-08-Window"]},
]


def test_iss_topology_completeness():
    assert len(ISS_MODULES) == 6
    module_ids = {m["id"] for m in ISS_MODULES}
    assert "node2" in module_ids
    assert "destiny" in module_ids
    assert "columbus" in module_ids
    assert "cupola" in module_ids


def test_sensor_allocation_uniqueness():
    for m in ISS_MODULES:
        assert len(m["sensors"]) >= 2
        assert len(set(m["sensors"])) == len(m["sensors"])
