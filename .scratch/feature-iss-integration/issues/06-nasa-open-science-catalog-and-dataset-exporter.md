# 06: NASA Open Science Catalog & Dataset Exporter

**What to build:**
A verifiable provenance catalog subview that presents official NASA Open Science Data Repository (OSDR), EDA, RadLab, and LSDA catalog entries with DOI links, flight hardware sensor specifications (CDRA, MCA, TEPC), and a single-click authentic JSON telemetry export utility.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Interactive catalog table displaying official NASA datasets with DOIs, sampling rates, flight missions, and hardware sensors.
- [x] Direct link outs to official NASA visualization platforms and repositories.
- [x] Single-click JSON export generating a standardized telemetry archive file formatted for flight surgeons and ground researchers.
- [x] Rendered as an isolated, clean card with `rounded-[32px]` styling integrated into the Research view.
- [x] Unit tests verify JSON serialization and export payload integrity.
