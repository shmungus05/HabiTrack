# 05: Simulation Sandbox & Anomaly Injector

**What to build:**
A dedicated training and simulation subsystem for Flight Surgeons to inject transient anomalies into the telemetry stream (such as a localized CO2 pocket excursion >3,800 PPM or an orbital South Atlantic Anomaly crossing) and test system alerts and assistant responses. Includes a simulated astronaut profile editor and threshold sliders, backed by a clean reset mechanism that restores nominal baselines without corrupting underlying data stores.

**Blocked by:** 01: Authentic NASA EDA Telemetry Stream & Playback Engine

**Status:** done

- [x] Interactive 1-click anomaly injector buttons:
  - Inject CO2 Pocket Anomaly (>3,800 PPM).
  - Simulate South Atlantic Anomaly (SAA) Radiation Belt Crossing.
  - Reset All Telemetry to Nominal Baselines.
- [x] Astronaut baseline profile form: editable callsign, operational role, baseline resting heart rate, and resting SpO2.
- [x] Interactive threshold sliders for CO2 warning level (2,500–4,500 PPM) and radiation rate alert (0.15–0.50 mGy/day).
- [x] Pure overlay state mutator ensuring underlying authentic telemetry files and database tables remain untouched.
- [x] Rendered in a high-contrast `rounded-[32px]` panel following the Perplexity minimalist aesthetic.
- [x] Unit tests verify scenario injection, threshold updates, and complete state restoration upon reset.
