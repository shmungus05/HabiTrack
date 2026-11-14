# 02: Epidemiological Risk Models & Biological Delay Curves

**What to build:**
A clinical risk evaluation module that calculates non-linear physiological hazard metrics from environmental telemetry. Encodes empirical NASA LSDA hypercapnic headache probabilities (4% to 78%), the 1.5–2.0 hour intracranial pressure delay curve, RadLab cellular fatigue indices, humidity-based dry-eye irritation rates, and exercise thermal strain. Renders a comprehensive Clinical Risk Matrix card with minimalist SVG curves and operational NASA Flight Rule flags.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Implements pure mathematical risk functions for:
  - CO2 PPM to headache incidence probability curve.
  - Delayed symptom onset lag-time distribution peaking at 90–120 minutes.
  - Radiation absorbed dose rate to cellular fatigue index (0–100 scale).
  - Cabin relative humidity to mucosal irritation rating.
  - Cabin temperature to core body heat rise during daily 2.5h exercise.
- [x] Renders an isolated, interactive Clinical Risk Matrix card featuring a factor tab selector and lightweight SVG visual curves.
- [x] Displays active operational flight rule warnings (NASA Flight Rule B13-101.B and SRAG ALARA) when parameters exceed safety bands.
- [x] Preserves all numerical ranges, status labels, and medical annotations from the original design.
- [x] Unit tests verify monotonicity, threshold boundaries, and numerical precision across all mathematical functions.
