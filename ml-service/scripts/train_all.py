"""Train XGBoost models for all configured prediction assets and horizons."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.model.xgboost_predictor import PREDICTION_HORIZONS, load_ohlcv, train_model


def main() -> int:
    failed: list[str] = []
    for asset in settings.assets:
        df = load_ohlcv(asset)
        if df.empty:
            print(f"[SKIP] {asset}: no 1h OHLC data")
            failed.append(asset)
            continue
        for horizon in PREDICTION_HORIZONS:
            try:
                model = train_model(asset, horizon_hours=horizon)
                print(
                    f"[OK]   {asset} ({horizon}h): trained on {len(df)} candles, "
                    f"trees={model.n_estimators}"
                )
            except Exception as exc:
                print(f"[FAIL] {asset} ({horizon}h): {exc}")
                failed.append(f"{asset}:{horizon}h")

    if failed:
        print(f"\nFailed: {', '.join(failed)}")
        return 1
    print("\nAll models trained. Artifacts in ml_service/model/artifacts/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
