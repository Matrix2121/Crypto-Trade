"""Wipe stored predictions and regenerate all three models for the past N days.

Models:
  - ML hourly (1h XGBoost)
  - ML daily (24h XGBoost)
  - Context-aware (LLM-tuned 24h forecast)

Usage (from repo root):
  $env:PYTHONPATH = "ml-service"
  .\\.venv\\Scripts\\python.exe ml-service/scripts/backfill_predictions.py --days 30 --wipe
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.db import execute, fetch_one
from ml_service.llm.context_predictor import context_predict
from ml_service.llm.tuner import tune_ml_output
from ml_service.model.xgboost_predictor import HORIZON_1H, HORIZON_24H, load_ohlcv, predict_ml
from ml_service.pipeline.predict import backfill_actuals
from ml_service.rag.indexer import index_from_predictions
from ml_service.rag.retriever import retrieve_precedents


def _as_of_ts(df, predicted_at: datetime) -> int | None:
    cutoff_ms = int(predicted_at.timestamp() * 1000)
    prior = df[df["timestamp"] < cutoff_ms]
    if prior.empty:
        return None
    return int(prior.iloc[-1]["timestamp"])


def build_ohlcv_state_at(df, as_of_ts: int) -> dict:
    subset = df[df["timestamp"] <= as_of_ts]
    if subset.empty:
        return {"close": 0, "volume": 0, "timestamp": as_of_ts}

    last = subset.iloc[-1]
    state = {
        "close": float(last["close"]),
        "volume": float(last["volume"]),
        "timestamp": int(last["timestamp"]),
    }

    tail = subset.tail(25)
    if len(tail) >= 2:
        vol_mean = float(tail["volume"].mean())
        if vol_mean > 0:
            state["volumeRatio24h"] = float(last["volume"]) / vol_mean
    if len(tail) >= 24:
        close_24h_ago = float(tail.iloc[-24]["close"])
        if close_24h_ago > 0:
            state["return24h"] = (float(last["close"]) - close_24h_ago) / close_24h_ago

    return state


def build_backfill_context(asset: str, ohlcv_state: dict) -> dict:
    """OHLCV-only context for historical slots (live news APIs are not time-travel aware)."""
    return_24h = ohlcv_state.get("return24h") or 0.0
    fg_proxy = max(0.0, min(100.0, 50.0 + return_24h * 200.0))
    on_chain: list[str] = []

    volume_ratio = ohlcv_state.get("volumeRatio24h")
    if volume_ratio is not None and volume_ratio > 2.0:
        on_chain.append(f"Volume {volume_ratio:.1f}x above 24h average")
    if abs(return_24h) > 0.05:
        direction = "up" if return_24h > 0 else "down"
        on_chain.append(f"Large 24h move: {return_24h * 100:.1f}% {direction}")

    return {
        "asset": asset,
        "fearGreedIndex": round(fg_proxy, 2),
        "fearGreedTrend7d": 0.0,
        "headlines": [],
        "socialSentimentScore": round(fg_proxy / 100.0, 4),
        "googleTrendsDelta": 0.0,
        "macro": {"btcDominance": 50.0, "dxyChange24h": 0.0},
        "onChainAlerts": on_chain,
        "ohlcvState": ohlcv_state,
        "sourcesUsed": ["ohlcv_backfill"],
    }


def _hour_slots(start: datetime, end: datetime) -> list[datetime]:
    slots: list[datetime] = []
    cursor = start.replace(minute=0, second=0, microsecond=0)
    while cursor <= end:
        slots.append(cursor)
        cursor += timedelta(hours=1)
    return slots


def _day_slots(start: datetime, end: datetime) -> list[datetime]:
    slots: list[datetime] = []
    cursor = start.replace(hour=0, minute=0, second=0, microsecond=0)
    while cursor <= end:
        slots.append(cursor)
        cursor += timedelta(days=1)
    return slots


def _clear_hourly_slot(asset: str, predicted_at: datetime) -> None:
    execute(
        """
        DELETE FROM predictions
        WHERE asset = :asset AND predicted_at = :predicted_at
          AND ml_1h_price IS NOT NULL
        """,
        {"asset": asset, "predicted_at": predicted_at},
    )


def _clear_daily_slot(asset: str, predicted_at: datetime) -> None:
    execute(
        """
        DELETE FROM predictions
        WHERE asset = :asset AND predicted_at = :predicted_at
          AND ml_price IS NOT NULL
        """,
        {"asset": asset, "predicted_at": predicted_at},
    )


def insert_hourly(asset: str, predicted_at: datetime, ml_1h: dict, source: str) -> None:
    _clear_hourly_slot(asset, predicted_at)
    execute(
        """
        INSERT INTO predictions (
            asset, predicted_at, source, use_rag,
            ml_1h_price, ml_1h_ci_low, ml_1h_ci_high
        ) VALUES (
            :asset, :predicted_at, :source, false,
            :ml_1h_price, :ml_1h_ci_low, :ml_1h_ci_high
        )
        """,
        {
            "asset": asset,
            "predicted_at": predicted_at,
            "source": source,
            "ml_1h_price": ml_1h["price"],
            "ml_1h_ci_low": ml_1h["ciLow"],
            "ml_1h_ci_high": ml_1h["ciHigh"],
        },
    )


def insert_daily(
    asset: str,
    predicted_at: datetime,
    ml_24h: dict,
    context_aware: dict,
    ctx_pred: dict,
    context_snapshot: dict,
    tuning: dict,
    rag_precedents: list[dict],
    source: str,
    use_rag: bool,
) -> None:
    _clear_daily_slot(asset, predicted_at)
    execute(
        """
        INSERT INTO predictions (
            asset, predicted_at, source, use_rag,
            ml_price, ml_ci_low, ml_ci_high,
            context_aware_price, context_aware_ci_low, context_aware_ci_high,
            context_prediction_json, context_snapshot_json,
            tuning_params_json, rag_precedents_json
        ) VALUES (
            :asset, :predicted_at, :source, :use_rag,
            :ml_price, :ml_ci_low, :ml_ci_high,
            :ca_price, :ca_ci_low, :ca_ci_high,
            CAST(:ctx_pred AS jsonb), CAST(:ctx_snap AS jsonb),
            CAST(:tuning AS jsonb), CAST(:rag AS jsonb)
        )
        """,
        {
            "asset": asset,
            "predicted_at": predicted_at,
            "source": source,
            "use_rag": use_rag,
            "ml_price": ml_24h["price"],
            "ml_ci_low": ml_24h["ciLow"],
            "ml_ci_high": ml_24h["ciHigh"],
            "ca_price": context_aware["price"],
            "ca_ci_low": context_aware["ciLow"],
            "ca_ci_high": context_aware["ciHigh"],
            "ctx_pred": json.dumps(ctx_pred),
            "ctx_snap": json.dumps(context_snapshot, default=str),
            "tuning": json.dumps(tuning),
            "rag": json.dumps(rag_precedents),
        },
    )


async def backfill_asset(
    asset: str,
    days: int,
    source: str,
    use_rag: bool,
    skip_context: bool,
) -> dict:
    df = load_ohlcv(asset)
    if df.empty:
        print(f"  skip {asset}: no OHLCV")
        return {"asset": asset, "hourly": 0, "daily": 0, "errors": 0}

    end = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)
    hour_slots = _hour_slots(start, end)
    day_slots = _day_slots(start, end)

    hourly_ok = 0
    daily_ok = 0
    errors = 0

    print(f"  daily slots: {len(day_slots)}, hourly slots: {len(hour_slots)}")

    for predicted_at in day_slots:
        as_of = _as_of_ts(df, predicted_at)
        if as_of is None:
            continue
        try:
            ml_24h = predict_ml(asset, horizon_hours=HORIZON_24H, as_of_ts=as_of)
            ohlcv_state = build_ohlcv_state_at(df, as_of)
            context_snapshot = build_backfill_context(asset, ohlcv_state)

            rag_precedents: list[dict] = []
            if use_rag:
                try:
                    rag_precedents = retrieve_precedents(asset, context_snapshot)
                    context_snapshot["similarHistoricalEvents"] = rag_precedents
                except Exception:
                    context_snapshot["similarHistoricalEvents"] = []

            if skip_context:
                insert_daily(
                    asset,
                    predicted_at,
                    ml_24h,
                    context_aware={"price": ml_24h["price"], "ciLow": ml_24h["ciLow"], "ciHigh": ml_24h["ciHigh"]},
                    ctx_pred={},
                    context_snapshot=context_snapshot,
                    tuning={},
                    rag_precedents=rag_precedents,
                    source=source,
                    use_rag=use_rag,
                )
            else:
                ctx_pred = await context_predict(context_snapshot)
                context_aware, tuning = await tune_ml_output(context_snapshot, ctx_pred, ml_24h)
                insert_daily(
                    asset,
                    predicted_at,
                    ml_24h,
                    context_aware,
                    ctx_pred,
                    context_snapshot,
                    tuning,
                    rag_precedents,
                    source,
                    use_rag,
                )
            daily_ok += 1
        except Exception as exc:
            errors += 1
            print(f"    daily {predicted_at.isoformat()} failed: {exc}")

    for predicted_at in hour_slots:
        as_of = _as_of_ts(df, predicted_at)
        if as_of is None:
            continue
        try:
            ml_1h = predict_ml(asset, horizon_hours=HORIZON_1H, as_of_ts=as_of)
            insert_hourly(asset, predicted_at, ml_1h, source)
            hourly_ok += 1
        except Exception as exc:
            errors += 1
            print(f"    hourly {predicted_at.isoformat()} failed: {exc}")

    return {"asset": asset, "hourly": hourly_ok, "daily": daily_ok, "errors": errors}


async def run_backfill(
    days: int,
    wipe: bool,
    assets: list[str] | None,
    source: str,
    use_rag: bool,
    skip_context: bool,
) -> None:
    assets = assets or settings.assets

    if wipe:
        before = fetch_one("SELECT COUNT(*) AS c FROM predictions")
        execute("DELETE FROM predictions")
        print(f"Wiped {before['c']} prediction rows")

    print(
        f"Backfilling {len(assets)} assets for the past {days} days "
        f"(source={source}, use_rag={use_rag}, skip_context={skip_context})"
    )

    totals = {"hourly": 0, "daily": 0, "errors": 0}
    for asset in assets:
        print(f"\n=== {asset} ===")
        result = await backfill_asset(asset, days, source, use_rag, skip_context)
        totals["hourly"] += result["hourly"]
        totals["daily"] += result["daily"]
        totals["errors"] += result["errors"]
        print(
            f"  done: {result['hourly']} hourly, {result['daily']} daily, "
            f"{result['errors']} errors"
        )

    print("\nBackfilling actual 24h prices...")
    backfill_actuals()

    print("Updating RAG index from predictions...")
    index_from_predictions(backfill=True)

    after = fetch_one("SELECT COUNT(*) AS c FROM predictions")
    print(
        f"\nFinished. Inserted {totals['hourly']} hourly + {totals['daily']} daily rows "
        f"({totals['errors']} slot errors). predictions table now has {after['c']} rows."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Wipe and backfill predictions for past N days")
    parser.add_argument("--days", type=int, default=30, help="How many days to backfill (default: 30)")
    parser.add_argument("--wipe", action="store_true", help="Delete all existing predictions first")
    parser.add_argument("--source", default="backfill", help="Value for predictions.source column")
    parser.add_argument("--no-rag", action="store_true", help="Skip RAG precedent lookup")
    parser.add_argument(
        "--skip-context",
        action="store_true",
        help="Skip LLM context-aware tuning (stores ML daily as context-aware)",
    )
    parser.add_argument("--asset", action="append", help="Limit to one or more assets (repeatable)")
    args = parser.parse_args()

    asyncio.run(
        run_backfill(
            days=args.days,
            wipe=args.wipe,
            assets=args.asset,
            source=args.source,
            use_rag=not args.no_rag,
            skip_context=args.skip_context,
        )
    )


if __name__ == "__main__":
    main()
