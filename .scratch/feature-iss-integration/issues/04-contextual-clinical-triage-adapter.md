# 04: Contextual Clinical Triage Adapter

**What to build:**
A contextual intelligence adapter that parses freeform astronaut symptom text for compartment locations, captures an instantaneous 5-factor environmental snapshot (CO2, Temp, Humidity, Radiation, Pressure), evaluates operational safety compliance against NASA Flight Rule B13-101.B, and injects actionable clinical insights into the Assistant drawer.

**Blocked by:** 02: Epidemiological Risk Models & Biological Delay Curves, 03: Spacecraft Compartment Topology Selector

**Status:** done

- [x] Location extractor parses freeform dialogue for compartment keywords ("Harmony", "Lab", "Destiny", "Columbus", "Kibo", "Unity", "Cupola") and resolves target module sensors.
- [x] Triage evaluator compares current environmental telemetry against Flight Rule thresholds and calculates delta from nominal.
- [x] Correlation engine flags potential delayed causal links (e.g., headache reported with elevated CO2 exposure lag).
- [x] Connects cleanly to the Assistant drawer without modifying core voice synthesis or streaming logic.
- [x] Unit tests verify regex extraction across varied casing, punctuation, and multi-factor advisory generation.
