"""Seed market_events from historical OHLCV for RAG retrieval on deploy."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.db import execute, fetch_all
from ml_service.model.features import compute_indicators
from ml_service.model.xgboost_predictor import load_ohlcv
from ml_service.rag.embedder import embed_snapshot, vector_to_pg


def _build_snapshot(asset: str, row: pd.Series) -> dict:
    return {
        "asset": asset,
        "fearGreedIndex": 50,
        "fearGreedTrend7d": 0,
        "headlines": [],
        "socialSentimentScore": 0.5,
        "googleTrendsDelta": 0.0,
        "macro": {"btcDominance": 50.0, "dxyChange24h": 0.0},
        "onChainAlerts": [],
        "ohlcvState": {
            "close": float(row["close"]),
            "volume": float(row["volume"]),
            "timestamp": int(row["timestamp"]),
            "rsi": float(row["rsi"]) if "rsi" in row and pd.notna(row["rsi"]) else None,
        },
        "sourcesUsed": ["ohlcv"],
    }


def seed_asset(asset: str, min_events: int | None = None) -> int:
    min_events = min_events or settings.min_rag_events
    df = load_ohlcv(asset)
    if df.empty:
        print(f"[SKIP] {asset}: no OHLC data")
        return 0

    frame = compute_indicators(df)
    indexed = 0
    for i in range(len(frame) - 24):
        row = frame.iloc[i]
        future = frame.iloc[i + 24]
        ts = datetime.fromtimestamp(int(row["timestamp"]) / 1000, tz=timezone.utc)
        actual = float(future["close"])
        close = float(row["close"])
        change_pct = (actual / close - 1) if close else 0.0
        snap = _build_snapshot(asset, row)
        vector = embed_snapshot(snap)
        execute(
            """
            INSERT INTO market_events
                (asset, event_timestamp, snapshot_json, embedding, actual_price_24h, actual_change_pct)
            VALUES
                (:asset, :ts, CAST(:snap AS jsonb), CAST(:vec AS vector), :actual, :change)
            ON CONFLICT (asset, event_timestamp) DO UPDATE SET
                snapshot_json = EXCLUDED.snapshot_json,
                embedding = EXCLUDED.embedding,
                actual_price_24h = EXCLUDED.actual_price_24h,
                actual_change_pct = EXCLUDED.actual_change_pct
            """,
            {
                "asset": asset,
                "ts": ts,
                "snap": json.dumps(snap),
                "vec": vector_to_pg(vector),
                "actual": actual,
                "change": change_pct,
            },
        )
        indexed += 1

    total = fetch_all(
        "SELECT COUNT(*) AS cnt FROM market_events WHERE asset = :asset",
        {"asset": asset},
    )[0]["cnt"]
    status = "ready" if total >= min_events else f"needs {min_events - total} more"
    print(f"[OK]   {asset}: seeded {indexed} events (total={total}, {status})")
    return indexed


def main() -> int:
    total = 0
    for asset in settings.assets:
        total += seed_asset(asset)
    rows = fetch_all(
        """
        SELECT asset, COUNT(*) AS cnt
        FROM market_events
        GROUP BY asset
        ORDER BY asset
        """
    )
    print("\nRAG index status:")
    for row in rows:
        print(f"  {row['asset']}: {row['cnt']}")
    print(f"\nSeeded {total} new events across {len(settings.assets)} assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
