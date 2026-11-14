# Goldfish Annotated Review Report

* **Status:** Resolved
* **Target:** `docs/designs/wayfinder_standby_assistant.md` (`Lines 501–558: DetailedRange`)

## Prioritized Findings & AI Suggestions

### 1. Missing SQLite DDL and Storage Layer for Structured `FlightRule` Records [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L505-L508](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L505-L508), [#L542](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L542), [#L545](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L545)
* **Discrepancy Description:** Task 1 requires seeding flight rules into `wayfinder.db` and Section 4 describes loading verified flight rules directly from SQLite. However, no table DDL schema is defined for `flight_rules`, leaving the implementer to invent table columns, data types, and JSON serialization.
* **Rationale:** Violates the Zero-Decision Rule. All database structures must be pre-determined.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Define the authoritative DDL in `wayfinder/core/storage.py` and document explicit `StorageManager` CRUD methods (`insert_flight_rule`, `get_flight_rule`, `list_flight_rules`).
* ***Proposed Edit:***
  * Location: `### 9. Storage, Database Schema Migration & Seeding` and `Task 1/Task 2`.
  * Change: Add DDL:
    ```sql
    CREATE TABLE IF NOT EXISTS flight_rules (
        rule_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subsystem TEXT NOT NULL,
        revision_date TEXT NOT NULL,
        severity_trigger TEXT NOT NULL CHECK(severity_trigger IN ('INFO', 'OBSERVE', 'INVESTIGATE', 'EMERGENCY')),
        condition_threshold TEXT NOT NULL,
        verbatim_text TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        checklist_steps_json TEXT NOT NULL,
        reference_docs_json TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_flight_rules_subsystem ON flight_rules(subsystem);
    CREATE INDEX IF NOT EXISTS idx_flight_rules_severity ON flight_rules(severity_trigger);
    ```

---

### 2. Omission of Flight Rule Ingestion into FTS5 Index (`research_knowledge_fts`) [`egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L509-L511](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L509-L511), [#L544](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L544)
* **Discrepancy Description:** `VectorStoreManager` uses hybrid RRF combining dense cosine similarity with lexical BM25 (`_search_bm25`). BM25 executes queries strictly against the SQLite FTS5 table `research_knowledge_fts`. If flight rules are only inserted into `research_vectors` and not `research_knowledge_fts`, BM25 search will return 0 matches for flight rule keyword queries, crippling hybrid retrieval.
* **Rationale:** A core functional failure for text-based flight rule lookups.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Flight rule sections must be ingested into both the vector matrix and the SQLite FTS5 table with `source_repository = 'NASA Flight Rules'`.
* ***Proposed Edit:***
  * Location: Tasks 1 & 2 (`Flight Rules Knowledge Base Ingestion` & `Hybrid Vector Store Extension`).
  * Change: Explicitly specify parsing flight rules into `ResearchDocument` records and inserting them into `research_knowledge_fts` alongside `research_vectors`.

---

### 3. Complete Omission of `wayfinder/core/models.py` from File Implementation Matrix [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L516-L518](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L516-L518), [#L535-L558](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L535-L558)
* **Discrepancy Description:** `wayfinder/core/models.py` is the central domain schema file defining `AssistantResponse`, `AssistantAuditLog`, and `VectorEmbeddingRecord`. It must be modified to support the new backward-compatible flight rule fields and provider telemetry, but it was completely omitted from the File Enumeration table.
* **Rationale:** An engineer following the file list would omit core domain model changes, causing immediate Pydantic validation failures.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Add `wayfinder/core/models.py` to the table as `Modified` and enumerate exact field additions.
* ***Proposed Edit:***
  * Location: `Detailed Implementation Plan` -> File Enumeration Table and Task List.
  * Change: Add row for `wayfinder/core/models.py` with explicit descriptions of `AssistantResponse`, `AssistantAuditLog`, `AssistantQueryRequest`, and `ProviderStatusResponse`.

---

### 4. SQLite `CHECK` Constraint Collision on `assistant_audit_logs.generation_mode` [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L518](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L518), [#L545](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L545)
* **Discrepancy Description:** Existing `wayfinder.db` databases enforce `CHECK(generation_mode IN ('OLLAMA_GENERATIVE', 'EXTRACTIVE_FALLBACK'))`. SQLite `ALTER TABLE` cannot modify existing column check constraints. Inserting `'GEMINI_GENERATIVE'` into `generation_mode` causes an unrecoverable `sqlite3.IntegrityError`.
* **Rationale:** Must maintain 100% database compatibility without breaking existing data files.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Retain `generation_mode` mapped to `"OLLAMA_GENERATIVE" | "EXTRACTIVE_FALLBACK"` (identifying the generative vs extractive paradigm), while recording the specific runtime engine (`"gemini-2.5-flash-audio"`, `"gemini-flash-lite"`, `"llama3.2:1b"`) strictly in the newly added `provider_used TEXT` column.
* ***Proposed Edit:***
  * Location: Section 6 and Task 4.
  * Change: Document exact mapping preserving the CHECK constraint on legacy databases.

---

### 5. Incomplete Audit Persistence Updates in `StorageManager` and Route Handler [`egm-codebase-details`] - Severity: Major
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L518](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L518), [#L545](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L545), [#L547](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L547)
* **Discrepancy Description:** Adding columns to `assistant_audit_logs` does not update `StorageManager.insert_assistant_audit_log` or `_persist_audit_log()` in `routes/assistant.py`.
* **Rationale:** The new audit columns would never be populated.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Update `StorageManager.insert_assistant_audit_log` to parameterize and insert all 7 new columns, and update `_persist_audit_log` to pass them from `AssistantResponse`.
* ***Proposed Edit:***
  * Location: Task 4 and Table rows for `storage.py` and `routes/assistant.py`.
  * Change: Explicitly specify updating the persistence methods.

---

### 6. Missing `wayfinder/provision.py` & Routing Fix for WebSocket (`WS /api/assistant/ws/audio`) [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L468](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L468), [#L520](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L520), [#L535-L558](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L535-L558)
* **Discrepancy Description:** `python -m wayfinder.provision` must invoke `seed_flight_rules()` during mission provisioning. Also, mounting WebSocket under `wayfinder/api/routes/assistant.py` (which has prefix `/api/assistant`) requires standardizing the path to `WS /api/assistant/ws/audio` to avoid route conflicts with `server.py`'s SPA fallback.
* **Rationale:** Clean routing and unified provisioning.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Add `wayfinder/provision.py` (Modified) to the file table, and standardize WebSocket URL to `WS /api/assistant/ws/audio`.
* ***Proposed Edit:***
  * Location: Task 5, File Enumeration table, and Section 3.5.
  * Change: Add `provision.py` and standardize route to `WS /api/assistant/ws/audio`.

---

### 7. Phasing Inversion: Schema Migration Scheduled After Seeding [`egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** Tasks 1 & 2 ([docs/designs/wayfinder_standby_assistant.md#L505-L511](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L505-L511))
* **Discrepancy Description:** Task 1 attempts to insert flight rules into `wayfinder.db` before Task 2 applies the SQLite schema migrations, which causes immediate `sqlite3.OperationalError` (table does not exist).
* **Rationale:** Tasks must execute in a buildable, testable chronological order.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Reorder phases so database schema migrations (DDL additions to `storage.py`) precede flight rule ingestion and seeding.
* ***Proposed Edit:***
  * Location: `1. Implementation Task List`.
  * Change: Swap execution order: Step 1 = Database Schema Preparation; Step 2 = Flight Rule Parsing & Seeding.

---

### 8. Concrete Specifications for Provider ABC and Fast-Path Latching [`egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L508](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L508), [#L513-L514](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L513-L514)
* **Discrepancy Description:** Abstract methods for `DecisionSupportProvider` and the threshold mapping dictionary for fast-path latching are left undefined.
* **Rationale:** Violates the Zero-Decision Rule.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Specify the abstract interface (`provider_id`, `is_available()`, `generate_response()`), decouple `GeminiAudioSessionManager` for streaming, and define `EVENT_SIGNATURE_TO_RULE_MAP`.
* ***Proposed Edit:***
  * Location: Tasks 1 & 3.
  * Change: Document exact signatures and threshold mapping dictionary.

---

### 9. Route Collision Clarification on `POST /query` & Client `queryAssistant` [`egm-codebase-details`] - Severity: Major
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L520](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L520), [#L547](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L547), [#L549](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L549)
* **Discrepancy Description:** `POST /api/assistant/query` and `queryAssistant()` in `api.ts` already exist and are consumed by `ResearchView.tsx`. Describing them as new files/endpoints causes route collision confusion.
* **Rationale:** Refactoring existing code must be explicitly framed as an extension to avoid breaking consumers.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Specify *refactoring/extending* existing `POST /api/assistant/query` and `queryAssistant` while preserving backward compatibility with `ResearchView.tsx`.
* ***Proposed Edit:***
  * Location: Task 5 and Table rows 547 & 549.
  * Change: Change "Add" to "Refactor/Extend".

---

### 10. Test Fixture Sharing in `tests/conftest.py` & Explicit Test Cases [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** [docs/designs/wayfinder_standby_assistant.md#L528-L532](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L528-L532), [#L558](file:///D:/nasaResearch/docs/designs/wayfinder_standby_assistant.md#L558)
* **Discrepancy Description:** `api_client` is defined inside `tests/test_api.py`, not `tests/conftest.py`, which causes `FixtureLookupError` when creating `tests/test_assistant_v4.py`. Test scenarios lack concrete test case names.
* **Rationale:** Test suites must run cleanly out-of-the-box.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Move `api_client` fixture to `tests/conftest.py` and enumerate concrete test case names.
* ***Proposed Edit:***
  * Location: Task 7 and File table row for `tests/conftest.py`.
  * Change: Add `tests/conftest.py` (Modified: promote `api_client` fixture) and enumerate test cases.

---

### 11. Technical Style, Typography & Latency Target Reconciliation [`egm-style`] - Severity: Nit
* **Affected Scope:** Lines 503, 506, 511, 521, 524, 527, 529, 535, 545, 555, 556
* **Discrepancy Description:** Filler headings ("Unified", "Comprehensive"), LaTeX in task lists (`$P_{\text{CO}_2}$`), vague placeholders ("etc."), and conflicting latency bounds (`<1ms` unit vs `<50ms` end-to-end).
* **Rationale:** Consistent, clean engineering copy.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Apply all 13 copy edits from the style audit.
* ***Proposed Edit:***
  * Location: Throughout `DetailedRange`.
  * Change: Apply copy edits.
