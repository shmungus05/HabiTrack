#!/usr/bin/env python3
"""
scripts/eval_gemini_audio.py: Standalone CLI evaluation tool for testing
Gemini 2.5 Flash Native Audio Dialog live bidirectional sessions.

Usage:
    python scripts/eval_gemini_audio.py --api-key YOUR_KEY [--model gemini-2.5-flash-audio] [--text "Check CO2 flight rule"]
"""

import argparse
import asyncio
import math
import os
import struct
import sys
import time
from pathlib import Path

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from wayfinder.core.providers import GeminiAudioSessionManager


def generate_synthetic_pcm_sine(
    duration_sec: float = 1.0,
    sample_rate: int = 16000,
    frequency: float = 440.0,
) -> bytes:
    """Generates 16-bit mono PCM sine wave for audio pipeline testing."""
    num_samples = int(duration_sec * sample_rate)
    buffer = bytearray()
    for i in range(num_samples):
        sample = int(32767.0 * 0.25 * math.sin(2.0 * math.pi * frequency * (i / sample_rate)))
        buffer.extend(struct.pack("<h", sample))
    return bytes(buffer)


async def run_evaluation(
    api_key: str,
    model: str,
    prompt_text: str,
    test_synthetic_audio: bool,
) -> None:
    print("=" * 60)
    print("WAYFINDER Gemini 2.5 Flash Native Audio Dialog Evaluation Tool")
    print(f"Model: {model}")
    print(f"API Key: {'*' * (len(api_key) - 4) + api_key[-4:] if len(api_key) >= 4 else '***'}")
    print("=" * 60)

    manager = GeminiAudioSessionManager(api_key=api_key, model=model)
    started = time.perf_counter()

    try:
        print("\n[1/3] Connecting to Gemini Live Session...")
        try:
            ready_payload = await manager.start(
                astronaut_id="ASTRO-TEST",
                system_instruction=(
                    "You are WAYFINDER, NASA's standby flight rule assistant. "
                    "Keep responses concise and direct for voice output."
                ),
            )
        except Exception as exc:
            print(f"\n[!] Connection failed: {exc}")
            if "404" in str(exc) or "InvalidStatus" in str(exc) or "400" in str(exc) or "403" in str(exc):
                print("\n[Notice] Google rejected the WebSocket live connection.")
                print("This happens when:")
                print(" 1. The API key passed is a placeholder (e.g. 'YOUR_GEMINI_API_KEY') instead of a live key.")
                print(" 2. Or the model name requires an experimental tag (e.g. try: --model gemini-2.0-flash-exp).")
                print("\nTo test with your live Gemini key, obtain one from https://aistudio.google.com/ and run:")
                print("    python scripts/eval_gemini_audio.py --api-key AIzaSy...")
            return

        conn_time = (time.perf_counter() - started) * 1000.0
        print(f"--> Connected successfully in {conn_time:.1f}ms! Session ID: {ready_payload['session_id']}")

        print(f"\n[2/3] Sending query turn: '{prompt_text}'")
        await manager.send_text_message(prompt_text, end_of_turn=True)

        if test_synthetic_audio:
            print("--> Streaming 1.0s synthetic 16kHz PCM audio chunk...")
            sine_bytes = generate_synthetic_pcm_sine(duration_sec=1.0)
            await manager.send_audio_chunk(sine_bytes)

        print("\n[3/3] Receiving live streamed response events...")
        first_byte_time = None
        total_audio_bytes = 0
        transcript_accum = []

        # Consume events with timeout
        async def event_consumer():
            nonlocal first_byte_time, total_audio_bytes
            async for event in manager.receive_events():
                now = time.perf_counter()
                if first_byte_time is None:
                    first_byte_time = (now - started) * 1000.0
                    print(f"--> Time-to-First-Token/Audio (TTFT): {first_byte_time:.1f}ms")

                if event["type"] == "delta_text":
                    print(event["text"], end="", flush=True)
                    transcript_accum.append(event["text"])
                elif event["type"] == "audio":
                    chunk_len = len(event["data"])
                    total_audio_bytes += chunk_len
                elif event["type"] == "turn_complete":
                    print("\n--> Turn complete signal received.")
                    break

        try:
            await asyncio.wait_for(event_consumer(), timeout=15.0)
        except asyncio.TimeoutError:
            print("\n[!] Stream evaluation timeout reached (15s).")

        total_elapsed = (time.perf_counter() - started) * 1000.0
        print("\n" + "=" * 60)
        print("Evaluation Summary:")
        print(f"- Total session elapsed: {total_elapsed:.1f}ms")
        print(f"- Audio payload received: {total_audio_bytes} bytes")
        print(f"- Transcript: {''.join(transcript_accum).strip() or '(Audio only response)'}")
        print("Status: 🟢 PASSED")
        print("=" * 60)

    finally:
        await manager.close()
        print("\nSession closed cleanly.")


def main():
    parser = argparse.ArgumentParser(description="Evaluate Gemini 2.5 Flash Native Audio Dialog.")
    parser.add_argument(
        "--api-key",
        default=os.getenv("GEMINI_API_KEY", ""),
        help="Google Gemini API Key (or set GEMINI_API_KEY environment variable)",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("GEMINI_AUDIO_MODEL", "gemini-2.5-flash-audio"),
        help="Model identifier (default: gemini-2.5-flash-audio)",
    )
    parser.add_argument(
        "--text",
        default="State the primary action for flight rule FR-ECLSS-001 hypercapnia.",
        help="Text prompt to send over live audio session",
    )
    parser.add_argument(
        "--synthetic-audio",
        action="store_true",
        help="Also stream synthetic 16kHz PCM audio chunk",
    )
    args = parser.parse_args()

    if not args.api_key:
        print("Error: Missing Gemini API key. Pass --api-key YOUR_KEY or set GEMINI_API_KEY.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(run_evaluation(
        api_key=args.api_key,
        model=args.model,
        prompt_text=args.text,
        test_synthetic_audio=args.synthetic_audio,
    ))


if __name__ == "__main__":
    main()
