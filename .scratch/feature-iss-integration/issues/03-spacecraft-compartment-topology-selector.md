# 03: Spacecraft Compartment Topology Selector

**What to build:**
A station compartment navigation subsystem that models key ISS modules (Node 1 Unity, Node 2 Harmony, US Lab Destiny, Columbus, JEM Kibo) and their assigned environmental life support sensor arrays (CDRA, MCA, TEPC, THC). Allows crew members to filter environmental telemetry and risk metrics by location to isolate localized atmospheric pockets.

**Blocked by:** 01: Authentic NASA EDA Telemetry Stream & Playback Engine

**Status:** done

- [x] Station topology registry defined with module metadata: assigned sensors, primary function, nominal airflow, and baseline thresholds.
- [x] Horizontal module navigation bar allowing instant switching between ISS compartments with active indicator chips.
- [x] Telemetry views filter or annotate sensor readings based on the selected spacecraft compartment.
- [x] Preserves all module names and sensor attributions with a minimalist `rounded-[32px]` container and micro-animations.
- [x] Unit tests verify compartment switching and filtering contracts.
