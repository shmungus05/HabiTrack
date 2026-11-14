"""
wayfinder.core.assistant: Evidence-grounded knowledge assistant, canonical event
archetype resolution, deterministic extractive synthesis, and epistemic guardrails.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional

import httpx
import numpy as np

from wayfinder.core.embeddings import EMBEDDING_DIMENSION, embed_text
from wayfinder.core.flight_rules import resolve_latch_rule_id
from wayfinder.core.models import (
    AssistantAuditLog,
    AssistantResponse,
    CitedEvidence,
    FlightRule,
    HealthEvent,
    ProviderStatusResponse,
)
from wayfinder.core.providers import (
    DecisionSupportProvider,
    ExtractiveSynthesizerProvider,
    GeminiFlashLiteProvider,
    OllamaLocalProvider,
)
from wayfinder.core.storage import StorageManager

if TYPE_CHECKING:
    from wayfinder.core.rag import VectorStoreManager

DEFAULT_EMBEDDING_MODEL = "all-minilm"
DEFAULT_GENERATIVE_MODEL = "llama3.2:1b"

MANDATORY_DISCLAIMER = (
    "Non-Causal Decision Support Disclaimer: Temporal correlation indicates "
    "co-occurrence only and does not establish clinical causation. WAYFINDER "
    "is a clinical decision-support tool, not an autonomous diagnostic system. "
    "Operational countermeasure decisions must be verified by flight surgeons."
)

PROHIBITED_CAUSAL_TERMS = re.compile(
    r"\b(cause|causes|caused|causing|proves|proven|proving|diagnose|diagnosed|"
    r"diagnosing|diagnosis|prescribe|prescribes|prescribed|prescribing|prescription|"
    r"treat|treated|treating|treatment|therapeutic|therapy|cure|remedy)\b",
    re.IGNORECASE,
)

ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT = "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT"
ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE = "ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE"
ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS = "ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS"
ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION = (
    "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION"
)

_STREAM_PATTERN = re.compile(r"stream_[a-z0-9_]+")


def extract_contributing_streams(contributing_stream_ids: str) -> set[str]:
    """Tokenizes comma-separated or legacy JSON-array stream identifiers safely."""
    return set(_STREAM_PATTERN.findall(contributing_stream_ids or ""))


def resolve_archetype_id(event: HealthEvent) -> str:
    """Deterministically maps a HealthEvent to a canonical event archetype."""
    streams = extract_contributing_streams(event.contributing_stream_ids)

    if "stream_eda_co2" in streams and (
        "stream_sim_hr" in streams or "stream_sim_hrv" in streams
    ):
        return ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT
    if "stream_sim_hr" in streams and "stream_sim_hrv" in streams:
        return ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE
    if "stream_eda_temp" in streams:
        return ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS
    return ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION


def get_archetype_vector(storage: StorageManager, archetype_id: str) -> np.ndarray:
    """Loads a canonical archetype embedding as a 384-d float32 query vector."""
    with storage.get_connection() as conn:
        row = conn.execute(
            "SELECT embedding FROM event_archetype_vectors WHERE archetype_id = ? LIMIT 1;",
            (archetype_id,),
        ).fetchone()

    if row is None:
        logging.warning("Archetype vector %s is missing; using deterministic fallback.", archetype_id)
        return embed_text(archetype_id.replace("_", " "))

    vector = np.frombuffer(row["embedding"], dtype=np.float32)
    if vector.shape != (EMBEDDING_DIMENSION,):
        logging.warning(
            "Archetype vector %s has unexpected shape %s; using deterministic fallback.",
            archetype_id,
            vector.shape,
        )
        return embed_text(archetype_id.replace("_", " "))
    return np.ascontiguousarray(vector, dtype=np.float32)


class ExtractiveResearchSynthesizer:
    """Deterministic zero-dependency fallback synthesizer for evidence responses."""

    @staticmethod
    def synthesize_for_event(
        event: HealthEvent,
        evidence: List[CitedEvidence],
        astronaut_id: Optional[str] = None,
        tripwire_triggered: bool = False,
        latency_ms: float = 0.0,
    ) -> AssistantResponse:
        """Builds a structured response for a 1-click event explanation."""
        headline = f"Scientific Evidence Context: {event.event_type.replace('_', ' ').title()}"

        streams_list = sorted(extract_contributing_streams(event.contributing_stream_ids))
        peak_sigma = getattr(event, "peak_deviation_sigma", None)
        sigma_text = (
            f" Max deviation reached {peak_sigma:.2f} sigma against circadian baseline."
            if peak_sigma is not None
            else ""
        )
        observed_dynamics = (
            f"Observed concordance event across {len(streams_list)} telemetry streams "
            f"({', '.join(streams_list)}). Rationale: {event.rationale}{sigma_text}"
        )

        scientific_context = ExtractiveResearchSynthesizer._format_context(evidence)
        caveats = ExtractiveResearchSynthesizer._build_caveats(evidence)

        return AssistantResponse(
            interaction_id=str(uuid.uuid4()),
            astronaut_id=astronaut_id,
            event_id=event.event_id,
            mode="EXTRACTIVE_FALLBACK",
            headline=headline,
            observed_dynamics=observed_dynamics,
            scientific_context=scientific_context,
            cited_evidence=evidence,
            study_caveats=caveats,
            disclaimer=MANDATORY_DISCLAIMER,
            tripwire_triggered=tripwire_triggered,
            latency_ms=latency_ms,
        )

    @staticmethod
    def synthesize_for_query(
        query: str,
        evidence: List[CitedEvidence],
        astronaut_id: Optional[str] = None,
        tripwire_triggered: bool = False,
        latency_ms: float = 0.0,
    ) -> AssistantResponse:
        """Builds a structured response for an ad-hoc literature exploration query."""
        headline = f"Literature Synthesis: {query.strip()[:60]}"
        observed_dynamics = (
            "Ad-hoc biomedical literature exploration query across NASA GeneLab "
            "and Life Sciences corpus."
        )
        scientific_context = ExtractiveResearchSynthesizer._format_context(evidence)
        caveats = ExtractiveResearchSynthesizer._build_caveats(evidence)

        return AssistantResponse(
            interaction_id=str(uuid.uuid4()),
            astronaut_id=astronaut_id,
            event_id=None,
            mode="EXTRACTIVE_FALLBACK",
            headline=headline,
            observed_dynamics=observed_dynamics,
            scientific_context=scientific_context,
            cited_evidence=evidence,
            study_caveats=caveats,
            disclaimer=MANDATORY_DISCLAIMER,
            tripwire_triggered=tripwire_triggered,
            latency_ms=latency_ms,
        )

    @staticmethod
    def _format_context(evidence: List[CitedEvidence]) -> str:
        if not evidence:
            return (
                "No direct NASA Life Sciences / GeneLab passages matched this query "
                "threshold. Review baseline trends and environmental telemetry manually."
            )
        context_bullets = [
            f"[{item.doc_id}: {item.section_heading}] {item.excerpt.strip()}"
            for item in evidence[:3]
        ]
        return " ".join(context_bullets)

    @staticmethod
    def _build_caveats(evidence: List[CitedEvidence]) -> List[str]:
        caveats = [
            "Data primarily reflects terrestrial 6-degree head-down tilt bed-rest analogues or LEO station telemetry.",
            "Individual astronaut autonomic reactivity varies significantly during high workload and circadian shifts.",
        ]
        for item in evidence[:2]:
            excerpt_lower = item.excerpt.lower()
            if "bed-rest" in excerpt_lower or "bed rest" in excerpt_lower:
                caveats.append(
                    f"Caveat for {item.doc_id}: Terrestrial bed-rest study; fluid redistribution "
                    "kinetics differ from free microgravity."
                )
        return caveats


def apply_epistemic_guardrail(
    headline: str,
    observed_dynamics: str,
    scientific_context: str,
    cited_evidence: List[CitedEvidence],
    study_caveats: List[str],
    astronaut_id: Optional[str],
    event_id: Optional[str],
    latency_ms: float,
    fallback_generator: Callable[[], AssistantResponse],
) -> AssistantResponse:
    """Intercepts prohibited causal/clinical language in generated narrative fields.

    Verbatim literature excerpts in ``cited_evidence`` are exempt: the guardrail
    governs the model's own synthesis, not quoted source attribution.
    """
    test_text = f"{headline} {observed_dynamics} {scientific_context}"
    if PROHIBITED_CAUSAL_TERMS.search(test_text):
        logging.warning(
            "Epistemic guardrail triggered: prohibited causal terms detected in "
            "generative output. Falling back to extractive synthesis."
        )
        fallback = fallback_generator()
        return fallback.model_copy(update={"tripwire_triggered": True})

    return AssistantResponse(
        interaction_id=str(uuid.uuid4()),
        astronaut_id=astronaut_id,
        event_id=event_id,
        mode="OLLAMA_GENERATIVE",
        headline=headline,
        observed_dynamics=observed_dynamics,
        scientific_context=scientific_context,
        cited_evidence=cited_evidence,
        study_caveats=study_caveats,
        disclaimer=MANDATORY_DISCLAIMER,
        tripwire_triggered=False,
        latency_ms=latency_ms,
    )


async def is_ollama_available(ollama_url: str = "http://localhost:11434") -> bool:
    """Asynchronously probes Ollama availability with a strict 1.5s timeout."""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            response = await client.get(f"{ollama_url.rstrip('/')}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


async def query_generative_assistant(
    prompt: str,
    evidence: List[CitedEvidence],
    event: Optional[HealthEvent] = None,
    astronaut_id: Optional[str] = None,
    model: str = DEFAULT_GENERATIVE_MODEL,
    ollama_url: str = "http://localhost:11434",
) -> AssistantResponse:
    """Calls local Ollama with fast-fail probe, JSON validation, and guardrails."""
    start_time = time.monotonic()

    def _fallback(tripwire: bool = False) -> AssistantResponse:
        latency_ms = (time.monotonic() - start_time) * 1000.0
        if event is not None:
            return ExtractiveResearchSynthesizer.synthesize_for_event(
                event=event,
                evidence=evidence,
                astronaut_id=astronaut_id,
                tripwire_triggered=tripwire,
                latency_ms=latency_ms,
            )
        return ExtractiveResearchSynthesizer.synthesize_for_query(
            query=prompt,
            evidence=evidence,
            astronaut_id=astronaut_id,
            tripwire_triggered=tripwire,
            latency_ms=latency_ms,
        )

    if not await is_ollama_available(ollama_url):
        return _fallback(tripwire=False)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{ollama_url.rstrip('/')}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                },
            )
            response.raise_for_status()
            parsed = json.loads(response.json().get("response", "{}"))
            if not isinstance(parsed, dict):
                raise ValueError("Ollama JSON response is not an object.")
            latency_ms = (time.monotonic() - start_time) * 1000.0

            return apply_epistemic_guardrail(
                headline=str(parsed.get("headline", "")),
                observed_dynamics=str(parsed.get("observed_dynamics", "")),
                scientific_context=str(parsed.get("scientific_context", "")),
                cited_evidence=evidence,
                study_caveats=list(parsed.get("study_caveats", [])),
                astronaut_id=astronaut_id,
                event_id=event.event_id if event is not None else None,
                latency_ms=latency_ms,
                fallback_generator=lambda: _fallback(tripwire=True),
            )
    except (
        json.JSONDecodeError,
        KeyError,
        TypeError,
        ValueError,
        httpx.HTTPError,
    ) as exc:
        logging.warning(
            "Generative LLM unavailable or malformed response (%s: %s). "
            "Falling back to extractive synthesis.",
            type(exc).__name__,
            exc,
        )
        return _fallback(tripwire=False)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class AssistantManager:
    """Orchestrates multi-provider decision support, fast-path rule latching,
    epistemic guardrails, and persistent audit logging.
    """

    def __init__(
        self,
        storage: Optional[StorageManager] = None,
        vector_store: Optional[VectorStoreManager] = None,
        gemini_provider: Optional[DecisionSupportProvider] = None,
        ollama_provider: Optional[DecisionSupportProvider] = None,
        extractive_provider: Optional[DecisionSupportProvider] = None,
    ) -> None:
        self.storage = storage
        self.vector_store = vector_store
        self.gemini_provider = gemini_provider or GeminiFlashLiteProvider()
        self.ollama_provider = ollama_provider or OllamaLocalProvider()
        self.extractive_provider = extractive_provider or ExtractiveSynthesizerProvider()

    async def get_active_provider(self) -> DecisionSupportProvider:
        """Selects provider according to priority: Gemini -> Ollama -> Extractive."""
        if await self.gemini_provider.is_available():
            return self.gemini_provider
        if await self.ollama_provider.is_available():
            return self.ollama_provider
        return self.extractive_provider

    async def get_provider_status(self) -> ProviderStatusResponse:
        active = await self.get_active_provider()
        gemini_avail = await self.gemini_provider.is_available()
        ollama_avail = await self.ollama_provider.is_available()
        if active.provider_id == "gemini-flash-lite":
            model_name = "Gemini 2.5 Flash Native Audio Dialog / Flash-Lite"
        elif "llama" in active.provider_id.lower():
            model_name = "Llama 3.2 1B (Local)"
        else:
            model_name = "Extractive Deterministic Synthesizer"

        return ProviderStatusResponse(
            active_provider=active.provider_id,
            gemini_available=gemini_avail,
            ollama_available=ollama_avail,
            gemini_audio_testing_enabled=gemini_avail,
            active_model_name=model_name,
        )

    async def execute_query(
        self,
        query: str,
        astronaut_id: Optional[str] = None,
        concordance_event_id: Optional[str] = None,
        top_k: int = 5,
        trace_id: Optional[str] = None,
        rule_id: Optional[str] = None,
        stt_confidence: Optional[float] = None,
        stt_duration_sec: Optional[float] = None,
    ) -> AssistantResponse:
        started = time.perf_counter()
        tid = trace_id or str(uuid.uuid4())
        latched_rule: Optional[FlightRule] = None

        # Conversational Greeting Handler: Don't dump random research papers for simple greetings
        greeting_regex = re.compile(
            r"^(hello|hi|hey|yo|greetings|howdy|good\s+(morning|afternoon|evening)|who\s+are\s+you)[\s!.]*$",
            re.IGNORECASE,
        )
        if greeting_regex.match(query.strip()):
            greeting_text = (
                "Hello! I am WAYFINDER, your operational flight rule and biomedical decision support assistant.\n\n"
                "You can tell me about any symptoms you're experiencing (for example, *'I have a headache'* or *'feeling fatigued'*), "
                "ask about cabin environmental telemetry, or query certified NASA flight rules and procedural checklists."
            )
            return AssistantResponse(
                interaction_id=str(uuid.uuid4()),
                astronaut_id=astronaut_id,
                event_id=concordance_event_id,
                mode="EXTRACTIVE_FALLBACK",
                headline="WAYFINDER Standby Assistant",
                observed_dynamics="Standby operational greeting.",
                scientific_context="Decision support system operational.",
                cited_evidence=[],
                study_caveats=[],
                disclaimer=MANDATORY_DISCLAIMER,
                tripwire_triggered=False,
                latency_ms=(time.perf_counter() - started) * 1000.0,
                answer=greeting_text,
                provider_used="extractive-synthesizer",
            )

        # Stage 1: Deterministic fast-path rule latching (<1ms in-memory lookup)
        if rule_id and self.storage:
            latched_rule = self.storage.get_flight_rule(rule_id)
        elif concordance_event_id and self.storage:
            event = self.storage.get_health_event(concordance_event_id)
            if event:
                streams = extract_contributing_streams(event.contributing_stream_ids)
                matched_id = resolve_latch_rule_id(event.event_type, streams)
                if matched_id:
                    latched_rule = self.storage.get_flight_rule(matched_id)

        # Symptom-to-Rule semantic latching if rule not explicitly latched
        if not latched_rule and self.storage:
            q_lower = query.lower()
            if any(k in q_lower for k in ("headache", "co2", "carbon dioxide", "hypercapnia", "stuffy", "air quality")):
                latched_rule = self.storage.get_flight_rule("FR-ECLSS-001")
            elif any(k in q_lower for k in ("scrubber", "cdra", "desiccant", "sorbent", "valve", "filter")):
                latched_rule = self.storage.get_flight_rule("FR-CDRA-002")
            elif any(k in q_lower for k in ("tachycardia", "heart rate", "pulse", "eva", "strain", "spacewalk", "palpitations")):
                latched_rule = self.storage.get_flight_rule("FR-EVA-003")

        # Stage 2: Hybrid RRF retrieval across flight rules & research papers
        evidence: List[CitedEvidence] = []
        retrieval_mode = "HYBRID_RRF"
        if self.vector_store:
            query_vector = embed_text(query)
            evidence, retrieval_mode = self.vector_store.search_hybrid_rrf(
                query, query_vector, top_k=top_k
            )

        # Provider synthesis
        cohort_context = {
            "astronaut_id": astronaut_id,
            "event_id": concordance_event_id,
        }
        active_provider = await self.get_active_provider()
        response = await active_provider.generate_response(
            prompt=query,
            evidence=evidence,
            rule=latched_rule,
            cohort_context=cohort_context,
            trace_id=tid,
        )

        # Epistemic guardrail verification
        test_text = f"{response.headline} {response.observed_dynamics} {response.scientific_context}"
        tripwire_match = PROHIBITED_CAUSAL_TERMS.search(test_text)
        tripwire_term: Optional[str] = None
        if tripwire_match:
            tripwire_term = tripwire_match.group(0)
            logging.warning(
                "AssistantManager epistemic guardrail tripped by '%s'. Falling back to extractive.",
                tripwire_term,
            )
            fallback = await self.extractive_provider.generate_response(
                prompt=query,
                evidence=evidence,
                rule=latched_rule,
                cohort_context=cohort_context,
                trace_id=tid,
            )
            response = fallback.model_copy(
                update={
                    "tripwire_triggered": True,
                    "latency_ms": (time.perf_counter() - started) * 1000.0,
                }
            )

        if response.disclaimer != MANDATORY_DISCLAIMER:
            response = response.model_copy(update={"disclaimer": MANDATORY_DISCLAIMER})

        # Stage 3: Observability & audit log persistence
        if self.storage:
            cited_doc_ids = sorted({item.doc_id for item in response.cited_evidence})
            # Respect SQLite CHECK(generation_mode IN ('OLLAMA_GENERATIVE', 'EXTRACTIVE_FALLBACK'))
            gen_mode = (
                "OLLAMA_GENERATIVE"
                if response.mode in ("OLLAMA_GENERATIVE", "GEMINI_GENERATIVE")
                else "EXTRACTIVE_FALLBACK"
            )
            log = AssistantAuditLog(
                log_id=str(uuid.uuid4()),
                trace_id=tid,
                event_id=concordance_event_id,
                astronaut_id=astronaut_id,
                query_text=query,
                retrieval_mode=retrieval_mode,
                generation_mode=gen_mode,
                response_text=f"{response.headline}\n{response.observed_dynamics}\n{response.scientific_context}",
                cited_doc_ids=json.dumps(cited_doc_ids),
                tripwire_triggered=response.tripwire_triggered,
                tripwire_match_term=tripwire_term,
                latency_ms=response.latency_ms,
                flight_rule_cited=latched_rule.rule_id if latched_rule else None,
                rule_sha256=latched_rule.sha256_hash if latched_rule else None,
                stt_confidence=stt_confidence,
                stt_duration_sec=stt_duration_sec,
                provider_used=response.provider_used or active_provider.provider_id,
                created_at=_utc_now_iso(),
            )
            try:
                self.storage.insert_assistant_audit_log(log)
            except Exception as exc:
                logging.warning("Failed to persist assistant audit log: %s", exc)

        return response
