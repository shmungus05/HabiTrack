---
rule_id: "FR-ECLSS-001"
title: "Elevated Cabin Carbon Dioxide and Hypercapnia Mitigation"
subsystem: "ECLSS / CDRA"
revision_date: "2026-04-15"
severity_trigger: "INVESTIGATE"
condition_threshold: "P_CO2 >= 4.0 mmHg for > 30 min"
reference_docs:
  - "NASA-STD-3001 Vol 2"
  - "SSP 50260 Section 4.2"
---

# Operational Flight Rule: FR-ECLSS-001

## Operating Condition & Context
When cabin partial pressure of CO2 exceeds 4.0 mmHg during crew rest cycles or 5.0 mmHg during active duty, the following procedural checklist must be executed immediately to prevent acute hypercapnia, cognitive impairment, and cephalic fluid shift compounding.

## Procedural Contingency Checklist

| Step | Action | Target Subsystem | Verification | Caution / Warning |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Transition CDRA Bed Selector to DUAL-BED HIGH-FLOW | CDRA-ECLSS | Telemetry CDRA_STATE == 0x04 | Ensure vacuum desorb valve V12 is open before switching |
| 2 | Verify cabin ventilation fans running at nominal rate | NOD2-VENT | Flow rate >= 55 CFM | High acoustic noise (>62 dBA) during high-flow operation |
| 3 | Inquire crew for subjective symptoms | CREW-MED | Log headache, vision blurring, dyspnea | Prepare backup LiOH canisters if CDRA delta-P > 1.2 psi |
| 4 | Deploy portable LiOH auxiliary scrubber if P_CO2 > 6.0 mmHg | AUX-SCRUB | Auxiliary latch confirmed | Emergency flight director notification mandatory |
