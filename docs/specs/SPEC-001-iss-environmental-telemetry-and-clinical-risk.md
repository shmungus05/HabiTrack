# SPEC-001: Authentic NASA EDA Telemetry Stream & Clinical Risk Intelligence Integration

**Status:** Ready for Agent (`ready-for-agent`)  
**Domain Model:** [GLOSSARY.md](file:///D:/nasaResearch/GLOSSARY.md)  
**Seam Type:** Isolated Deep Feature Seams (UI & Logic)

---

## Problem Statement

During spaceflight missions, Astronauts and Flight Surgeons face severe cognitive overload when assessing environmental hazards and physiological symptoms. In the current workstation, telemetry streams rely predominantly on simulated data models without an interactive bridge to authentic NASA flight records. Furthermore, while environmental metrics (such as carbon dioxide partial pressure and ionizing radiation) are displayed as raw longitudinal time-series, the system does not explicitly evaluate the non-linear physiological risk curves or the characteristic 1.5–2 hour biological lag between an environmental excursion and symptom onset (such as hypercapnic headaches). Finally, Flight Surgeons lack an onboard mechanism to inject simulated anomalies during flight readiness training to verify how detection algorithms and decision-support agents respond to critical environmental transients.

---

## Solution

Integrate an authentic flight telemetry playback engine, an epidemiological clinical risk predictor, a spacecraft compartment topology selector, and an onboard simulation anomaly injector as strictly isolated deep modules. The solution provides:

1. **Authentic NASA EDA Stream Playback**: A continuous, high-fidelity playback controller that streams real ISS Expedition 71/72 environmental telemetry (180+ sequential records) across Node 2 Harmony and US Lab Destiny, complete with play/pause, scrub slider, 1x/2x/5x speed modifiers, and sliding 10-point moving sparklines.
2. **Clinical Risk & Biological Delay Engine**: A non-linear epidemiological risk calculator encoding NASA Life Sciences Data Archive (LSDA) and RadLab clinical models to quantify hypercapnia headache probabilities (4% to 78%), cellular radiation fatigue indexes, dry-eye mucosal irritation rates, and exercise thermal strain.
3. **5-Factor Contextual Clinical Triage**: An environmental snapshot adapter that evaluates astronaut symptom entries against simultaneous multi-factor telemetry and station compartment topology, applying Flight Rule B13-101.B advisory thresholds.
4. **Onboard Anomaly Injector**: A controlled simulation sandbox allowing Flight Surgeons to trigger CO2 pocket spikes (>3,800 PPM) and South Atlantic Anomaly (SAA) radiation belt crossings to test alert pipelines without state corruption.
5. **NASA Open Science Repository Provenance**: A structured dataset catalog linking every variable to official NASA DOIs and enabling one-click authentic JSON telemetry export.

---

## User Stories

1. As a Flight Surgeon, I want to switch the environmental telemetry feed from deterministic simulation to authentic NASA EDA telemetry, so that I can validate clinical decision algorithms against genuine spaceflight conditions.
2. As a Flight Surgeon, I want to scrub forward and backward through the ISS Expedition 71/72 flight telemetry stream, so that I can inspect atmospheric transitions before and after cabin air scrubbing cycles.
3. As an Astronaut, I want to play and pause the authentic telemetry stream, so that I can review environmental conditions at a manageable pace during mission debriefs.
4. As an Astronaut, I want to adjust playback speed between 1x, 2x, and 5x, so that I can rapidly scan long orbital passes or closely analyze rapid gas excursions.
5. As a Flight Surgeon, I want to see a 10-point moving-window sparkline for carbon dioxide, temperature, humidity, and radiation, so that I have immediate short-term trend awareness while telemetry streams.
6. As a Flight Surgeon, I want to see carbon dioxide levels reported in both PPM and partial pressure (mmHg), so that I can cross-reference clinical literature with engineering sensor telemetry.
7. As a Flight Surgeon, I want to see estimated headache probability calculated as a function of cabin carbon dioxide PPM, so that I can anticipate crew impairment before acute symptoms are reported.
8. As a Flight Surgeon, I want to view the empirical 1.5–2 hour biological lag-time distribution for carbon dioxide exposure, so that I understand why an astronaut develops a headache well after leaving an unventilated compartment.
9. As a Flight Surgeon, I want to monitor the cellular radiation fatigue index derived from active dosimeter dose rates, so that I can evaluate cumulative crew physiological stress during high solar activity.
10. As an Astronaut, I want to see relative humidity evaluated against mucosal and dry-eye irritation thresholds, so that I can use lubricating eye drops before ocular discomfort impairs visual acuity.
11. As a Flight Surgeon, I want to view core body temperature rise curves during daily 2.5-hour exercise periods, so that I can verify whether cabin ventilation prevents heat exhaustion.
12. As a Flight Surgeon, I want a multi-factor comparison matrix summarizing all five environmental factors side-by-side with nominal operational ranges, so that I can diagnose complex multi-sensor anomalies at a glance.
13. As an Astronaut, I want to filter environmental telemetry and risk metrics by spacecraft compartment (Node 1 Unity, Node 2 Harmony, US Lab Destiny, Columbus, JEM Kibo), so that I can pinpoint localized atmospheric pockets.
14. As an Astronaut, I want an onboard clinical triage assistant that automatically captures an environmental snapshot when I report symptoms, so that my symptom report is grounded in immediate environmental context.
15. As an Astronaut, I want the clinical triage assistant to detect compartment names mentioned in freeform speech or text, so that it correlates my report with the correct localized environmental sensors.
16. As a Flight Surgeon, I want symptom evaluations to cross-reference NASA Flight Rule B13-101.B advisory thresholds, so that operational compliance is automatically audited.
17. As a Flight Surgeon, I want to inject a simulated CO2 pocket spike exceeding 3,800 PPM into the telemetry pipeline with a single click, so that I can verify that alert banners and assistant triggers fire appropriately.
18. As a Flight Surgeon, I want to simulate an orbital South Atlantic Anomaly (SAA) crossing, so that I can evaluate the workstation's dosimetric surge notifications.
19. As a Flight Surgeon, I want a single-click reset action to restore all simulated telemetry streams to nominal baselines, so that training scenarios can be cleanly reset.
20. As a Flight Surgeon, I want to inspect official NASA Open Science Data Repository (OSDR) catalog metadata including DOIs and flight hardware sensors (CDRA, MCA, TEPC), so that data provenance is verifiable.
21. As an Astronaut, I want to export authentic NASA telemetry records to a standardized JSON file with a single click, so that data can be archived or transferred to ground-based investigation teams.
22. As an Astronaut, I want all new controls and cards formatted with high-contrast, rounded-[32px] minimalist containers and generous whitespace, so that reading telemetry is effortless in low-light cabin environments.

---

## Implementation Decisions

### Decision 1: Architectural Seams and Strict External Isolation
The entire feature set is implemented as four standalone deep modules residing under an isolated feature namespace. The core application shell and existing stores (`cohortStore`, `timelineStore`) interact with these capabilities strictly through four minimal interfaces:
- **`useEdaPlayback`**: Exposes playback state (playing, speed, index, current record, sparklines) and four atomic controls (`play`, `pause`, `setSpeed`, `seek`).
- **`evaluateClinicalRisk`**: Pure function accepting an environmental snapshot and returning calculated probabilities, delay distributions, and flight rule violations.
- **`evaluateContextualTriage`**: Pure adapter consuming raw crew dialogue and environmental state, returning detected compartment entities and clinical triage advice.
- **`useSimulationSandbox`**: Hook managing transient synthetic anomaly states without mutating persistent databases.

### Decision 2: State Machine for EDA Playback Engine
The authentic NASA EDA telemetry playback engine is designed as a deterministic ticker state machine:
```
[ PAUSED ] <───( play / pause )───> [ PLAYING ]
    │                                     │
  (seek)                             (tick event: interval = 2000ms / speed)
    │                                     │
    └──> [ Advance Index (0..N-1) ] <─────┘
                   │
         [ Update Current Record ]
                   │
    [ Recompute 10-point Sparkline Window ]
```
The ticker automatically loops when reaching the end of the 180-record telemetry array.

### Decision 3: Clinical Risk Formulation
Risk calculations are implemented as deterministic mathematical mappings derived from NASA LSDA cohort studies:
- **Headache Probability Function**: Logistic curve mapped from 1,970 PPM (4%) through 3,950 PPM (28%) up to 5,920 PPM (78%).
- **Temporal Onset Distribution**: Gamma-distributed response modeling intracranial pressure onset, peaking at $t = 90 - 120$ minutes with an 84% correlation match.
- **Radiation Fatigue Index**: Linearized dosimetric scale mapping $0.12\text{ mGy/day}$ (score 5) to $0.50\text{ mGy/day}$ (score 94).

### Decision 4: Visual Language & UI Token Preservation
In strict adherence to the project's minimalist aesthetic:
- Containers use `rounded-[32px]`, `border-border/60` hairlines, and obsidian canvas background (`#0c0d10`).
- Typography uses `font-black` uppercase section headings and JetBrains Mono numerical values.
- All functional controls, buttons, units, and annotations from the original design are preserved with zero data loss.

---

## Testing Decisions

### What Makes a Good Test
Tests must verify external behavioral contracts across the public seams rather than private implementation details. Specifically:
- **Playback Ticker Behavior**: Advancing indices, speed scaling, boundary clamping, and looping without memory leaks.
- **Pure Math Risk Invariants**: Verifying that `evaluateClinicalRisk` outputs monotonically increasing headache probabilities with respect to CO2 PPM, and strictly validates boundary inputs.
- **Compartment Regex Accuracy**: Verifying that compartment references (e.g., "Harmony", "US Lab", "Columbus") are accurately extracted regardless of sentence casing or punctuation.
- **Simulation Isolation**: Verifying that anomaly injection mutates only the active simulation layer and does not contaminate authentic baseline stores.

### Modules to Test
1. `EdaPlaybackModule` unit tests (timer mechanics and index advancement).
2. `ClinicalRiskModule` unit tests (mathematical precision of curves and NASA rule flags).
3. `ContextualTriageAdapter` unit tests (entity extraction and rule generation).
4. `SimulationSandboxModule` unit tests (scenario injection and nominal restoration).

### Prior Art in Codebase
- Backend unit tests in [test_analytics.py](file:///D:/nasaResearch/tests/test_analytics.py) and [test_simulation.py](file:///D:/nasaResearch/tests/test_simulation.py).
- Frontend type safety checked via `npm run tsc` in `web/`.

---

## Out of Scope

- Upgrading the core web project to React 19 or Vite 8.
- Installing Tailwind CSS v4 or Recharts (Plotly.js and lightweight SVG charts are used instead).
- Rewriting the existing `cohortStore.ts` multi-astronaut state model.
- Direct network streaming from live NASA public APIs (all flight telemetry is loaded offline from the bundled authentic dataset).

---

## Further Notes

- The authentic telemetry dataset source is NASA Environmental Data Application (EDA) Expedition 71/72, covering cabin CO2, temperature, relative humidity, total pressure, and dosimeter readings.
- All clinical risk models disclaim diagnostic causality and are designated for clinical decision support and training purposes only.
