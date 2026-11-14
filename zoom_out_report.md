# Stage 5 Zoom Out & Inventive Catalyst Review Report

**Target:** `docs/designs/wayfinder_prd_completion_package.md` (`Lines 1-324`)  
**Date:** 2026-11-14  
**Stage:** Stage 5 (Initial Zoom Out & Inventive Catalyst Review)  
**Author:** MinnThikeTunn  

## Reviewer Status

| Reviewer | Status | Primary Focus |
| :--- | :--- | :--- |
| `egm-zoom-out` | completed | Contrarian YAGNI, phantom abstractions, real-world spaceflight operational friction |
| `egm-inventive-catalyst` | completed | TRIZ contradiction analysis, secondary failure modes, trade-off mitigation |

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Print CSS Multi-Page Clipping Flaw (`position: absolute` Destroys Paged Media) - Severity: ðŸ”´ Blocker
* **Reviewer Lens:** `egm-zoom-out` & `egm-inventive-catalyst`
* **Affected Scope:** Lines 176â€“184 (`dossierTemplates.ts` & `@media print` CSS specification)
* **Discrepancy Description**: 
  The proposed `@media print` stylesheet specifies:
  ```css
  @media print {
    body * { visibility: hidden; }
    #printable-dossier, #printable-dossier * { visibility: visible; }
    #printable-dossier { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; }
    .no-print { display: none !important; }
  }
  ```
  Under CSS Paged Media specifications implemented in Chromium, Gecko, and WebKit, an element with `position: absolute` is detached from normal document flow and rendered into a single fixed viewport frame. Browser print engines refuse to break pages across an absolutely positioned container. Any content exceeding the height of Page 1 is silently clipped and discarded. In a realistic clinical investigation dossier containing 7-day vitals, environmental snapshots, symptom logs, concordance events, and verified flight rule checklists, the report spans 2 to 4 pages. Applying `position: absolute` causes catastrophic truncation of all data beyond the first page.
* **Rationale & Recommendation**: 
  Remove `position: absolute` entirely. The zero-dependency standard for multi-page print layouts in single-page apps is:
  1. Hide the outer application shell elements (`#root > nav, #root > header, #root > main { display: none !important; }`).
  2. Keep `#printable-dossier` in static flow (`position: static; width: 100%; display: block;`).
  3. Enforce page breaks and card containment:
     ```css
     @page { size: auto; margin: 15mm; }
     .dossier-card, tr { break-inside: avoid; page-break-inside: avoid; }
     ```

---

### 2. Phantom Architecture Dependency â€” Coupling Compiler to Non-Existent `timelineStore` - Severity: ðŸ”´ Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 76, 85â€“86, 173 (`High-Level Architecture & Seams`, `dossierCompiler.ts`)
* **Discrepancy Description**: 
  The architecture diagram and compiler specification assert:
  `TIMELINE["timelineStore (Multi-Factor Telemetry Streams)"]`
  `COHORT --> COMPILER; TIMELINE --> COMPILER`
  "dossierCompiler.ts: Pure calculation function that projects the current Zustand stores into DossierReport."
  However, in the actual codebase (`web/src/stores/`), there is no `timelineStore.ts` storing telemetry streams. Telemetry streams, baselines, and events are loaded dynamically within components via service calls (`web/src/services/api.ts`). Coupling `dossierCompiler` directly to global Zustand stores (especially a non-existent one) breaks the deep-module principle established in `concepts_brief.md` line 177 (`DossierInput` interface). If the compiler directly reads Zustand stores, it cannot be headlessly executed, unit-tested with static fixtures, or invoked outside the active React component tree.
* **Rationale & Recommendation**: 
  Decouple `dossierCompiler` from Zustand stores entirely. Re-align with `concepts_brief.md` by defining a pure, state-agnostic function signature:
  ```typescript
  export function compileDossier(input: DossierInput): DossierReport;
  ```
  where `DossierInput` receives typed plain objects (`astronaut`, `baselines`, `measurements`, `symptoms`, `events`, `activeFlightRules`). Remove `timelineStore` from the architecture diagram and text.

---

### 3. Comms Simulator Unusable at Deep Space Delays Without Time Warp / Acceleration - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 226, 234â€“239 (`commsStore.ts` & `CommsModal.tsx`)
* **Discrepancy Description**: 
  The design specifies presets for Mars Conjunction (14.2 min = 852s) and Mars Opposition (24.0 min = 1,440s), stating that "an internal ticker decrements timeRemainingSeconds until reaching DELIVERED."
  However, the design includes no simulation speed multiplier (e.g., 10x, 60x, or "Fast-Forward / Warp" button). In an operational drill, hackathon judging evaluation, or flight surgeon review, waiting 14 to 24 real-world clock minutes for a simulated packet to progress from `TRANSMITTING` to `DELIVERED` renders the feature untestable. Furthermore, backgrounded browser tabs throttle `setInterval` to 1 minute or freeze it, inducing severe countdown drift.
* **Rationale & Recommendation**: 
  Add a time-compression multiplier (e.g., `1x | 10x | 60x | Instant Delivery`) to `commsStore` and `CommsModal`, matching the speed modifiers already present in `EdaStreamController` (1x/2x/5x). In addition, calculate countdowns based on timestamp deltas (`Date.now()`) rather than counting down tick-by-tick to prevent background-tab drift.

---

### 4. Simulation Leakage & Mode Blindness Contradiction Between Roles - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 190â€“208, 296 (`Multi-Role Shell Perspective Toggle` & `OverviewView.tsx`)
* **Discrepancy Description**: 
  In Flight Surgeon mode, the user can use `SimulationSandboxPanel` to inject anomalous transient overrides (e.g., cabin $P_{\text{CO}_2} > 3,800\text{ PPM}$ pocket spike or SAA radiation crossing).
  The design specifies that in Astronaut mode, `SimulationSandboxPanel` is hidden via `<SurgeonOnly>`.
  However, if a Flight Surgeon or evaluator injects an anomaly and toggles the shell to Astronaut mode:
  1. The transient anomaly override remains active in memory.
  2. The reset/clear controls and the "ACTIVE SIMULATION OVERRIDE" banner are hidden because they live inside `SimulationSandboxPanel`.
  3. The Astronaut view now displays critical alarms, hypercapnia cephalea flight rules, and red status chips without ANY visual indication that the anomaly is simulated.
  This creates a dangerous "Mode Blindness" state that violates spaceflight safety standards (PRD Section 11: "Distinguish NASA measurements from synthetic and manually entered data").
* **Rationale & Recommendation**: 
  Apply TRIZ Principle 23 (Feedback) & Principle 10 (Preliminary Action):
  1. Render a persistent, high-contrast global ambient badge `[âš ï¸ SIMULATION OVERRIDE ACTIVE]` in the app shell across all roles whenever an override is active, accompanied by a 1-tap "Reset to Live Flight Telemetry" button accessible even in Astronaut mode.

---

### 5. Comms Outbox In-Memory Volatility & Partial Wiring (Orphan Packet Types) - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-zoom-out` & `egm-inventive-catalyst`
* **Affected Scope:** Lines 215â€“225, 286, 297, 315 (`commsStore.ts` & Implementation Plan)
* **Discrepancy Description**: 
  1. **Memory Volatility:** Unlike `roleStore` which explicitly mandates `localStorage` persistence under key `wayfinder_active_role` (line 201), `commsStore` has no persistence specified. If an astronaut logs a symptom during LOS and refreshes or navigates the page, all buffered packets in the outbox evaporate, while the symptom record remains written in SQLite. This causes state desynchronization between ground telemetry queue and local history.
  2. **Orphan Packet Types:** `commsStore.ts` defines 4 packet types: `SYMPTOM_REPORT`, `EVENT_ACK`, `DOSSIER_TRANSMIT`, and `TELEMETRY_SYNC`. Yet in the implementation plan (lines 297, 315), ONLY `SymptomsView.tsx` is wired to enqueue packets. `DossierModal.tsx` has no "Transmit to Ground" button, and `reviewEvent` in `OverviewView.tsx` has no packet enqueueing hook.
* **Rationale & Recommendation**: 
  1. Add `localStorage` persistence to `commsStore` (via Zustand `persist` middleware under key `wayfinder_outbox_queue`) so buffered deep-space packets survive page reloads and tab closures.
  2. Fully wire the packet types: add a "Transmit to Ground via Comms" action button in `DossierModal.tsx` (enqueueing `DOSSIER_TRANSMIT`), and wire `OverviewView.tsx` event review sign-offs to enqueue `EVENT_ACK`. Prune `TELEMETRY_SYNC` from `PacketType` to avoid dead specification bloat.

---

### 6. Unspecified Error Handling for Epistemic Guardrail in Tabular Input Data - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 170â€“174, 318 (`dossierCompiler.ts` & Epistemic Guardrail)
* **Discrepancy Description**: 
  The design states: "dossierCompiler.ts: Validates that no prohibited causal terms appear in the synthesized narrative."
  However, unlike Version 3 where the guardrail checks free-form text generated by a stochastic LLM (`wayfinder/core/assistant`), the Dossier Compiler compiles structured facts, metadata, and user-submitted symptom notes.
  If an astronaut writes a free-form symptom note such as: `"Headache caused by carbon dioxide accumulation during maintenance in Node 2 forward bay"`:
  What does `dossierCompiler` do? The document does not specify whether it throws an uncaught exception, aborts compilation, censors crew notes, or logs a warning. Blocking report export during an operational incident because an astronaut typed "caused" is an unacceptable clinical failure mode.
* **Rationale & Recommendation**: 
  Define a deterministic sanitization and warning behavior:
  `dossierCompiler` must never abort or crash. If a prohibited causal term (e.g., "caused", "diagnose", "treatment") is detected in user symptom notes:
  1. The compiler preserves report generation.
  2. It flags the term with a bracketed disclaimer chip (e.g., `[Note: Non-causal observation - unverified correlation]`).
  3. The compiler guarantees the mandatory PRD disclaimer is appended at the bottom: `"Temporal alignment of environmental excursions and physiological observations does not establish clinical causation."`

---

### 7. Role Switcher Scope Inconsistency Across Shell Navigation Routes - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 190â€“208, 295â€“296 (`RoleGate.tsx`, `App.tsx`, `OverviewView.tsx`)
* **Discrepancy Description**: 
  The document states that Astronaut mode simplifies the interface to reduce cognitive load per NASA-STD-3001. However, the implementation only adapts `OverviewView.tsx`. The top navigation bar (`App.tsx`) still allows the Astronaut to freely click into `Research` (dense biomedical literature search) and `Timeline` (dense 4-lane WebGL Plotly charts with raw scrubbers).
* **Rationale & Recommendation**: 
  Document explicitly that Astronaut perspective declutters the primary operational workstation (`OverviewView`), while secondary workspaces remain accessible for mission specialists.

---

### 8. Absence of Automated Verification Tests in File Inventory - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 280â€“301, 322â€“324 (`File Inventory & Rationale`, `Phase 4 Verification`)
* **Discrepancy Description**: 
  Sections 7.1 and 7.2 only specify `npm --prefix web run build` (TypeScript compilation). No unit test files are listed for `dossierCompiler.test.ts`. While TypeScript checks types, it does not verify pure calculation projection logic, baseline sigma deviation rounding, or markdown formatting.
* **Rationale & Recommendation**: 
  Add a dedicated unit test suite or verification script verifying `dossierCompiler` projection outputs against known baseline fixtures (e.g. Commander Vance Day 127 event) to guarantee reproducible, zero-defect compilation.

---

## Severity Summary

- ðŸ”´ **Blockers**: 2
- ðŸŸ¡ **Major**: 4
- ðŸŸ¢ **Nits**: 2
- **Total Findings**: 8
