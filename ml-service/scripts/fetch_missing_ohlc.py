"""Backfill 1h OHLC for ML training.

Kraken's OHLC endpoint returns at most 720 recent candles and cannot page into
older history. For lookbacks beyond ~30 days we paginate the Trades endpoint
(nanosecond ``since`` cursor) and resample to 1h candles locally.
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml_service.config import settings
from ml_service.db import execute_many, fetch_one

KRAKEN_PAIR = {
    "BTC/USD": "XBTUSD",
    "ETH/USD": "ETHUSD",
    "SOL/USD": "SOLUSD",
    "LINK/USD": "LINKUSD",
}

KRAKEN_OHLC_URL = "https://api.kraken.com/0/public/OHLC"
KRAKEN_TRADES_URL = "https://api.kraken.com/0/public/Trades"
RATE_LIMIT_SEC = 1.2
TRADES_FLUSH_HOURS = 24
LOG_EVERY_PAGES = 25
MAX_RATE_LIMIT_RETRIES = 6

UPSERT_SQL = """
INSERT INTO ohlc_1m (symbol, bucket, open, high, low, close, volume)
VALUES (:symbol, to_timestamp(:ts / 1000.0), :open, :high, :low, :close, :volume)
ON CONFLICT (symbol, bucket) DO UPDATE SET
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume
"""


def _kraken_get(url: str, params: dict) -> dict:
    for attempt in range(1, MAX_RATE_LIMIT_RETRIES + 1):
        with httpx.Client(timeout=60) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        errors = data.get("error") or []
        if any("Too many requests" in str(e) for e in errors):
            wait = RATE_LIMIT_SEC * (2 ** attempt)
            print(f"  [rate limit] backing off {wait:.1f}s (attempt {attempt})")
            time.sleep(wait)
            continue
        if errors:
            raise RuntimeError(errors)
        return data
    raise RuntimeError("Kraken rate limit exceeded after retries")


def fetch_kraken_ohlc(pair: str, interval: int = 60) -> list[dict]:
    data = _kraken_get(KRAKEN_OHLC_URL, {"pair": pair, "interval": interval})
    result = data.get("result", {})
    key = next(k for k in result if k != "last")
    return [
        {
            "timestamp": int(row[0]) * 1000,
            "open": float(row[1]),
            "high": float(row[2]),
            "low": float(row[3]),
            "close": float(row[4]),
            "volume": float(row[6]),
        }
        for row in result[key]
    ]


def fetch_kraken_trades_page(pair: str, since_ns: int) -> tuple[list[tuple[float, float, float]], int]:
    data = _kraken_get(KRAKEN_TRADES_URL, {"pair": pair, "since": since_ns})
    result = data.get("result", {})
    key = next(k for k in result if k != "last")
    rows = result[key]
    trades = [(float(r[0]), float(r[1]), float(r[2])) for r in rows]
    return trades, int(result["last"])


def trades_to_1h_candles(trades: list[tuple[float, float, float]]) -> list[dict]:
    if not trades:
        return []
    df = pd.DataFrame(trades, columns=["price", "volume", "time_sec"])
    df["dt"] = pd.to_datetime(df["time_sec"], unit="s", utc=True)
    grouped = df.set_index("dt").resample("1h").agg(
        {"price": ["first", "max", "min", "last"], "volume": "sum"}
    )
    grouped.columns = ["open", "high", "low", "close", "volume"]
    grouped = grouped.dropna(subset=["open"])
    candles = []
    for ts, row in grouped.iterrows():
        candles.append(
            {
                "timestamp": int(ts.timestamp() * 1000),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
            }
        )
    return candles


def upsert_candles(symbol: str, candles: list[dict]) -> int:
    if not candles:
        return 0
    execute_many(
        UPSERT_SQL,
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
            for c in candles
        ],
    )
    return len(candles)


def _lookback_start_ms(lookback_days: int) -> int:
    since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    return int(since_dt.timestamp() * 1000)


def needs_backfill(symbol: str, lookback_days: int) -> tuple[bool, str]:
    row = fetch_one(
        """
        SELECT COUNT(*) AS cnt,
               COALESCE(SUM(CASE WHEN volume > 0 THEN 1 ELSE 0 END), 0) AS with_volume,
               CAST(EXTRACT(EPOCH FROM MIN(bucket)) * 1000 AS BIGINT) AS min_ts
        FROM ohlc_1h WHERE symbol = :s
        """,
        {"s": symbol},
    )
    if not row or row["cnt"] == 0:
        return True, "no 1h candles"

    target_ms = _lookback_start_ms(lookback_days)
    min_expected = int(lookback_days * 24 * 0.9)
    with_volume = int(row["with_volume"])
    min_ts = row["min_ts"]

    if with_volume < min_expected:
        return True, f"only {with_volume} candles with volume (need ~{min_expected})"
    if min_ts is None or int(min_ts) > target_ms:
        oldest = datetime.fromtimestamp(int(min_ts) / 1000, tz=timezone.utc) if min_ts else None
        return True, f"oldest candle {oldest} does not reach {lookback_days}d lookback"
    return False, f"{with_volume} candles, oldest ts={min_ts}"


def backfill_from_trades(
    symbol: str,
    pair: str,
    since_ms: int,
    until_ms: int | None = None,
) -> int:
    """Paginate Kraken trades and upsert resampled 1h candles."""
    since_ns = since_ms * 1_000_000
    until_ms = until_ms or int(datetime.now(timezone.utc).timestamp() * 1000)
    until_sec = until_ms / 1000

    cursor = since_ns
    pending: list[tuple[float, float, float]] = []
    total = 0
    pages = 0
    flush_through_sec = since_ms / 1000

    print(f"  trades backfill from {datetime.fromtimestamp(since_ms/1000, tz=timezone.utc).date()}")

    while True:
        prev_cursor = cursor
        trades, last_ns = fetch_kraken_trades_page(pair, cursor)
        pages += 1
        if not trades:
            break

        pending.extend(trades)
        last_trade_sec = trades[-1][2]
        cursor = last_ns

        flush_cutoff_sec = last_trade_sec - TRADES_FLUSH_HOURS * 3600
        if flush_cutoff_sec > flush_through_sec and pending:
            complete = [t for t in pending if t[2] < flush_cutoff_sec]
            keep = [t for t in pending if t[2] >= flush_cutoff_sec]
            candles = trades_to_1h_candles(complete)
            if candles:
                total += upsert_candles(symbol, candles)
            pending = keep
            flush_through_sec = flush_cutoff_sec
            if pages % LOG_EVERY_PAGES == 0:
                print(
                    f"  page {pages}: through "
                    f"{datetime.fromtimestamp(flush_cutoff_sec, tz=timezone.utc).date()}, "
                    f"{total} candles saved"
                )

        if last_trade_sec >= until_sec - 3600:
            break
        if cursor <= prev_cursor:
            break

        time.sleep(RATE_LIMIT_SEC)

    if pending:
        candles = trades_to_1h_candles(pending)
        total += upsert_candles(symbol, candles)

    print(f"  trades done: {pages} pages, {total} candles upserted")
    return total


def backfill_asset(symbol: str, lookback_days: int | None = None) -> int:
    lookback_days = lookback_days or settings.ohlc_training_lookback_days
    should_fetch, reason = needs_backfill(symbol, lookback_days)
    if not should_fetch:
        print(f"[SKIP] {symbol}: {reason}")
        return 0
    print(f"[FETCH] {symbol}: {reason}")

    pair = KRAKEN_PAIR.get(symbol)
    if not pair:
        print(f"[SKIP] {symbol}: no Kraken pair mapping")
        return 0

    target_ms = _lookback_start_ms(lookback_days)
    total = 0

    # Recent window: fast OHLC call (max 720 candles).
    recent = fetch_kraken_ohlc(pair)
    time.sleep(RATE_LIMIT_SEC)
    if recent:
        total += upsert_candles(symbol, recent)
        oldest_recent_ms = min(c["timestamp"] for c in recent)
        print(f"  OHLC window: {len(recent)} candles (oldest {datetime.fromtimestamp(oldest_recent_ms/1000, tz=timezone.utc)})")
    else:
        oldest_recent_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    # Historical gap: trades pagination (OHLC cannot page past 720 candles).
    if target_ms < oldest_recent_ms:
        existing = fetch_one(
            """
            SELECT CAST(EXTRACT(EPOCH FROM MIN(bucket)) * 1000 AS BIGINT) AS min_ts
            FROM ohlc_1h
            WHERE symbol = :s AND volume > 0
            """,
            {"s": symbol},
        )
        trade_until_ms = oldest_recent_ms
        if existing and existing["min_ts"]:
            existing_min = int(existing["min_ts"])
            if existing_min <= target_ms:
                print(f"[OK]   {symbol}: {total} candles refreshed ({lookback_days}d already covered)")
                return total
            if existing_min < oldest_recent_ms:
                trade_until_ms = existing_min
                print(
                    f"  resume until existing oldest "
                    f"{datetime.fromtimestamp(existing_min / 1000, tz=timezone.utc)}"
                )
        total += backfill_from_trades(symbol, pair, target_ms, until_ms=trade_until_ms)

    print(f"[OK]   {symbol}: upserted {total} 1h candles ({lookback_days}d lookback)")
    return total


def main() -> int:
    lookback = settings.ohlc_training_lookback_days
    print(f"Backfilling 1h OHLC for {len(settings.assets)} assets ({lookback}d lookback)")
    for asset in settings.assets:
        backfill_asset(asset, lookback_days=lookback)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
