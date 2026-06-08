from __future__ import annotations

from datetime import datetime, timezone

from ml_service.config import settings
from ml_service.db import fetch_all
from ml_service.rag.embedder import embed_snapshot, snapshot_to_text, vector_to_pg


def retrieve_precedents(asset: str, snapshot: dict, limit: int = 5) -> list[dict]:
    vector = embed_snapshot(snapshot)
    vec_str = vector_to_pg(vector)
    now = datetime.now(timezone.utc)

    rows = fetch_all(
        """
        SELECT id, asset, event_timestamp, snapshot_json, actual_price_24h, actual_change_pct,
               1 - (embedding <=> CAST(:vec AS vector)) AS similarity_score
        FROM market_events
        WHERE asset = :asset AND event_timestamp < :now
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :limit
        """,
        {"vec": vec_str, "asset": asset, "now": now, "limit": limit},
    )

    precedents = []
    for row in rows:
        snap = row.get("snapshot_json") or {}
        if isinstance(snap, str):
            import json
            snap = json.loads(snap)
        precedents.append({
            "id": row["id"],
            "similarityScore": round(float(row["similarity_score"]), 4),
            "eventTimestamp": row["event_timestamp"].isoformat()
            if hasattr(row["event_timestamp"], "isoformat")
            else str(row["event_timestamp"]),
            "conditionsSummary": snapshot_to_text(snap)[:200],
            "actualPrice24h": float(row["actual_price_24h"]) if row["actual_price_24h"] else None,
            "actualChangePct24h": float(row["actual_change_pct"]) if row["actual_change_pct"] else None,
        })
    return precedents


def rag_index_status() -> dict:
    rows = fetch_all(
        """
        SELECT asset, COUNT(*) AS cnt
        FROM market_events
        GROUP BY asset
        ORDER BY asset
        """
    )
    by_asset = {r["asset"]: int(r["cnt"]) for r in rows}
    return {
        "byAsset": by_asset,
        "minRequired": settings.min_rag_events,
        "ready": all(by_asset.get(a, 0) >= settings.min_rag_events for a in settings.assets),
    }
