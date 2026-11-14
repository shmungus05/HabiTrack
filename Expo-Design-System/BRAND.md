# Expo Brand Guidelines & Design System

> **Brand ID:** `expo-d70910`  
> **Design System ID:** `user:expo-dev`  
> **Source:** [https://expo.dev/](https://expo.dev/)  
> **Status:** Verified & Finalized  

---

## 1. Brand Identity & Positioning

**Expo** is the agentic mobile infrastructure for building modern application software. It empowers engineering teams and autonomous coding agents to develop, validate, deploy, and observe native iOS, Android, and web applications from a single unified codebase.

### Core Value Proposition
- **Agentic Mobile Infrastructure:** Built for human engineers and autonomous agents working seamlessly in mobile development loops.
- **One Codebase, Every Platform:** True cross-platform fidelity spanning iOS, Android, macOS, and web with native performance.
- **End-to-End Cloud Services (EAS):** Frictionless cloud build pipelines, automated simulator validations, instant over-the-air updates, and production crash telemetry.

---

## 2. Color System & Science

The Expo color palette is built on high-contrast obsidian minimalism with precision technical accents. Every color literal is calibrated in both standard sRGB hex and OKLCH color spaces.

### The 7 Semantic Roles

| Role | Name | Hex | OKLCH | Usage & Accessibility |
| :--- | :--- | :--- | :--- | :--- |
| **background** | Background | `#000000` | `oklch(0.000 0.000 0.0)` | Deep page canvas ground; absorbs light, high focus. |
| **surface** | Surface | `#0a0a0a` | `oklch(0.145 0.000 89.9)` | Raised containers, elevated cards, and modal dialogs. |
| **foreground** | Foreground | `#ffffff` | `oklch(1.000 0.000 89.9)` | Primary text, titles, headings, and high-emphasis icons (21:1 contrast). |
| **muted** | Muted | `#737373` | `oklch(0.556 0.000 89.9)` | Secondary copy, metadata, timestamps, and input placeholders (≥4.5:1 contrast). |
| **border** | Border | `#242424` | `oklch(0.260 0.000 89.9)` | Precision 1px container borders, dividers, and table grids (≥3:1 contrast against surface). |
| **accent** | Accent | `#000000` | `oklch(0.000 0.000 0.0)` | Primary technical identity baseline. |
| **accent-secondary** | Accent Secondary | `#0026a3` | `oklch(0.360 0.200 263.8)` | Vibrant electric indigo for interactive states, key CTA outlines, links, and focus rings. |

### Color Rules for Downstream Agents
1. **Pitch-Black Foundation:** Never use warm beige, cream, or off-white canvas backgrounds. Canvas ground is strictly `#000000` with `#0a0a0a` container elevations.
2. **Strict Palette Discipline:** Use only registered palette tokens. Avoid uncalibrated color washes or random rainbow accents.
3. **High Signal Accents:** Accent Secondary (`#0026a3`) must be applied surgically to interactive controls, badges, and focus indicators rather than massive background floods.

---

## 3. Typography Stack

Expo pairs technical developer authority with clean typographic legibility through **JetBrains Mono**.

### Specifications

- **Display & Headings:** `JetBrains Mono`
  - *Weights:* `700` (Bold), `600` (SemiBold), `400` (Regular)
  - *Fallbacks:* `system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif`
  - *Google Fonts URL:* `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap`
- **Body & UI Elements:** `JetBrains Mono`
  - *Weights:* `400` (Regular), `500` (Medium), `700` (Bold)
  - *Fallbacks:* `system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif`
  - *Google Fonts URL:* `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap`

### Type Scale & Hierarchy
- **Hero Title:** `clamp(2.5rem, 5vw, 4.5rem)` / line-height `1.1` / letter-spacing `-0.03em`
- **Section Heading (H2):** `clamp(1.75rem, 3vw, 2.5rem)` / line-height `1.2` / letter-spacing `-0.02em`
- **Subheading (H3):** `1.25rem` – `1.5rem` / line-height `1.3`
- **Body Text:** `1rem` (16px) / line-height `1.6` / letter-spacing `0em`
- **Caption & Meta:** `0.875rem` (14px) / line-height `1.5` / color `var(--muted)`
- **Code & Inline CLI:** `0.875rem` / line-height `1.4` / monospaced padding `2px 6px`

---

## 4. Logo Assets & Mark Usage

All brand marks are extracted as vector SVGs and high-resolution platform assets under `logos/`.

### Available Candidates
1. **Primary Wordmark:** `logos/header.svg`
   - Literal vector SVG extracted from the site navigation.
   - Clean, geometric "expo" lowercase wordmark.
   - Scales crisply across desktop, tablet, and mobile navigation headers.
2. **Icon & Symbol:** `logos/expo-icon.svg`
   - The iconic exponential mark (`^` / dual chevron caret).
   - Suitable for square profile avatars, app icons, and compact toolbars.
3. **Platform Assets:**
   - `logos/apple-touch-icon-0.png` (512x512 high-density touch icon)
   - `logos/favicon-1.png` through `logos/favicon-5.png` (16px, 32px, 48px light/dark favicon variants)

### Logo Rules
- Never alter the aspect ratio or path geometry of the wordmark or exponential mark.
- Maintain a minimum clear space equal to half the height of the mark on all sides.
- Use `logos/header.svg` as the primary mark for web headers and presentation title slides.

---

## 5. Voice, Tone & Messaging

Expo speaks directly to software engineers, mobile architects, and AI agent developers. The voice is authoritative, technically precise, and devoid of marketing fluff.

### Persona & Adjectives
- **Agentic:** Built for automation and AI-native developer workflows.
- **Infrastructure-Grade:** Reliable, battle-tested at scale by Fortune 500 apps and thousands of indie creators.
- **Developer-First:** Clear code-first documentation, command-line examples, and transparent status.
- **Autonomous & Composable:** Modularity and workflow independence without lock-in.

### Core Messaging Pillars
1. **Agentic mobile infrastructure:** Providing the tools, MCP servers, and cloud primitives for human and AI development teams.
2. **Building blocks for agentic workflows:** CLI, Skills, MCP connectors, and cloud simulators ready for autonomous agents.
3. **Infrastructure for your apps:** Cloud builds, over-the-air updates, continuous delivery, and native observability.
4. **Ship native apps from one codebase:** True multi-platform deployment spanning iOS, Android, and Web.

### Vocabulary Guide
- **Use:** `Agentic`, `Infrastructure`, `Workflows`, `Simulators`, `EAS`, `SDK`, `MCP`, `One codebase`, `Observe`, `TestFlight`, `Production-grade`, `Dev tools`.
- **Avoid:** `Magic`, `Easy-peasy`, `No-code`, `Toy apps`, `Hassle-free`, `Revolutionary`, `Disruptive`, `Synergy`, `One-click wonder`.

---

## 6. Imagery & Visual Language

Expo’s imagery conveys industrial-grade engineering through dark-mode product UI captures, isometric hardware simulator frames, and atmospheric cyan-blue flares.

### Curated Assets (in `imagery/`)
- `imagery/og-image.png` (1200x630) — Primary social card and hero graphic.
- `imagery/box-1-dark.webp` (1440x900) — Expo CLI and developer terminal tools.
- `imagery/box-2-dark.webp` (1677x945) — Cloud Simulators and automated agent testing.
- `imagery/box-3-dark.webp` (3270x1641) — Automated deployment to App Store & TestFlight.
- `imagery/box-4-dark.webp` (1308x1014) — Real-time observability, crash telemetry, and adoption metrics.
- `imagery/box-6-mobile-dark.webp` — Mobile device simulators in active execution.
- `imagery/flare-top.png` (1682x946) — Subtle atmospheric cyan/indigo top ambient flare.
- `imagery/new-dark.png` (1017x573) — Textured dark background pattern.

### Styling & Placement
- **Card Frames:** Raised `#0a0a0a` panels with `1px solid #242424` borders and `border-radius: 8px`.
- **Image Geometry:** Measure intrinsic dimensions before styling; preserve natural aspect ratios (`height: auto`).
- **Forbidden:** No cartoon illustrations, no stock photography of business handshakes, and no warm pastel gradients.

---

## 7. Layout & Spatial Posture

- **Baseline Grid:** 8px baseline rhythm (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`, `96px`).
- **Corner Radius:** Strictly `8px` on all standard interactive elements, cards, inputs, and modal sheets.
- **Border Weight:** Fixed at `1px` (`#242424`) to preserve crisp hairline delineation.
- **Container Posture:** Dense, high-information-density technical layouts with monospaced data grids, code tabs, and terminal viewports.
- **Safe Area:** Keep interactive targets and calls to action centered within standard viewport boundaries (≥50px margins on desktop, ≥16px on mobile).
