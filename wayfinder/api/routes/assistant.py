"""
wayfinder.api.routes.assistant: Contextual evidence explanation, flight rule catalog,
decision support provider status, and live audio dialog WebSocket.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from wayfinder.api.deps import get_storage, get_vector_store
from wayfinder.core.assistant import (
    AssistantManager,
    extract_contributing_streams,
    get_archetype_vector,
    query_generative_assistant,
    resolve_archetype_id,
)
from wayfinder.core.embeddings import embed_text
from wayfinder.core.flight_rules import resolve_latch_rule_id
from wayfinder.core.models import (
    AssistantAuditLog,
    AssistantQueryRequest,
    AssistantResponse,
    CitedEvidence,
    ExplainEventRequest,
    FlightRule,
    HealthEvent,
    ProviderStatusResponse,
)
from wayfinder.core.providers import GeminiAudioSessionManager
from wayfinder.core.rag import VectorStoreManager
from wayfinder.core.storage import StorageManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

TOP_K_EVIDENCE = 5


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _require_astronaut(storage: StorageManager, astronaut_id: str) -> None:
    """Rejects assistant requests for unregistered crew members.

    Audit rows carry a foreign key to ``astronauts``; validating up front turns
    what would be a database integrity error into a clean 404.
    """
    if storage.get_astronaut(astronaut_id) is None:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")


def _build_event_prompt(event: HealthEvent, evidence: list[CitedEvidence]) -> str:
    context = "\n\n".join(
        f"[{item.doc_id}: {item.section_heading}] {item.excerpt}" for item in evidence
    )
    return (
        "You are the WAYFINDER spaceflight clinical decision-support assistant. "
        "Summarize only temporal co-occurrence and cite the supplied NASA literature. "
        "Do not make clinical assertions or use causal/intervention verbs. Return a JSON "
        "object with keys headline, observed_dynamics, scientific_context, study_caveats.\n\n"
        f"Event: {event.event_type} for {event.astronaut_id}\n"
        f"Contributing streams: {event.contributing_stream_ids}\n"
        f"Rationale: {event.rationale}\n"
        f"Peak deviation sigma: {getattr(event, 'peak_deviation_sigma', None)}\n\n"
        f"Evidence:\n{context}\n"
    )


def _persist_audit_log(
    storage: StorageManager,
    *,
    event_id: str | None,
    astronaut_id: str | None,
    query_text: str,
    retrieval_mode: str,
    response: AssistantResponse,
) -> None:
    cited_doc_ids = sorted({item.doc_id for item in response.cited_evidence})
    gen_mode = (
        "OLLAMA_GENERATIVE"
        if response.mode in ("OLLAMA_GENERATIVE", "GEMINI_GENERATIVE")
        else "EXTRACTIVE_FALLBACK"
    )
    log = AssistantAuditLog(
        log_id=str(uuid.uuid4()),
        event_id=event_id,
        astronaut_id=astronaut_id,
        query_text=query_text,
        retrieval_mode=retrieval_mode if retrieval_mode in ("HYBRID_RRF", "LEXICAL_BM25", "DENSE_COSINE") else "HYBRID_RRF",
        generation_mode=gen_mode,
        response_text=(
            f"{response.headline}\n{response.observed_dynamics}\n{response.scientific_context}"
        ),
        cited_doc_ids=json.dumps(cited_doc_ids),
        tripwire_triggered=response.tripwire_triggered,
        latency_ms=response.latency_ms,
        flight_rule_cited=response.flight_rule_cited.rule_id if response.flight_rule_cited else None,
        rule_sha256=response.flight_rule_cited.sha256_hash if response.flight_rule_cited else None,
        provider_used=response.provider_used,
        created_at=_utc_now_iso(),
    )
    storage.insert_assistant_audit_log(log)


@router.post("/explain", response_model=AssistantResponse)
async def explain_event(
    request: ExplainEventRequest,
    storage: StorageManager = Depends(get_storage),
    vector_store: VectorStoreManager = Depends(get_vector_store),
) -> AssistantResponse:
    """Explains an active health event with cited NASA literature in one click."""
    _require_astronaut(storage, request.astronaut_id)
    event = storage.get_health_event(request.event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event {request.event_id} not found")
    if event.astronaut_id != request.astronaut_id:
        raise HTTPException(status_code=404, detail=f"Event {request.event_id} not found")

    archetype_id = resolve_archetype_id(event)
    query_vector = get_archetype_vector(storage, archetype_id)
    query_text = (
        f"Explain event {event.event_id}: {event.event_type} ({event.rationale})"
    )
    retrieval_text = f"{query_text} {archetype_id.replace('_', ' ')}"
    evidence, retrieval_mode = vector_store.search_hybrid_rrf(
        retrieval_text, query_vector, top_k=TOP_K_EVIDENCE
    )

    streams = extract_contributing_streams(event.contributing_stream_ids)
    rule_id = resolve_latch_rule_id(event.event_type, streams)
    flight_rule = storage.get_flight_rule(rule_id) if rule_id else None

    response = await query_generative_assistant(
        prompt=_build_event_prompt(event, evidence),
        evidence=evidence,
        event=event,
        astronaut_id=request.astronaut_id,
    )

    if flight_rule:
        response = response.model_copy(
            update={
                "flight_rule_cited": flight_rule,
                "verbatim_checklist": flight_rule.checklist_steps,
            }
        )

    _persist_audit_log(
        storage,
        event_id=event.event_id,
        astronaut_id=request.astronaut_id,
        query_text=query_text,
        retrieval_mode=retrieval_mode,
        response=response,
    )
    return response


@router.post("/query", response_model=AssistantResponse)
async def query_assistant(
    request: AssistantQueryRequest,
    storage: StorageManager = Depends(get_storage),
    vector_store: VectorStoreManager = Depends(get_vector_store),
) -> AssistantResponse:
    """Runs hybrid RRF over the embedded corpus and synthesizes an evidence and flight rule response."""
    query_text = request.query.strip()
    if not query_text:
        raise HTTPException(status_code=422, detail="Query text must not be empty.")
    if request.astronaut_id is not None:
        _require_astronaut(storage, request.astronaut_id)

    assistant_mgr = AssistantManager(storage=storage, vector_store=vector_store)
    return await assistant_mgr.execute_query(
        query=query_text,
        astronaut_id=request.astronaut_id,
        concordance_event_id=request.concordance_event_id,
        top_k=request.top_k,
    )


@router.get("/rules", response_model=List[FlightRule])
def list_flight_rules(
    subsystem: Optional[str] = None,
    severity: Optional[str] = None,
    storage: StorageManager = Depends(get_storage),
) -> List[FlightRule]:
    """Catalog of certified flight rules with optional subsystem and severity filters."""
    return storage.list_flight_rules(subsystem=subsystem, severity=severity)


@router.get("/rules/{rule_id}", response_model=FlightRule)
def get_flight_rule(
    rule_id: str,
    storage: StorageManager = Depends(get_storage),
) -> FlightRule:
    """Fast-path lookup for a verified NASA flight rule by canonical ID (<1 ms latency)."""
    rule = storage.get_flight_rule(rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail=f"Flight rule '{rule_id}' not found")
    return rule


@router.get("/provider-status", response_model=ProviderStatusResponse)
async def get_provider_status(
    storage: StorageManager = Depends(get_storage),
) -> ProviderStatusResponse:
    """Returns runtime readiness and availability of all decision support engines."""
    mgr = AssistantManager(storage=storage)
    return await mgr.get_provider_status()


@router.websocket("/ws/audio")
async def websocket_audio_dialog(
    websocket: WebSocket,
):
    """Developer evaluation WebSocket for Gemini 2.5 Flash Native Audio Dialog live bidirectional sessions."""
    await websocket.accept()
    manager: Optional[GeminiAudioSessionManager] = None
    try:
        init_frame = await websocket.receive_json()
        if init_frame.get("type") != "init":
            await websocket.send_json({"type": "error", "message": "First frame must be type: 'init'"})
            await websocket.close()
            return

        api_key = init_frame.get("api_key") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            await websocket.send_json({"type": "error", "message": "Missing GEMINI_API_KEY"})
            await websocket.close()
            return

        model = init_frame.get("model") or os.getenv("GEMINI_AUDIO_MODEL", "gemini-2.5-flash-audio")
        sample_rate_hz = int(init_frame.get("sample_rate_hz", 16000))
        astronaut_id = init_frame.get("astronaut_id")

        manager = GeminiAudioSessionManager(
            api_key=api_key,
            model=model,
            sample_rate_hz=sample_rate_hz,
        )

        ready_payload = await manager.start(astronaut_id=astronaut_id)
        await websocket.send_json(ready_payload)

        # Handle bidirectional message exchange
        async def client_receiver():
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    await manager.send_audio_chunk(message["bytes"])
                elif "text" in message and message["text"]:
                    data = json.loads(message["text"])
                    if data.get("type") == "text_query":
                        await manager.send_text_message(data.get("text", ""))
                    elif data.get("type") == "close":
                        break

        async def server_sender():
            async for event in manager.receive_events():
                if event.get("type") == "audio":
                    await websocket.send_bytes(event["data"])
                else:
                    await websocket.send_json(event)

        receiver_task = asyncio.create_task(client_receiver())
        sender_task = asyncio.create_task(server_sender())

        done, pending = await asyncio.wait(
            [receiver_task, sender_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        if manager:
            await manager.close()
        try:
            await websocket.close()
        except Exception:
            pass
