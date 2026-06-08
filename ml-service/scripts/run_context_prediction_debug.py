"""Run one context-aware daily prediction and print LLM exchanges to the console."""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.pipeline.predict import run_daily_prediction

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)


async def main() -> int:
    asset = sys.argv[1] if len(sys.argv) > 1 else settings.assets[0]
    print(f"LLM provider : {settings.llm_provider}")
    print(f"Gemini model : {settings.gemini_model}")
    print(f"Asset        : {asset}")
    print(f"Log exchanges: {settings.llm_log_exchanges}")
    print("Gathering context, calling LLM twice (context + tuning)…\n")

    result = await run_daily_prediction(
        asset,
        use_rag=True,
        source="debug",
        align="midnight",
    )

    print("\n========== FINAL PREDICTION ==========")
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
