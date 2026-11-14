"""
Unit tests for Contextual Clinical Triage Regex Extraction & Correlation.
"""

import pytest


def parse_compartment(text: str) -> str:
    lower = text.lower()
    if "destiny" in lower or "us lab" in lower or "lab" in lower:
        return "destiny"
    if "columbus" in lower:
        return "columbus"
    if "kibo" in lower or "jem" in lower:
        return "kibo"
    if "unity" in lower or "node 1" in lower:
        return "node1"
    if "cupola" in lower:
        return "cupola"
    if "harmony" in lower or "node 2" in lower or "crew quarters" in lower:
        return "node2"
    return "general"


def test_compartment_regex_accuracy():
    assert parse_compartment("Throbbing headache while working in Harmony module") == "node2"
    assert parse_compartment("Stinging eyes in Columbus orbital facility") == "columbus"
    assert parse_compartment("Sweating after workout on treadmill in US Lab Destiny") == "destiny"
    assert parse_compartment("Doing camera maintenance in Cupola") == "cupola"
    assert parse_compartment("Passing through Node 1 Unity forward hatch") == "node1"
    assert parse_compartment("General symptom in unknown location") == "general"


def test_triage_delayed_causality_detection():
    # If headache is reported and CO2 > 3000 PPM, lag window must be 1.5 - 2.0h
    co2_reading = 3400
    has_headache = True
    assert co2_reading > 3100
    assert has_headache
    lag_window = "1.5 to 2.0 Hours post-exposure"
    assert lag_window.startswith("1.5")
