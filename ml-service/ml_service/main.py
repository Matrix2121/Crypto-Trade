from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ml_service.config import settings
from ml_service.db import engine
from sqlalchemy import text
from ml_service.evaluation.walk_forward import ablation_summary, rolling_hit_rate, run_walk_forward
from ml_service.pipeline.predict import (
    backfill_actuals,
    run_daily_prediction,
    run_hourly_prediction,
)
from ml_service.rag.indexer import index_from_predictions
from ml_service.rag.retriever import rag_index_status

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Crypto-Trade ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
    except Exception:
        pass


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/batch/hourly")
async def predict_batch_hourly(
    source: str = Query(default="scheduled"),
    align: str | None = Query(default="next_hour"),
):
    results = []
    errors: list[str] = []
    for asset in settings.assets:
        try:
            results.append(await run_hourly_prediction(asset, source=source, align=align))
        except Exception as exc:
            msg = f"{asset}: {exc}"
            logger.exception("Hourly prediction failed for %s", asset)
            errors.append(msg)
    if errors and not results:
        raise HTTPException(status_code=503, detail={"errors": errors})
    return {"results": results, "errors": errors}


@app.post("/predict/batch/daily")
async def predict_batch_daily(
    use_rag: bool = True,
    source: str = Query(default="scheduled"),
    align: str | None = Query(default="midnight"),
):
    results = []
    errors: list[str] = []
    for asset in settings.assets:
        try:
            results.append(
                await run_daily_prediction(asset, use_rag=use_rag, source=source, align=align)
            )
        except Exception as exc:
            msg = f"{asset}: {exc}"
            logger.exception("Daily prediction failed for %s", asset)
            errors.append(msg)
    if errors and not results:
        raise HTTPException(status_code=503, detail={"errors": errors})
    return {"results": results, "errors": errors}


@app.post("/backtest/run")
def backtest_run(asset: str = Query(...), eval_days: int = 180):
    return run_walk_forward(asset, eval_days)


@app.get("/backtest/summary")
def backtest_summary(asset: str | None = None):
    return ablation_summary(asset)


@app.get("/backtest/drift/{asset:path}")
def backtest_drift(asset: str, days: int = 7):
    return rolling_hit_rate(asset, days)


@app.post("/backfill/actuals")
def backfill_actuals_endpoint():
    backfill_actuals()
    index_from_predictions(backfill=False)
    return {"status": "ok"}


@app.post("/rag/index")
def rag_index(asset: str | None = None, backfill: bool = False):
    index_from_predictions(asset, backfill=backfill)
    return rag_index_status()


@app.get("/rag/status")
def rag_status():
    return rag_index_status()
