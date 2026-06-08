from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from ml_service.context.gatherer import gather_context
from ml_service.db import execute
from ml_service.llm.context_predictor import context_predict
from ml_service.llm.tuner import tune_ml_output
from ml_service.model.xgboost_predictor import HORIZON_1H, HORIZON_24H, load_ohlcv, predict_ml
from ml_service.rag.retriever import retrieve_precedents


def align_predicted_at(align: str | None) -> datetime:
    """Return UTC timestamp aligned to prediction boundaries."""
    now = datetime.now(timezone.utc)
    if align == "next_hour":
        floored = now.replace(minute=0, second=0, microsecond=0)
        if now > floored:
            return floored + timedelta(hours=1)
        return floored
    if align == "midnight":
        floored = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if now > floored:
            return floored + timedelta(days=1)
        return floored
    return now


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


def _forecast_dict(ml: dict) -> dict:
    return {
        "horizonHours": ml["horizonHours"],
        "price": ml["price"],
        "ciLow": ml["ciLow"],
        "ciHigh": ml["ciHigh"],
    }


def build_ohlcv_state(
    asset: str,
    fallback_price: float | None = None,
    fallback_ts: int | None = None,
) -> dict:
    df = load_ohlcv(asset)
    if df.empty:
        return {
            "close": fallback_price or 0,
            "volume": 0,
            "timestamp": fallback_ts or 0,
        }

    last = df.iloc[-1]
    state = {
        "close": float(last["close"]),
        "volume": float(last["volume"]),
        "timestamp": int(last["timestamp"]),
    }

    tail = df.tail(25)
    if len(tail) >= 2:
        vol_mean = float(tail["volume"].mean())
        if vol_mean > 0:
            state["volumeRatio24h"] = float(last["volume"]) / vol_mean
    if len(tail) >= 24:
        close_24h_ago = float(tail.iloc[-24]["close"])
        if close_24h_ago > 0:
            state["return24h"] = (float(last["close"]) - close_24h_ago) / close_24h_ago

    return state


async def _run_daily_context_pipeline(
    asset: str,
    ml_24h: dict,
    use_rag: bool,
    max_age_hours: int = 24,
) -> tuple[dict, dict, dict, list[dict], dict]:
    ohlcv_state = build_ohlcv_state(asset, ml_24h["currentPrice"], ml_24h["predictedAtTs"])

    context_snapshot = await gather_context(asset, ohlcv_state, max_age_hours=max_age_hours)
    context_snapshot["ohlcvState"] = ohlcv_state

    rag_precedents: list[dict] = []
    if use_rag:
        try:
            rag_precedents = retrieve_precedents(asset, context_snapshot)
            context_snapshot["similarHistoricalEvents"] = rag_precedents
        except Exception:
            context_snapshot["similarHistoricalEvents"] = []

    ctx_pred = await context_predict(context_snapshot)
    context_aware, tuning = await tune_ml_output(context_snapshot, ctx_pred, ml_24h)
    return context_snapshot, ctx_pred, context_aware, rag_precedents, tuning


async def run_hourly_prediction(
    asset: str,
    source: str = "scheduled",
    *,
    predicted_at: datetime | None = None,
    align: str | None = None,
) -> dict:
    ml_1h = predict_ml(asset, horizon_hours=HORIZON_1H)
    predicted_at = predicted_at or align_predicted_at(align)
    _clear_hourly_slot(asset, predicted_at)

    result = {
        "asset": asset,
        "predictedAt": predicted_at.isoformat(),
        "source": source,
        "ml1hPrediction": _forecast_dict(ml_1h),
    }

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
    return result


async def run_daily_prediction(
    asset: str,
    use_rag: bool = True,
    source: str = "scheduled",
    max_age_hours: int = 24,
    *,
    predicted_at: datetime | None = None,
    align: str | None = None,
) -> dict:
    ml_24h = predict_ml(asset, horizon_hours=HORIZON_24H)
    context_snapshot, ctx_pred, context_aware, rag_precedents, tuning = (
        await _run_daily_context_pipeline(asset, ml_24h, use_rag, max_age_hours)
    )

    predicted_at = predicted_at or align_predicted_at(align)
    _clear_daily_slot(asset, predicted_at)
    result = {
        "asset": asset,
        "predictedAt": predicted_at.isoformat(),
        "useRag": use_rag,
        "source": source,
        "mlPrediction": _forecast_dict(ml_24h),
        "contextAwarePrediction": {
            "horizonHours": HORIZON_24H,
            **context_aware,
        },
        "contextPrediction": ctx_pred,
        "contextSnapshot": context_snapshot,
        "ragPrecedents": rag_precedents,
        "tuningApplied": tuning,
    }

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
    return result


def backfill_actuals():
    """Set actual_price_24h for predictions older than 24h."""
    execute(
        """
        UPDATE predictions p
        SET actual_price_24h = sub.close
        FROM (
            SELECT p2.id,
                   o.close
            FROM predictions p2
            JOIN LATERAL (
                SELECT close FROM ohlc_data
                WHERE symbol = p2.asset
                  AND interval_string = '1h'
                  AND timestamp <= EXTRACT(EPOCH FROM (p2.predicted_at + INTERVAL '24 hours')) * 1000
                ORDER BY timestamp DESC
                LIMIT 1
            ) o ON TRUE
            WHERE p2.actual_price_24h IS NULL
              AND p2.predicted_at < NOW() - INTERVAL '24 hours'
        ) sub
        WHERE p.id = sub.id
        """
    )
