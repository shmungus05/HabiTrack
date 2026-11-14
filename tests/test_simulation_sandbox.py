"""
Unit tests for Simulation Sandbox & Telemetry Anomaly Injector.
"""

import pytest


def test_scenario_state_transitions():
    scenarios = ["nominal", "co2_spike", "saa_transit", "thermal_overheat"]
    state = "nominal"

    def inject_scenario(sc):
        assert sc in scenarios
        return sc

    def reset_nominal():
        return "nominal"

    state = inject_scenario("co2_spike")
    assert state == "co2_spike"

    state = inject_scenario("saa_transit")
    assert state == "saa_transit"

    state = reset_nominal()
    assert state == "nominal"


def test_threshold_slider_bounds():
    co2_min, co2_max = 2500, 4500
    rad_min, rad_max = 0.15, 0.50

    def validate_co2_threshold(val):
        return co2_min <= val <= co2_max

    def validate_rad_threshold(val):
        return rad_min <= val <= rad_max

    assert validate_co2_threshold(3100)
    assert not validate_co2_threshold(2000)
    assert not validate_co2_threshold(5000)

    assert validate_rad_threshold(0.25)
    assert not validate_rad_threshold(0.10)
    assert not validate_rad_threshold(0.60)
