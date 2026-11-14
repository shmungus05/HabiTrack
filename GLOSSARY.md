# WAYFINDER Domain Model

Offline-first astronaut health intelligence and environmental exposure analysis workstation supporting crew medical decision-making during spaceflight missions.

## Language

### Astronaut & Mission Entities

**Astronaut**:
A specific crew member participating in a spaceflight mission with an assigned operational role and health telemetry stream.
_Avoid_: User, patient, subject, client

**Flight Surgeon**:
A ground-based or crew medical officer responsible for evaluating astronaut physiological trends and clinical events.
_Avoid_: Doctor, physician, clinician, admin

### Telemetry & Data Streams

**Environmental Telemetry**:
Physical sensor measurements tracking atmospheric conditions within the spacecraft cabin (e.g., carbon dioxide partial pressure, temperature, total atmospheric pressure).
_Avoid_: Cabin sensor data, sensor logs, habitat metrics

**Physiological Vitals**:
Time-series biometric measurements reflecting an astronaut's physiological state (e.g., heart rate, blood oxygen saturation, core body temperature).
_Avoid_: Wearable metrics, biological signals, health telemetry

**Deterministic Vitals Simulation**:
A pseudorandom, reproducible time-series generator that produces physiologically plausible vital signs synchronized to authentic mission timestamps without cloud dependencies or dynamic environmental coupling.
_Avoid_: Mock data, fake telemetry, synthetic vitals generator, coupling function

**Telemetry Stream**:
A registered, continuous channel of measurements characterized by an engineering unit, category, and nominal operational range.
_Avoid_: Channel, metric, time series, sensor feed

**Measurement**:
An individual recorded data point along a telemetry stream with a standardized UTC timestamp, numeric value, and quality classification.
_Avoid_: Reading, point, sample, sensor record

### Data Integrity & Provenance

**Provenance Category**:
The authoritative origin classification assigned to every data record, distinguishing authentic NASA logs (`AUTHENTIC_NASA_EDA`), deterministic simulation (`SYNTHETIC_SIMULATION`), and manual crew entries (`CREW_REPORTED`).
_Avoid_: Data source type, origin flag, authenticity tag

**Quality Status**:
The operational integrity state of an individual measurement (`VALID`, `SUSPECT`, `STALE`, `GAP`, `IMPUTED`), indicating whether sensor data is physically plausible, dropout-affected, or interpolated.
_Avoid_: Validity flag, health status, sensor status

### Clinical & Operational Events

**Symptom Report**:
A structured entry submitted by an astronaut documenting the subjective onset of physical discomfort, preserving distinct occurrence and submission timestamps.
_Avoid_: Incident report, complaint, medical log, ticket

**Exposure Window**:
A bounded temporal interval surrounding a symptom's occurrence time used to analyze co-occurring fluctuations in environmental and physiological telemetry.
_Avoid_: Time slice, correlation window, search window

**Health Event**:
An explainable, immutable system finding generated when an environmental threshold excursion co-occurs with an active exposure window or physiological deviation, explicitly disclaiming clinical causation.
_Avoid_: Alert, anomaly, diagnosis, alarm, incident

**Multi-Signal Concordance**:
The bounded-window co-occurrence of environmental atmospheric excursions (e.g. cabin $P_{\text{CO}_2} \ge 4.5\,\text{mmHg}$), multi-vital autonomic shifts ($Z_{HR} \ge +2.0$ and $Z_{RMSSD} \le -2.0$), and crew-reported clinical symptoms, evaluated symmetrically without presuming clinical causality.
_Avoid_: Multi-sensor correlation, anomaly overlap, combined alarm, triage score

**Temporal Interval Coalescence**:
The algorithmic pre-clustering of contiguous physiological deviation epochs (separated by $\le 10$ minutes and spanning $\ge 15$ minutes) into a single summarized event record before severity classification, preventing event flooding during routine physical exercise countermeasures.
_Avoid_: Alert deduplication, event merging, alarm throttling, debounce

### Baseline & Personalization Analytics

**Circadian Hourly Bin**:
A discrete integer time-of-day segment ($b \in [0, 23]$ in mission UTC) used to aggregate historical physiological measurements across rolling mission days to estimate time-of-day expected baseline means and standard deviations.
_Avoid_: Time slot, circadian bucket, hourly average, hourly window

**Autonomic Tone (RMSSD)**:
The Root Mean Square of Successive Differences between normal heartbeats, expressed in milliseconds (`ms`), serving as an operational non-invasive biomarker for parasympathetic activity and sympathetic stress response in microgravity.
_Avoid_: HRV score, pulse variability, stress index, autonomic score

**Calibration Status**:
The baseline reliability state of an astronaut's physiological profile (`CALIBRATING` vs. `CALIBRATED`), where `CALIBRATED` requires at least 3 distinct mission calendar days ($N_{\text{days}} \ge 3$) and $\ge 36$ valid historical samples within a circadian hourly bin.
_Avoid_: Training status, baseline flag, warm-up state, readiness level

**Chronotype Phase Offset**:
The individual operational sleep-wake phase shift (in hours relative to mission UTC) assigned to an astronaut to account for personalized diurnal rhythms and staggered crew sleep schedules.
_Avoid_: Time zone, shift time, sleep delay, circadian lag

### Knowledge & Research

**Scientific Evidence Card**:
A retrieved passage from curated NASA spaceflight medicine literature citing authoritative sources, findings, and DOI references to provide scientific context for an observed health event.
_Avoid_: Search result, LLM answer, AI diagnosis, summary

### Operational Decision Support & Flight Rules

**Operational Flight Rule**:
A certified flight-qualified contingency document parsed from primary Markdown, containing structured frontmatter, condition thresholds, and verbatim checklist steps cryptographically verified by SHA-256.
_Avoid_: Playbook, protocol, SOP, guidelines, runbook

**Procedural Checklist Step**:
An individual immutable operational instruction within a flight rule defining a required action, target subsystem, verification telemetry condition, and caution/warning note.
_Avoid_: Task, item, to-do, sub-step, checklist entry

**Fast-Path Latching**:
The sub-50ms deterministic in-memory lookup that binds an active environmental threshold breach or concordance event to its canonical operational flight rule without LLM inference.
_Avoid_: Auto-trigger, instant prompt, rule caching, quick search

**Standby Assistant Trigger**:
The persistent floating console UI entry point providing non-modal excursion alerting, Push-to-Talk audio metering, and `Ctrl+K` text focus across all console views.
_Avoid_: Chat widget, popup button, floating action button, bot launcher

**Decision Support Provider**:
The decoupled computational backend delivering single-turn contextual narrative synthesis across cloud testing, air-gapped local LLMs, and deterministic extractive synthesis.
_Avoid_: AI engine, model wrapper, chatbot backend, agent executor

**Epistemic Guardrail (Non-Causal)**:
The programmatic tripwire enforcing strict non-causal language constraints (`PROHIBITED_CAUSAL_TERMS`) to prevent clinical diagnostic claims or medical prescriptions in spaceflight operations.
_Avoid_: AI filter, content moderator, safety censor, hallucination guard
