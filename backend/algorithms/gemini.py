"""Gemini API wrapper.

Embeddings: direct HTTP `embedContent` (avoids SDK's batchEmbedContents).
Generation: google-genai SDK for judge_qa_pair.
Fallback:   deterministic local hash-embedding when API is unavailable.
"""
import asyncio
import hashlib
import logging
import time

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# Internal embedding dimension (must be consistent across the whole pipeline).
EMBEDDING_DIM = 768

_GEN_MODEL = "gemini-2.0-flash"
_MIN_INTERVAL = 1.0   # ≥1 s between requests → ≤60 req/min
_last_request_time = 0.0

# Candidate (api_version, model_name) pairs tried in order
_EMBED_CANDIDATES = [
    ("v1beta", "gemini-embedding-2"),
    ("v1beta", "gemini-embedding-2-preview"),
    ("v1beta", "gemini-embedding-001"),
]

_embed_api_key: str = ""
_gen_client = None


def _api_key() -> str:
    global _embed_api_key
    if not _embed_api_key:
        from config import settings
        _embed_api_key = settings.gemini_api_key
    return _embed_api_key


def _get_gen_client():
    global _gen_client
    if _gen_client is None:
        try:
            from google import genai
            _gen_client = genai.Client(api_key=_api_key())
        except Exception as e:
            logger.error(f"Gemini gen client init failed: {e}")
    return _gen_client


async def _rate_limit():
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if elapsed < _MIN_INTERVAL:
        await asyncio.sleep(_MIN_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def _local_embed(text: str) -> np.ndarray:
    """Deterministic character-trigram hash embedding (dim=EMBEDDING_DIM)."""
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    text = text.lower()
    for i in range(max(1, len(text) - 2)):
        gram = text[i:i + 3]
        h = int(hashlib.sha256(gram.encode()).hexdigest(), 16)
        vec[h % EMBEDDING_DIM] += 1.0
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _resize(vec: np.ndarray) -> np.ndarray:
    """Resize a vector to EMBEDDING_DIM by truncation or zero-padding."""
    if vec.shape[0] == EMBEDDING_DIM:
        return vec
    if vec.shape[0] > EMBEDDING_DIM:
        return vec[:EMBEDDING_DIM]
    padded = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    padded[:vec.shape[0]] = vec
    return padded


async def _try_embed_http(text: str) -> np.ndarray | None:
    """Call embedContent REST endpoint directly (bypasses SDK batchEmbedContents)."""
    key = _api_key()
    if not key:
        return None

    async with httpx.AsyncClient(timeout=20.0) as client:
        for api_ver, model in _EMBED_CANDIDATES:
            url = (
                f"https://generativelanguage.googleapis.com"
                f"/{api_ver}/models/{model}:embedContent"
                f"?key={key}"
            )
            body = {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text or " "}]},
                "outputDimensionality": EMBEDDING_DIM,
            }
            try:
                resp = await client.post(url, json=body)
                if resp.status_code == 200:
                    values = resp.json()["embedding"]["values"]
                    vec = np.array(values, dtype=np.float32)
                    norm = np.linalg.norm(vec)
                    if norm > 0:
                        vec = vec / norm
                    logger.debug(f"Embed OK: {api_ver}/{model} dim={len(values)}")
                    return _resize(vec)
                else:
                    logger.warning(f"Embed {api_ver}/{model}: HTTP {resp.status_code} – {resp.text[:200]}")
            except Exception as e:
                logger.warning(f"Embed {api_ver}/{model}: {e}")

    return None


async def embed(text: str) -> np.ndarray:
    await _rate_limit()
    vec = await _try_embed_http(text)
    if vec is not None:
        return vec
    logger.warning("All Gemini embed attempts failed – using local hash embedding")
    return _local_embed(text)


async def embed_batch(texts: list[str]) -> list[np.ndarray]:
    return [await embed(t) for t in texts]


async def judge_qa_pair(
    author_a: str, content_a: str, timestamp_a: str,
    author_b: str, content_b: str, timestamp_b: str,
) -> bool:
    client = _get_gen_client()
    if client is None:
        return False

    from google.genai import types

    system = (
        "あなたはチャットメッセージの関係性を判定するアナリストです。"
        "以下の2つのメッセージが「質問と回答の対応関係」にあるかどうかを判定してください。"
        "必ず \"true\" または \"false\" のみを返答してください。"
    )
    prompt = (
        f"[メッセージA（質問候補）]\n送信者: {author_a}\n内容: {content_a}\n送信時刻: {timestamp_a}\n\n"
        f"[メッセージB（回答候補）]\n送信者: {author_b}\n内容: {content_b}\n送信時刻: {timestamp_b}\n\n"
        "これらは質問と回答の対応関係にありますか？"
    )

    for attempt in range(3):
        try:
            await _rate_limit()
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=_GEN_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0.0,
                    max_output_tokens=10,
                ),
            )
            return response.text.strip().lower().startswith("true")
        except Exception as e:
            wait = 2 ** attempt
            logger.warning(f"Gemini judge attempt {attempt + 1} failed: {e}. Retry in {wait}s")
            await asyncio.sleep(wait)

    return False
