from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def snapshot_to_text(snapshot: dict) -> str:
    ohlcv = snapshot.get("ohlcvState", {})
    headlines = snapshot.get("headlines", [])
    headline_text = "; ".join(h.get("title", "") for h in headlines[:3])
    macro = snapshot.get("macro", {})
    alerts = ", ".join(snapshot.get("onChainAlerts", []))
    return (
        f"Asset: {snapshot.get('asset', '')}. "
        f"Close: {ohlcv.get('close', '')}. RSI: {ohlcv.get('rsi', '')}. "
        f"Fear/Greed: {snapshot.get('fearGreedIndex', '')} "
        f"(trend 7d: {snapshot.get('fearGreedTrend7d', '')}). "
        f"Social sentiment: {snapshot.get('socialSentimentScore', '')}. "
        f"Google trends delta: {snapshot.get('googleTrendsDelta', '')}. "
        f"Headlines: {headline_text}. "
        f"Macro BTC dom: {macro.get('btcDominance', '')}. "
        f"On-chain: {alerts}."
    )


def embed_snapshot(snapshot: dict) -> list[float]:
    text = snapshot_to_text(snapshot)
    vector = _get_model().encode(text, normalize_embeddings=True)
    return vector.tolist()


def vector_to_pg(vector: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vector) + "]"
