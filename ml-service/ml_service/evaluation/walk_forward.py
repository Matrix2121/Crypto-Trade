from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone

import pandas as pd

from ml_service.config import settings
from ml_service.db import execute, fetch_all
from ml_service.evaluation.metrics import directional_accuracy, hit_rate_ci, mae, rmse
from ml_service.model.xgboost_predictor import HORIZON_24H, load_ohlcv, predict_ml, train_model


def run_walk_forward(asset: str, eval_days: int = 180):
    df = load_ohlcv(asset)
    if df.empty:
        print(f"No data for {asset}")
        return

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=eval_days)
    start_ts = int(start.timestamp() * 1000)

    daily = df[df["timestamp"] >= start_ts].copy()
    daily["date"] = pd.to_datetime(daily["timestamp"], unit="ms", utc=True).dt.floor("D")
    eval_points = daily.groupby("date").first().reset_index()

    ml_actuals, ml_preds, ml_lows, ml_highs, bases = [], [], [], [], []

    for _, row in eval_points.iterrows():
        ts = int(row["timestamp"])
        future_ts = ts + 24 * 3600 * 1000
        future = df[df["timestamp"] >= future_ts].head(1)
        if future.empty:
            continue
        actual = float(future.iloc[0]["close"])
        base = float(row["close"])

        try:
            train_model(asset, horizon_hours=HORIZON_24H, train_end_ts=ts)
            pred = predict_ml(asset, horizon_hours=HORIZON_24H, as_of_ts=ts)
        except Exception as e:
            print(f"Skip {ts}: {e}")
            continue

        ml_actuals.append(actual)
        ml_preds.append(pred["price"])
        ml_lows.append(pred["ciLow"])
        ml_highs.append(pred["ciHigh"])
        bases.append(base)

        predicted_at = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        execute(
            """
            INSERT INTO predictions (
                asset, predicted_at, source, use_rag,
                ml_price, ml_ci_low, ml_ci_high,
                actual_price_24h
            ) VALUES (
                :asset, :predicted_at, 'backtest', false,
                :ml_price, :ml_ci_low, :ml_ci_high, :actual
            )
            """,
            {
                "asset": asset,
                "predicted_at": predicted_at,
                "ml_price": pred["price"],
                "ml_ci_low": pred["ciLow"],
                "ml_ci_high": pred["ciHigh"],
                "actual": actual,
            },
        )

    report = {
        "asset": asset,
        "windows": len(ml_actuals),
        "mae": round(mae(ml_actuals, ml_preds), 2),
        "rmse": round(rmse(ml_actuals, ml_preds), 2),
        "directionalAccuracy": round(directional_accuracy(ml_actuals, ml_preds, bases), 4),
        "hitRateCi": round(hit_rate_ci(ml_actuals, ml_lows, ml_highs), 4),
    }
    print(json.dumps(report, indent=2))
    return report


def ablation_summary(asset: str | None = None) -> dict:
    query = """
        SELECT asset,
               COUNT(*) FILTER (WHERE ml_price IS NOT NULL AND actual_price_24h IS NOT NULL) AS ml_n,
               COUNT(*) FILTER (WHERE context_aware_price IS NOT NULL AND actual_price_24h IS NOT NULL AND use_rag = false) AS hybrid_no_rag_n,
               COUNT(*) FILTER (WHERE context_aware_price IS NOT NULL AND actual_price_24h IS NOT NULL AND use_rag = true) AS hybrid_rag_n,
               AVG(CASE WHEN actual_price_24h BETWEEN ml_ci_low AND ml_ci_high THEN 1.0 ELSE 0.0 END) AS ml_hit,
               AVG(CASE WHEN actual_price_24h BETWEEN context_aware_ci_low AND context_aware_ci_high AND use_rag = false THEN 1.0 ELSE 0.0 END) AS hybrid_no_rag_hit,
               AVG(CASE WHEN actual_price_24h BETWEEN context_aware_ci_low AND context_aware_ci_high AND use_rag = true THEN 1.0 ELSE 0.0 END) AS hybrid_rag_hit
        FROM predictions
        WHERE actual_price_24h IS NOT NULL
    """
    params = {}
    if asset:
        query += " AND asset = :asset"
        params["asset"] = asset
    query += " GROUP BY asset ORDER BY asset"
    rows = fetch_all(query, params)
    return {"byAsset": rows}


def rolling_hit_rate(asset: str, days: int = 7) -> list[dict]:
    return fetch_all(
        """
        SELECT DATE(predicted_at) AS day,
               AVG(CASE WHEN actual_price_24h BETWEEN ml_ci_low AND ml_ci_high THEN 1.0 ELSE 0.0 END) AS ml_hit,
               AVG(CASE WHEN actual_price_24h BETWEEN context_aware_ci_low AND context_aware_ci_high AND use_rag = true THEN 1.0 ELSE 0.0 END) AS hybrid_rag_hit,
               AVG(CASE WHEN actual_price_24h BETWEEN context_aware_ci_low AND context_aware_ci_high AND use_rag = false THEN 1.0 ELSE 0.0 END) AS hybrid_no_rag_hit
        FROM predictions
        WHERE asset = :asset AND actual_price_24h IS NOT NULL
          AND predicted_at >= NOW() - CAST(:days AS integer) * INTERVAL '1 day'
        GROUP BY DATE(predicted_at)
        ORDER BY day
        """,
        {"asset": asset, "days": days},
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", default=settings.assets[0])
    parser.add_argument("--eval-days", type=int, default=180)
    args = parser.parse_args()
    run_walk_forward(args.asset, args.eval_days)


if __name__ == "__main__":
    main()
