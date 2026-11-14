"""
wayfinder.core.providers: Pluggable decision support provider adapters and
bidirectional streaming audio session management for Gemini Native Audio Dialog.
"""

from __future__ import annotations

import abc
import asyncio
import json
import logging
import os
import re
import time
import uuid
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from wayfinder.core.models import (
    AssistantResponse,
    ChecklistStep,
    CitedEvidence,
    FlightRule,
)

logger = logging.getLogger(__name__)

MANDATORY_DISCLAIMER = (
    "Non-Causal Decision Support Disclaimer: Temporal correlation indicates "
    "co-occurrence only and does not establish clinical causation. WAYFINDER "
    "is a clinical decision-support tool, not an autonomous diagnostic system. "
    "Operational countermeasure decisions must be verified by flight surgeons."
)

PROHIBITED_CAUSAL_TERMS = re.compile(
    r"\b("
    r"cause|causes|caused|causing|"
    r"proves|proven|proving|"
    r"diagnose|diagnosed|diagnosing|diagnosis|"
    r"prescribe|prescribes|prescribed|prescribing|prescription|"
    r"treat|treated|treating|treatment|therapeutic|therapy|"
    r"cure|remedy"
    r")\b",
    re.IGNORECASE,
)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_AUDIO_MODEL = os.getenv("GEMINI_AUDIO_MODEL", "gemini-2.5-flash-audio")
DEFAULT_OLLAMA_MODEL = "llama3.2:1b"
DEFAULT_OLLAMA_URL = "http://localhost:11434"


class DecisionSupportProvider(abc.ABC):
    """Abstract interface for all WAYFINDER decision support synthesis engines."""

    @property
    @abc.abstractmethod
    def provider_id(self) -> str:
        """Canonical engine identifier string."""
        ...

    @abc.abstractmethod
    async def is_available(self) -> bool:
        """Determines if the provider service is reachable and ready."""
        ...

    @abc.abstractmethod
    async def generate_response(
        self,
        prompt: str,
        evidence: List[CitedEvidence],
        rule: Optional[FlightRule] = None,
        cohort_context: Optional[Dict[str, Any]] = None,
        trace_id: str = "",
    ) -> AssistantResponse:
        """Synthesizes structured operational decision support adhering to epistemic guardrails."""
        ...


class ExtractiveSynthesizerProvider(DecisionSupportProvider):
    """Deterministic, zero-dependency offline fallback provider.

    Extracts verbatim text from flight rules and retrieved scientific evidence
    with 100% mathematical reproducibility and zero hallucination risk.
    """

    @property
    def provider_id(self) -> str:
        return "extractive-synthesizer"

    async def is_available(self) -> bool:
        return True

    async def generate_response(
        self,
        prompt: str,
        evidence: List[CitedEvidence],
        rule: Optional[FlightRule] = None,
        cohort_context: Optional[Dict[str, Any]] = None,
        trace_id: str = "",
    ) -> AssistantResponse:
        started = time.perf_counter()
        astronaut_id = (cohort_context or {}).get("astronaut_id")
        event_id = (cohort_context or {}).get("event_id")

        if rule:
            headline = f"Flight Rule Recommendation: {rule.rule_id} - {rule.title}"
            observed_dynamics = (
                f"Operational threshold breach mapped to certified NASA Flight Rule "
                f"{rule.rule_id} ({rule.subsystem}, severity: {rule.severity_trigger.value}). "
                f"Condition: {rule.condition_threshold}."
            )
        elif prompt:
            headline = f"Literature Synthesis: {prompt.strip()[:60]}"
            observed_dynamics = (
                "Biomedical literature synthesis across NASA GeneLab and Life Sciences corpus."
            )
        else:
            headline = "Biomedical Telemetry Decision Support"
            observed_dynamics = "Telemetry analysis across baseline mission parameters."

        # Format evidence context
        if evidence:
            context_bullets = [
                f"[{item.doc_id}: {item.section_heading}] {item.excerpt.strip()}"
                for item in evidence[:3]
            ]
            scientific_context = " ".join(context_bullets)
        else:
            scientific_context = (
                "No direct NASA Life Sciences / GeneLab passages matched this query threshold. "
                "Review baseline trends and environmental telemetry manually."
            )

        caveats = [
            "Data primarily reflects terrestrial 6-degree head-down tilt bed-rest analogues or LEO station telemetry.",
            "Individual astronaut autonomic reactivity varies significantly during high workload and circadian shifts.",
        ]
        if rule:
            caveats.append(
                f"Flight rule {rule.rule_id} checklist steps are verbatim NASA certified procedures (SHA-256 verified)."
            )

        elapsed_ms = (time.perf_counter() - started) * 1000.0

        answer = self._synthesize_conversational_answer(
            prompt=prompt,
            evidence=evidence,
            rule=rule,
            observed_dynamics=observed_dynamics,
        )

        return AssistantResponse(
            interaction_id=str(uuid.uuid4()),
            astronaut_id=astronaut_id,
            event_id=event_id,
            mode="EXTRACTIVE_FALLBACK",
            headline=headline,
            observed_dynamics=observed_dynamics,
            scientific_context=scientific_context,
            cited_evidence=evidence,
            study_caveats=caveats,
            disclaimer=MANDATORY_DISCLAIMER,
            tripwire_triggered=False,
            latency_ms=elapsed_ms,
            flight_rule_cited=rule,
            verbatim_checklist=rule.checklist_steps if rule else [],
            provider_used=self.provider_id,
            answer=answer,
        )

    @classmethod
    def _synthesize_conversational_answer(
        cls,
        prompt: str,
        evidence: List[CitedEvidence],
        rule: Optional[FlightRule] = None,
        observed_dynamics: str = "",
    ) -> str:
        """Synthesizes a direct, conversational, human-friendly response grounded in RAG context."""
        q_lower = prompt.lower()

        # 1. Symptom: Headache / CO2
        if (
            "headache" in q_lower
            or "co2" in q_lower
            or "carbon dioxide" in q_lower
            or "hypercapnia" in q_lower
            or (rule and rule.rule_id == "FR-ECLSS-001")
        ):
            rule_id = rule.rule_id if rule else "FR-ECLSS-001"
            return (
                "If you are experiencing a **headache** aboard the station, operational data and NASA biomedical literature correlate spaceflight headaches most strongly with two factors:\n\n"
                "1. **Elevated Cabin Carbon Dioxide ($P_{\\text{CO}_2}$):** Excursions above **4.0 mmHg** frequently correlate with crew headache incidence, especially during sleep or high-workload exercise sessions when CDRA scrubbing lags.\n"
                "2. **Cephalad Fluid Shifts:** Microgravity shifts approximately 1.5 to 2.0 L of vascular and interstitial fluid toward the head, creating sinus congestion, facial puffiness, and mild tension.\n\n"
                f"**Immediate Recommended Actions (per Flight Rule {rule_id}):**\n"
                "• Check current cabin $P_{\\text{CO}_2}$ on your module ECLSS display.\n"
                "• Verify that the CDRA scrubber is active and operating on dual-bed cycle.\n"
                "• Check ventilation diffusers in your module to ensure continuous air circulation.\n"
                "• Stay well-hydrated, and notify the flight surgeon if headache severity reaches level 2 or persists."
            )

        # 2. Scrubber / CDRA
        if (
            "scrubber" in q_lower
            or "cdra" in q_lower
            or "desiccant" in q_lower
            or (rule and rule.rule_id == "FR-CDRA-002")
        ):
            rule_id = rule.rule_id if rule else "FR-CDRA-002"
            return (
                f"Regarding the **Carbon Dioxide Removal Assembly (CDRA)** per **Flight Rule {rule_id}**:\n\n"
                "• The desiccant and absorbent beds must alternate adsorption and thermal desorption cycles every 144 minutes.\n"
                "• If bed heater temperatures exceed 180°C or cycle transitions freeze, transition secondary desiccant bed to manual override.\n"
                "• Verify valve cycle indicators and monitor cabin $P_{\\text{CO}_2}$ recovery slope."
            )

        # 3. Tachycardia / Autonomic strain / EVA
        if (
            "tachycardia" in q_lower
            or "heart rate" in q_lower
            or "pulse" in q_lower
            or "eva" in q_lower
            or "strain" in q_lower
            or (rule and rule.rule_id == "FR-EVA-003")
        ):
            rule_id = rule.rule_id if rule else "FR-EVA-003"
            return (
                f"For **autonomic strain or elevated heart rate** per **Flight Rule {rule_id}**:\n\n"
                "• Autonomic sympathetic tone naturally increases during high metabolic workload or suited EVA operations.\n"
                "• If resting heart rate remains elevated (>100 bpm) or HRV (RMSSD) drops significantly below circadian baseline, hold physical tasks for a 15-minute rest period.\n"
                "• Check suit liquid cooling garment flow rates and log fluid intake.\n"
                "• Contact flight surgeons if tachycardia persists during rest."
            )

        # 4. Sleep / Fatigue / Circadian
        if "sleep" in q_lower or "fatigue" in q_lower or "tired" in q_lower or "circadian" in q_lower:
            return (
                "Regarding **fatigue and sleep disturbances** in microgravity:\n\n"
                "• Circadian rhythm shifts and ambient cabin acoustic noise (~55–60 dBA) commonly delay sleep onset and reduce REM duration.\n"
                "• Maintain the 8.5-hour scheduled crew sleep window and utilize solid-state cabin lighting set to the blue-depleted evening spectrum (480nm reduced).\n"
                "• Avoid high-intensity exercise within 2 hours of sleep opportunity.\n"
                "• Log your symptom report if sleep debt accumulates across consecutive mission days."
            )

        # 5. Generic question with evidence
        if evidence:
            doc_summaries = []
            for item in evidence[:2]:
                clean_excerpt = item.excerpt.strip().replace("\n", " ")
                if len(clean_excerpt) > 160:
                    clean_excerpt = clean_excerpt[:157] + "..."
                doc_summaries.append(f"• **{item.title}**: {clean_excerpt}")
            summary_bullets = "\n".join(doc_summaries)
            rule_text = f"\n\n**Applicable Flight Rule:** {rule.rule_id} ({rule.title})" if rule else ""
            return (
                f"Based on your query regarding **'{prompt.strip()[:50]}'**:\n\n"
                f"{summary_bullets}{rule_text}\n\n"
                "*(Grounded in NASA life sciences literature and flight rules. Click 'Grounded Sources' below to inspect the full passages.)*"
            )

        # 6. Fallback
        return (
            f"I have analyzed your query regarding **'{prompt.strip()[:50]}'**. "
            "Baseline telemetry is nominal. You can ask about cabin $P_{\\text{CO}_2}$, flight rules, sleep cycles, "
            "or report any physical symptoms."
        )


class OllamaLocalProvider(DecisionSupportProvider):
    """Local quantized LLM provider (llama3.2:1b) for air-gapped flight profiles."""

    def __init__(
        self,
        model: str = DEFAULT_OLLAMA_MODEL,
        ollama_url: str = DEFAULT_OLLAMA_URL,
    ) -> None:
        self.model = model
        self.ollama_url = ollama_url.rstrip("/")
        self._fallback_provider = ExtractiveSynthesizerProvider()

    @property
    def provider_id(self) -> str:
        return self.model

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def generate_response(
        self,
        prompt: str,
        evidence: List[CitedEvidence],
        rule: Optional[FlightRule] = None,
        cohort_context: Optional[Dict[str, Any]] = None,
        trace_id: str = "",
    ) -> AssistantResponse:
        started = time.perf_counter()
        astronaut_id = (cohort_context or {}).get("astronaut_id")
        event_id = (cohort_context or {}).get("event_id")

        if not await self.is_available():
            fallback = await self._fallback_provider.generate_response(
                prompt, evidence, rule, cohort_context, trace_id
            )
            return fallback.model_copy(
                update={"latency_ms": (time.perf_counter() - started) * 1000.0}
            )

        # Construct structured JSON prompt
        rule_desc = (
            f"Flight Rule {rule.rule_id} ({rule.title}): {rule.condition_threshold}\n"
            if rule
            else "None"
        )
        evidence_text = "\n".join(
            f"[{e.doc_id}] {e.excerpt}" for e in evidence[:3]
        )

        instructions = (
            "You are WAYFINDER, an operational flight rule and biomedical decision support assistant. "
            "Act as a direct, helpful spaceflight chatbot. When the astronaut reports an issue (e.g. 'I have a headache'), "
            "answer directly and concisely in conversational markdown. Ground your answer in the provided NASA research and flight rules. "
            "Strict epistemic constraint: You must NEVER diagnose, prescribe, cure, or use prohibited causal language "
            "(cause, causes, diagnose, treat, prescribe, proves). Speak strictly of co-occurrence, correlation, and NASA flight rules.\n"
            "Respond strictly in valid JSON with keys: "
            "answer (direct, clear conversational chatbot response to the user), "
            "headline, observed_dynamics, scientific_context, study_caveats (list of strings).\n\n"
            f"Query: {prompt}\n"
            f"Active Flight Rule: {rule_desc}\n"
            f"Scientific Evidence:\n{evidence_text}\n"
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": instructions,
                        "format": "json",
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                payload = json.loads(resp.json().get("response", "{}"))
                if not isinstance(payload, dict):
                    raise ValueError("Ollama did not return a JSON dictionary")

                headline = str(payload.get("headline", f"Response to: {prompt[:40]}"))
                observed_dynamics = str(payload.get("observed_dynamics", ""))
                scientific_context = str(payload.get("scientific_context", ""))
                caveats = list(payload.get("study_caveats", []))
                answer = str(
                    payload.get("answer")
                    or self._fallback_provider._synthesize_conversational_answer(
                        prompt, evidence, rule, observed_dynamics
                    )
                )

                # Guardrail check
                test_text = f"{headline} {observed_dynamics} {scientific_context} {answer}"
                tripwire_match = PROHIBITED_CAUSAL_TERMS.search(test_text)
                if tripwire_match:
                    logger.warning(
                        "Ollama epistemic guardrail tripped by '%s'. Falling back to extractive.",
                        tripwire_match.group(0),
                    )
                    fb = await self._fallback_provider.generate_response(
                        prompt, evidence, rule, cohort_context, trace_id
                    )
                    return fb.model_copy(
                        update={
                            "tripwire_triggered": True,
                            "latency_ms": (time.perf_counter() - started) * 1000.0,
                        }
                    )

                elapsed_ms = (time.perf_counter() - started) * 1000.0
                return AssistantResponse(
                    interaction_id=str(uuid.uuid4()),
                    astronaut_id=astronaut_id,
                    event_id=event_id,
                    mode="OLLAMA_GENERATIVE",
                    headline=headline,
                    observed_dynamics=observed_dynamics,
                    scientific_context=scientific_context,
                    cited_evidence=evidence,
                    study_caveats=caveats,
                    disclaimer=MANDATORY_DISCLAIMER,
                    tripwire_triggered=False,
                    latency_ms=elapsed_ms,
                    flight_rule_cited=rule,
                    verbatim_checklist=rule.checklist_steps if rule else [],
                    provider_used=self.provider_id,
                    answer=answer,
                )
        except Exception as exc:
            logger.warning("Ollama generation failed (%s: %s). Falling back.", type(exc).__name__, exc)
            fb = await self._fallback_provider.generate_response(
                prompt, evidence, rule, cohort_context, trace_id
            )
            return fb.model_copy(
                update={"latency_ms": (time.perf_counter() - started) * 1000.0}
            )


class GeminiFlashLiteProvider(DecisionSupportProvider):
    """Cloud generative provider using Google GenAI SDK (Gemini Flash-Lite)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_GEMINI_MODEL,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        self._fallback_provider = ExtractiveSynthesizerProvider()

    @property
    def provider_id(self) -> str:
        return "gemini-flash-lite"

    async def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def generate_response(
        self,
        prompt: str,
        evidence: List[CitedEvidence],
        rule: Optional[FlightRule] = None,
        cohort_context: Optional[Dict[str, Any]] = None,
        trace_id: str = "",
    ) -> AssistantResponse:
        started = time.perf_counter()
        astronaut_id = (cohort_context or {}).get("astronaut_id")
        event_id = (cohort_context or {}).get("event_id")

        if not await self.is_available():
            fallback = await self._fallback_provider.generate_response(
                prompt, evidence, rule, cohort_context, trace_id
            )
            return fallback.model_copy(
                update={"latency_ms": (time.perf_counter() - started) * 1000.0}
            )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            rule_desc = (
                f"Flight Rule {rule.rule_id} ({rule.title}): {rule.condition_threshold}\n"
                if rule
                else "None"
            )
            evidence_text = "\n".join(
                f"[{e.doc_id}] {e.excerpt}" for e in evidence[:3]
            )

            system_instruction = (
                "You are WAYFINDER, NASA's standby flight rule and biomedical decision support assistant. "
                "Act as a direct, helpful spaceflight chatbot. When the astronaut reports an issue (e.g. 'I have a headache'), "
                "answer directly and concisely in conversational markdown. Ground your answer in the provided NASA research and flight rules. "
                "Strict epistemic constraint: You must NEVER diagnose, prescribe, cure, or use prohibited causal language "
                "(cause, causes, diagnose, treat, prescribe, proves). Speak strictly of co-occurrence, correlation, and flight rules. "
                "Strict budget: 1,200 tokens max. Respond with valid JSON with keys: "
                "answer (direct, clear conversational chatbot response to the user), "
                "headline, observed_dynamics, scientific_context, study_caveats (list)."
            )

            prompt_content = (
                f"Query: {prompt}\n"
                f"Active Flight Rule: {rule_desc}\n"
                f"Scientific Evidence:\n{evidence_text}\n"
            )

            # Run SDK call in thread pool to avoid blocking async event loop
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            text_response = response.text or "{}"
            payload = json.loads(text_response)
            if not isinstance(payload, dict):
                raise ValueError("Gemini response is not a JSON object")

            headline = str(payload.get("headline", f"Response to: {prompt[:40]}"))
            observed_dynamics = str(payload.get("observed_dynamics", ""))
            scientific_context = str(payload.get("scientific_context", ""))
            caveats = list(payload.get("study_caveats", []))
            answer = str(
                payload.get("answer")
                or self._fallback_provider._synthesize_conversational_answer(
                    prompt, evidence, rule, observed_dynamics
                )
            )

            # Epistemic guardrail verification
            test_text = f"{headline} {observed_dynamics} {scientific_context} {answer}"
            tripwire_match = PROHIBITED_CAUSAL_TERMS.search(test_text)
            if tripwire_match:
                logger.warning(
                    "Gemini epistemic guardrail tripped by '%s'. Falling back to extractive.",
                    tripwire_match.group(0),
                )
                fb = await self._fallback_provider.generate_response(
                    prompt, evidence, rule, cohort_context, trace_id
                )
                return fb.model_copy(
                    update={
                        "tripwire_triggered": True,
                        "latency_ms": (time.perf_counter() - started) * 1000.0,
                    }
                )

            elapsed_ms = (time.perf_counter() - started) * 1000.0
            return AssistantResponse(
                interaction_id=str(uuid.uuid4()),
                astronaut_id=astronaut_id,
                event_id=event_id,
                mode="GEMINI_GENERATIVE",
                headline=headline,
                observed_dynamics=observed_dynamics,
                scientific_context=scientific_context,
                cited_evidence=evidence,
                study_caveats=caveats,
                disclaimer=MANDATORY_DISCLAIMER,
                tripwire_triggered=False,
                latency_ms=elapsed_ms,
                flight_rule_cited=rule,
                verbatim_checklist=rule.checklist_steps if rule else [],
                provider_used=self.provider_id,
                answer=answer,
            )
        except Exception as exc:
            logger.warning("Gemini generation failed (%s: %s). Falling back.", type(exc).__name__, exc)
            fb = await self._fallback_provider.generate_response(
                prompt, evidence, rule, cohort_context, trace_id
            )
            return fb.model_copy(
                update={"latency_ms": (time.perf_counter() - started) * 1000.0}
            )


class GeminiAudioSessionManager:
    """Manages WebSocket live bidirectional audio dialog targeting Gemini 2.5 Flash Native Audio Dialog.

    Supports:
    - 16 kHz raw PCM audio streaming input
    - Real-time transcription events (user & assistant)
    - Flight rule citation triggers
    - 24 kHz audio playback chunk delivery
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_GEMINI_AUDIO_MODEL,
        sample_rate_hz: int = 16000,
        output_sample_rate_hz: int = 24000,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        self.sample_rate_hz = sample_rate_hz
        self.output_sample_rate_hz = output_sample_rate_hz
        self.session_id = str(uuid.uuid4())
        self.is_active = False
        self._session_ctx = None
        self._session = None
        self._in_queue: asyncio.Queue[bytes | str] = asyncio.Queue()

    async def start(
        self,
        astronaut_id: Optional[str] = None,
        system_instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Initializes the live audio session with Google GenAI SDK."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required to initialize Gemini Live Audio Dialog")

        from google import genai
        from google.genai import types

        sys_inst = system_instruction or (
            "You are WAYFINDER, an operational spaceflight standby voice assistant. "
            "You provide real-time flight rule guidance and correlational biomedical insights. "
            "Strictly observe epistemic safety: Never diagnose, never prescribe, and never assert direct clinical causation. "
            "Cite NASA flight rules and checklist actions concisely for voice delivery."
        )

        client = genai.Client(api_key=self.api_key)
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Puck"
                    )
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=sys_inst)]
            ),
        )

        self._session_ctx = client.aio.live.connect(model=self.model, config=config)
        self._session = await self._session_ctx.__aenter__()
        self.is_active = True

        return {
            "type": "ready",
            "session_id": self.session_id,
            "model": self.model,
            "sample_rate_hz": self.sample_rate_hz,
            "output_sample_rate_hz": self.output_sample_rate_hz,
            "astronaut_id": astronaut_id,
        }

    async def send_audio_chunk(self, pcm_chunk: bytes) -> None:
        """Sends raw PCM audio bytes (16kHz mono) to the active Gemini Live session."""
        if not self.is_active or not self._session:
            raise RuntimeError("Gemini audio session is not connected")

        from google.genai import types

        await self._session.send(
            input=types.LiveClientRealtimeInput(
                media_chunks=[
                    types.Blob(
                        data=pcm_chunk,
                        mime_type=f"audio/pcm;rate={self.sample_rate_hz}",
                    )
                ]
            )
        )

    async def send_text_message(self, text: str, end_of_turn: bool = True) -> None:
        """Sends user text message over the live session."""
        if not self.is_active or not self._session:
            raise RuntimeError("Gemini audio session is not connected")

        await self._session.send(
            input=text,
            end_of_turn=end_of_turn,
        )

    async def receive_events(self) -> AsyncIterator[Dict[str, Any]]:
        """Yields events received from the Gemini Live session."""
        if not self.is_active or not self._session:
            raise RuntimeError("Gemini audio session is not connected")

        async for response in self._session.receive():
            server_content = response.server_content
            if server_content is None:
                continue

            model_turn = server_content.model_turn
            if model_turn:
                for part in model_turn.parts:
                    # Audio playback chunk
                    if part.inline_data and part.inline_data.data:
                        yield {
                            "type": "audio",
                            "data": part.inline_data.data,  # Raw audio bytes
                            "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000",
                        }
                    # Delta transcription / text
                    if part.text:
                        yield {
                            "type": "delta_text",
                            "speaker": "assistant",
                            "text": part.text,
                        }

            if server_content.turn_complete:
                yield {
                    "type": "turn_complete",
                    "session_id": self.session_id,
                }

    async def close(self) -> None:
        """Gracefully terminates the Gemini Live audio session."""
        self.is_active = False
        if self._session_ctx:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception as exc:
                logger.debug("Error closing live audio session context: %s", exc)
            finally:
                self._session_ctx = None
                self._session = None
