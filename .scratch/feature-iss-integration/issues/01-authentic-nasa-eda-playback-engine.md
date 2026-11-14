# 01: Authentic NASA EDA Telemetry Stream & Playback Engine

**What to build:**
An end-to-end telemetry playback subsystem that loads authentic ISS Expedition 71/72 flight telemetry records and streams them via a deterministic ticker state machine. Astronauts and Flight Surgeons can play, pause, scrub through time, and adjust playback rate (1x, 2x, 5x). The UI presents the active environmental metrics alongside a 10-point rolling sparkline window, styled in a minimalist Perplexity aesthetic with rounded-[32px] containers and font-black headings.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Bundled authentic NASA EDA flight telemetry dataset (180+ sequential records) is loaded offline without network latency.
- [x] Telemetry stream exposes current CO2 (in PPM and mmHg), temperature (°C), relative humidity (%), and radiation rate (mGy/day).
- [x] Playback controller supports play, pause, seek (via scrubber slider), and speed switching (1x, 2x, 5x) without interval drift or memory leaks.
- [x] Rolling 10-point moving-window sparklines update dynamically as records advance.
- [x] Component is rendered with a high-contrast `rounded-[32px]` container, font-black title, and subtle micro-animations.
- [x] Unit tests verify timer mechanics, boundary clamping at the start/end of the record list, and looping behavior.
