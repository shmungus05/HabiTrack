---
name: "HabiTrack"
category: Products
surface: web
colors:
  background: "#f8fafc"
  surface: "#ffffff"
  foreground: "#0f172a"
  muted: "#64748b"
  border: "#e2e8f0"
  accent: "#0284c7"
  accent-secondary: "#0369a1"
---

# HabiTrack

> Category: Products  
> Surface: web  

*Evidence-Grounded Spaceflight Health Intelligence & Environmental Exposure Analysis*

HabiTrack is an offline-first operational clinical intelligence workstation designed for long-duration human spaceflight (e.g., ISS Expeditions and lunar/Mars transit missions). It unifies environmental telemetry, autonomic vital dynamics, crew-reported symptoms, and NASA Human Research Program (HRP) evidence into a unified, calm decision-support interface.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Background | `#f8fafc` | page canvas / workstation ground |
| surface | Surface | `#ffffff` | cards / elevated `rounded-[32px]` containers |
| surface-subtle | Subtle Surface | `#f1f5f9` | segmented control trays, sub-panels |
| foreground | Foreground | `#0f172a` | titles, headings, active labels, high-contrast text |
| secondary | Secondary Text | `#334155` | body copy, description text |
| muted | Muted Text | `#64748b` | secondary metadata, timestamps, units |
| border | Border | `#e2e8f0` | container borders, dividers, subtle outlines |
| border-strong | Strong Border | `#cbd5e1` | active borders, input focus states |
| accent | Accent (Aerospace Sky) | `#0284c7` | primary interactive highlights, active badges, CTA buttons |
| accent-secondary | Accent Secondary | `#0369a1` | hover states, pressed buttons, active focus rings |
| status-nominal | Nominal Green | `#059669` | nominal telemetry, passing flight rules, verified states |
| status-caution | Caution Amber | `#d97706` | advisory warnings, moderate exposure excursions |
| status-critical | Critical Red | `#dc2626` | alerts, emergency thresholds, flight rule violations |

## Typography

- **Display & Section Titles:** `Inter` — weights 700 (Bold), 900 (Black) for primary section hero banners — fallbacks: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Body & Controls:** `Inter` — weights 400 (Regular), 500 (Medium), 600 (SemiBold) — fallbacks: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Telemetry & Metadata:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace` — used for sensor readings, document IDs, timestamps, and astronaut callsigns

## Voice & Tone

- **Adjectives:** calm, clinical, objective, evidence-grounded, non-causal, rigorous, restrained
- **Tone:** High-reliability operational medicine. Prioritizes scanability, low cognitive load during high-stress missions, and transparent uncertainty over decorative fluff.

### Epistemic Decision Support Rules
- **Non-Causal Guardrail:** Strictly maintain non-causal terminology. Correlated signals indicate temporal co-occurrence, not unverified clinical causation. Use phrases like *"temporally associated with"*, *"co-occurs with"*, rather than claiming single-variable causation.
- **Decision Support:** Frame all assessments as decision support for flight surgeons and astronauts, not autonomous unilateral medical diagnosis.

### Vocabulary
- **Use:** Telemetry, Concordance, Flight Rule, Baseline Delta, Anomaly, Excursion, Evidence-Grounded, Countermeasure, Autonomic Strain, Circadian Phase, Expedition
- **Avoid:** Pitch-black dark UI, Magic, Guaranteed cure, Unilateral diagnosis, Flashy neon gamification, Clutter

## Imagery & Media Treatment

- **Authentic Aerospace Footage:** Direct integration with NASA CDN media and research archives.
- **Media Frame Backgrounds:** True black (`#000000` / `bg-black`) is strictly confined to video stream viewports and media players to preserve aspect-ratio letterboxing contrast.
- **Video Badges:** Semi-transparent frosted overlays (`bg-black/75 backdrop-blur-xs text-white`) used only when overlaid on image thumbnails for legibility.

## Layout & Perplexity Aesthetic Posture

- **Primary Container Radius:** `rounded-[32px]` for primary dashboard sections, views, and cards.
- **Secondary Radius:** `rounded-2xl` (16px) or `rounded-xl` (12px) for inner modules, modals, and input fields.
- **Whitespace & Breathing Room:** Generous internal padding (`p-6 sm:p-8`), clear vertical rhythm, and uncluttered layouts.
- **Segmented Controls & Tabs:**
  - Enclosed neutral tray: `bg-slate-100/90` with border `border-slate-200/80`.
  - Elevated active indicator: `bg-white text-slate-900 border border-slate-200/90 shadow-xs`.
  - Inactive options: `text-slate-600 hover:text-slate-900 hover:bg-white/60`.
  - **Banned:** Solid pitch-black buttons (`bg-slate-900 text-white`) for general navigation tabs and category filter pills.
- **Filter Pills:** Active states use Aerospace Sky (`bg-sky-600 text-white border-sky-600 shadow-xs`) or subtle tinted pills; inactive states use `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`.
- **Shadows:** Minimalist soft shadows (`shadow-xs`, `shadow-2xs`), never heavy harsh drop shadows.
