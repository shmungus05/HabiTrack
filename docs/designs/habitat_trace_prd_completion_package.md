# HABITAT TRACE PRD Final Completion Package: Clinical Dossier, Multi-Role Perspective, & Deep Space Communications

* **Author:** MinnThikeTunn
* **Date:** 2026-11-14
* **Status:** Final Approved Technical Design Document (Stage 9 Certified & Implementation Ready)
* **Predecessor Context:** [concepts_brief.md](file:///D:/nasaResearch/concepts_brief.md)
* **Parent Architecture:** [README.md](file:///D:/nasaResearch/README.md) Â· [habitat_trace_v3.md](file:///D:/nasaResearch/docs/designs/habitat_trace_v3.md) Â· [habitat_trace_v4.md](file:///D:/nasaResearch/docs/designs/habitat_trace_v4.md)
* **Requirements Baseline:** [PRD.md](file:///D:/nasaResearch/PRD.md) (FR-11, FR-12, Section 4, Section 11, Section 17, Section 18)
* **Domain Model:** [GLOSSARY.md](file:///D:/nasaResearch/GLOSSARY.md)

---

## 1. Overview

HABITAT TRACE Version 5 established an offline-first health intelligence workstation featuring deterministic operational flight rule latching, push-to-talk voice interaction, authentic NASA EDA flight telemetry playback, and non-linear clinical risk modeling. To bring the authoritative Product Requirements Document ([PRD.md](file:///D:/nasaResearch/PRD.md)) to 100% completion, this technical design integrates the three final remaining capabilities into a unified, zero-backend frontend package:

1. **Client-Side Structured Clinical Investigation Dossier (`FR-12` / `MVP Item 11`):** A zero-dependency report generator that aggregates active astronaut demographics, baseline vital deltas, multi-factor cabin telemetry snapshots (EDA $P_{\text{CO}_2}$, radiation, temperature), logged symptom histories, active concordance events, and verified operational flight rule checklists into a publication-grade clinical investigation dossier. Supports instant Markdown download (`.md`), clipboard copy, interactive HTML modal preview, and `@media print` optimized vector PDF generation via the browser's native print pipeline.
2. **Multi-Role Shell Perspective Toggle (`Section 4`):** A persistent, zero-friction client-side role toggle between **Astronaut** (streamlined, low cognitive load, status chips, quick symptom entry, certified action plans) and **Flight Surgeon** (full diagnostic depth, authentic telemetry scrubbers, simulation anomaly sandbox, threshold overrides, multi-signal risk matrices) without requiring backend authentication or complex RBAC.
3. **Deep Space Comms & Outbox Simulator (`FR-11` / `Section 17`):** An interactive communications controller simulating Mars/lunar long-duration spaceflight realities. Features an Acquisition of Signal (AOS) vs. Loss of Signal (LOS) toggle, a 0-to-24 minute Mars transmission latency slider with time-warp multipliers (1x / 10x / 60x / Instant), and a simulated Outbox sync queue that buffers ground downlink packets during LOS and drains sequentially via a FIFO queue during AOS without interrupting local offline operations.

---

## 2. The Problem

### 2.1 Absence of Exportable Structured Investigation Dossiers (`FR-12`)
In the current workstation, while raw telemetry can be exported as a JSON array (`NasaDatasetsCatalog.tsx`), flight surgeons and astronauts have no automated way to generate a cohesive narrative investigation report. When a clinical concordance event occurs (such as the reference Day 127 mission scenario where Commander Vance experiences a cabin $P_{\text{CO}_2}$ excursion and acute frontal headache), flight surgeons must manually transcribe telemetry measurements, baseline deviations, symptom logs, and flight rule citations into external flight logs. This introduces significant transcription error risk and delays mission debriefs.

### 2.2 Cognitive Load Imbalance & Role Friction (`Section 4`)
[PRD.md](file:///D:/nasaResearch/PRD.md) Section 4 specifies distinct primary user profiles: the **Astronaut** (self-monitoring, immediate symptom logging, clear action checklists under physical microgravity stress) and the **Flight Surgeon** (exhaustive longitudinal analysis, anomaly simulation, threshold overrides, and risk modeling). Currently, all diagnostic controls (simulation sandbox, authentic playback scrubbers, and complex risk curves) are rendered concurrently on a single screen. For an astronaut experiencing hypercapnic cephalea, motion sickness, or high-stress operational tasks, this excessive visual density violates NASA-STD-3001 (NASA Space Flight Human-System Standard) ergonomic requirements and increases operational error risk.

### 2.3 Disconnect from Deep Space Communications Realities (`FR-11` / `Section 17`)
Long-duration spaceflight (e.g., lunar Gateway, Mars transit) operates under speed-of-light propagation delays ($3.5\text{ to }24\text{ minutes}$ each way to Mars) and periodic orbital Loss of Signal (LOS) blackouts. The current workstation operates in a generic "Offline" mode without visually conveying mission communication constraints, latency countdowns, or an outbox queue buffering telemetry packets destined for ground review.

---

## 3. Goals

1. **Client-Side Dossier Compiler (`FR-12`):**
   - Provide a pure compiler function that aggregates cohort metadata, 7-day baseline deviations, multi-factor environmental measurements, symptom entries, active concordance events, and verified flight rule checklists into a typed `DossierReport`.
   - Strictly enforce non-causal epistemic assertions (`PROHIBITED_CAUSAL_TERMS` regex: `\b(cause|causes|caused|causing|proves|proven|proving|diagnose|diagnosed|diagnosing|diagnosis|prescribe|prescribes|prescribed|prescribing|prescription|treat|treated|treating|treatment|therapeutic|therapy|cure|remedy)\b`) and append the mandatory clinical disclaimer:
     > *"Non-Causal Decision Support Disclaimer: Temporal alignment of environmental excursions and physiological observations indicates co-occurrence only and does not establish clinical causation. HABITAT TRACE is an operational decision-support tool, not an autonomous diagnostic system. Clinical actions must be verified by flight surgeons."*
   - Deliver four instant export modalities: Markdown download (`.md`), Markdown clipboard copy, interactive HTML modal preview, and `@media print` native browser print-to-PDF with zero added runtime dependencies.
2. **Multi-Role Perspective Switcher (`Section 4`):**
   - Implement a persistent header segmented toggle (`[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]`) stored in `localStorage` (`habitat_trace_active_role`).
   - Dynamically adapt UI views:
     - **Astronaut Mode:** High-contrast glanceable KPI chips (<3s cognitive assessment), 1-tap quick symptom logger, verbatim flight rule actions, and standby voice assistant. Hides secondary diagnostic panels (`SimulationSandboxPanel`, `EdaStreamController`, and threshold overrides) and locks cohort view to the active astronaut (`ASTRO-01`) for medical privacy.
     - **Flight Surgeon Mode:** Full diagnostic depth exposing anomaly injection sliders, raw telemetry scrubbers, risk matrices, and multi-cohort event sign-off controls.
3. **Deep Space Comms & Outbox Simulator (`FR-11` / `Section 17`):**
   - Implement persistent communications state in `commsStore` with `localStorage` backing: AOS / LOS link toggle and 0â€“24 minute Mars latency slider with accurate astrodynamic mission presets:
     - `ISS Orbit (0.0s)`
     - `Lunar Gateway (1.3s)`
     - `Mars Opposition (3.5m)` (closest approach ~0.4 AU)
     - `Mars Conjunction (21.5m)` (solar conjunction ~2.5 AU)
   - Add a simulation time-warp multiplier (`1x | 10x | 60x | Instant Delivery`) to ensure evaluation feasibility during live reviews.
   - Provide an Outbox drawer/modal displaying buffered packets with payload inspection, simulated FIFO transmission countdowns, and automated draining upon AOS acquisition.
   - Display an ambient header indicator chip showing link status, latency, and queued packet counts.
4. **Zero Workstation Blocking Invariant:**
   - Guarantee that all local operations (symptom reporting, event review, local assistant queries) commit immediately ($<5\text{ms}$) to the local SQLite database and Zustand stores, completely decoupled from the simulated ground downlink pipeline.
5. **Mode Blindness Elimination Invariant:**
   - If an anomaly is injected via the Simulation Sandbox in Flight Surgeon mode, switching to Astronaut mode displays a persistent global indicator `[âš ï¸ SIMULATION OVERRIDE ACTIVE]` with a 1-tap reset action so crew members never confuse synthetic training anomalies with genuine flight telemetry.
6. **Aesthetic & Backward Compatibility Compliance:**
   - Adhere strictly to the Perplexity minimalist design language (`rounded-[32px]`, `font-black` headings, subtle micro-animations, high-contrast dark palette).
   - Preserve 100% of existing functional elements, threshold sliders, and simulation controls.

---

## 4. Non-Goals

1. **Backend Authentication & Server RBAC:** The role switcher is a client-side operational perspective toggle for onboard crew and ground flight surgeons sharing a workstation; no server-side password hashing, JWTs, or database user tables will be added.
2. **Heavy Third-Party PDF Libraries:** No `jspdf`, `pdfmake`, or server-side headless browsers (Puppeteer); formatting relies on semantic HTML and native browser `@media print` styling.
3. **Network Request Interception:** The comms simulator will not intercept local FastAPI `/api/*` requests; it exclusively models ground downlink packet transmissions.
4. **Autonomous Medical Diagnoses:** The system remains a non-causal decision-support tool and will not diagnose clinical disease or prescribe medication.

---

## 5. Technical Plan

### 5.1 High-Level Architecture & Seams

```mermaid
flowchart TD
    subgraph Ingress["Authoritative State Ingress"]
        COHORT["cohortStore<br/>(Astronaut Demographics, Baseline Windows)"]
        MEASUREMENTS["Telemetry Streams<br/>(EDA CO2, Dosimetry, Vitals)"]
        SYMPTOMS["Symptom Logs<br/>(Severity, Occurrence Time, Notes)"]
        EVENTS["Concordance Events<br/>(Active Events, Rationales)"]
        FLIGHT_RULES["Flight Rules Engine<br/>(Verified Markdown Checklists)"]
    end

    subgraph Stores["Client State & Perspectives"]
        ROLE["roleStore (New)<br/>('astronaut' | 'flight_surgeon')"]
        COMMS["commsStore (New)<br/>(AOS/LOS, Latency Slider, Outbox FIFO Queue)"]
    end

    subgraph Dossier["Dossier Feature Module (web/src/features/dossier/)"]
        COMPILER["dossierCompiler.ts<br/>(Pure projection: DossierCompilerInput -> DossierReport)"]
        TEMPLATES["dossierTemplates.ts<br/>(Markdown & Flow-based @media print HTML)"]
        MODAL["DossierModal.tsx<br/>(Preview, Clipboard Copy, .md Download, Downlink Outbox, window.print())"]
        COHORT --> COMPILER
        MEASUREMENTS --> COMPILER
        SYMPTOMS --> COMPILER
        EVENTS --> COMPILER
        FLIGHT_RULES --> COMPILER
        COMPILER --> TEMPLATES --> MODAL
    end

    subgraph Shell["App Shell & Navigation (web/src/App.tsx)"]
        ROLE_TOGGLE["Role Toggle Pill<br/>[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]"]
        COMMS_CHIP["CommsStatusChip.tsx<br/>[ AOS Â· 0m | LOS Â· 21.5m Â· 3 queued ]"]
        SIM_WARN["Ambient Simulation Banner<br/>[âš ï¸ SIMULATION OVERRIDE ACTIVE]"]
        ROLE --> ROLE_TOGGLE
        COMMS --> COMMS_CHIP
    end

    subgraph CommsModule["Comms Feature Module (web/src/features/comms/)"]
        COMMS_MODAL["CommsModal.tsx<br/>(AOS/LOS Switch, Latency & Warp Presets, Outbox Inspector)"]
        COMMS_CHIP --> COMMS_MODAL
        COMMS --> COMMS_MODAL
        MODAL -.->|Enqueue DOSSIER_TRANSMIT| COMMS
    end

    subgraph Views["Adaptive View Rendering (OverviewView.tsx)"]
        ROLE_GATE["RoleGate.tsx (<SurgeonOnly> / <AstronautOnly>)"]
        ASTRO_VIEW["Astronaut Perspective<br/>(Glanceable Status Chips, Locked Cohort, 1-Tap Log)"]
        SURGEON_VIEW["Surgeon Perspective<br/>(Full Diagnostics, EdaStreamController, SimulationSandbox)"]
        ROLE --> ROLE_GATE
        ROLE_GATE --> ASTRO_VIEW
        ROLE_GATE --> SURGEON_VIEW
    end

    subgraph LocalPersistence["Local Persistence & Outbox Decoupling"]
        DB[("Local SQLite (via FastAPI)")]
        ASYNC_OUTBOX["Ground Telemetry Outbox<br/>(Buffered during LOS, FIFO drain during AOS)"]
        VIEWS -->|Immediate Write (<5ms)| DB
        VIEWS -.->|On Success Enqueue| COMMS
        COMMS --> ASYNC_OUTBOX
    end
```

---

### 5.2 Module Specifications

#### 1. Structured Clinical Investigation Dossier (`web/src/features/dossier/`)
* **`types.ts`**: Defines the authoritative, PRD-compliant typed contract:
  ```typescript
  export type QualityStatus = "VALID" | "SUSPECT" | "STALE" | "GAP" | "IMPUTED";

  export interface DossierReport {
    metadata: {
      reportId: string;
      generatedAt: string;
      timeWindow: {
        start: string;
        end: string;
        missionDayRange: string;
      };
      missionId: string;
      astronautId: string;
      callsign: string;
      crewRole: string;
    };
    vitalsSummary: Array<{
      parameter: string;
      value: string;
      unit: string;
      baselineRange: string;
      deviationSigma: number;
      status: "NOMINAL" | "SUSPECT" | "ANOMALOUS";
      qualityStatus: QualityStatus;
    }>;
    environmentalSnapshot: Array<{
      parameter: string;
      value: string;
      unit: string;
      status: "NOMINAL" | "CAUTION" | "ALERT";
      qualityStatus: QualityStatus;
    }>;
    symptomHistory: Array<{
      occurredAt: string;
      symptom: string;
      severity: number;
      module: string;
      notes?: string;
      nonCausalFlag?: boolean;
    }>;
    concordanceEvents: Array<{
      eventId: string;
      title: string;
      severity: string;
      rationale: string;
      timeWindow: string;
    }>;
    verifiedFlightRules: Array<{
      ruleId: string;
      title: string;
      checklistSteps: Array<{
        stepNumber: number;
        instruction: string;
        verified: boolean;
        verifiedAt?: string;
      }>;
      sha256Hash: string;
    }>;
    sourceReferences: Array<{
      sourceName: string;
      datasetIdentifier: string;
      doi?: string;
      provenance: "AUTHENTIC_NASA_EDA" | "SYNTHETIC_SIMULATION" | "CREW_REPORTED";
    }>;
    epistemicDisclaimer: string;
  }
  ```

* **`dossierCompiler.ts`**: Pure calculation function decoupled from global Zustand stores:
  ```typescript
  export interface DossierCompilerInput {
    astronaut: Astronaut;
    baselines: Baselines;
    measurements: Measurement[];
    symptoms: SymptomReport[];
    events: HealthEvent[];
    activeFlightRules?: FlightRule[];
    timeWindow?: { start: string; end: string; missionDayRange: string };
  }

  export function compileDossier(input: DossierCompilerInput): DossierReport;
  ```
  - **Epistemic Invariant:** Enforces the `PROHIBITED_CAUSAL_TERMS` regex:
    `\b(cause|causes|caused|causing|proves|proven|proving|diagnose|diagnosed|diagnosing|diagnosis|prescribe|prescribes|prescribed|prescribing|prescription|treat|treated|treating|treatment|therapeutic|therapy|cure|remedy)\b`
  - **Deterministic Error Handling:** If prohibited causal terms are detected in user symptom notes, the compiler **never aborts or crashes**. Instead, it flags the entry with `nonCausalFlag: true`, appends an inline notice (`[Note: Non-causal observation - unverified correlation]`), and guarantees the mandatory non-causal disclaimer is rendered at the bottom:
    > *"Non-Causal Decision Support Disclaimer: Temporal alignment of environmental excursions and physiological observations indicates co-occurrence only and does not establish clinical causation. HABITAT TRACE is an operational decision-support tool, not an autonomous diagnostic system. Clinical actions must be verified by flight surgeons."*

* **`dossierTemplates.ts`**:
  - Produces clean GitHub-Flavored Markdown with markdown tables, header blocks, and verified flight rule citations.
  - Produces semantic HTML with paged `@media print` CSS utilizing **normal document flow** to prevent browser page-clipping. Global hiding rules (`body > *:not(#printable-dossier-root) { display: none !important; }`) are declared in `web/src/index.css`.

* **`DossierModal.tsx`**: High-end Perplexity modal dialog providing:
  - Header with Dossier ID, mission timestamp, and status chips.
  - Tab switcher: "Rendered Dossier" vs. "Markdown Source".
  - Actions:
    1. `"Copy Markdown"` (via `navigator.clipboard`)
    2. `"Download .md"` (native Blob download)
    3. `"Print / Save PDF"` (`window.print()`)
    4. `"Downlink to Ground via Comms"`: Enqueues a `"DOSSIER_TRANSMIT"` packet into `commsStore` and renders an ambient confirmation toast.

---

#### 2. Multi-Role Shell Perspective Toggle (`web/src/stores/roleStore.ts` & `RoleGate.tsx`)
* **`roleStore.ts`**: Lightweight Zustand store managing `role: "astronaut" | "flight_surgeon"`, synced with `localStorage` (`habitat_trace_active_role`, defaulting to `"flight_surgeon"`).
* **`RoleGate.tsx`**: Structural wrapper components `<SurgeonOnly>` and `<AstronautOnly>`.
* **Perspective Constraints & Medical Privacy**:
  - In **Astronaut** mode:
    - **Cohort Locking:** The global header cohort switcher is locked to the logged crewmember (`ASTRO-01` / Commander Vance) to prevent accidental data entry or cross-astronaut medical privacy breaches.
    - **Cognitive Ergonomics:** `OverviewView.tsx` displays 3 glanceable cards (Cabin Environmental State, Personal Autonomic Status, Immediate Action Plan) and a 1-tap quick symptom logger. Diagnostic controls (`SimulationSandboxPanel`, `EdaStreamController`, threshold override sliders) are hidden.
    - **Route Gating:** Navigation is optimized for `/` (Overview) and `/symptoms`. If the astronaut navigates to `/timeline` or `/research`, an ambient banner displays: *"Viewing in Astronaut Perspective Â· Flight Surgeon diagnostic controls minimized."*
  - In **Flight Surgeon** mode: Exposes full multi-cohort switching, raw telemetry scrubbers, anomaly simulation sliders, and full 4-lane timeline correlation.

---

#### 3. Deep Space Comms & Outbox Simulator (`web/src/stores/commsStore.ts` & `web/src/features/comms/`)
* **`commsStore.ts`**: Zustand store backed by `localStorage` persistence (`habitat_trace_comms_state`):
  ```typescript
  export type CommsLinkState = "AOS" | "LOS";
  export type PacketStatus = "PENDING_LOS" | "TRANSMITTING" | "DELIVERED";
  export type PacketType = "SYMPTOM_REPORT" | "EVENT_ACK" | "DOSSIER_TRANSMIT";

  export interface OutboxPacket {
    packetId: string;
    type: PacketType;
    title: string;
    payload: Record<string, unknown>;
    createdAt: string;
    latencySeconds: number;
    timeRemainingSeconds: number;
    pausedRemainingSeconds?: number;
    status: PacketStatus;
  }
  ```
  - **State Machine Lifecycle & Enqueue Behavior:**
    - When link is `LOS`, all new packets receive `status: "PENDING_LOS"`.
    - When link is `AOS` (or transitions `LOS -> AOS`), queued packets enter a **serialized FIFO queue**. If the queue is idle, the active packet immediately enters `TRANSMITTING` with `timeRemainingSeconds = latencySeconds`. If another packet is in flight, new packets wait in `PENDING_AOS` behind the active packet.
    - When link transitions `AOS -> LOS` during transmission, `timeRemainingSeconds` pauses into `pausedRemainingSeconds` and status returns to `PENDING_LOS`.
  - **Simulation Time-Warp Multiplier:** Supports `1x | 10x | 60x | Instant Delivery`. The wall-clock delta `(Date.now() - lastTickTime) / 1000` is multiplied by `speedMultiplier` each tick to decrement pure simulated spaceflight seconds (`timeRemainingSeconds = Math.max(0, timeRemainingSeconds - (deltaSec * speedMultiplier))`), avoiding timer double-acceleration when toggling speeds mid-flight. When `"Instant Delivery"` is selected, `timeRemainingSeconds` immediately snaps to `0`.

* **`CommsStatusChip.tsx`**: Renders in the top header:
  - AOS (0s): Green dot, `AOS Â· Real-time`.
  - AOS (>0s): Yellow dot, `AOS Â· 21.5m Delay Â· 1 Transmitting`.
  - LOS: Red dot, `LOS Â· Deep Space Silence Â· 3 Queued`.
  Clicking opens `CommsModal`.

* **`CommsModal.tsx`**:
  - Link state segmented switch: `[ AOS (Acquisition) | LOS (Loss of Signal) ]`.
  - Latency slider ($0\text{ to }1,440\text{ s}$) with 4 astrodynamically accurate presets:
    - `ISS Orbit (0.0s)`
    - `Lunar Gateway (1.3s)`
    - `Mars Opposition (210s / 3.5m)`
    - `Mars Conjunction (1290s / 21.5m)`
  - Time-warp speed buttons: `1x`, `10x`, `60x`, `Instant Delivery`.
  - Outbox packet queue list with status chips, countdown progress bars, JSON payload inspection, and manual flush actions.

---

### 5.3 Workstation Decoupling & Safety Invariants

1. **Decoupled Asynchronous Downlink:**
   - All local operations (logging symptoms, reviewing concordance events) commit immediately ($<5\text{ms}$) to the local SQLite database via FastAPI.
   - Only upon **successful promise fulfillment** of the local database write does the handler call `enqueuePacket()`. If the local write fails, the outbox is not mutated.
2. **Mode Blindness Elimination Invariant:**
   - If an anomaly is injected via the Simulation Sandbox in Flight Surgeon mode, switching to Astronaut mode displays a persistent global ambient badge `[âš ï¸ SIMULATION OVERRIDE ACTIVE]` with a 1-tap reset action so crew members never confuse synthetic training anomalies with authentic flight telemetry.

---

## 6. Alternatives Considered

### 6.1 Server-Side PDF Generation via Headless Chromium or WeasyPrint
* **Proposed Mechanism:** Render investigation reports into PDF format using server-side headless browsers (e.g., Playwright/Puppeteer) or Python PDF libraries (WeasyPrint / ReportLab) exposed via a FastAPI `/api/reports/pdf` endpoint.
* **Rejected by Author:** 
  - **Heavy External Dependencies:** Requires bundling multi-megabyte Chromium/WebKit browser binaries or complex C-extension dependencies, which increases container size and maintenance complexity.
  - **Latency & Resource Contention:** Headless rendering consumes significant memory (>300 MB per render) and introduces a multi-second generation delay, degrading performance on resource-constrained embedded spaceflight hardware.
  - **Native Alternative:** Semantic HTML coupled with native browser `@media print` CSS achieves pixel-accurate, vector-quality PDF generation directly through `window.print()` with zero server overhead and zero additional JavaScript bundle weight.

### 6.2 Backend-Enforced RBAC with Session Authentication
* **Proposed Mechanism:** Implement user authentication with password hashing, JWT bearer tokens, and SQLite user privilege tables to strictly enforce role permissions on the backend.
* **Rejected by Author:**
  - **Unnecessary Operational Friction:** In real spaceflight operations and simulation environments, crewmembers and flight surgeons frequently share workstations. Session timeouts, login screens, and token expirations create dangerous delays during time-critical incidents.
  - **Out of Scope for PRD Section 4:** The PRD specifies tailoring visual presentation and cognitive load to user needs, not securing multi-tenant adversarial access. A client-side segmented toggle with `localStorage` persistence satisfies human-factors requirements without introducing brittle authentication state machines.

### 6.3 Intercepting Local `fetch()` Requests via Service Worker to Simulate Comms Delay
* **Proposed Mechanism:** Register a client-side Service Worker or Axios/Fetch interceptor that delays all network requests by the configured Mars latency (0â€“24 minutes) or returns HTTP 503 during LOS.
* **Rejected by Author:**
  - **Severe Functional Regressions:** Intercepting real local network requests breaks core workstation workflows: cohort switching freezes, live WebGL timeline updates fail, local symptom submissions hang, and assistant drawer queries abort.
  - **Architectural Misconception:** Spaceflight communication delays occur across deep-space interplanetary distances between Earth and the spacecraft, not on the spacecraft's local LAN. The onboard workstation must remain completely responsive offline. Decoupling the simulation into an asynchronous `commsStore` Outbox queue preserves 100% local responsiveness while authentically modeling ground downlink latency.

---

## 7. Detailed Implementation Plan

This section provides the complete, unified execution plan. Every file touched, created, or updated is explicitly enumerated with its technical rationale.

### 7.1 Unified File Inventory & Rationale

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| [`web/src/stores/roleStore.ts`](file:///D:/nasaResearch/web/src/stores/roleStore.ts) | **Create** | Implements the lightweight Zustand role store managing active perspective (`astronaut` vs. `flight_surgeon`) with `localStorage` persistence under key `habitat_trace_active_role`. |
| [`web/src/features/shared/RoleGate.tsx`](file:///D:/nasaResearch/web/src/features/shared/RoleGate.tsx) | **Create** | Provides declarative, ergonomic `<SurgeonOnly>` and `<AstronautOnly>` React wrapper components and `useUserRole()` hook for perspective-conditional rendering. |
| [`web/src/features/shared/index.ts`](file:///D:/nasaResearch/web/src/features/shared/index.ts) | **Create** | Barrel export exposing `RoleGate`, `SurgeonOnly`, `AstronautOnly`, and `useUserRole`. |
| [`web/src/stores/commsStore.ts`](file:///D:/nasaResearch/web/src/stores/commsStore.ts) | **Create** | Implements the communications simulator store with `localStorage` persistence, managing link state (`AOS` / `LOS`), Mars latency in seconds, operational presets, outbox FIFO packet queue, self-contained countdown ticker, and speed multipliers. |
| [`web/src/features/dossier/types.ts`](file:///D:/nasaResearch/web/src/features/dossier/types.ts) | **Create** | Defines TypeScript interfaces for `DossierReport`, `DossierCompilerInput`, vitals entries, environmental metrics, and export configuration options, importing `QualityStatus` from `../../types/api`. |
| [`web/src/features/dossier/dossierCompiler.ts`](file:///D:/nasaResearch/web/src/features/dossier/dossierCompiler.ts) | **Create** | Implements pure calculation projection aggregating cohort profile, 7-day baseline deviations, multi-factor telemetry snapshots, logged symptoms, active concordance events, and verified flight rule checklists with epistemic validation and deterministic warning flags. |
| [`web/src/features/dossier/dossierCompiler.test.ts`](file:///D:/nasaResearch/web/src/features/dossier/dossierCompiler.test.ts) | **Create** | Automated unit test suite validating pure compilation, baseline sigma deviation math, epistemic guardrail compliance, and markdown/HTML formatting using static Day 127 fixtures. |
| [`web/src/features/dossier/dossierTemplates.ts`](file:///D:/nasaResearch/web/src/features/dossier/dossierTemplates.ts) | **Create** | Provides template formatters generating portable GitHub-Flavored Markdown (`.md`) and semantic HTML with flow-based styling for native browser vector PDF generation. |
| [`web/src/features/dossier/DossierModal.tsx`](file:///D:/nasaResearch/web/src/features/dossier/DossierModal.tsx) | **Create** | Implements the high-end Perplexity modal dialog (`rounded-[32px]`, `font-black`) providing tabbed preview (HTML Dossier vs. Raw Markdown), clipboard copy, `.md` download, downlink outbox enqueueing, self-contained asynchronous data fetching fallback, and `window.print()` action. |
| [`web/src/features/dossier/index.ts`](file:///D:/nasaResearch/web/src/features/dossier/index.ts) | **Create** | Barrel export exposing `DossierModal`, `compileDossier`, and related types. |
| [`web/src/features/comms/CommsStatusChip.tsx`](file:///D:/nasaResearch/web/src/features/comms/CommsStatusChip.tsx) | **Create** | Implements the ambient header indicator pill displaying real-time link status (`border-emerald-500/30` AOS 0s, `border-amber-500/30` AOS delay, `border-rose-500/30` LOS), active latency, and queued outbox packet count. |
| [`web/src/features/comms/CommsModal.tsx`](file:///D:/nasaResearch/web/src/features/comms/CommsModal.tsx) | **Create** | Implements the interactive modal dialog for toggling AOS/LOS, selecting planetary latency presets, time-warp acceleration (1x/10x/60x/Instant Delivery), inspecting buffered outbox packets, and triggering manual flushes. |
| [`web/src/features/comms/index.ts`](file:///D:/nasaResearch/web/src/features/comms/index.ts) | **Create** | Barrel export exposing `CommsStatusChip`, `CommsModal`, and related comms utilities. |
| [`web/src/App.tsx`](file:///D:/nasaResearch/web/src/App.tsx) | **Modify** | Mounts Role Toggle pill (`[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]`), ambient `[âš ï¸ SIMULATION OVERRIDE ACTIVE]` warning banner linked to `useSimulationSandbox()`, locked cohort selection in Astronaut mode, and `CommsStatusChip` in the header bar, with global `DossierModal` trigger. |
| [`web/src/components/OverviewView.tsx`](file:///D:/nasaResearch/web/src/components/OverviewView.tsx) | **Modify** | Wraps diagnostic panels in `<RoleGate>`: in Astronaut mode, renders `<AstronautOverview>` with 3 status cards and a 4-button quick symptom grid (`Headache`, `Fatigue`, `Dizziness`, `Nausea`); in Flight Surgeon mode, renders full diagnostic depth, wires event sign-off to `commsStore.enqueuePacket("EVENT_ACK")`, and adds an "Export Investigation Dossier" action. |
| [`web/src/components/SymptomsView.tsx`](file:///D:/nasaResearch/web/src/components/SymptomsView.tsx) | **Modify** | Integrates symptom submission with `commsStore.enqueuePacket("SYMPTOM_REPORT")` strictly upon successful local SQLite write to demonstrate the asynchronous ground telemetry outbox queue during LOS conditions. |
| [`web/src/index.css`](file:///D:/nasaResearch/web/src/index.css) | **Modify** | Appends clean `@media print` directives ensuring the printed dossier hides navigation bars and buttons while forcing white background and black text on paged media. |
| [`PRD.md`](file:///D:/nasaResearch/PRD.md) | **Modify** | Updates functional requirements matrix to record FR-11, FR-12, and Section 4 as fully implemented. |
| [`README.md`](file:///D:/nasaResearch/README.md) | **Modify** | Updates system documentation to reflect the availability of the Clinical Dossier, Multi-Role Switcher, and Deep Space Comms Simulator. |

---

### 7.2 Component Specifications & Algorithmic Grounding

#### 1. `DossierModal.tsx` Asynchronous Data Acquisition
`DossierModal` accepts an optional `preloadedData?: OverviewData` prop:
- When invoked from `OverviewView.tsx`, it uses `preloadedData` immediately with zero network delay.
- When invoked from the global header in `App.tsx`, `DossierModal` executes:
  ```typescript
  const [astronaut, baselines, measurements, symptoms, events] = await Promise.all([
    fetchAstronaut(activeAstronautId),
    fetchBaselines(activeAstronautId),
    fetchMeasurements(activeAstronautId, 336, 1000),
    fetchSymptoms(activeAstronautId),
    fetchEvents(activeAstronautId),
  ]);
  ```
  rendering an ambient loading skeleton until the promise bundle resolves.

#### 2. `commsStore.ts` Ticker & FIFO Queue Drainage
- **Timer Execution:** `commsStore.ts` manages an internal module-level timer guarded by `typeof window !== 'undefined'` with `startTicker()` / `stopTicker()` exported for testing.
- **Queue Pump Algorithm:** Each tick calculates wall-clock delta `deltaSec = (Date.now() - lastTickTime) / 1000`. If active packet reaches `timeRemainingSeconds <= 0`, its status transitions to `DELIVERED`. If `linkState === "AOS"`, the next packet in `PENDING_LOS` or `QUEUED_AOS` is automatically promoted to `TRANSMITTING` with `timeRemainingSeconds = latencySeconds`.

#### 3. `dossierCompiler.ts` Baseline Deviations & Stream Mapping
- **Stream Mapping:**
  - Vitals: `stream_sim_hr` (Resting HR, bpm), `stream_sim_hrv` (RMSSD, ms), `stream_sim_spo2` (SpOâ‚‚, %), `stream_sim_temp` (Core Temp, Â°C).
  - Environmental: `stream_eda_co2` ($P_{\text{CO}_2}$, PPM), `stream_sim_radiation` (Radiation, mGy/d), `stream_sim_cabin_pressure` (Pressure, kPa), `stream_sim_cabin_temp` (Cabin Temp, Â°C).
- **Deviation Formula:** `deviationSigma = baselineStd > 0 ? (latestValue - baselineMean) / baselineStd : 0.0`.
  - $|\sigma| \ge 3.0 \to \text{"ANOMALOUS"}`
  - $|\sigma| \ge 2.0 \to \text{"SUSPECT"}`
  - Else $\to \text{"NOMINAL"}`

#### 4. `@media print` Directives in `web/src/index.css`
```css
@media print {
  body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 11pt !important;
  }
  body > *:not(#printable-dossier-root) {
    display: none !important;
  }
  #printable-dossier-root {
    display: block !important;
    position: static !important;
    width: 100% !important;
    margin: 0 !important;
  }
  table, tr, td, th, .dossier-card {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  @page {
    size: auto;
    margin: 15mm;
  }
}
```

---

### 7.3 Implementation Sequence

1. **Phase 1: Multi-Role Perspective Shell (`roleStore.ts`, `RoleGate.tsx`, & `features/shared`)**
   - Implement `roleStore.ts` with `localStorage` persistence.
   - Implement `RoleGate.tsx` with `<SurgeonOnly>` and `<AstronautOnly>` components and `features/shared/index.ts`.
   - Update `App.tsx` top navigation bar to render the role toggle pill, cohort locking in Astronaut mode, and ambient simulation override indicator via `useSimulationSandbox()`.
   - Update `OverviewView.tsx` with `<AstronautOverview>` (3 status cards and 4-button quick symptom grid) while preserving full diagnostic panels in Flight Surgeon mode.
2. **Phase 2: Deep Space Communications Simulator (`commsStore.ts` & `features/comms/`)**
   - Implement `commsStore.ts` with `localStorage` persistence, packet enqueueing, lifecycle states (`PENDING_LOS` $\to$ `TRANSMITTING` $\to$ `DELIVERED`), FIFO queue drainage, time-warp speed modifiers (1x/10x/60x/Instant), and countdown ticker.
   - Build `CommsStatusChip.tsx` with standardized color tokens and integrate into `App.tsx`.
   - Build `CommsModal.tsx` with link toggle, latency slider, planetary presets, and outbox packet inspector.
   - Wire `SymptomsView.tsx` and `OverviewView.tsx` event sign-offs to enqueue outbound packets upon local write success.
3. **Phase 3: Structured Clinical Investigation Dossier (`features/dossier/`)**
   - Define schema and types in `features/dossier/types.ts` importing `QualityStatus` from `../../types/api`.
   - Build `dossierCompiler.ts` pure projection function with non-causal epistemic assertion checks, sigma formulas, and warning chip fallbacks.
   - Implement flow-based paged Markdown and HTML formatters in `dossierTemplates.ts` and print CSS in `web/src/index.css`.
   - Build `DossierModal.tsx` following the Perplexity minimalist design system (`rounded-[32px]`, `font-black` headings, subtle tabs, copy/download/downlink/print buttons) with dual-mode data loading.
   - Wire "Export Investigation Dossier" button in `OverviewView.tsx` and `App.tsx`.
4. **Phase 4: Automated Testing, Build Verification & Documentation Closure**
   - Implement and execute `web/src/features/dossier/dossierCompiler.test.ts`.
   - Run `npm --prefix web run build` to verify zero TypeScript errors and bundle size compliance.
   - Update [PRD.md](file:///D:/nasaResearch/PRD.md) and [README.md](file:///D:/nasaResearch/README.md).
