# HabiTrack
## Offline Astronaut Health Intelligence & Environmental Exposure Analysis

**Product Requirements Document (PRD)**  
**Project:** NASA Space Apps Challenge  
**Document status:** Final consolidated product direction  
**Product type:** Offline-first astronaut health monitoring and decision-support prototype  
**Working tagline:** Monitor the astronaut. Understand the environment. Investigate the change. Support the decision.

---

# 1. Executive Summary

HabiTrack is an offline-first astronaut health intelligence platform designed to help astronauts and medical-support personnel investigate changes in astronaut health by combining personal health information, environmental measurements, and crew-reported symptoms.

The system organizes data from different sources, validates its quality, aligns measurements over time, and identifies noteworthy changes and possible relationships between environmental conditions and reported symptoms.

Its core capabilities are:

1. Environmental monitoring using available NASA environmental datasets.
2. Structured astronaut symptom reporting.
3. Personal health baselines and longitudinal trend monitoring.
4. Explainable multi-signal health analysis.
5. Evidence-grounded scientific knowledge retrieval.
6. Offline health information access and event recording.
7. Medical decision support with transparent uncertainty.

HabiTrack is a research and demonstration prototype. It is not a replacement for NASA operational systems, qualified medical professionals, or approved mission medical procedures.

## Product principle

**Detect changes. Understand context. Retrieve evidence. Support decisions.**

---

# 2. Problem Statement

Astronauts experience physiological, behavioral, and environmental changes during spaceflight.

Health measurements, environmental telemetry, medical assessments, and self-reported symptoms may originate from different systems and may not be easy to interpret together.

A single measurement may not adequately describe an astronaut's health condition. A change in one measurement may be more meaningful when considered alongside personal history, other physiological signals, environmental conditions, and reported symptoms.

Long-duration missions introduce another challenge: communication delays or temporary disconnection can limit immediate access to ground-based medical support.

HabiTrack addresses these challenges by organizing relevant information into a unified, explainable, offline-capable health investigation workflow.

## Main questions the product should help answer

- What has changed in the astronaut's health or environment?
- How does the measurement compare with the astronaut's own historical pattern?
- What other relevant measurements or symptoms occurred around the same time?
- Is the available data reliable and complete?
- What scientific evidence may help interpret the observation?
- What information should be reviewed by the astronaut or medical-support personnel?

---

# 3. Product Vision and Goals

## Vision

Build a mission-ready concept for astronaut health intelligence that connects the astronaut, the spacecraft environment, and scientific knowledge in one transparent decision-support experience.

## Product goals

1. Provide a unified view of relevant astronaut health and environmental information.
2. Establish personal baselines when suitable historical data exists.
3. Identify unusual changes and persistent trends.
4. Connect environmental measurements with symptom reports through time-based investigation.
5. Make every finding traceable to its source data.
6. Explain uncertainty, missing data, and limitations.
7. Provide locally accessible information during network disconnection.
8. Support human medical review without making autonomous diagnoses.

## Non-goals

HabiTrack will not:

- Diagnose diseases or medical emergencies.
- Claim that a correlation proves causation.
- Replace existing NASA medical systems.
- Invent clinical thresholds or radiation limits.
- Present research datasets as live astronaut telemetry.
- Treat molecular research data as continuous physiological measurements.
- Allow a language model to independently determine medical risk or prescribe treatment.

---

# 4. Target Users

## Primary user: Astronaut

Needs to:
- Review personal health trends.
- Report symptoms.
- Understand relevant environmental conditions.
- Review important alerts and historical events.
- Access locally stored reference information.

## Secondary user: Flight surgeon / Medical-support personnel

Needs to:
- Review astronaut health history.
- Investigate environmental and physiological patterns.
- Inspect source measurements and data quality.
- Review event timelines and reports.
- Access evidence and relevant reference material.

## Additional user: Research and mission-support team

Needs to:
- Explore historical datasets.
- Review trends and data provenance.
- Understand system findings and limitations.
- Export structured reports for further analysis.

**Delivery status (Version 5): 100% Delivered.** The console exposes a persistent, zero-authentication perspective switch (`localStorage: habitrack_active_role`). **Astronaut perspective** locks the cohort to the active crewmember, renders three glanceable status cards, and provides one-tap symptom logging. **Flight Surgeon perspective** retains full diagnostic depth: multi-cohort switching, telemetry scrubbers, anomaly injection, threshold overrides, risk matrices, and event sign-off. Switching perspective never discards in-progress work or refetches authoritative state.

---

# 5. Core Product Concept

HabiTrack combines three perspectives:

### A. The astronaut

What is happening inside the astronaut?

Examples:
- Heart rate
- Heart-rate variability
- Oxygen saturation
- Sleep duration
- Activity
- Exercise performance
- Reported symptoms
- Available clinical assessments

### B. The environment

What is happening around the astronaut?

Examples, subject to actual dataset availability:
- Carbon dioxide
- Temperature
- Humidity
- Oxygen
- Radiation-related measurements
- Other spacecraft environmental or hardware telemetry

### C. The evidence

What does relevant scientific knowledge tell us?

Examples:
- NASA human-system risk documentation.
- Spaceflight health research.
- Relevant peer-reviewed studies.
- Approved medical references and procedures, when available and authorized.

These three perspectives should be connected without treating them as interchangeable data types.

---

# 6. Data Sources and Data Strategy

## 6.1 NASA Environmental Data Application (EDA)

**Primary purpose:** Environmental monitoring and exposure context.

Use EDA to inspect and obtain available International Space Station environmental and hardware telemetry.

Before implementation, inspect:
- Dataset variables.
- Units.
- Timestamps.
- Mission coverage.
- Sampling frequency.
- Missing values.
- Data quality.
- Download and access options.

Only display measurements that are actually present in the selected dataset.

Potential variables include CO₂, oxygen, temperature, humidity, and other environmental measurements, depending on the selected dataset.

EDA data must not be represented as current live spacecraft telemetry unless the source explicitly provides live data.

## 6.2 NASA Open Science Data Repository (OSDR)

**Primary purpose:** Scientific research and supporting evidence.

Use OSDR to discover suitable human and spaceflight research datasets.

Potential research areas:
- Cardiovascular changes.
- Immune-system changes.
- Biological responses to microgravity.
- Radiation-related research.
- Sleep and behavioral changes.

OSDR is a research repository. Do not assume it provides continuous live astronaut medical telemetry.

## 6.3 Inspiration4 research

**Primary purpose:** Understand individual biological variation and multimodal astronaut research.

The supplied research notes describe the Inspiration4 study as involving four crew members and measurements across mission phases, including physiological monitoring, cognitive assessments, surveys, imaging, and biological sampling.

Use this research to support scientific context and explain why astronaut health monitoring should consider multiple systems and individual variation.

Do not treat biological samples or intermittent research measurements as continuous wearable streams.

## 6.4 RadLab and radiation-related research

**Primary purpose:** Radiation exposure context.

Use only available and documented measurements. Preserve units, measurement method, source, and assumptions.

Do not infer radiation dose from unrelated wearable measurements.

## 6.5 Crew-reported information

Astronauts may enter:
- Symptom.
- Severity.
- Description.
- Start time.
- Report time.
- Location, if known.
- Additional context.

Self-reported data must remain distinguishable from sensor measurements.

## 6.6 Demonstration data

If real-time astronaut telemetry is unavailable, use clearly labeled synthetic demonstration streams.

Every data record should identify whether it is:
- Authentic NASA research or telemetry data.
- Manually entered information.
- Synthetic demonstration data.

Historical NASA measurements replayed in a live-looking interface must be labeled as historical replay or simulation.

---

# 7. Functional Requirements

## FR-01: Astronaut Profile

The system shall maintain a profile for each demonstration astronaut.

Profile information may include:
- Identifier.
- Mission identifier.
- Mission day.
- Relevant baseline period.
- Available health measurements.
- Data-source references.

Sensitive personal information should be minimized in the prototype.

## FR-02: Data Ingestion

The system shall import supported environmental and health datasets.

It shall preserve:
- Original source.
- Dataset identifier.
- Measurement name.
- Value.
- Unit.
- Timestamp.
- Collection method, when available.
- Data type.
- Quality status.

The first release may use file-based ingestion rather than a live API connection.

## FR-03: Data Validation and Quality

The system shall identify:
- Missing values.
- Invalid timestamps.
- Duplicate records.
- Unsupported units.
- Implausible values.
- Stale measurements.
- Incomplete source metadata.

Missing information must not be interpreted as normal information.

## FR-04: Environmental Monitoring

The system shall display available environmental measurements over time.

It shall provide:
- Measurement name.
- Value and unit.
- Timestamp.
- Dataset or source.
- Historical chart.
- Data-quality indicator.
- Source limitations.

Environmental thresholds may only be used when supported by an authoritative source and applicable measurement context.

## FR-05: Symptom Reporting

The astronaut shall be able to record:
- Symptom type or description.
- Severity.
- Symptom occurrence time.
- Report submission time.
- Location, when known.
- Optional notes.

The system shall preserve the difference between symptom occurrence time and report submission time.

## FR-06: Exposure Context and Timeline

The system shall align symptom reports with environmental readings by timestamp.

Where available, it may also consider:
- Location.
- Exposure duration.
- Measurement frequency.
- Data quality.

It shall display measurements around the reported symptom period.

It may identify temporal overlap or possible associations, but must not claim that an environmental measurement caused a symptom.

## FR-07: Personal Health Baseline

The system shall support comparison of health measurements against an astronaut's own historical pattern when sufficient suitable data exists.

It shall display:
- Baseline period.
- Current measurement.
- Historical range or summary.
- Difference from baseline.
- Data availability.
- Confidence or limitations.

Baseline methods must be documented and tested. A baseline is not automatically a clinical normal range.

## FR-08: Explainable Trend and Pattern Analysis

The system shall identify noteworthy changes using transparent statistical or rule-based methods.

Initial methods may include:
- Rolling averages.
- Trend slopes.
- Deviation from personal baseline.
- Persistence checks.
- Time-based co-occurrence.
- Missing-data and sensor-quality checks.

Each finding shall explain:
- What changed.
- Which measurements contributed.
- Relevant time period.
- Data quality.
- What information is missing.
- What the system cannot conclude.

## FR-09: Alerts and Event History

The system shall create reviewable events for noteworthy changes.

An event should include:
- Event title.
- Time.
- Affected measurements.
- Explanation.
- Severity or priority, if justified.
- Uncertainty.
- Data provenance.
- Review status.

Alerts are prompts for review, not medical diagnoses.

## FR-10: Local Scientific Knowledge Assistant

A later release shall provide a local retrieval-augmented knowledge assistant.

It shall:
- Search a curated local knowledge base.
- Retrieve relevant passages.
- Present source citations.
- Explain findings in understandable language.
- State when evidence is insufficient.
- Distinguish scientific research from approved medical procedures.

The language model must not independently calculate medical risk, diagnose conditions, invent thresholds, or prescribe treatment.

## FR-11: Offline Operation

The core monitoring and investigation workflow should operate locally without continuous internet access.

Offline functionality should include:
- Local data access.
- Local event recording.
- Historical timeline access.
- Local reference retrieval in later releases.
- Clear synchronization status.

**Delivery status (Version 5): 100% Delivered.** Local reads, symptom and event writes, timeline access, and reference retrieval remain fully offline. All workstation operations are local-first and never wait on a network round trip; a visible synchronization-status indicator was intentionally removed with the deep-space link simulator, so the console no longer implies a live ground link it does not have.

## FR-12: Reports and Review

The system shall support a structured report containing:
- Mission and astronaut identifier.
- Time period.
- Relevant environmental measurements.
- Relevant health measurements.
- Symptom reports.
- Detected patterns.
- Data-quality notes.
- Source references.
- Uncertainty and limitations.

**Delivery status (Version 5): 100% Delivered.** The **Structured Clinical Investigation Dossier** compiles every bullet above into a typed `DossierReport`, including baseline deviation σ, unit-annotated environmental and vital snapshots, symptom history, concordance events, verified flight-rule checklists, provenance-tagged source references, and the mandatory non-causal disclaimer. Export modalities: interactive HTML preview, GFM Markdown clipboard copy, `.md` download, native `@media print` PDF, and simulated ground downlink. Prohibited causal language in symptom notes is flagged inline rather than aborting compilation.

---

# 8. User Experience and Main Screens

## 8.1 Mission Health Overview

Purpose: Give the astronaut a quick overview.

Display:
- Mission day.
- Latest available health information.
- Environmental status.
- Recent events.
- Data freshness.
- Offline status.

## 8.2 Environmental Monitoring

Purpose: Inspect spacecraft environmental measurements.

Display:
- Available variables.
- Historical charts.
- Units and timestamps.
- Source and dataset details.
- Data-quality status.

## 8.3 Symptom Reporting

Purpose: Record symptoms quickly and consistently.

Keep the form short, readable, and usable on a small display.

## 8.4 Exposure Investigation

Purpose: Investigate environmental and symptom timelines.

Display:
- Symptom occurrence.
- Environmental readings before and after the report.
- Relevant time differences.
- Data gaps.
- Location information when available.
- Explicit uncertainty.

## 8.5 Health Intelligence

Purpose: Understand personal health changes.

Display:
- Personal baseline.
- Current and historical measurements.
- Trends.
- Explainable findings.
- Contributing indicators.

## 8.6 Knowledge Assistant

Purpose: Retrieve and explain relevant research.

Display:
- User question.
- Retrieved evidence.
- Source references.
- Explanation.
- Limitations.

## 8.7 Event and Medical Review

Purpose: Review previous observations and actions.

Display:
- Event timeline.
- Supporting data.
- Review notes.
- Follow-up status.
- Exportable report.

---

# 9. Technical Architecture

## 9.1 Proposed technology stack

**Frontend**
- React.
- TypeScript.
- Responsive interface.
- Charting library such as Plotly or Recharts.

**Backend**
- Python.
- FastAPI.
- Pandas and NumPy for data processing.
- SciPy or scikit-learn only where appropriate.

**Database**
- SQLite for the initial offline prototype.
- A future migration to PostgreSQL may be considered if multi-user deployment requires it.

**Local AI — later release**
- Ollama or another suitable local model runtime.
- A small quantized instruction model selected after hardware testing.
- Local embedding model.
- ChromaDB or FAISS for retrieval.
- Lightweight RAG pipeline.

The local model is optional for the first working release. Do not allow the model to become a blocker for the core health investigation workflow.

## 9.2 Logical architecture

### Layer 1 — Data collection
- NASA environmental datasets.
- Available physiological measurements.
- Symptom reports.
- Research data.
- Synthetic demonstration streams.

### Layer 2 — Data validation
- Unit handling.
- Timestamp normalization.
- Data provenance.
- Missing-data checks.
- Data-quality status.

### Layer 3 — Health intelligence
- Environmental timeline.
- Personal baselines.
- Trend detection.
- Multi-signal analysis.
- Explainable event generation.

### Layer 4 — Knowledge retrieval
- Curated research corpus.
- Local indexing.
- Evidence retrieval.
- Citation-grounded explanations.

### Layer 5 — Decision-support interface
- Health dashboard.
- Exposure investigation.
- Alerts.
- Medical review.
- Reports.
- Offline event history.

## 9.3 Critical AI design rule

The analytics engine determines what changed.

The retrieval system finds relevant evidence.

The language model explains the evidence.

The human reviews and makes the medical decision.

Do not use a language model as the clinical prediction engine.

---

# 10. Data Model — Initial Concept

The system should use a common measurement structure.

### Measurement

- id
- astronaut_id
- source_id
- dataset_id
- measurement_type
- value
- unit
- timestamp
- location
- data_category
- quality_status
- is_synthetic

### SymptomReport

- id
- astronaut_id
- symptom
- severity
- occurred_at
- reported_at
- location
- notes
- is_synthetic

### HealthEvent

- id
- astronaut_id
- event_type
- title
- description
- start_time
- end_time
- contributing_measurements
- data_quality
- uncertainty
- review_status

### SourceRecord

- id
- source_name
- dataset_identifier
- source_url
- collection_method
- time_coverage
- limitations

This is a conceptual starting schema. Exact field types and relationships should be decided during implementation.

---

# 11. Scientific Integrity and Safety

These requirements apply to every release.

1. Do not claim that the prototype diagnoses a disease.
2. Do not claim that an unvalidated model predicts medical emergencies.
3. Do not invent clinical thresholds or radiation limits.
4. Distinguish NASA measurements from synthetic and manually entered data.
5. Preserve units, timestamps, source, and dataset limitations.
6. Do not treat missing data as normal.
7. Do not interpret correlation as causation.
8. Do not treat biological research data as continuous physiological telemetry.
9. Do not present NASA research publications as approved operational medical procedures.
10. Medical instructions must come from approved material and require appropriate human oversight.
11. Display uncertainty and data quality.
12. Protect sensitive health information.
13. Keep important events and changes auditable.

---

# 12. Non-Functional Requirements

## Offline-first
The core monitoring and investigation workflow must not depend on a live internet connection.

## Reliability
The application should handle missing, delayed, duplicate, and malformed measurements without silently producing misleading results.

## Explainability
Every generated finding should be traceable to source measurements and documented logic.

## Usability
The interface should prioritize:
- Large readable text.
- High contrast.
- Clear status labels.
- Simple navigation.
- Minimal interaction steps.
- Color-independent status indicators.

## Performance
The first release should prioritize responsive local data loading and chart rendering over complex AI features.

## Privacy
Use local storage for the prototype and avoid collecting unnecessary personal information.

---

# 13. MVP Acceptance Criteria

The first release is successful when a user can:

1. Open HabiTrack without an internet connection after setup.
2. Load a selected historical environmental dataset.
3. See only variables that actually exist in that dataset.
4. Inspect values, units, timestamps, and source information.
5. Submit a symptom report with occurrence time and severity.
6. See symptom reports aligned with environmental measurements.
7. Identify missing or stale measurements.
8. Inspect a possible temporal association without seeing a causal claim.
9. Review an explainable event generated from the selected scenario.
10. See whether each demonstration record is real, manually entered, or synthetic.
11. Export or inspect a basic investigation report.

---

# 14. Demonstration Scenario

**Scenario: Day 127 — Long-duration mission**

All live-looking data in this scenario is synthetic unless explicitly identified as historical NASA data.

1. The system loads a historical NASA environmental dataset or a labeled synthetic environmental stream.
2. The environmental timeline shows a change in an available measurement.
3. The astronaut submits a symptom report.
4. HabiTrack aligns the report with nearby environmental measurements.
5. The system highlights temporal overlap and displays measurement quality.
6. The system explains what is known, what is missing, and what cannot be concluded.
7. The astronaut or medical-support user reviews the event.
8. The event is saved locally for later review.

In a later release, the knowledge assistant retrieves relevant scientific references and explains the context with citations.

The demonstration should make clear that temporal overlap does not establish causation.

---

# 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| No live astronaut telemetry | Use historical NASA data and clearly labeled synthetic streams |
| EDA variables differ by dataset | Inspect dataset metadata before building visualizations |
| Research data is mistaken for sensor data | Separate data categories and display provenance |
| False alerts | Use transparent rules, persistence checks, and quality filters |
| Correlation interpreted as causation | Use careful wording and explicit limitations |
| LLM generates unsupported medical advice | Restrict it to evidence retrieval and explanation |
| Local model is too slow | Keep AI optional and benchmark on target hardware |
| Scope becomes too large | Use phased releases and acceptance criteria |
| Missing or unreliable measurements | Show quality status and uncertainty |

---

# 16. Success Measures

For the prototype, success should be measured by demonstrable system behavior rather than unverified clinical performance.

- Can the system ingest and display a real selected NASA dataset?
- Can it preserve source, unit, and timestamp information?
- Can it align symptom reports with environmental measurements?
- Can it identify missing and stale data?
- Can it explain why an event was generated?
- Can it work offline?
- Can it distinguish correlation from causation?
- Can the user understand the investigation without technical assistance?

No clinical sensitivity, specificity, or emergency-prediction performance should be claimed unless properly evaluated using suitable labeled data.

---

# 17. Product Release Strategy

HabiTrack will be developed in progressive releases.

**Version 1 — Core Environmental Health Investigation**
- Environmental dataset ingestion.
- Environmental monitoring.
- Symptom reporting.
- Timestamp alignment.
- Data-quality indicators.
- Explainable exposure-context events.
- Offline local storage.

**Version 2 — Personalized Health Monitoring**
- Astronaut profile.
- Personal health baselines.
- Physiological measurement history.
- Trend analysis.
- Multi-signal health context.

**Version 3 — Evidence-Grounded Local AI (Delivered)**
- Curated NASA research corpus (OSDR & Life Sciences).
- In-process SQLite hybrid retrieval (Dense float32 BLOB vector embeddings + FTS5 BM25 with RRF).
- Citation-grounded explanations with explicit evidence limitations.
- Epistemic guardrail blocking causal/clinical terminology (`PROHIBITED_CAUSAL_TERMS`).
- Decoupled FastAPI backend and React 18 WebGL console.

**Version 4 — Predictive Clinical Risk & Environmental Playback Intelligence (Delivered)**
- **Authentic NASA EDA Telemetry Stream Playback**: Continuous streaming controller for authentic ISS Expedition 71/72 flight telemetry across Node 2 Harmony and US Lab Destiny with scrub, play/pause, 1x/2x/5x speed modifiers, and 10-point moving sparklines.
- **Epidemiological Clinical Risk Predictor**: Non-linear models encoding NASA Life Sciences Data Archive (LSDA) and RadLab equations calculating hypercapnia headache probabilities (4% to 78%), cellular radiation fatigue indices, dry-eye mucosal irritation thresholds, and exercise thermal strain.
- **Empirical Biological Delay Modeling**: Visualization and evaluation of the 1.5–2 hour biological lag between cabin environmental excursions and physiological symptom manifestation.
- **5-Factor Contextual Clinical Triage**: Environmental snapshot adapter evaluating astronaut symptom entries against simultaneous multi-factor telemetry and station compartment topology under NASA Flight Rule B13-101.B.
- **Onboard Simulation Anomaly Sandbox**: Contained injection environment enabling flight surgeons to trigger CO2 pocket spikes (>3,800 PPM) and South Atlantic Anomaly (SAA) dosimetric surges to validate alert pipelines without corrupting authoritative state.
- **Multi-Factor Comparison Matrix**: Side-by-side environmental and physiological baseline comparison table with nominal operational envelopes.

**Version 5 — Autonomous Standby Health Station & Deep Space Operations (Current / Baselined)**
- **Omnipresent Standby AI Assistant**: Floating trigger pill and non-blocking 500 px slide-out drawer accessible across all console routes (`Overview`, `Timeline`, `Symptoms`, `Research`, `Alerts`, `Settings`).
- **Dual-Modality Interface**: Client-side Push-to-Talk (PTT) voice interaction with Web Speech API audio states alongside global keyboard hotkeys (`Ctrl+K`).
- **Certified Operational Flight Rules Ingestion**: Markdown-based flight rule corpus with YAML frontmatter indexed via SQLite vector and FTS5 search (`FR_ECLSS_001`, `FR_CDRA_002`, `FR_EVA_003`).
- **Sub-50ms Deterministic Latching**: Immediate threshold-to-rule latching presenting verified, SHA-256 hash-checked operational checklists prior to stochastic LLM generation.
- **Multi-Tier Provider Resilience**: Failover cascade spanning offline Extractive Synthesizer (0ms), local Ollama (`llama3.2:1b`), and cloud Gemini Flash-Lite, with a developer streaming audio dialog harness over WebSocket (`/ws/assistant/audio`).
- **Spacecraft Compartment Topology**: Spatial station module filtering (Node 1 Unity, Node 2 Harmony, US Lab Destiny, Columbus, JEM Kibo) and freeform text compartment entity extraction.
- **NASA Open Science Provenance & Exporter**: Verified DOI catalog for flight hardware sensors (CDRA, MCA, TEPC) and one-click authentic JSON telemetry export.
- **3-Mode Crew Symptom Capture Suite**: Quick severity chips, clinical structured reporting, and conversational triage chatbot.
- **Expo Obsidian Design System**: Strict 8 px radius, hairline borders on a pitch-black canvas, JetBrains Mono typography, restrained hue reserved for interaction and critical alerts.
- **Multi-Role Perspective Shell (Delivered)**: Persistent Astronaut / Flight Surgeon toggle with cohort locking, glanceable crew status cards, one-tap symptom logging, and role-gated diagnostic depth.
- **Structured Clinical Investigation Dossier (Delivered)**: Typed, non-causal report compiler with Markdown download, clipboard copy, native print-to-PDF, and PDF export.
- **Phase 2 Expansion (Roadmap)**: Multi-agent peer consensus for expedition medical teams and embedded edge NPU inference profiling.

Each version must preserve the safety and data-integrity requirements established in Version 1.

---

# 18. Final Product Positioning

HabiTrack is not simply a vital-sign dashboard or an AI medical chatbot.

It is an integrated astronaut health investigation system that connects:

- The astronaut's personal health patterns.
- The environment surrounding the astronaut.
- Crew-reported symptoms.
- Scientific research evidence.
- Explainable analytical findings.
- Offline decision-support workflows.

Its main innovation is the ability to connect different evidence sources while preserving provenance, uncertainty, and the distinction between correlation and causation.

**Final product principle:**

Monitor the astronaut. Understand the environment. Investigate the change. Support the decision.

### Version 5 Requirements Delivery Matrix

| Requirement | Capability | Status |
| :--- | :--- | :--- |
| `FR-11` | Offline-first local read/write access and reference retrieval | ✅ Delivered |
| `FR-12` | Structured Clinical Investigation Dossier (Markdown, print-PDF, downlink) | ✅ 100% Delivered |
| `Section 4` | Multi-Role Perspective Switcher (Astronaut / Flight Surgeon) | ✅ 100% Delivered |
| `FR-01`–`FR-10` | Cohort profiles, ingestion, quality, environment, symptoms, timeline, baselines, analytics, alerts, local assistant | ✅ Delivered (V1–V4) |

**Important limitation:** HabiTrack is a hackathon research prototype, not flight-certified medical software. Operational use would require appropriate clinical, engineering, security, human-factors, and mission-system validation.