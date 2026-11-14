"""
wayfinder.core.rag: Offline research corpus indexing and SQLite FTS5 BM25 retrieval.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import json
import re
import sqlite3
import threading
import urllib.request
import urllib.error

import numpy as np

from wayfinder.core.embeddings import EMBEDDING_DIMENSION, embed_text
from wayfinder.core.models import CitedEvidence, ResearchDocument
from wayfinder.core.storage import StorageManager


def _parse_markdown_doc(file_path: Path) -> List[ResearchDocument]:
    """Parses a markdown document into structured sections with metadata."""
    text = file_path.read_text(encoding="utf-8")
    
    doc_id = file_path.stem
    title = file_path.stem.replace("_", " ").title()
    doi = None
    repo = "NASA Spaceflight Research"

    # Extract frontmatter if present
    content_body = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            content_body = parts[2]
            for line in fm_text.splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    key = key.strip().lower()
                    val = val.strip()
                    if key == "doc_id":
                        doc_id = val
                    elif key == "title":
                        title = val
                    elif key == "doi":
                        doi = val
                    elif key == "source_repository":
                        repo = val

    # Split into sections by '## '
    sections: List[ResearchDocument] = []
    heading_regex = re.compile(r"^##\s+(.+)$", re.MULTILINE)
    splits = heading_regex.split(content_body)

    if len(splits) <= 1:
        # No subsections, insert entire body
        body_clean = content_body.strip()
        if body_clean:
            sections.append(
                ResearchDocument(
                    doc_id=doc_id,
                    title=title,
                    section_heading="Overview",
                    content=body_clean,
                    doi_citation=doi,
                    source_repository=repo,
                )
            )
    else:
        # splits: [intro_text, heading1, content1, heading2, content2, ...]
        intro = splits[0].strip()
        if intro:
            sections.append(
                ResearchDocument(
                    doc_id=doc_id,
                    title=title,
                    section_heading="Introduction",
                    content=intro,
                    doi_citation=doi,
                    source_repository=repo,
                )
            )
        for i in range(1, len(splits), 2):
            heading = splits[i].strip()
            body = splits[i + 1].strip() if i + 1 < len(splits) else ""
            if body:
                sections.append(
                    ResearchDocument(
                        doc_id=doc_id,
                        title=title,
                        section_heading=heading,
                        content=body,
                        doi_citation=doi,
                        source_repository=repo,
                    )
                )

    return sections


def index_research_corpus(corpus_dir: Union[str, Path], storage_manager: StorageManager) -> int:
    """Indexes all markdown files in corpus_dir into SQLite FTS5 research_knowledge_fts table."""
    c_dir = Path(corpus_dir)
    if not c_dir.exists():
        raise FileNotFoundError(f"Research corpus directory not found: {corpus_dir}")

    all_docs: List[ResearchDocument] = []
    for md_file in c_dir.glob("*.md"):
        all_docs.extend(_parse_markdown_doc(md_file))

    with storage_manager.get_connection() as conn:
        conn.execute("DELETE FROM research_knowledge_fts WHERE source_repository != 'NASA Flight Rules';")
        for doc in all_docs:
            conn.execute(
                """
                INSERT INTO research_knowledge_fts (doc_id, title, section_heading, content, doi_citation, source_repository)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (doc.doc_id, doc.title, doc.section_heading, doc.content, doc.doi_citation, doc.source_repository),
            )
    return len(all_docs)


def _sanitize_fts_query(query: str) -> str:
    """Sanitizes user input for SQLite FTS5 query."""
    # Remove FTS5 control characters and hyphens, then quote each token so
    # identifiers such as EVT-API-CO2 cannot be parsed as column filters.
    clean = re.sub(r'[^\w\s]', ' ', query)
    tokens = [t.strip() for t in clean.split() if t.strip()]
    if not tokens:
        return '""'
    return " OR ".join(f'"{token}"' for token in tokens)


def search_knowledge(
    query: str,
    storage_manager: StorageManager,
    max_results: int = 3,
) -> List[ResearchDocument]:
    """
    Searches the offline research corpus using SQLite FTS5 BM25 ranking.
    Returns top matching ResearchDocument models.
    """
    fts_query = _sanitize_fts_query(query)
    if not fts_query or fts_query == '""':
        return []

    results: List[ResearchDocument] = []
    with storage_manager.get_connection() as conn:
        try:
            rows = conn.execute(
                """
                SELECT doc_id, title, section_heading, content, doi_citation, source_repository
                FROM research_knowledge_fts
                WHERE research_knowledge_fts MATCH ?
                ORDER BY rank
                LIMIT ?;
                """,
                (fts_query, max_results),
            ).fetchall()
            for r in rows:
                results.append(ResearchDocument(**dict(r)))
        except Exception:
            # Fallback to LIKE if FTS expression fails
            like_term = f"%{query.strip()}%"
            rows = conn.execute(
                """
                SELECT doc_id, title, section_heading, content, doi_citation, source_repository
                FROM research_knowledge_fts
                WHERE content LIKE ? OR title LIKE ?
                LIMIT ?;
                """,
                (like_term, like_term, max_results),
            ).fetchall()
            for r in rows:
                results.append(ResearchDocument(**dict(r)))

    return results


def synthesize_with_ollama(
    query: str,
    retrieved_docs: List[ResearchDocument],
    base_url: str = "http://localhost:11434",
    timeout_sec: float = 3.0,
) -> Optional[str]:
    """
    Optional zero-config hook to synthesize retrieved literature cards with local Ollama.
    Returns None immediately if Ollama is unreachable, maintaining pure offline autonomy.
    """
    if not retrieved_docs:
        return None

    context_snippets = "\n\n".join(
        [f"[{doc.title} - {doc.section_heading}]:\n{doc.content}" for doc in retrieved_docs]
    )

    prompt = (
        f"You are the WAYFINDER Spaceflight Health Support Assistant. Answer the question using strictly "
        f"the provided NASA research context below. Include relevant citations. Do not make clinical diagnosis.\n\n"
        f"Context:\n{context_snippets}\n\n"
        f"Question: {query}\n\nAnswer:"
    )

    payload = json.dumps({
        "model": "llama3.2:1b",
        "prompt": prompt,
        "stream": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response")
    except Exception:
        # Graceful zero-failure fallback
        return None


# --- V3: In-process matrix vector store and calibrated hybrid RRF retrieval ---

RRF_RANK_CONSTANT = 60.0


class VectorStoreManager:
    """Thread-safe in-memory cache over the persisted research embedding matrix."""

    def __init__(self, storage_manager: StorageManager):
        self.storage_manager = storage_manager
        self.lock = threading.Lock()
        self.corpus_matrix = np.empty((0, EMBEDDING_DIMENSION), dtype=np.float32)
        self.chunk_ids: List[str] = []
        self._rows_by_chunk_id: Dict[str, sqlite3.Row] = {}
        self._rows_by_key: Dict[Tuple[str, str], sqlite3.Row] = {}
        self.reload_corpus()

    def reload_corpus(self) -> None:
        """Rebuilds the contiguous normalized matrix from SQLite BLOBs."""
        rows = self.storage_manager.list_all_vector_chunks()
        with self.lock:
            if not rows:
                self.corpus_matrix = np.empty((0, EMBEDDING_DIMENSION), dtype=np.float32)
                self.chunk_ids = []
                self._rows_by_chunk_id = {}
                self._rows_by_key = {}
                return

            raw_matrix = np.vstack(
                [np.frombuffer(row["embedding"], dtype=np.float32) for row in rows]
            )
            norms = np.linalg.norm(raw_matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.corpus_matrix = (raw_matrix / norms).astype(np.float32)
            self.chunk_ids = [row["chunk_id"] for row in rows]
            self._rows_by_chunk_id = {row["chunk_id"]: row for row in rows}
            self._rows_by_key = {
                (row["doc_id"], row["section_heading"]): row for row in rows
            }

    def search_dense(
        self, query_vector: np.ndarray, top_k: int = 5, corpus_type: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """Returns top-K chunk IDs by dot-product cosine similarity, optionally filtered by corpus_type."""
        if top_k <= 0 or self.corpus_matrix.shape[0] == 0:
            return []

        query = np.asarray(query_vector, dtype=np.float32).reshape(-1)
        if query.shape[0] != self.corpus_matrix.shape[1]:
            return []

        norm = float(np.linalg.norm(query))
        if norm == 0.0:
            return []
        query_norm = (query / np.float32(norm)).astype(np.float32)

        scores = self.corpus_matrix.dot(query_norm)

        # Apply corpus_type filtering if specified
        if corpus_type is not None:
            def _get_corpus_type(cid: str) -> str:
                row = self._rows_by_chunk_id.get(cid)
                if row is None:
                    return "RESEARCH"
                if "corpus_type" in row.keys():
                    return row["corpus_type"] or "RESEARCH"
                return "RESEARCH"

            valid_mask = np.array([
                _get_corpus_type(cid) == corpus_type
                for cid in self.chunk_ids
            ], dtype=bool)
            scores[~valid_mask] = -np.inf

        limit = min(top_k, scores.shape[0])
        if limit < scores.shape[0]:
            candidate_indices = np.argpartition(scores, -limit)[-limit:]
        else:
            candidate_indices = np.arange(scores.shape[0])
        ranked_indices = candidate_indices[np.argsort(scores[candidate_indices])[::-1]]

        results = []
        for index in ranked_indices:
            score_val = float(scores[int(index)])
            if score_val == -np.inf:
                continue
            results.append((self.chunk_ids[int(index)], score_val))
            if len(results) >= top_k:
                break
        return results

    def _search_bm25(
        self, query_text: str, top_k: int, corpus_type: Optional[str] = None
    ) -> List[sqlite3.Row]:
        """Returns top-K research vector rows ranked by FTS5 BM25, optionally filtered by corpus_type."""
        fts_query = _sanitize_fts_query(query_text)
        if not fts_query or fts_query == '""' or top_k <= 0:
            return []

        with self.storage_manager.get_connection() as conn:
            try:
                rows = conn.execute(
                    """
                    SELECT doc_id, section_heading
                    FROM research_knowledge_fts
                    WHERE research_knowledge_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?;
                    """,
                    (fts_query, top_k * 4),
                ).fetchall()
            except sqlite3.OperationalError:
                return []

        matched: List[sqlite3.Row] = []
        for row in rows:
            vector_row = self._rows_by_key.get((row["doc_id"], row["section_heading"]))
            if vector_row is None:
                continue
            if corpus_type is not None:
                row_type = vector_row["corpus_type"] if "corpus_type" in vector_row.keys() else "RESEARCH"
                if row_type != corpus_type:
                    continue
            matched.append(vector_row)
            if len(matched) >= top_k:
                break
        return matched

    @staticmethod
    def _to_cited_evidence(row: sqlite3.Row, rrf_score: float, relevance_pct: float) -> CitedEvidence:
        return CitedEvidence(
            chunk_id=row["chunk_id"],
            doc_id=row["doc_id"],
            title=row["title"],
            authors=row["authors"],
            report_identifier=row["report_identifier"],
            section_heading=row["section_heading"],
            doi_citation=row["doi_citation"],
            source_repository=row["source_repository"] or "NASA Life Sciences",
            excerpt=row["content"],
            rrf_score=float(rrf_score),
            relevance_pct=float(max(0.0, min(100.0, relevance_pct))),
        )

    def search_hybrid_rrf(
        self,
        query_text: str,
        query_vector: Optional[np.ndarray] = None,
        top_k: int = 5,
        corpus_type: Optional[str] = None,
    ) -> Tuple[List[CitedEvidence], str]:
        """Fuses dense cosine and BM25 rankings with calibrated RRF percentages, supporting corpus_type filtering."""
        if top_k <= 0:
            return [], "LEXICAL_BM25"

        bm25_rows = self._search_bm25(query_text, top_k, corpus_type=corpus_type)
        dense_results: List[Tuple[str, float]] = []
        if query_vector is not None and self.corpus_matrix.shape[0] > 0:
            dense_results = self.search_dense(query_vector, top_k=top_k, corpus_type=corpus_type)

        active_modalities = 0
        if bm25_rows:
            active_modalities += 1
        if dense_results:
            active_modalities += 1

        if active_modalities == 0:
            return [], "DENSE_COSINE" if query_vector is not None else "LEXICAL_BM25"

        rrf_scores: Dict[str, float] = {}
        rows_by_chunk: Dict[str, sqlite3.Row] = {}

        for rank, row in enumerate(bm25_rows, start=1):
            chunk_id = row["chunk_id"]
            rows_by_chunk[chunk_id] = row
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (
                RRF_RANK_CONSTANT + rank
            )

        for rank, (chunk_id, _score) in enumerate(dense_results, start=1):
            row = self._rows_by_chunk_id.get(chunk_id)
            if row is None:
                continue
            rows_by_chunk[chunk_id] = row
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (
                RRF_RANK_CONSTANT + rank
            )

        rrf_max = active_modalities / (RRF_RANK_CONSTANT + 1.0)
        ordered = sorted(
            rrf_scores.items(),
            key=lambda item: (-item[1], rows_by_chunk[item[0]]["doc_id"], item[0]),
        )

        evidence = [
            self._to_cited_evidence(
                rows_by_chunk[chunk_id],
                rrf_score=score,
                relevance_pct=(score / rrf_max) * 100.0 if rrf_max else 0.0,
            )
            for chunk_id, score in ordered[:top_k]
        ]

        if bm25_rows and dense_results:
            mode = "HYBRID_RRF"
        elif dense_results:
            mode = "DENSE_COSINE"
        else:
            mode = "LEXICAL_BM25"
        return evidence, mode
