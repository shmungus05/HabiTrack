"""
scripts/generate_research_embeddings_seed.py: Rebuild the checked-in offline
research embedding seed asset from the curated markdown corpus.

Usage: python scripts/generate_research_embeddings_seed.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from wayfinder.core.embeddings import EMBEDDING_MODEL, embed_text  # noqa: E402
from wayfinder.core.rag import _parse_markdown_doc  # noqa: E402

CORPUS_DIR = REPO_ROOT / "data" / "research_corpus"
SEED_PATH = REPO_ROOT / "data" / "research_embeddings_seed.json"

ARCHETYPES = [
    {
        "archetype_id": "ARCHETYPE_CO2_HYPERCAPNIA_VITAL_SHIFT",
        "description": (
            "Cabin CO2 carbon dioxide excursion hypercapnia coupled with compensatory "
            "tachycardia and autonomic vagal withdrawal"
        ),
    },
    {
        "archetype_id": "ARCHETYPE_AUTONOMIC_WORKOUT_FATIGUE",
        "description": (
            "Elevated heart rate with suppressed HRV RMSSD during strenuous physical "
            "countermeasure workout fatigue"
        ),
    },
    {
        "archetype_id": "ARCHETYPE_THERMAL_ENVIRONMENTAL_STRESS",
        "description": (
            "Cabin thermal temperature excursion with cutaneous vasodilation and mild "
            "sympathetic elevation"
        ),
    },
    {
        "archetype_id": "ARCHETYPE_GENERIC_PHYSIOLOGICAL_EXCURSION",
        "description": (
            "General physiological vital deviation exceeding circadian baseline threshold"
        ),
    },
]


def build_seed_payload() -> dict:
    """Builds the deterministic seed payload from corpus markdown files."""
    chunks = []
    for markdown_path in sorted(CORPUS_DIR.glob("*.md")):
        for index, document in enumerate(_parse_markdown_doc(markdown_path), start=1):
            chunks.append(
                {
                    "chunk_id": f"{document.doc_id}_c{index}",
                    "doc_id": document.doc_id,
                    "title": document.title,
                    "authors": None,
                    "report_identifier": document.doc_id,
                    "section_heading": document.section_heading,
                    "content": document.content,
                    "doi_citation": document.doi_citation,
                    "source_repository": document.source_repository,
                    "embedding": embed_text(document.content).tolist(),
                    "embedding_model": EMBEDDING_MODEL,
                }
            )

    archetypes = [
        {
            "archetype_id": archetype["archetype_id"],
            "description": archetype["description"],
            "embedding": embed_text(archetype["description"]).tolist(),
        }
        for archetype in ARCHETYPES
    ]
    return {"chunks": chunks, "archetypes": archetypes}


def main() -> None:
    """Writes the seed asset and prints a summary."""
    payload = build_seed_payload()
    SEED_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(payload['chunks'])} chunks and "
        f"{len(payload['archetypes'])} archetypes to {SEED_PATH}"
    )


if __name__ == "__main__":
    main()
