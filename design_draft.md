# WAYFINDER PRD Final Completion Package: Clinical Dossier, Multi-Role Perspective, & Deep Space Communications

* **Author:** MinnThikeTunn
* **Date:** 2026-11-14
* **Status:** Draft (Step 5: Detailed Implementation Plan Added)
* **Predecessor Context:** [concepts_brief.md](file:///D:/nasaResearch/concepts_brief.md)
* **Parent Architecture:** [README.md](file:///D:/nasaResearch/README.md) Â· [wayfinder_v3.md](file:///D:/nasaResearch/docs/designs/wayfinder_v3.md) Â· [wayfinder_v4.md](file:///D:/nasaResearch/docs/designs/wayfinder_v4.md)
* **Requirements Baseline:** [PRD.md](file:///D:/nasaResearch/PRD.md) (FR-11, FR-12, Section 4, Section 11, Section 17, Section 18)
* **Domain Model:** [GLOSSARY.md](file:///D:/nasaResearch/GLOSSARY.md)

---

## 1. Overview

WAYFINDER Version 5 established an offline-first health intelligence workstation featuring deterministic operational flight rule latching, push-to-talk voice interaction, authentic NASA EDA flight telemetry playback, and non-linear clinical risk modeling. To bring the authoritative Product Requirements Document ([PRD.md](file:///D:/nasaResearch/PRD.md)) to 100% completion, this technical design integrates the three final remaining capabilities into a unified, zero-backend frontend package:

1. **Client-Side Structured Clinical Investigation Dossier (`FR-12` / `MVP Item 11`):** A zero-dependency report generator that aggregates active astronaut demographics, baseline vital deltas, multi-factor cabin telemetry snapshots (EDA $P_{\text{CO}_2}$, radiation, temperature), logged symptom histories, active concordance events, and verified operational flight rule checklists into a publication-grade clinical investigation dossier. Supports instant Markdown download (`.md`), clipboard copy, interactive HTML modal preview, and `@media print` optimized vector PDF generation via the browser's native print pipeline.
2. **Multi-Role Shell Perspective Toggle (`Section 4`):** A persistent, zero-friction client-side role toggle between **Astronaut** (streamlined, low cognitive load, status chips, quick symptom entry, certified action plans) and **Flight Surgeon** (full diagnostic depth, authentic telemetry scrubbers, simulation anomaly sandbox, threshold overrides, multi-signal risk matrices) without requiring backend authentication or complex RBAC.
3. **Deep Space Comms & Outbox Simulator (`FR-11` / `Section 17`):** An interactive communications controller simulating Mars/lunar long-duration spaceflight realities. Features an Acquisition of Signal (AOS) vs. Loss of Signal (LOS) toggle, a 0-to-24 minute Mars transmission latency slider, and a simulated Outbox sync queue that buffers ground downlink packets during LOS and drains with dynamic progress bars during AOS without interrupting local offline operations.

---

## 2. The Problem

### 2.1 Absence of Exportable Structured Investigation Dossiers (`FR-12`)
In the current workstation, while raw telemetry can be exported as a JSON array (`NasaDatasetsCatalog.tsx`), flight surgeons and astronauts have no automated way to generate a cohesive narrative investigation report. When an operational incident occurs (such as Commander Vance's Day 127 cabin $P_{\text{CO}_2}$ excursion and acute frontal headache), flight surgeons must manually transcribe telemetry readings, baseline deviations, symptom logs, and flight rule citations into external flight logs. This introduces significant transcription error risk and delays mission debriefs.

### 2.2 Cognitive Load Imbalance & Role Friction (`Section 4`)
[PRD.md](file:///D:/nasaResearch/PRD.md) Section 4 specifies distinct primary user profiles: the **Astronaut** (self-monitoring, immediate symptom logging, clear action checklists under physical microgravity stress) and the **Flight Surgeon** (exhaustive longitudinal analysis, anomaly simulation, threshold overrides, and risk modeling). Currently, all diagnostic controls (simulation sandbox, authentic playback scrubbers, and complex risk curves) are rendered concurrently on a single screen. For an astronaut experiencing hypercapnic cephalea, motion sickness, or high-stress operational tasks, this excessive visual density violates NASA-STD-3001 human factors requirements and increases operational error risk.

### 2.3 Disconnect from Deep Space Communications Realities (`FR-11` / `Section 17`)
Long-duration spaceflight (e.g., lunar Gateway, Mars transit) operates under speed-of-light propagation delays ($4\text{ to }24\text{ minutes}$ each way to Mars) and periodic orbital Loss of Signal (LOS) blackouts. The current workstation operates in a generic "Offline" mode without visually conveying mission communication constraints, latency countdowns, or an outbox queue buffering telemetry packets destined for ground review.

---

## 3. Goals

1. **Client-Side Dossier Compiler (`FR-12`):**
   - Provide a pure compiler function that aggregates cohort metadata, 7-day baseline deviations, multi-factor environmental readings, symptom entries, active concordance events, and verified flight rule checklists.
   - Strictly enforce non-causal epistemic assertions (`PROHIBITED_CAUSAL_TERMS`) and append the mandatory clinical disclaimer.
   - Deliver four instant export modalities: Markdown download (`.md`), Markdown clipboard copy, interactive HTML modal preview, and `@media print` native browser print-to-PDF with zero added runtime dependencies.
2. **Multi-Role Perspective Switcher (`Section 4`):**
   - Implement a persistent header segmented toggle (`[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]`) stored in `localStorage` (`wayfinder_active_role`).
   - Dynamically adapt UI views:
     - **Astronaut Mode:** High-contrast glanceable KPI chips (<3s cognitive assessment), 1-tap quick symptom logger, verbatim flight rule actions, and standby voice assistant. Hides secondary diagnostic panels (`SimulationSandboxPanel`, `EdaStreamController`, and threshold overrides).
     - **Flight Surgeon Mode:** Full diagnostic depth exposing anomaly injection sliders, raw telemetry scrubbers, risk matrices, and event sign-off controls.
3. **Deep Space Comms & Outbox Simulator (`FR-11` / `Section 17`):**
   - Implement persistent communications state in `commsStore`: AOS / LOS link toggle and 0â€“24 minute Mars latency slider with operational mission presets (ISS 0m, Lunar Gateway 1.3m, Mars Conjunction 14m, Mars Opposition 24m).
   - Provide an Outbox drawer/modal displaying buffered packets with payload inspection, simulated transmission countdowns, and automated draining upon AOS acquisition.
   - Display an ambient header indicator chip showing link status, latency, and queued packet counts.
4. **Zero Workstation Blocking Invariant:**
   - Guarantee that all local operations (symptom reporting, event review, local assistant queries) commit immediately ($<5\text{ms}$) to the local SQLite database and Zustand stores, completely decoupled from the simulated ground downlink pipeline.
5. **Aesthetic & Backward Compatibility Compliance:**
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
    subgraph State["Zustand Client State Layer"]
        COHORT["cohortStore<br/>(Astronaut Profile, Baseline Window)"]
        TIMELINE["timelineStore<br/>(Multi-Factor Telemetry Streams)"]
        ROLE["roleStore (New)<br/>('astronaut' | 'flight_surgeon')"]
        COMMS["commsStore (New)<br/>(AOS/LOS, Mars Latency, Outbox Queue)"]
    end

    subgraph Dossier["Dossier Feature Module (web/src/features/dossier/)"]
        COMPILER["dossierCompiler.ts<br/>(Pure projection: state -> DossierReport)"]
        TEMPLATES["dossierTemplates.ts<br/>(Markdown & Semantic HTML + @media print)"]
        MODAL["DossierModal.tsx<br/>(Preview, Clipboard Copy, .md Download, window.print())"]
        COHORT --> COMPILER
        TIMELINE --> COMPILER
        COMPILER --> TEMPLATES --> MODAL
    end

    subgraph Shell["App Shell & Navigation (web/src/App.tsx)"]
        ROLE_TOGGLE["Role Toggle Pill<br/>[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]"]
        COMMS_CHIP["CommsStatusChip.tsx<br/>[ AOS Â· 0m | LOS Â· 14.2m Â· 3 queued ]"]
        ROLE --> ROLE_TOGGLE
        COMMS --> COMMS_CHIP
    end

    subgraph CommsModule["Comms Feature Module (web/src/features/comms/)"]
        COMMS_MODAL["CommsModal.tsx<br/>(AOS/LOS Switch, 0-24m Slider, Outbox Inspector)"]
        COMMS_CHIP --> COMMS_MODAL
        COMMS --> COMMS_MODAL
    end

    subgraph Views["Adaptive View Rendering (OverviewView.tsx)"]
        ROLE_GATE["RoleGate.tsx (<SurgeonOnly> / <AstronautOnly>)"]
        ASTRO_VIEW["Astronaut Perspective<br/>(Glanceable Status Chips, 1-Tap Log, Certified Checklists)"]
        SURGEON_VIEW["Surgeon Perspective<br/>(Full Diagnostics, EdaStreamController, SimulationSandbox)"]
        ROLE --> ROLE_GATE
        ROLE_GATE --> ASTRO_VIEW
        ROLE_GATE --> SURGEON_VIEW
    end

    subgraph LocalPersistence["Local Persistence & Outbox Decoupling"]
        DB[("Local SQLite (via FastAPI)")]
        ASYNC_OUTBOX["Ground Telemetry Outbox<br/>(Buffered during LOS, Drains during AOS)"]
        VIEWS -->|Immediate Write (<5ms)| DB
        VIEWS -.->|Asynchronous Enqueue| COMMS
        COMMS --> ASYNC_OUTBOX
    end
```

---

### 5.2 Module Specifications

#### 1. Structured Clinical Investigation Dossier (`web/src/features/dossier/`)
* **`types.ts`**: Defines the typed contract:
  ```typescript
  export interface DossierReport {
    metadata: {
      reportId: string;
      generatedAt: string;
      missionId: string;
      astronautId: string;
      callsign: string;
      crewRole: string;
    };
    vitalsSummary: Array<{
      parameter: string;
      value: string;
      baselineRange: string;
      deviationSigma: string;
      status: "NOMINAL" | "SUSPECT" | "ANOMALOUS";
    }>;
    environmentalSnapshot: Array<{
      parameter: string;
      value: string;
      unit: string;
      status: "NOMINAL" | "CAUTION" | "ALERT";
    }>;
    symptomHistory: Array<{
      occurredAt: string;
      symptom: string;
      severity: number;
      module: string;
      notes?: string;
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
      checklist: string[];
      sha256Hash: string;
    }>;
    epistemicDisclaimer: string;
  }
  ```
* **`dossierCompiler.ts`**: Pure calculation function that projects the current Zustand stores into `DossierReport`. Validates that no prohibited causal terms appear in the synthesized narrative.
* **`dossierTemplates.ts`**: 
  - Produces standard GitHub-Flavored Markdown with markdown tables, header blocks, and flight rule citations.
  - Produces semantic HTML with `@media print` CSS:
    ```css
    @media print {
      body * { visibility: hidden; }
      #printable-dossier, #printable-dossier * { visibility: visible; }
      #printable-dossier { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; }
      .no-print { display: none !important; }
    }
    ```
* **`DossierModal.tsx`**: Modal dialog following the Perplexity aesthetic:
  - Header with Dossier ID and timestamp.
  - Tab switcher between "Rendered Dossier" and "Markdown Source".
  - Actions: "Copy Markdown" (via `navigator.clipboard`), "Download .md", and "Print / Save PDF" (`window.print()`).

#### 2. Multi-Role Shell Perspective Toggle (`web/src/stores/roleStore.ts` & `RoleGate.tsx`)
* **`roleStore.ts`**: Lightweight Zustand store:
  ```typescript
  export type UserRole = "astronaut" | "flight_surgeon";

  interface RoleStore {
    role: UserRole;
    setRole: (role: UserRole) => void;
    toggleRole: () => void;
  }
  ```
  Syncs with `localStorage.getItem("wayfinder_active_role")` (defaults to `"flight_surgeon"` to preserve immediate diagnostic discovery for developers and judges).
* **`RoleGate.tsx`**: Structural wrapper components:
  - `<SurgeonOnly children={...} />`: Renders children only when `role === "flight_surgeon"`.
  - `<AstronautOnly children={...} />`: Renders children only when `role === "astronaut"`.
* **Adaptive `OverviewView.tsx` Behavior**:
  - In **Astronaut** mode: Focuses on NASA-STD-3001 operational readiness. Displays 3 glanceable cards (Cabin Atmospheric State, Personal Autonomic Status, Immediate Flight Action Plan), the 1-tap quick symptom logger, and the Standby Voice Assistant trigger. Diagnostic features like `SimulationSandboxPanel`, `EdaStreamController`, and threshold overrides are hidden.
  - In **Flight Surgeon** mode: Exposes all diagnostic tools, playback scrubbers, anomaly simulation sliders, and full 4-lane timeline correlation.

#### 3. Deep Space Comms & Outbox Simulator (`web/src/stores/commsStore.ts` & `web/src/features/comms/`)
* **`commsStore.ts`**:
  ```typescript
  export type CommsLinkState = "AOS" | "LOS";
  export type PacketStatus = "PENDING_LOS" | "TRANSMITTING" | "DELIVERED";

  export interface OutboxPacket {
    packetId: string;
    type: "SYMPTOM_REPORT" | "EVENT_ACK" | "DOSSIER_TRANSMIT" | "TELEMETRY_SYNC";
    title: string;
    payload: Record<string, unknown>;
    createdAt: string;
    latencyMinutes: number;
    timeRemainingSeconds: number;
    status: PacketStatus;
  }
  ```
  Manages the outbox queue. When AOS is active and `latencyMinutes > 0`, an internal ticker decrements `timeRemainingSeconds` until reaching `DELIVERED`.
* **`CommsStatusChip.tsx`**: Renders in the application header:
  - When AOS (0m): Green dot, `AOS Â· Real-time`.
  - When AOS (>0m): Yellow dot, `AOS Â· 14.2m Delay Â· 2 Transmitting`.
  - When LOS: Red dot, `LOS Â· Deep Space Silence Â· 3 Queued`.
  Clicking opens `CommsModal`.
* **`CommsModal.tsx`**:
  - Link state segmented switch: `[ AOS (Acquisition) | LOS (Loss of Signal) ]`.
  - Latency slider ($0\text{ to }24\text{ min}$) with 4 quick presets:
    - `ISS Orbit (0.0s)`
    - `Lunar Gateway (1.3s)`
    - `Mars Conjunction (14.2m)`
    - `Mars Opposition (24.0m)`
  - Outbox packet list with status badges, payload viewer, and "Flush Completed" action.

---

### 5.3 Workstation Decoupling Invariant

To guarantee that the simulated Mars communications delay never corrupts or freezes local operations:
1. When a user submits a symptom or acknowledges an event, the call directly reaches `api.postSymptom()` and updates the local SQLite database in $<5\text{ms}$.
2. In the same handler, a background call `enqueuePacket("SYMPTOM_REPORT", title, payload)` pushes a packet into `commsStore`.
3. If the link is in `LOS`, the packet waits in `PENDING_LOS` without throwing an error or freezing the UI.
4. When the user toggles back to `AOS`, the outbox begins transmission automatically.

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
| [`web/src/stores/roleStore.ts`](file:///D:/nasaResearch/web/src/stores/roleStore.ts) | **Create** | Implements the lightweight Zustand role store managing active perspective (`astronaut` vs. `flight_surgeon`) with `localStorage` persistence under key `wayfinder_active_role`. |
| [`web/src/features/shared/RoleGate.tsx`](file:///D:/nasaResearch/web/src/features/shared/RoleGate.tsx) | **Create** | Provides declarative, ergonomic `<SurgeonOnly>` and `<AstronautOnly>` React wrapper components and `useUserRole()` hook for perspective-conditional rendering. |
| [`web/src/stores/commsStore.ts`](file:///D:/nasaResearch/web/src/stores/commsStore.ts) | **Create** | Implements the communications simulator store managing link state (`AOS` / `LOS`), Mars latency ($0\text{ to }24\text{ min}$), operational presets, outbox packet queue, automated countdown ticking, and packet lifecycle. |
| [`web/src/features/dossier/types.ts`](file:///D:/nasaResearch/web/src/features/dossier/types.ts) | **Create** | Defines TypeScript interfaces for `DossierReport`, `DossierVitalsEntry`, `DossierEnvironmentEntry`, `DossierSymptomEntry`, and export configuration options. |
| [`web/src/features/dossier/dossierCompiler.ts`](file:///D:/nasaResearch/web/src/features/dossier/dossierCompiler.ts) | **Create** | Implements pure calculation projection aggregating cohort profile, 7-day baseline deviations, multi-factor telemetry snapshots, logged symptoms, active concordance events, and verified flight rule checklists. |
| [`web/src/features/dossier/dossierTemplates.ts`](file:///D:/nasaResearch/web/src/features/dossier/dossierTemplates.ts) | **Create** | Provides template formatters generating portable GitHub-Flavored Markdown (`.md`) and semantic HTML with `@media print` styling for native browser vector PDF generation. |
| [`web/src/features/dossier/DossierModal.tsx`](file:///D:/nasaResearch/web/src/features/dossier/DossierModal.tsx) | **Create** | Implements the high-end Perplexity modal dialog providing tabbed preview (HTML Dossier vs. Raw Markdown), clipboard copy, `.md` download, and `window.print()` action. |
| [`web/src/features/dossier/index.ts`](file:///D:/nasaResearch/web/src/features/dossier/index.ts) | **Create** | Barrel export exposing `DossierModal`, `compileDossier`, and related types. |
| [`web/src/features/comms/CommsStatusChip.tsx`](file:///D:/nasaResearch/web/src/features/comms/CommsStatusChip.tsx) | **Create** | Implements the ambient header indicator pill displaying real-time link status (AOS/LOS dot), active latency delay, and queued outbox packet count. |
| [`web/src/features/comms/CommsModal.tsx`](file:///D:/nasaResearch/web/src/features/comms/CommsModal.tsx) | **Create** | Implements the interactive modal dialog for toggling AOS/LOS, selecting planetary latency presets, inspecting buffered outbox packets, and triggering manual flushes. |
| [`web/src/features/comms/index.ts`](file:///D:/nasaResearch/web/src/features/comms/index.ts) | **Create** | Barrel export exposing `CommsStatusChip`, `CommsModal`, and related comms utilities. |
| [`web/src/App.tsx`](file:///D:/nasaResearch/web/src/App.tsx) | **Modify** | Mounts the Role Toggle pill (`[ ðŸ§‘â€ðŸš€ Astronaut | ðŸ©º Flight Surgeon ]`) and `CommsStatusChip` in the header bar, and embeds the global `DossierModal` trigger. |
| [`web/src/components/OverviewView.tsx`](file:///D:/nasaResearch/web/src/components/OverviewView.tsx) | **Modify** | Wraps diagnostic panels in `<RoleGate>`: in Astronaut mode, renders high-contrast ambient status chips and 1-tap quick symptom logger while decluttering secondary panels; in Flight Surgeon mode, renders full diagnostic depth and adds an "Export Investigation Dossier" action. |
| [`web/src/components/SymptomsView.tsx`](file:///D:/nasaResearch/web/src/components/SymptomsView.tsx) | **Modify** | Integrates symptom submission with `commsStore.enqueuePacket()` to demonstrate the asynchronous ground telemetry outbox queue during LOS conditions. |
| [`web/src/index.css`](file:///D:/nasaResearch/web/src/index.css) | **Modify** | Appends clean `@media print` directives ensuring the printed dossier hides navigation bars, background colors, and buttons while preserving high-contrast clinical typography. |
| [`PRD.md`](file:///D:/nasaResearch/PRD.md) | **Modify** | Updates functional requirements matrix to record FR-11, FR-12, and Section 4 as fully implemented. |
| [`README.md`](file:///D:/nasaResearch/README.md) | **Modify** | Updates system documentation to reflect the availability of the Clinical Dossier, Multi-Role Switcher, and Deep Space Comms Simulator. |

---

### 7.2 Implementation Sequence

1. **Phase 1: Multi-Role Perspective Shell (`roleStore.ts` & `RoleGate.tsx`)**
   - Implement `roleStore.ts` with `localStorage` persistence.
   - Implement `RoleGate.tsx` with `<SurgeonOnly>` and `<AstronautOnly>` components.
   - Update `App.tsx` top navigation bar to render the role toggle pill.
   - Update `OverviewView.tsx` with role-conditional view branches, verifying that all friend's controls remain 100% preserved in Flight Surgeon mode.
2. **Phase 2: Deep Space Communications Simulator (`commsStore.ts` & `features/comms/`)**
   - Implement `commsStore.ts` with packet enqueueing, lifecycle states (`PENDING_LOS` $\to$ `TRANSMITTING` $\to$ `DELIVERED`), and countdown ticker.
   - Build `CommsStatusChip.tsx` and integrate it into the `App.tsx` header bar.
   - Build `CommsModal.tsx` with link toggle, latency slider, mission presets, and outbox packet inspector.
   - Wire `SymptomsView.tsx` submission handler to enqueue outbound packets.
3. **Phase 3: Structured Clinical Investigation Dossier (`features/dossier/`)**
   - Define schema and types in `features/dossier/types.ts`.
   - Build `dossierCompiler.ts` pure projection function with non-causal epistemic assertion checks.
   - Implement Markdown and HTML `@media print` formatters in `dossierTemplates.ts`.
   - Build `DossierModal.tsx` following the Perplexity minimalist design system (`rounded-[32px]`, `font-black` headings, subtle tabs, copy/download/print buttons).
   - Wire "Export Investigation Dossier" button in `OverviewView.tsx` and `App.tsx`.
4. **Phase 4: Build Verification & Documentation Closure**
   - Run `npm --prefix web run build` to verify zero TypeScript errors and bundle size compliance.
   - Update [PRD.md](file:///D:/nasaResearch/PRD.md) and [README.md](file:///D:/nasaResearch/README.md).
