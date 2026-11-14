"""
wayfinder.core.embeddings: Deterministic offline 384-dimensional text embeddings.

This module provides the single shared text encoder used for the bundled seed
corpus, canonical event archetypes, and query-time vectorization. It is a
dependency-free (NumPy only) deterministic stand-in for the pinned ``all-minilm``
embedding contract: document vectors are produced offline and must stay stable
across processes and machines, so a token-hashing bag-of-words encoder is used
instead of downloading a model or requiring a GPU.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import List

import numpy as np

EMBEDDING_DIMENSION = 384
EMBEDDING_MODEL = "all-minilm"

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
_MIN_TOKEN_LENGTH = 2


def _tokenize(text: str) -> List[str]:
    """Tokenizes text into lowercase alphanumeric unigrams and bigrams."""
    unigrams = [
        token
        for token in _TOKEN_PATTERN.findall(text.lower())
        if len(token) >= _MIN_TOKEN_LENGTH
    ]
    bigrams = [f"{left}_{right}" for left, right in zip(unigrams, unigrams[1:])]
    return unigrams + bigrams


def _hash_token(token: str) -> tuple[int, float]:
    """Maps a token to a deterministic bucket index and sign."""
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:8], "little") % EMBEDDING_DIMENSION
    sign = 1.0 if digest[8] & 1 else -1.0
    return bucket, sign


def embed_text(text: str) -> np.ndarray:
    """Encodes text as an L2-normalized contiguous 384-d float32 vector.

    The encoder is deterministic: identical input always yields identical bytes.
    Unigrams carry full term-frequency weight; adjacent bigrams carry half weight
    so phrase overlap improves ranking without dominating single-term matches.
    """
    vector = np.zeros(EMBEDDING_DIMENSION, dtype=np.float32)
    tokens = _tokenize(text or "")
    if not tokens:
        return vector

    counts = Counter(tokens)

    for token, count in counts.items():
        bucket, sign = _hash_token(token)
        weight = 1.0 + math.log(count)
        if "_" in token:
            weight *= 0.5
        vector[bucket] += np.float32(sign * weight)

    norm = float(np.linalg.norm(vector))
    if norm > 0.0:
        vector = vector / np.float32(norm)
    return np.ascontiguousarray(vector, dtype=np.float32)
