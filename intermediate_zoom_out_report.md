# Stage 8 Intermediate Zoom Out Review Report

**Target:** `D:\nasaResearch\docs\designs\wayfinder_prd_completion_package.md` (`Lines 1-398`)  
**Mode:** `STAGE_8_INTERMEDIATE_ZOOM_OUT`  
**Date:** 2026-11-14  
**Reviewer:** `egm-zoom-out`  

---

## Reviewer Status

| Reviewer | Status | Primary Focus |
| :--- | :--- | :--- |
| `egm-zoom-out` | completed | High-altitude simplicity, anti-bloat verification, YAGNI audit, operational friction |

**Severity Breakdown:**
- ðŸ”´ **Blockers**: 0
- ðŸŸ¡ **Major**: 3
- ðŸŸ¢ **Nit**: 2
- **Total Findings**: 5

---

## High-Altitude Simplicity & Minimalism Verdict

A thorough, contrarian audit of [`wayfinder_prd_completion_package.md`](file:///D:/nasaResearch/docs/designs/wayfinder_prd_completion_package.md) following the Comprehension (Stage 6) and Critic (Stage 7) remediation rounds reveals that **the core architecture has successfully resisted bloat and feature creep**:
1. **Zero Server / Database Bloat:** The package strictly maintains the offline-first invariant without introducing server-side authentication, password hashing, or SQLite schema migrations.
2. **Zero Heavy Dependency Bloat:** Third-party PDF generation engines (`jspdf`, `puppeteer`, `weasyprint`) were decisively rejected in favor of native `@media print` and plain GitHub-Flavored Markdown.
3. **No Network Hijacking:** The deep-space comms delay simulator is strictly decoupled from local operations, avoiding service-worker or fetch-interception hazards that would degrade local UI responsiveness.
4. **Authentic Domain Alignment:** Additions to `DossierReport` (`QualityStatus`, `ProvenanceCategory`, `ChecklistStep`) directly reuse existing types from [`web/src/types/api.ts`](file:///D:/nasaResearch/web/src/types/api.ts) rather than introducing synthetic abstractions.

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. In-Flight Time-Warp Countdown Acceleration Contradiction - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 284â€“296 (Section 5.2.3 `commsStore.ts` lifecycle specification)
* **Discrepancy Description**: 
  Dividing `timeRemainingSeconds` by `speedMultiplier` upon queue entry creates a severe state contradiction if the user toggles the speed multiplier (e.g. from `1x` to `10x` or `60x`) while a packet is already in flight.
* **Resolution**: Keep `timeRemainingSeconds` representing pure simulated spaceflight seconds ($t_{\text{sim}} = \text{latencySeconds}$). In the wall-clock tick loop, scale the delta:
  ```typescript
  const deltaSec = (Date.now() - lastTickTime) / 1000;
  timeRemainingSeconds = Math.max(0, timeRemainingSeconds - (deltaSec * speedMultiplier));
  ```
  When `"Instant Delivery"` is triggered, set `timeRemainingSeconds = 0`.

---

### 2. Latency Unit Mismatch (`latencyMinutes` vs. Sub-Minute Planetary Presets `1.3s`) - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 49â€“53, 284, 304â€“309 (Sections 3, 5.2.3, and 7.1)
* **Discrepancy Description**: Storing sub-minute latencies as fractional minutes (`1.3s` = $0.0216666...$ minutes) introduces floating-point rounding errors and awkward formatting branches in the UI.
* **Resolution**: Store latency in the canonical time unit of calculations: **seconds** (`latencySeconds: number`). The presets map cleanly to numbers without float division:
  - `ISS Orbit`: `0` s
  - `Lunar Gateway`: `1.3` s
  - `Mars Opposition`: `210` s ($3.5\,\text{min}$)
  - `Mars Conjunction`: `1290` s ($21.5\,\text{min}$)

---

### 3. Type Schema Impedance Mismatch between `FlightRule` and `DossierCompilerInput` - Severity: ðŸŸ¡ Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 194â€“204, 223 (Section 5.2.1 `types.ts` & `dossierCompiler.ts`)
* **Discrepancy Description**: `DossierCompilerInput` specifies an ad-hoc intermediate representation (`checklist: string[]`, `sha256: string`), whereas the codebase defines `FlightRule` with `ChecklistStep[]`.
* **Resolution**: Directly accept `activeFlightRules?: FlightRule[];` from `web/src/types/api.ts` in `DossierCompilerInput`.

---

### 4. Dual-Location Print CSS Specification (`dossierTemplates.ts` vs `web/src/index.css`) - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 237â€“246 (`dossierTemplates.ts`) vs. Line 371 (`web/src/index.css`)
* **Resolution**: Declare global outer document hiding rules (`body > *:not(#printable-dossier-root) { display: none !important; }`) in `web/src/index.css`, and keep `dossierTemplates.ts` focused on dossier markup.

---

### 5. Unspecified Enqueue Behavior when Link is Already in AOS - Severity: ðŸŸ¢ Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 290â€“294 (Section 5.2.3 Packet Lifecycle)
* **Resolution**: Explicitly specify: When `linkState === "AOS"`, if queue is idle, newly enqueued packet immediately transitions to `TRANSMITTING`; if another packet is currently transmitting, new packet queues behind in FIFO order.
