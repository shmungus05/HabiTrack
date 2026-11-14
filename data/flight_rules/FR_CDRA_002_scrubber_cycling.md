---
rule_id: "FR-CDRA-002"
title: "Carbon Dioxide Removal Assembly Desiccant Bed Thermal Regeneration"
subsystem: "CDRA / ECLSS"
revision_date: "2026-05-10"
severity_trigger: "INVESTIGATE"
condition_threshold: "CDRA_BED_TEMP >= 210.0 degC or CYCLING_DELTA_P > 1.2 psi"
reference_docs:
  - "SSP 50260 Section 4.5"
  - "NASA-STD-3001 Vol 2"
---

# Operational Flight Rule: FR-CDRA-002

## Operating Condition & Context
During cyclic thermal desorption of CDRA desiccant and zeolite adsorbent beds, differential pressure anomalies across the selector valve or bed core temperatures exceeding nominal limits indicate thermal boundary excursion or bed channeling.

## Procedural Contingency Checklist

| Step | Action | Target Subsystem | Verification | Caution / Warning |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Isolate regenerative heating loop on affected bed | CDRA-HEAT | Power telemetry HEATER_A_PWR == 0 W | Do not touch manifold lines; surface temperature exceeds 200 degC |
| 2 | Engage secondary cabin return air bypass loop | NOD2-AIR | BYPASS_V22 position confirmed OPEN | Airflow drop across desiccant bed expected |
| 3 | Initiate vacuum desorption purge for 20 minutes | CDRA-VAC | Vacuum valve V12 OPEN, P_VAC < 0.05 torr | Monitor cabin pressure for unexpected air loss |
| 4 | Re-evaluate bed delta-P before resuming automatic cycle | CDRA-METRICS | DELTA_P <= 0.8 psi | If delta-P persists above 1.2 psi, lock out Bed B |
