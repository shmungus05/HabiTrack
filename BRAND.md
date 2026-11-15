# HabiTrack Brand Guidelines & Design System

> **Brand ID:** `habitrack-nasa`  
> **System Name:** HabiTrack Spaceflight Health Intelligence  
> **Aesthetic Archetype:** High-End Minimalist Perplexity Workstation  
> **Status:** Verified & Finalized  

---

## 1. Brand Identity & Positioning

**HabiTrack** is an offline-first operational health intelligence platform designed for long-duration human spaceflight (e.g., International Space Station Expeditions, Artemis lunar transit, and Mars surface missions).

It empowers astronauts and ground flight surgeons to monitor multi-modal telemetry, correlate environmental excursions with physiological baselines, log symptoms, and access NASA-certified countermeasure procedures without requiring external internet connectivity.

### Core Value Proposition
- **Detect Changes:** Continuous concordance monitoring across cabin atmosphere ($P\text{CO}_2$, radiation, acoustic noise, thermal) and crew vitals (resting HR, RMSSD, $\text{SpO}_2$, temperature).
- **Understand Context:** Historical personalized baselines and circadian envelope modeling.
- **Retrieve Evidence:** In-browser RAG retrieval grounded in the NASA GeneLab and Human Research Program (HRP) literature.
- **Support Decisions:** Transparent epistemic guardrails ensuring operational non-causal decision support.

---

## 2. Color System & Science

HabiTrack uses a calm, clinical light-mode palette calibrated for high usability under mission stress.

### Semantic Color Roles

| Role | Token | Hex | Usage & Accessibility |
| :--- | :--- | :--- | :--- |
| **Canvas** | `canvas` / `background` | `#f8fafc` | Clean, low-glare workstation backdrop. |
| **Surface** | `surface` | `#ffffff` | Elevated `rounded-[32px]` containers and cards. |
| **Subtle Surface** | `surface-subtle` | `#f1f5f9` | Segmented control trays, table headers. |
| **Foreground** | `foreground` | `#0f172a` | High-emphasis titles, active labels, metric values. |
| **Secondary** | `secondary` | `#334155` | Body copy, clinical descriptions. |
| **Muted** | `muted` | `#64748b` | Timestamps, units, document IDs, helper text. |
| **Border Default** | `border` | `#e2e8f0` | 1px hairline container borders and dividers. |
| **Border Strong** | `border-strong` | `#cbd5e1` | Input focus rings, highlighted card boundaries. |
| **Accent Primary** | `accent` | `#0284c7` | Aerospace Sky 600: active filters, primary CTAs, links. |
| **Accent Secondary**| `accent-secondary` | `#0369a1` | Aerospace Sky 700: button hover, pressed states. |
| **Nominal Status** | `status-nominal` | `#059669` | Emerald 600: healthy vital signs, nominal life support. |
| **Caution Status** | `status-caution` | `#d97706` | Amber 600: advisory alerts, moderate baseline deltas. |
| **Critical Status**| `status-critical` | `#dc2626` | Red 600: flight rule violations, severe vitals excursions. |

### Color Rules for Downstream Agents
1. **Never Default to Pitch-Black UI:** The application ground is strictly light canvas (`#f8fafc`). Do not introduce pitch-black canvases (`#000000`) or dark theme card backgrounds.
2. **Restrained Use of Solid Dark Blocks:** General UI controls, tabs, and filter pills must not use solid `bg-slate-900` or `bg-black`. Use clean segmented controls (`bg-white` on `bg-slate-100`) and aerospace sky accents.
3. **Black Restricted to Media:** Pure black (`bg-black`) is strictly confined to video viewports and media players to preserve aspect-ratio letterboxing contrast.

---

## 3. Typography Stack

- **Font Family:** `Inter` (sans-serif) paired with standard monospaced fallbacks for telemetry and sensor data.
- **Headings & Hero Banners:** `font-black text-slate-900` with `tracking-tight` for major section headers, giving the signature Perplexity editorial feel.
- **Card & Modal Titles:** `font-bold text-slate-900` for crisp legibility without letterfill smudging.
- **Body:** `font-normal` or `font-medium text-slate-600` / `text-slate-700`.
- **Telemetry & Codes:** `font-mono text-xs` / `text-sm font-semibold`.

---

## 4. Layout & Perplexity Aesthetic Posture

- **`rounded-[32px]` Containers:** Primary dashboard cards and feature views use large `rounded-[32px]` geometry with subtle 1px border (`border-slate-200/90`) and micro-shadows (`shadow-xs`).
- **Breathable Whitespace:** Ample internal padding (`p-6 sm:p-8`) to prevent cognitive overload.
- **Segmented Control Standard:**
  ```tsx
  <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80">
    <button className="bg-white text-slate-900 shadow-xs border border-slate-200/90 rounded-xl px-4 py-2">
      Active
    </button>
    <button className="text-slate-600 hover:text-slate-900 rounded-xl px-4 py-2">
      Inactive
    </button>
  </div>
  ```
- **Active Pills:** Use `bg-sky-600 text-white border-sky-600 shadow-xs` for active category filters.
