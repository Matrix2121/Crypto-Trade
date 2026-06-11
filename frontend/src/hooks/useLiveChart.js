import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePrices, { getTickMidPrice } from "./usePrices";
import {
  CHART_BUCKET_MS,
  CHART_RANGES,
  LIVE_CANDLE_PERIOD_MS,
  OHLC_WINDOW_MS,
} from "../constants/chartConfig";

export { CHART_RANGES };

// ─── Constants ────────────────────────────────────────────────────────────────

const FIFTEEN_S_BUCKET_MS = LIVE_CANDLE_PERIOD_MS;
const FIFTEEN_MIN_MS      = 15 * 60 * 1_000;
const MAX_TICK_POINTS     = 2_000;

// Ranges served from in-memory master caches (no API fetch per range).
const SHORT_TERM_RANGES = new Set(["1Min", "5Min", "15Min"]);

const TICK_WINDOW_MS = {
  "1Min":   1 * 60 * 1_000,
  "5Min":   5 * 60 * 1_000,
  "15Min": 15 * 60 * 1_000,
};

const OHLC_BUCKET_MS = CHART_BUCKET_MS;

const LIVE_OHLC_RANGES = Object.keys(OHLC_WINDOW_MS);

const LONG_OHLC_REFRESH_MS = 10 * 60_000;

// Master arrays replace the per-range tick/candle keys.
// Long OHLC ranges start as null (unfetched) and are populated lazily.
const EMPTY_CACHE = {
  masterTicks:      [],
  master15sCandles: [],
  "1H": null, "1D": null, "1W": null,
  "1M": null, "3M": null, "1Y": null, ALL: null,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function normalizeSymbol(symbol) {
  return String(symbol).replace("-", "/").toUpperCase();
}

function toTimestampMs(ts) {
  const n = Number(ts);
  if (Number.isNaN(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n;
}

function getLiveTickTimestampMs(tick) {
  if (tick?.timestamp instanceof Date) return tick.timestamp.getTime();
  if (tick?.timestamp) return toTimestampMs(tick.timestamp);
  return Date.now();
}

function toApiPathSymbol(symbol) {
  return normalizeSymbol(symbol).replace("/", "-");
}

function mapTicksToChart(items) {
  return items
    .map((item) => ({
      timestamp: toTimestampMs(item.timestamp),
      price: Number(item.price),
      bid: item.bid == null ? null : Number(item.bid),
      ask: item.ask == null ? null : Number(item.ask),
    }))
    .filter((p) => !Number.isNaN(p.price))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function mapOhlcToChart(items) {
  return items
    .map((item) => ({
      timestamp: toTimestampMs(item.timestamp),
      open:  Number(item.open),
      high:  Number(item.high),
      low:   Number(item.low),
      close: Number(item.close),
    }))
    .filter((p) => !Number.isNaN(p.close))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function filterByWindow(data, windowMs) {
  if (windowMs == null || data.length === 0) return data;
  const cutoff = Date.now() - windowMs;
  return data.filter((p) => p.timestamp >= cutoff);
}

/**
 * Insert null OHLC rows for missing buckets so the chart breaks lines at gaps
 * instead of drawing straight segments across missing time.
 */
function fillOhlcGaps(candles, bucketMs, windowMs) {
  if (!candles?.length || !bucketMs) return candles;

  const now = Date.now();
  const alignedEnd = floorToBucketMs(now, bucketMs);
  const alignedStart = windowMs != null
    ? floorToBucketMs(now - windowMs, bucketMs)
    : floorToBucketMs(candles[0].timestamp, bucketMs);

  // Snap to bucket grid so DB bucket timestamps match loop slots (Timescale
  // time_bucket boundaries may differ slightly from raw epoch ms).
  const byTs = new Map(
    candles.map((c) => [floorToBucketMs(c.timestamp, bucketMs), c]),
  );
  const result = [];

  for (let ts = alignedStart; ts <= alignedEnd; ts += bucketMs) {
    const existing = byTs.get(ts);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        timestamp: ts,
        open: null,
        high: null,
        low: null,
        close: null,
      });
    }
  }

  return result;
}

function floorToBucketMs(timestamp, bucketMs) {
  return Math.floor(timestamp / bucketMs) * bucketMs;
}

/**
 * Apply a live tick to a long-range OHLC series.
 * Updates the active bucket or appends a new candle when time advances.
 */
function applyLiveTickToOhlcCandles(candles, price, timestamp, bucketMs, windowMs) {
  if (!candles?.length) return candles;

  const bucket = floorToBucketMs(timestamp, bucketMs);
  const last = candles[candles.length - 1];
  let updated;

  if (last.timestamp === bucket) {
    updated = [
      ...candles.slice(0, -1),
      {
        ...last,
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
      },
    ];
  } else if (bucket > last.timestamp) {
    const open = last.close;
    updated = [
      ...candles,
      {
        timestamp: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
      },
    ];
  } else {
    const idx = candles.findIndex((c) => c.timestamp === bucket);
    if (idx < 0) return candles;
    const candle = candles[idx];
    updated = [...candles];
    updated[idx] = {
      ...candle,
      close: price,
      high: Math.max(candle.high, price),
      low: Math.min(candle.low, price),
    };
  }

  return filterByWindow(updated, windowMs);
}

// ─── Network ──────────────────────────────────────────────────────────────────

async function fetchRangeHistory(symbol, range) {
  const pathSegment = toApiPathSymbol(symbol);
  const url = `${process.env.REACT_APP_API_URL}/api/history/${pathSegment}?range=${encodeURIComponent(range)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(
    `Failed to fetch chart data for ${pathSegment} range=${range} (${response.status})`
  );
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid chart data response");
  return data;
}

async function fetchLiveContext(symbol) {
  const pathSegment = toApiPathSymbol(symbol);
  const url = `${process.env.REACT_APP_API_URL}/api/history/live-context/${pathSegment}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(
    `Failed to fetch live context for ${pathSegment} (${response.status})`
  );
  return response.json(); // { ticks: [...], candles15s: [...] }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const useLiveChart = (symbol, initialRange = "1Min", chartMode = "line") => {
  const [range, setRange]         = useState(initialRange);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartType, setChartType] = useState("TICK");

  const cache          = useRef({ ...EMPTY_CACHE });
  const lastLiveKeyRef = useRef(null);
  const latestLiveRef  = useRef({ price: null, timestamp: null });

  // Refs mirror the latest range/chartMode values so stable callbacks can read
  // them without needing those values in their dependency arrays.
  const rangeRef     = useRef(range);
  const chartModeRef = useRef(chartMode);
  rangeRef.current     = range;
  chartModeRef.current = chartMode;

  const prices           = usePrices();
  const normalizedSymbol = normalizeSymbol(symbol);

  const liveTick = useMemo(
    () => prices.find((tick) => normalizeSymbol(tick.symbol) === normalizedSymbol),
    [prices, normalizedSymbol]
  );

  // ── updateShortTermChart ──────────────────────────────────────────────────
  // Stable helper (empty deps). Reads range and chartMode from refs at call time.
  // Filters the master caches to the window of the current range and drives a
  // re-render. No-ops when the current range is not a short-term range.
  const updateShortTermChart = useCallback(() => {
    const r  = rangeRef.current;
    const cm = chartModeRef.current;
    if (!SHORT_TERM_RANGES.has(r)) return;

    const cutoff = Date.now() - TICK_WINDOW_MS[r];

    if (cm === "candle") {
      const filtered = (cache.current.master15sCandles || []).filter(
        (c) => c.timestamp >= cutoff
      );
      setChartType("OHLC");
      setChartData(filtered);
    } else {
      const raw      = (cache.current.masterTicks || []).filter(
        (t) => t.timestamp >= cutoff
      );
      const windowed = raw.length <= MAX_TICK_POINTS ? raw : raw.slice(-MAX_TICK_POINTS);
      setChartType("TICK");
      setChartData(windowed);
    }
  }, []); // stable — all data accessed via refs or module constants

  // ── Effect A: re-filter on range / chartMode / symbol change ─────────────
  // Toggling Line↔Candle or switching between short-term timeframes is instant
  // because data is already in the master caches; no network call needed.
  useEffect(() => {
    if (!SHORT_TERM_RANGES.has(range)) return;
    updateShortTermChart();
  }, [range, chartMode, symbol, updateShortTermChart]);

  // ── Effect B: fetch long-term OHLC data from API ──────────────────────────
  useEffect(() => {
    if (!symbol || !range) return undefined;
    if (SHORT_TERM_RANGES.has(range)) return undefined; // handled by Effect A

    const windowMs = OHLC_WINDOW_MS[range];
    if (!(range in OHLC_WINDOW_MS)) return undefined;

    // Cache hit
    const cached = cache.current[range];
    if (Array.isArray(cached)) {
      setChartType("OHLC");
      setChartData(cached);
      setIsLoading(false);
      return undefined;
    }

    setChartType("OHLC");
    setIsLoading(true);
    setChartData([]);
    lastLiveKeyRef.current = null;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        const raw     = await fetchRangeHistory(symbol, range);
        if (cancelled) return;
        const bucketMs = OHLC_BUCKET_MS[range];
        const fetched = fillOhlcGaps(
          filterByWindow(mapOhlcToChart(raw), windowMs),
          bucketMs,
          windowMs,
        );
        const { price: livePrice, timestamp: liveTs } = latestLiveRef.current;
        const merged = livePrice != null && bucketMs
          ? applyLiveTickToOhlcCandles(fetched, livePrice, liveTs, bucketMs, windowMs)
          : fetched;
        cache.current[range] = merged;
        setChartData(merged);
      } catch (err) {
        console.error("useLiveChart history fetch error:", err);
        if (!cancelled) setChartData([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadHistory();
    return () => { cancelled = true; };
  }, [symbol, range]);

  // ── Effect B2: periodically refresh long OHLC from API (fills aggregation gaps)
  useEffect(() => {
    if (!symbol || !range) return undefined;
    if (SHORT_TERM_RANGES.has(range)) return undefined;

    const windowMs = OHLC_WINDOW_MS[range];
    if (!(range in OHLC_WINDOW_MS)) return undefined;

    let cancelled = false;

    const refreshHistory = async () => {
      try {
        const raw = await fetchRangeHistory(symbol, range);
        if (cancelled) return;
        const bucketMs = OHLC_BUCKET_MS[range];
        const fetched = fillOhlcGaps(
          filterByWindow(mapOhlcToChart(raw), windowMs),
          bucketMs,
          windowMs,
        );
        const { price: livePrice, timestamp: liveTs } = latestLiveRef.current;
        const merged = livePrice != null && bucketMs
          ? applyLiveTickToOhlcCandles(fetched, livePrice, liveTs, bucketMs, windowMs)
          : fetched;
        cache.current[range] = merged;
        if (rangeRef.current === range) {
          setChartData(merged);
        }
      } catch (err) {
        console.warn("useLiveChart periodic refresh error:", err);
      }
    };

    const intervalId = setInterval(refreshHistory, LONG_OHLC_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [symbol, range]);

  // ── Effect C: seed master caches from live-context on mount / symbol change ─
  // Also resets all per-symbol state so switching coins is clean.
  useEffect(() => {
    if (!symbol) return undefined;

    // Full reset whenever the symbol changes.
    cache.current          = { ...EMPTY_CACHE };
    lastLiveKeyRef.current = null;
    latestLiveRef.current  = { price: null, timestamp: null };

    // Show a spinner while the first live-context payload is in flight, but
    // only if the current range is a short-term one (OHLC Effect B manages its
    // own loading state independently).
    if (SHORT_TERM_RANGES.has(rangeRef.current)) {
      setIsLoading(true);
    }

    let cancelled = false;

    const loadLiveContext = async () => {
      try {
        const ctx = await fetchLiveContext(symbol);
        if (cancelled) return;

        cache.current.masterTicks      = mapTicksToChart(
          Array.isArray(ctx.ticks)     ? ctx.ticks     : []
        );
        cache.current.master15sCandles = mapOhlcToChart(
          Array.isArray(ctx.candles15s) ? ctx.candles15s : []
        );

        // Populate the chart immediately if the user is on a short-term range.
        updateShortTermChart();
      } catch (err) {
        console.warn("useLiveChart: live-context fetch failed:", err);
      } finally {
        // Only clear our own loading flag — OHLC Effect B clears its own.
        if (!cancelled && SHORT_TERM_RANGES.has(rangeRef.current)) {
          setIsLoading(false);
        }
      }
    };

    loadLiveContext();
    return () => { cancelled = true; };
  }, [symbol, updateShortTermChart]);

  // ── Effect D: WebSocket tick → dual-write to master caches + OHLC wiggle ──
  useEffect(() => {
    if (!liveTick) return;
    if (normalizeSymbol(liveTick.symbol) !== normalizedSymbol) return;

    const price = getTickMidPrice(liveTick);
    if (price == null || Number.isNaN(price)) return;

    const timestamp = getLiveTickTimestampMs(liveTick);
    latestLiveRef.current = { price, timestamp };
    const liveKey   = `${timestamp}|${price}`;
    if (lastLiveKeyRef.current === liveKey) return;
    lastLiveKeyRef.current = liveKey;

    const bid      = liveTick.bid == null ? null : Number(liveTick.bid);
    const ask      = liveTick.ask == null ? null : Number(liveTick.ask);
    const newPoint = { timestamp, price, bid, ask };

    // ── Master ticks: append + prune to 15-min rolling window ────────────────
    const cutoff15m       = timestamp - FIFTEEN_MIN_MS;
    const prevTicks       = cache.current.masterTicks || [];
    const prunedTicks     = prevTicks.filter((t) => t.timestamp >= cutoff15m);
    const lastTickTs      = prunedTicks.length > 0
      ? prunedTicks[prunedTicks.length - 1].timestamp
      : 0;
    cache.current.masterTicks = timestamp > lastTickTs
      ? [...prunedTicks, newPoint]
      : prunedTicks;

    // ── Master 15s candles: bucket-aware update / append ──────────────────────
    const c15s   = cache.current.master15sCandles || [];
    const bucket = Math.floor(timestamp / FIFTEEN_S_BUCKET_MS) * FIFTEEN_S_BUCKET_MS;
    const last15 = c15s.length > 0 ? c15s[c15s.length - 1] : null;

    if (last15?.timestamp === bucket) {
      cache.current.master15sCandles = [
        ...c15s.slice(0, -1),
        {
          ...last15,
          close: price,
          high:  Math.max(last15.high, price),
          low:   Math.min(last15.low,  price),
        },
      ];
    } else if (last15 == null || bucket > last15.timestamp) {
      cache.current.master15sCandles = [
        ...c15s,
        { timestamp: bucket, open: price, high: price, low: price, close: price },
      ];
    }

    // ── Long OHLC ranges: update active bucket or append when time advances ───
    LIVE_OHLC_RANGES.forEach((ohlcRange) => {
      const candles = cache.current[ohlcRange];
      if (!candles || candles.length === 0) return;
      const bucketMs = OHLC_BUCKET_MS[ohlcRange];
      const windowMs = OHLC_WINDOW_MS[ohlcRange];
      if (!bucketMs) return;
      cache.current[ohlcRange] = applyLiveTickToOhlcCandles(
        candles,
        price,
        timestamp,
        bucketMs,
        windowMs,
      );
    });

    // ── Drive a re-render for the currently visible range ─────────────────────
    if (SHORT_TERM_RANGES.has(range)) {
      updateShortTermChart();
    } else if (cache.current[range] != null) {
      setChartData(cache.current[range]);
    }
  }, [liveTick, range, normalizedSymbol, updateShortTermChart]);

  return { chartData, isLoading, chartType, range, setRange, liveTick };
};

export default useLiveChart;
