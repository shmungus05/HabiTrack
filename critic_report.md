# Stage 7 Antagonistic Critic Review: Feature Specification Audit

**Target:** [`docs/designs/wayfinder_prd_completion_package.md`](file:///D:/nasaResearch/docs/designs/wayfinder_prd_completion_package.md) (`Lines 1 to 275`)  
**Standard:** `feature-spec-standard` / [PRD.md](file:///D:/nasaResearch/PRD.md) / [GLOSSARY.md](file:///D:/nasaResearch/GLOSSARY.md)  
**Date:** 2026-11-14  
**Status:** Ingested & Staged for Automated Agent Remediation  

---

## Reviewer Status

| Reviewer | Lens | Status | Findings Contributed |
| :--- | :--- | :--- | :--- |
| `egm-design` | Architecture, Clean Interfaces & Failure Modes | completed | 5 findings (1 Blocker, 3 Major, 1 Nit) |
| `egm-structural` | Spec Invariants, Omissions & PRD Alignment | completed | 6 findings (2 Blocker, 3 Major, 1 Nit) |
| `egm-style` | Glossary Terminology, Epistemic Guardrails & Copy | completed | 3 findings (0 Blocker, 1 Major, 2 Nit) |

**Severity Summary:** ðŸ”´ **3 Blockers** | ðŸŸ¡ **7 Majors** | ðŸŸ¢ **4 Nits** (Total: 14 Findings)

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Missing Provenance, Quality Status, and Temporal Bounding in `DossierReport` - Severity: ðŸ”´ Blocker
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 128â€“171 (`types.ts` `DossierReport` contract) & Lines 38â€“41 (Section 3 Goal 1)
* **Discrepancy Description**: The `DossierReport` interface directly violates [PRD.md](file:///D:/nasaResearch/PRD.md) FR-12 ("Reports and Review") and Section 11 ("Scientific Integrity and Safety"):
  1. `metadata` lacks temporal bounding fields (`timeWindowStart`, `timeWindowEnd`, or `missionDayRange`), recording only `generatedAt`. A clinical investigation dossier cannot substantiate clinical findings without an explicit bounding interval for the incident analyzed.
  2. Both `vitalsSummary` and `environmentalSnapshot` omit `qualityStatus` (`VALID`, `SUSPECT`, `STALE`, `GAP`, `IMPUTED`), violating the core PRD invariant: *"Preserve units, timestamps, source, and dataset limitations. Do not treat missing data as normal."*
  3. The contract omits source references (`sourceReferences: Array<{ sourceName: string; datasetId: string; doi?: string; }>`), failing the mandate to distinguish authentic NASA EDA logs from synthetic vitals and crew logs.
* **Resolution**: Expand `DossierReport` in `types.ts` to include temporal window bounding in `metadata`, `qualityStatus` and `unit` across all vitals and environmental metrics, and an authoritative `sourceReferences` array.

---

### 2. Outbox Packet Lifecycle & Link Loss Interruption State Machine Undefined - Severity: ðŸ”´ Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 210â€“226 (`commsStore.ts` & Packet Lifecycle)
* **Discrepancy Description**: The state transitions for `OutboxPacket` (`PENDING_LOS` $\leftrightarrow$ `TRANSMITTING` $\to$ `DELIVERED`) omit critical deep space communications operational rules:
  1. **Parallel vs. Serialized Downlink Drain:** When link state toggles from `LOS` to `AOS`, it is unspecified whether all buffered packets transmit simultaneously in parallel lockstep or drain sequentially (FIFO). If parallel, all packets finish transmission at the exact same second, violating realistic transmission physics.
  2. **Link Loss Mid-Transmission Interruption:** If link state switches to `LOS` while packets are `TRANSMITTING`, the spec does not state whether `timeRemainingSeconds` pauses and preserves progress, or if the packet aborts back to `PENDING_LOS` with full latency reset.
  3. **Packet Transmission Collision:** The behavior when a new packet is enqueued while an existing packet is in-flight is undefined.
* **Resolution**: Formally define the lifecycle state machine in `commsStore.ts`:
  - Enforce FIFO queue processing during `AOS` where packets drain sequentially or receive staggered transmission offsets (`timeRemainingSeconds = (index + 1) * (latencyMinutes * 60)`).
  - Explicitly define the `LOS` transition handler: any packet in `TRANSMITTING` transitions to `PENDING_LOS` with remaining countdown paused (`pausedRemainingSeconds`).
  - Add explicit lifecycle transitions: `enqueuePacket()`, `onLinkStateChange()`, `tick()`, and `retryPacket()`.

---

### 3. Missing Cohort Binding & Medical Privacy Boundary in Astronaut Perspective - Severity: ðŸ”´ Blocker
* **Reviewer Lens:** `egm-structural` & `egm-design`
* **Affected Scope:** Lines 190â€“208 (Section 5.2.2 Multi-Role Perspective & `roleStore.ts`)
* **Discrepancy Description**: The design introduces `roleStore` without defining its constraint relationship with `cohortStore`. Under NASA-STD-3001 and [PRD.md](file:///D:/nasaResearch/PRD.md) Section 4, an astronaut's operational interface is strictly for self-monitoring personal physiological trends and reporting symptoms. In the current design, switching to `"astronaut"` mode leaves the cohort switcher unconstrained, allowing an astronaut to view other crew members' private baselines or accidentally log symptoms under a crewmate's callsign.
* **Resolution**: Formally specify that when `role === "astronaut"`:
  1. The global App Shell Cohort Switcher is locked to the active logged astronaut (`ASTRO-01`) or replaced by a static astronaut badge.
  2. The flight surgeon perspective (`flight_surgeon`) restores the full multi-astronaut cohort selector.

---

### 4. Orphaned `DOSSIER_TRANSMIT` Packet Type & Missing Outbox Action in `DossierModal` - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 185â€“189 (`DossierModal.tsx`) & Line 217 (`OutboxPacket.type`)
* **Discrepancy Description**: `OutboxPacket.type` specifies `"DOSSIER_TRANSMIT"` as a supported ground downlink payload type. However, `DossierModal.tsx` defines only three user actions: `"Copy Markdown"`, `"Download .md"`, and `"Print / Save PDF"`. There is no UI trigger, button, or hook in `DossierModal.tsx` to enqueue the compiled dossier into `commsStore` as a `"DOSSIER_TRANSMIT"` packet.
* **Resolution**: Add a fourth primary action button to `DossierModal.tsx`: `"Downlink to Ground via Comms"`, which enqueues the compiled dossier into `commsStore` as a `"DOSSIER_TRANSMIT"` packet.

---

### 5. Missing Physical Engineering Units in `vitalsSummary` Schema - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 137â€“143 (`DossierReport.vitalsSummary`)
* **Discrepancy Description**: In `DossierReport`, `environmentalSnapshot` explicitly includes `unit: string;`, but `vitalsSummary` omits `unit`. Physiological measurements ($HR$ in $\text{bpm}$, $RMSSD$ in $\text{ms}$, $SpO_2$ in $\%$, $T_{\text{core}}$ in $^\circ\text{C}$) require explicit engineering units.
* **Resolution**: Add `unit: string;` to each item in `vitalsSummary`, maintaining exact parity with `environmentalSnapshot`.

---

### 6. Print CSS Truncation on Multi-Page Documents (`position: absolute`) - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 177â€“184 (`dossierTemplates.ts` `@media print`)
* **Discrepancy Description**: The print CSS specifies `#printable-dossier { position: absolute; left: 0; top: 0; width: 100%; }`. In modern Chromium/WebKit print pipelines, multi-page documents styled with `position: absolute` fail to paginate, clipping all content beyond the first page.
* **Resolution**: Refactor `@media print` in `dossierTemplates.ts` to use normal document flow (`position: static; display: block; width: 100%;`) with `break-inside: avoid; page-break-inside: avoid;` on cards and rows.

---

### 7. Impure `dossierCompiler` Signature & Global Store Coupling - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 172â€“174 (`dossierCompiler.ts`)
* **Discrepancy Description**: If `dossierCompiler` internally reads from global Zustand store singletons, it is not a pure function, making automated unit testing fragile.
* **Resolution**: Declare an explicit, pure function signature:
  `export function compileDossier(input: DossierCompilerInput): DossierReport;` where `DossierCompilerInput` takes plain typed objects.

---

### 8. Incomplete State Ingress in Section 5.1 Mermaid Architecture - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 72â€“88 (Section 5.1 Mermaid Diagram)
* **Discrepancy Description**: In the high-level architecture diagram, the `COMPILER` node only receives incoming edges from `COHORT` and `TIMELINE`. It omits state ingress edges for `symptoms`, `concordanceEvents`, and `verifiedFlightRules`.
* **Resolution**: Add the missing data flow arrows in Mermaid: `SYMPTOMS --> COMPILER`, `EVENTS --> COMPILER`, `FLIGHT_RULES --> COMPILER`.

---

### 9. Unchecked Local Persistence Error Handling in Workstation Decoupling Invariant - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 245â€“250 (Section 5.3 Workstation Decoupling Invariant)
* **Discrepancy Description**: If `api.postSymptom()` fails, but `enqueuePacket()` executes unconditionally, the outbox transmits uncommitted ghost data.
* **Resolution**: Specify that `enqueuePacket` executes strictly upon successful resolution of the local persistence promise.

---

### 10. Undefined Navigation Shell Route Gating in Astronaut Perspective - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 205â€“208 (Adaptive `OverviewView.tsx` Behavior)
* **Discrepancy Description**: Navigation shell behavior across other routes (`/timeline`, `/research`, `/alerts`, `/settings`) was undefined for the Astronaut perspective.
* **Resolution**: Explicitly specify that in Astronaut mode, primary operational routes are `/` (Overview) and `/symptoms`, while diagnostic routes (`/timeline`, `/research`) display an informational banner and simplified views.

---

### 11. Domain Model Terminology Alignment - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Vocabulary across document
* **Resolution**: Align terminology with [GLOSSARY.md](file:///D:/nasaResearch/GLOSSARY.md) (e.g. `CrewPerspective` instead of `UserRole`, `measurements` instead of `readings`).

---

### 12. Planetary Preset Latency Correction: Lunar Gateway 1.3s - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-style` & `egm-structural`
* **Affected Scope:** Line 48 vs. Line 236
* **Resolution**: Standardize Lunar Gateway latency to `1.3s` (seconds) across all sections.

---

### 13. Typed Checklist Steps in `verifiedFlightRules` - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 164â€“169
* **Resolution**: Refine checklist to `checklistSteps: Array<{ stepNumber: number; instruction: string; verified: boolean; verifiedAt?: string; }>;`.

---

### 14. Persistent Storage for `commsStore` - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 210â€“226
* **Resolution**: Mandate Zustand `persist` middleware for `commsStore` saving to `localStorage` under `wayfinder_comms_state`.
