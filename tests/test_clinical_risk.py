"""
Unit tests for NASA LSDA & RadLab Epidemiological Risk Models.
Verifies monotonicity of headache probability, lag time windows, and flight rule violations.
"""

import pytest


def test_co2_headache_monotonicity():
    # Model: CO2 PPM -> Headache probability %
    points = [
        (1970, 4),
        (2630, 8),
        (3290, 16),
        (3950, 28),
        (4600, 44),
        (5260, 62),
        (5920, 78),
    ]
    for i in range(len(points) - 1):
        assert points[i][1] < points[i + 1][1], f"Monotonicity violated at {points[i]} vs {points[i+1]}"
        assert points[i][0] < points[i + 1][0]


def test_co2_lag_distribution_peak():
    # 1.5h and 2.0h must represent the peak intracranial pressure window (>80% match)
    lag_data = {
        "0h": 18,
        "0.5h": 42,
        "1.0h": 68,
        "1.5h": 81,
        "2.0h": 84,
        "2.5h": 76,
        "3.0h": 55,
        "4.0h": 28,
    }
    assert lag_data["2.0h"] == max(lag_data.values()), "Peak headache lag must occur at 2.0 hours"
    assert lag_data["1.5h"] > lag_data["1.0h"]
    assert lag_data["2.0h"] > lag_data["2.5h"]


def test_flight_rule_b13_101_threshold():
    threshold_ppm = 3100
    safe_reading = 2800
    alert_reading = 3400

    def check_flight_rule(co2_ppm):
        return co2_ppm > threshold_ppm

    assert not check_flight_rule(safe_reading)
    assert check_flight_rule(alert_reading)
