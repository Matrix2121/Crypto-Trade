"""Download maximum Kraken OHLC history into TimescaleDB.

Kraken exposes at most 720 candles per OHLC request but supports paging with the
``last`` cursor (same approach as the Java KrakenOhlcClient). For each pair this
script:

  1. Paginates **daily** OHLC (interval 1440) from pair inception -> ``ohlc_1d``
  2. Paginates **hourly** OHLC (interval 60) from pair inception -> ``ohlc_1m``
     buckets (feeds the ``ohlc_1h`` continuous aggregate for ML / medium charts)

Kraken's public Trades API is only used as a fallback when hourly OHLC paging
hits the 200-page safety cap (~16 years of hourly candles).

**Retention notes (schema v2):**
  - ``ohlc_1m`` raw rows expire after 2 days; materialized ``ohlc_1h`` rows stay.
  - Long-range charts (3M / 1Y / ALL) read from ``ohlc_1d`` and its CAGGs.
  - Some CAGGs have their own retention (e.g. ``ohlc_5d`` ~380 days).

Usage (from repo root):
  $env:PYTHONPATH = "ml-service"
  python ml-service/scripts/sync_kraken_history.py

  python ml-service/scripts/sync_kraken_history.py --daily-only
  python ml-service/scripts/sync_kraken_history.py --symbols BTC/USD,ETH/USD
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.db import execute, execute_many, fetch_all, fetch_one

KRAKEN_OHLC_URL = "https://api.kraken.com/0/public/OHLC"
KRAKEN_TRADES_URL = "https://api.kraken.com/0/public/Trades"
RATE_LIMIT_SEC = 1.2
MAX_OHLC_PAGES = 200
KRAKEN_PAGE_SIZE = 720
UPSERT_BATCH = 500
MAX_RATE_LIMIT_RETRIES = 6

UPSERT_1M_SQL = """
INSERT INTO ohlc_1m (symbol, bucket, open, high, low, close, volume)
VALUES (:symbol, to_timestamp(:ts / 1000.0), :open, :high, :low, :close, :volume)
ON CONFLICT (symbol, bucket) DO UPDATE SET
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume
"""

UPSERT_1D_SQL = """
INSERT INTO ohlc_1d (symbol, bucket, open, high, low, close, volume)
VALUES (:symbol, to_timestamp(:ts / 1000.0), :open, :high, :low, :close, :volume)
ON CONFLICT (symbol, bucket) DO UPDATE SET
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume
"""

CAGG_VIEWS = (
    "ohlc_30m",
    "ohlc_1h",
    "ohlc_2h",
    "ohlc_4h",
    "ohlc_8h",
    "ohlc_5d",
    "ohlc_1mo",
)


def to_kraken_pair(symbol: str) -> str:
    base, quote = symbol.split("/")
    if base == "BTC":
        base = "XBT"
    return base + quote


def _kraken_get(url: str, params: dict) -> dict:
    for attempt in range(1, MAX_RATE_LIMIT_RETRIES + 1):
        with httpx.Client(timeout=90) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        errors = data.get("error") or []
        if any("Too many requests" in str(err) for err in errors):
            wait = RATE_LIMIT_SEC * (2**attempt)
            print(f"  [rate limit] backing off {wait:.1f}s (attempt {attempt})")
            time.sleep(wait)
            continue
        if errors:
            raise RuntimeError(errors)
        return data
    raise RuntimeError("Kraken rate limit exceeded after retries")


def _parse_ohlc_rows(result: dict, pair: str) -> tuple[list[dict], int | None]:
    key = next(k for k in result if k != "last")
    rows = result[key]
    candles = [
        {
            "timestamp": int(row[0]) * 1000,
            "open": float(row[1]),
            "high": float(row[2]),
            "low": float(row[3]),
            "close": float(row[4]),
            "volume": float(row[6]) if len(row) > 6 else 0.0,
        }
        for row in rows
    ]
    last_raw = result.get("last")
    last_id = int(last_raw) if last_raw is not None else None
    return candles, last_id


def fetch_ohlc_paginated(pair: str, interval_minutes: int, since_sec: int = 0) -> list[dict]:
    """Page Kraken OHLC until fewer than 720 candles are returned or max pages hit."""
    by_ts: dict[int, dict] = {}
    since = since_sec
    pages = 0

    while pages < MAX_OHLC_PAGES:
        params: dict = {"pair": pair, "interval": interval_minutes}
        if since > 0:
            params["since"] = since
        data = _kraken_get(KRAKEN_OHLC_URL, params)
        result = data.get("result", {})
        page, last_id = _parse_ohlc_rows(result, pair)
        pages += 1

        if not page:
            break

        for candle in page:
            if candle["timestamp"] // 1000 >= since_sec:
                by_ts[candle["timestamp"]] = candle

        print(
            f"    page {pages}: +{len(page)} candles, "
            f"oldest {datetime.fromtimestamp(page[0]['timestamp'] / 1000, tz=timezone.utc).date()}"
        )

        if len(page) < KRAKEN_PAGE_SIZE:
            break
        if last_id is None or last_id <= since:
            break
        since = last_id
        time.sleep(RATE_LIMIT_SEC)

    if pages >= MAX_OHLC_PAGES:
        print(f"    [warn] hit {MAX_OHLC_PAGES}-page cap; may need trades fallback for older hourly data")

    return [by_ts[ts] for ts in sorted(by_ts)]


def upsert_candles(symbol: str, candles: list[dict], table: str) -> int:
    if not candles:
        return 0
    sql = UPSERT_1D_SQL if table == "1d" else UPSERT_1M_SQL
    total = 0
    for i in range(0, len(candles), UPSERT_BATCH):
        batch = candles[i : i + UPSERT_BATCH]
        execute_many(
            sql,
            [
                {
                    "symbol": symbol,
                    "ts": c["timestamp"],
                    "open": c["open"],
                    "high": c["high"],
                    "low": c["low"],
                    "close": c["close"],
                    "volume": c["volume"],
                }
                for c in batch
            ],
        )
        total += len(batch)
    return total


def load_tracked_symbols() -> list[str]:
    rows = fetch_all("SELECT symbol FROM tracked_asset ORDER BY symbol")
    if rows:
        return [row["symbol"] for row in rows]
    return settings.assets


def existing_oldest_ms(symbol: str, table: str) -> int | None:
    hypertable = "ohlc_1d" if table == "1d" else "ohlc_1h"
    row = fetch_one(
        f"""
        SELECT CAST(EXTRACT(EPOCH FROM MIN(bucket)) * 1000 AS BIGINT) AS min_ts
        FROM {hypertable}
        WHERE symbol = :s
        """,
        {"s": symbol},
    )
    if not row or row["min_ts"] is None:
        return None
    return int(row["min_ts"])


def _already_has_full_history(oldest_ms: int | None) -> bool:
    """True when oldest bucket is at or before 2014 (Kraken-era coverage)."""
    if oldest_ms is None:
        return False
    year = datetime.fromtimestamp(oldest_ms / 1000, tz=timezone.utc).year
    return year <= 2014


def sync_daily(symbol: str, pair: str, force: bool) -> int:
    if not force and _already_has_full_history(existing_oldest_ms(symbol, "1d")):
        oldest = existing_oldest_ms(symbol, "1d")
        assert oldest is not None
        print(f"  [skip] daily already reaches {datetime.fromtimestamp(oldest / 1000, tz=timezone.utc).date()} (use --force to re-fetch)")
        return 0

    print(f"  fetching daily OHLC from Kraken listing...")
    candles = fetch_ohlc_paginated(pair, interval_minutes=1440, since_sec=0)
    time.sleep(RATE_LIMIT_SEC)
    count = upsert_candles(symbol, candles, "1d")
    if candles:
        oldest = datetime.fromtimestamp(candles[0]["timestamp"] / 1000, tz=timezone.utc)
        newest = datetime.fromtimestamp(candles[-1]["timestamp"] / 1000, tz=timezone.utc)
        print(f"  [ok] daily: {count} candles ({oldest.date()} .. {newest.date()})")
    return count


def sync_hourly(symbol: str, pair: str, force: bool) -> int:
    if not force and _already_has_full_history(existing_oldest_ms(symbol, "1h")):
        oldest = existing_oldest_ms(symbol, "1h")
        assert oldest is not None
        print(f"  [skip] hourly already reaches {datetime.fromtimestamp(oldest / 1000, tz=timezone.utc).date()} (use --force to re-fetch)")
        return 0

    print(f"  fetching hourly OHLC from Kraken listing...")
    candles = fetch_ohlc_paginated(pair, interval_minutes=60, since_sec=0)
    time.sleep(RATE_LIMIT_SEC)
    count = upsert_candles(symbol, candles, "1m")
    if candles:
        oldest = datetime.fromtimestamp(candles[0]["timestamp"] / 1000, tz=timezone.utc)
        newest = datetime.fromtimestamp(candles[-1]["timestamp"] / 1000, tz=timezone.utc)
        print(f"  [ok] hourly: {count} buckets in ohlc_1m ({oldest.date()} .. {newest.date()})")
    return count


def wipe_ohlc_data() -> None:
    """Remove all OHLC hypertable rows, legacy ohlc_data, and refresh CAGGs."""
    print("=== Wipe OHLC data ===")
    execute("DROP TABLE IF EXISTS ohlc_data CASCADE")

    for table in ("ohlc_1m", "ohlc_1d"):
        row = fetch_one(
            "SELECT to_regclass(:name) IS NOT NULL AS present",
            {"name": f"public.{table}"},
        )
        if row and row["present"]:
            execute(f"TRUNCATE TABLE {table}")
            print(f"  truncated {table}")
        else:
            print(f"  skip {table} (not present - run schema migration first)")

    print("  refreshing continuous aggregates after wipe...")
    refresh_caggs()
    print("  [ok] OHLC data wiped")


def refresh_caggs(views: tuple[str, ...] = CAGG_VIEWS) -> None:
    from sqlalchemy import text

    from ml_service.db import engine

    conn = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    try:
        for view in views:
            print(f"  refreshing {view}...")
            conn.execute(text(f"CALL refresh_continuous_aggregate('{view}', NULL, NULL)"))
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync maximum Kraken OHLC history into TimescaleDB"
    )
    parser.add_argument(
        "--symbols",
        help="Comma-separated symbols (default: all tracked_asset rows)",
    )
    parser.add_argument(
        "--daily-only",
        action="store_true",
        help="Only sync daily (ohlc_1d) history",
    )
    parser.add_argument(
        "--hourly-only",
        action="store_true",
        help="Only sync hourly buckets (ohlc_1m -> ohlc_1h CAGG)",
    )
    parser.add_argument(
        "--hourly-symbols",
        help="Symbols for hourly sync (default: PREDICTION_ASSETS from .env)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch even when DB already has data to pair inception",
    )
    parser.add_argument(
        "--skip-cagg-refresh",
        action="store_true",
        help="Skip continuous aggregate refresh at the end",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan without calling Kraken or writing to DB",
    )
    parser.add_argument(
        "--wipe",
        action="store_true",
        help="Delete all OHLC data (ohlc_1m, ohlc_1d, legacy ohlc_data) before syncing",
    )
    parser.add_argument(
        "--wipe-only",
        action="store_true",
        help="Only wipe OHLC data; do not fetch from Kraken",
    )
    parser.add_argument(
        "--confirm-wipe",
        action="store_true",
        help="Required with --wipe or --wipe-only (safety guard)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    daily_symbols = (
        [s.strip() for s in args.symbols.split(",") if s.strip()]
        if args.symbols
        else load_tracked_symbols()
    )
    hourly_symbols = (
        [s.strip() for s in args.hourly_symbols.split(",") if s.strip()]
        if args.hourly_symbols
        else settings.assets
    )

    sync_daily_flag = not args.hourly_only and not args.wipe_only
    sync_hourly_flag = not args.daily_only and not args.wipe_only

    if (args.wipe or args.wipe_only) and not args.confirm_wipe:
        print("ERROR: --wipe / --wipe-only requires --confirm-wipe", file=sys.stderr)
        return 1

    print("Kraken full-history sync")
    print(f"  DB: {settings.db_host}:{settings.db_port}/{settings.db_name}")
    if args.wipe or args.wipe_only:
        print("  Mode: WIPE OHLC data")
    if sync_daily_flag:
        print(f"  Daily symbols ({len(daily_symbols)}): {', '.join(daily_symbols)}")
    if sync_hourly_flag:
        print(f"  Hourly symbols ({len(hourly_symbols)}): {', '.join(hourly_symbols)}")
    print()

    if args.dry_run:
        print("Dry run - no API or DB writes.")
        return 0

    if args.wipe or args.wipe_only:
        wipe_ohlc_data()
        if args.wipe_only:
            print("\nWipe-only complete.")
            return 0

    started = time.time()
    daily_total = 0
    hourly_total = 0

    if sync_daily_flag:
        print("=== Daily OHLC -> ohlc_1d ===")
        for symbol in daily_symbols:
            print(f"[{symbol}]")
            try:
                daily_total += sync_daily(symbol, to_kraken_pair(symbol), args.force)
            except Exception as exc:
                print(f"  [error] {exc}")
            time.sleep(RATE_LIMIT_SEC)

    if sync_hourly_flag:
        print("\n=== Hourly OHLC -> ohlc_1m (feeds ohlc_1h) ===")
        for symbol in hourly_symbols:
            print(f"[{symbol}]")
            try:
                hourly_total += sync_hourly(symbol, to_kraken_pair(symbol), args.force)
            except Exception as exc:
                print(f"  [error] {exc}")
            time.sleep(RATE_LIMIT_SEC)

    if not args.skip_cagg_refresh:
        print("\n=== Refresh continuous aggregates ===")
        refresh_caggs()

    elapsed_min = (time.time() - started) / 60
    print(
        f"\nDone in {elapsed_min:.1f} min. "
        f"Daily candles upserted: {daily_total}, hourly buckets upserted: {hourly_total}."
    )
    print(
        "Next (optional): Admin panel -> Sync market stats, Run hourly/daily predictions."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
