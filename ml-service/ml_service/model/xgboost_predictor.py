from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error

from ml_service.db import fetch_all
from ml_service.model.features import FEATURE_COLUMNS, compute_indicators

MODEL_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_DIR.mkdir(exist_ok=True)

HORIZON_1H = 1
HORIZON_24H = 24
PREDICTION_HORIZONS = (HORIZON_1H, HORIZON_24H)


def _safe_asset(asset: str) -> str:
    return asset.replace("/", "_")


def _model_paths(asset: str, horizon_hours: int) -> tuple[Path, Path]:
    safe = _safe_asset(asset)
    model_path = MODEL_DIR / f"{safe}_{horizon_hours}h.json"
    meta_path = MODEL_DIR / f"{safe}_{horizon_hours}h_meta.json"
    if horizon_hours == HORIZON_24H and not model_path.exists():
        legacy_model = MODEL_DIR / f"{safe}.json"
        legacy_meta = MODEL_DIR / f"{safe}_meta.json"
        if legacy_model.exists():
            return legacy_model, legacy_meta
    return model_path, meta_path


def load_ohlcv(asset: str, interval: str = "1h") -> pd.DataFrame:
    rows = fetch_all(
        """
        SELECT timestamp, open, high, low, close, volume
        FROM ohlc_data
        WHERE symbol = :asset AND interval_string = :interval
        ORDER BY timestamp ASC
        """,
        {"asset": asset, "interval": interval},
    )
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)
    df["timestamp"] = df["timestamp"].astype(int)
    return df


def prepare_training_frame(df: pd.DataFrame, horizon_hours: int = HORIZON_24H) -> pd.DataFrame:
    enriched = compute_indicators(df)
    enriched["target"] = enriched["close"].shift(-horizon_hours)
    enriched["target_return"] = enriched["target"] / enriched["close"] - 1
    return enriched.dropna(subset=["target"] + FEATURE_COLUMNS)


def train_model(asset: str, horizon_hours: int = HORIZON_24H, train_end_ts: int | None = None) -> xgb.XGBRegressor:
    df = load_ohlcv(asset)
    if df.empty:
        raise ValueError(f"No OHLCV data for {asset}")

    frame = prepare_training_frame(df, horizon_hours=horizon_hours)
    if train_end_ts:
        frame = frame[frame["timestamp"] < train_end_ts]

    min_rows = 50 if horizon_hours == HORIZON_1H else 100
    if len(frame) < min_rows:
        raise ValueError(
            f"Insufficient training data for {asset} ({horizon_hours}h): {len(frame)} rows"
        )

    X = frame[FEATURE_COLUMNS]
    y = frame["target"]

    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X, y)

    preds = model.predict(X)
    mae = mean_absolute_error(y, preds)
    residual_std = float(np.std(y - preds))

    model_path, meta_path = _model_paths(asset, horizon_hours)
    model.save_model(model_path)

    meta = {
        "asset": asset,
        "horizonHours": horizon_hours,
        "mae": mae,
        "residual_std": residual_std,
        "train_rows": len(frame),
    }
    meta_path.write_text(json.dumps(meta))

    return model


def load_model(asset: str, horizon_hours: int = HORIZON_24H) -> tuple[xgb.Booster, dict]:
    model_path, meta_path = _model_paths(asset, horizon_hours)

    if not model_path.exists():
        train_model(asset, horizon_hours=horizon_hours)

    booster = xgb.Booster()
    booster.load_model(model_path)
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {"residual_std": 0.02}
    return booster, meta


def predict_ml(
    asset: str,
    horizon_hours: int = HORIZON_24H,
    as_of_ts: int | None = None,
) -> dict:
    df = load_ohlcv(asset)
    if df.empty:
        raise ValueError(f"No data for {asset}")

    if as_of_ts:
        df = df[df["timestamp"] <= as_of_ts]
    if df.empty:
        raise ValueError(f"No data before timestamp for {asset}")

    frame = compute_indicators(df)
    if frame.empty:
        raise ValueError(f"Could not compute indicators for {asset}")

    row = frame.iloc[-1]
    booster, meta = load_model(asset, horizon_hours=horizon_hours)
    X = row[FEATURE_COLUMNS].values.reshape(1, -1)
    price = float(booster.predict(xgb.DMatrix(X, feature_names=FEATURE_COLUMNS))[0])
    std = meta.get("residual_std", price * 0.02)
    ci_low = price - 1.96 * std
    ci_high = price + 1.96 * std

    return {
        "horizonHours": horizon_hours,
        "price": round(price, 2),
        "ciLow": round(max(ci_low, 0), 2),
        "ciHigh": round(ci_high, 2),
        "currentPrice": float(row["close"]),
        "predictedAtTs": int(row["timestamp"]),
    }
