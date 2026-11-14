"""
tests/test_flight_rules.py: Unit tests for Markdown flight rules parser,
SHA-256 cryptographic verification, fast-path threshold latching, and dual-index seeding.
"""

import time
from pathlib import Path
import pytest
import sqlite3

from wayfinder.core.flight_rules import (
    DEFAULT_FLIGHT_RULES_DIR,
    parse_markdown_flight_rule,
    parse_flight_rule_text,
    resolve_latch_rule_id,
    seed_flight_rules,
)
from wayfinder.core.models import SeverityTrigger


def test_parse_valid_frontmatter_and_checklist():
    """TICK-02: Verifies parsing authentic Markdown flight rules."""
    rule_path = Path(DEFAULT_FLIGHT_RULES_DIR) / "FR_ECLSS_001_hypercapnia.md"
    assert rule_path.exists(), f"Missing flight rule file: {rule_path}"

    rule = parse_markdown_flight_rule(rule_path)
    assert rule.rule_id == "FR-ECLSS-001"
    assert "Carbon Dioxide" in rule.title
    assert rule.subsystem == "ECLSS / CDRA"
    assert rule.revision_date == "2026-04-15"
    assert rule.severity_trigger == SeverityTrigger.INVESTIGATE
    assert "P_CO2 >= 4.0 mmHg" in rule.condition_threshold
    assert len(rule.checklist_steps) == 4

    step1 = rule.checklist_steps[0]
    assert step1.step_number == 1
    assert "DUAL-BED HIGH-FLOW" in step1.action
    assert step1.target_subsystem == "CDRA-ECLSS"
    assert step1.verification is not None
    assert "CDRA_STATE" in step1.verification
    assert step1.caution_warning is not None
    assert "V12" in step1.caution_warning

    assert len(rule.reference_docs) == 2
    assert "NASA-STD-3001 Vol 2" in rule.reference_docs
    assert len(rule.sha256_hash) == 64


def test_tampered_rule_hash_mismatch():
    """TICK-02: Verifies that SHA-256 hash strictly changes if body content is altered."""
    original_text = """---
rule_id: "FR-TEST-001"
title: "Test Rule"
subsystem: "TEST"
revision_date: "2026-01-01"
severity_trigger: "INFO"
---
# Original Body
Step 1: Check Valve
"""
    tampered_text = """---
rule_id: "FR-TEST-001"
title: "Test Rule"
subsystem: "TEST"
revision_date: "2026-01-01"
severity_trigger: "INFO"
---
# Original Body
Step 1: Check Valve TAMPERED
"""
    rule_orig = parse_flight_rule_text(original_text)
    rule_tampered = parse_flight_rule_text(tampered_text)

    assert rule_orig.sha256_hash != rule_tampered.sha256_hash


def test_fast_path_threshold_latching_sub_millisecond():
    """TICK-02: Verifies deterministic latching from telemetry anomaly signatures in <0.2ms."""
    # Hypercapnia CO2 signature
    rule_co2 = resolve_latch_rule_id("HYPERCAPNIA", ["stream_eda_co2"])
    assert rule_co2 == "FR-ECLSS-001"

    # CDRA thermal cycling signature
    rule_cdra = resolve_latch_rule_id("CDRA_CYCLING_ANOMALY", ["stream_eda_co2", "stream_eda_temp"])
    assert rule_cdra == "FR-CDRA-002"

    # Autonomic strain HR/HRV signature
    rule_eva = resolve_latch_rule_id("AUTONOMIC_STRAIN", ["stream_sim_hr", "stream_sim_hrv"])
    assert rule_eva == "FR-EVA-003"

    # Environmental spike concordance co-occurrence
    rule_concordance = resolve_latch_rule_id("ENVIRONMENTAL_SPIKE_COOCCURRENCE", ["stream_eda_co2", "stream_sim_hr"])
    assert rule_concordance == "FR-ECLSS-001"

    # Benchmark: 10,000 resolutions complete in <50ms
    start = time.perf_counter()
    for _ in range(10000):
        resolve_latch_rule_id("HYPERCAPNIA", ["stream_eda_co2"])
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    assert elapsed_ms < 50.0, f"Latching benchmark exceeded SLA: {elapsed_ms:.2f} ms"


def test_seed_flight_rules_idempotence(temp_db):
    """TICK-02: Verifies idempotent seeding into SQLite flight_rules, FTS5, and vectors."""
    count1 = seed_flight_rules(temp_db)
    assert count1 == 3

    # Verify structured flight_rules table
    rules = temp_db.list_flight_rules()
    assert len(rules) == 3
    rule_ids = {r.rule_id for r in rules}
    assert rule_ids == {"FR-ECLSS-001", "FR-CDRA-002", "FR-EVA-003"}

    # Verify FTS5 indexing
    with temp_db.get_connection() as conn:
        fts_rows = conn.execute(
            "SELECT doc_id, title, section_heading FROM research_knowledge_fts WHERE source_repository = 'NASA Flight Rules';"
        ).fetchall()
        assert len(fts_rows) == 3  # 1 entry per rule

        # Test BM25 keyword matching
        fts_match = conn.execute(
            "SELECT doc_id FROM research_knowledge_fts WHERE research_knowledge_fts MATCH 'hypercapnia';"
        ).fetchall()
        assert any(row["doc_id"] == "FR-ECLSS-001" for row in fts_match)

        # Verify research_vectors indexing
        vec_rows = conn.execute(
            "SELECT chunk_id, rule_id, corpus_type, sha256_hash FROM research_vectors WHERE corpus_type = 'FLIGHT_RULE';"
        ).fetchall()
        assert len(vec_rows) == 3
        assert all(row["corpus_type"] == "FLIGHT_RULE" for row in vec_rows)
        assert all(row["sha256_hash"] is not None for row in vec_rows)

    # Re-seed to verify idempotency (no duplicate entries)
    count2 = seed_flight_rules(temp_db)
    assert count2 == 3

    with temp_db.get_connection() as conn:
        total_rules = conn.execute("SELECT COUNT(*) as c FROM flight_rules;").fetchone()["c"]
        total_fts = conn.execute("SELECT COUNT(*) as c FROM research_knowledge_fts WHERE source_repository = 'NASA Flight Rules';").fetchone()["c"]
        total_vec = conn.execute("SELECT COUNT(*) as c FROM research_vectors WHERE corpus_type = 'FLIGHT_RULE';").fetchone()["c"]

    assert total_rules == 3
    assert total_fts == 3
    assert total_vec == 3
