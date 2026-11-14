---
rule_id: "FR-EVA-003"
title: "Extravehicular Activity Autonomic Strain and Tachycardia Mitigation"
subsystem: "EVA / CREW-MED"
revision_date: "2026-06-01"
severity_trigger: "EMERGENCY"
condition_threshold: "HR >= 160 bpm or RMSSD <= 15 ms during EVA prep"
reference_docs:
  - "NASA-STD-3001 Vol 1"
  - "JSC-63557 EVA Ops"
---

# Operational Flight Rule: FR-EVA-003

## Operating Condition & Context
Sustained sympathetic hyperactivation (heart rate exceeding 160 bpm or RMSSD dropping below 15 ms for greater than 5 consecutive minutes) during airlock pre-breathe or spacesuit donning signals acute autonomic decompensation, exhaustion, or impending vasovagal collapse.

## Procedural Contingency Checklist

| Step | Action | Target Subsystem | Verification | Caution / Warning |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Halt spacesuit donning protocol and direct crew to rest position | AIRLOCK-OPS | Suit umbilical motion stopped | Do not depressurize airlock while heart rate is elevated |
| 2 | Switch EMU oxygen regulator to 100% O2 high-flow flush | EMU-O2 | O2 supply pressure >= 850 psi | Check for hyperoxic euphoria symptoms |
| 3 | Instruct crewmember to initiate paced 4-4 breathing cycle | CREW-MED | Real-time RMSSD telemetry trending upward | Ground flight surgeon audio consultation required |
| 4 | Abort EVA preparation if heart rate does not decrease below 120 bpm within 15 min | FLIGHT-DIR | Mission Director notification logged | Mandatory 24-hour stand-down for affected crewmember |
