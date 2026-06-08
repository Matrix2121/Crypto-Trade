from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

from ml_service.config import settings
from ml_service.db import execute, fetch_all
from ml_service.rag.embedder import embed_snapshot, vector_to_pg


def index_from_predictions(asset: str | None = None, backfill: bool = False):
    query = """
        SELECT id, asset, predicted_at, context_snapshot_json, actual_price_24h
        FROM predictions
        WHERE actual_price_24h IS NOT NULL
    """
    params: dict = {}
    if asset:
        query += " AND asset = :asset"
        params["asset"] = asset
    if not backfill:
        query += """
            AND NOT EXISTS (
                SELECT 1 FROM market_events me
                WHERE me.asset = predictions.asset
                  AND me.event_timestamp = predictions.predicted_at
            )
        """
    query += " ORDER BY predicted_at ASC"

    rows = fetch_all(query, params)
    indexed = 0
    for row in rows:
        snap = row.get("context_snapshot_json")
        if not snap:
            continue
        if isinstance(snap, str):
            snap = json.loads(snap)

        actual = float(row["actual_price_24h"])
        close = float(snap.get("ohlcvState", {}).get("close", actual))
        change_pct = (actual / close - 1) if close else 0

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
                "asset": row["asset"],
                "ts": row["predicted_at"],
                "snap": json.dumps(snap),
                "vec": vector_to_pg(vector),
                "actual": actual,
                "change": change_pct,
            },
        )
        indexed += 1
    print(f"Indexed {indexed} events")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--asset")
    args = parser.parse_args()
    assets = [args.asset] if args.asset else settings.assets
    for asset in assets:
        index_from_predictions(asset, backfill=args.backfill)


if __name__ == "__main__":
    main()
