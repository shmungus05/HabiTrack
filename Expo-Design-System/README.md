# Expo Design System Package

Comprehensive design system package for **Expo** (`expo-d70910`, registered as `user:expo-dev`), enriched and verified from [expo.dev](https://expo.dev/).

## Structure

- `brand.json` — Single source of truth containing 7 semantic color roles, JetBrains Mono typography tokens, vector logo candidate paths, voice & tone specifications, 8 curated high-res imagery samples, and layout posture constraints.
- `BRAND.md` — Autonomous agent implementation guide detailing color science, contrast ratios, typographic hierarchy, voice pillars, and component rules.
- `DESIGN.md` — Standardized Open Design tokens and frontmatter specifications for rapid UI composition.
- `SKILL.md` — Agent skill definition allowing coding agents to invoke and apply the Expo brand guidelines.
- `brand.html` — Live interactive brand kit preview page showing switchable vector marks, typography specimens, color swatches, voice rules, and imagery gallery.
- `logos/` — Extracted vector SVG wordmark (`header.svg`), exponential icon (`expo-icon.svg`), and platform favicons.
- `imagery/` — 8 curated high-resolution cover, product UI, cloud simulator, and atmospheric ambient assets.
- `system/` — Compiled design tokens (`variables.css`, `variables.dark.css`, `tokens.*.json`) and 6 pre-built application templates (`artifacts/landing.html`, `deck.html`, `poster.html`, `email.html`, `newsletter.html`, `form.html`).

## Commands

- **Preview:** `od brand preview expo-d70910` — Re-renders `brand.html` live.
- **Finalize:** `od brand finalize expo-d70910` — Compiles design tokens and synchronizes registered `user:expo-dev` system.
