import { useEffect, useState } from "react";

const INTERVAL_MAP = {
  "1M": 1,
  "5M": 5,
  "1H": 60,
  "1D": 1440,
  "1W": 10080,
};

const MAX_LIVE_POINTS = 100;
const SHORT_INTERVAL_MINUTES = 5;

function normalizeSymbol(symbol) {
  return String(symbol).replace("-", "/").toUpperCase();
}

function getWindowSeconds(range, intervalMinutes) {
  if (range === "1W") {
    return null;
  }
  return intervalMinutes * 60 * MAX_LIVE_POINTS;
}

function filterByRange(items, range, intervalMinutes) {
  const windowSeconds = getWindowSeconds(range, intervalMinutes);
  if (windowSeconds == null || items.length === 0) {
    return items;
  }
  const latestTs = items[items.length - 1].timestamp;
  const cutoff = latestTs - windowSeconds;
  return items.filter((item) => item.timestamp >= cutoff);
}

export function formatChartTime(ts, range) {
  const date = new Date(ts * 1000);

  if (range === "1M" || range === "5M" || range === "1H") {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (range === "1D") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  }

  if (range === "1W") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function getBucketStart(tsSeconds, intervalMinutes) {
  const bucketSize = intervalMinutes * 60;
  return Math.floor(tsSeconds / bucketSize) * bucketSize;
}

function mapHistoryToChart(items, range) {
  return items.map((item) => ({
    timestamp: item.timestamp,
    time: formatChartTime(item.timestamp, range),
    price: Number(item.closePrice),
  }));
}

function trimIfShort(data, intervalMinutes) {
  if (intervalMinutes > SHORT_INTERVAL_MINUTES || data.length <= MAX_LIVE_POINTS) {
    return data;
  }
  return data.slice(data.length - MAX_LIVE_POINTS);
}

function getLivePrice(tick) {
  const bid = Number(tick.bid);
  const ask = Number(tick.ask);
  if (!Number.isNaN(bid) && !Number.isNaN(ask)) {
    return (bid + ask) / 2;
  }
  return !Number.isNaN(ask) ? ask : bid;
}

function getTickTimestampSeconds(tick) {
  if (tick.timestamp) {
    return Math.floor(new Date(tick.timestamp).getTime() / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function applyLiveTick(prev, tick, range, intervalMinutes) {
  const livePrice = getLivePrice(tick);
  if (Number.isNaN(livePrice)) {
    return prev;
  }

  const tickTs = getTickTimestampSeconds(tick);
  const bucket = getBucketStart(tickTs, intervalMinutes);

  if (prev.length === 0) {
    return trimIfShort(
      [{ timestamp: bucket, time: formatChartTime(bucket, range), price: livePrice }],
      intervalMinutes
    );
  }

  const last = prev[prev.length - 1];
  const lastBucket = getBucketStart(last.timestamp, intervalMinutes);

  let next;
  if (bucket === lastBucket) {
    next = [...prev.slice(0, -1), { ...last, price: livePrice }];
  } else if (bucket > lastBucket) {
    next = [
      ...prev,
      { timestamp: bucket, time: formatChartTime(bucket, range), price: livePrice },
    ];
  } else {
    return prev;
  }

  return trimIfShort(next, intervalMinutes);
}

const useLiveChart = (symbol, range) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedSymbol = normalizeSymbol(symbol);
  const intervalMinutes = INTERVAL_MAP[range];

  useEffect(() => {
    if (!symbol || !range || intervalMinutes === undefined) {
      setChartData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const token = localStorage.getItem("jwt");
    if (!token) {
      setChartData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      setChartData([]);

      const pathSymbol = symbol.replace("/", "");
      const fetchUrl = `${process.env.REACT_APP_URL}/api/history/${pathSymbol}?interval=${intervalMinutes}`;

      try {
        const response = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch history (${response.status})`);
        }

        const json = await response.json();
        const filtered = filterByRange(json, range, intervalMinutes);
        const seeded = trimIfShort(mapHistoryToChart(filtered, range), intervalMinutes);

        if (!cancelled) {
          setChartData(seeded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Error loading chart");
          setChartData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [symbol, range, intervalMinutes]);

  useEffect(() => {
    if (!normalizedSymbol || !range || intervalMinutes === undefined) {
      return undefined;
    }

    const socket = new WebSocket(`${process.env.REACT_APP_URL}/ws`);

    socket.onmessage = (event) => {
      try {
        const tick = JSON.parse(event.data);
        if (normalizeSymbol(tick.symbol) !== normalizedSymbol) {
          return;
        }
        setChartData((prev) => applyLiveTick(prev, tick, range, intervalMinutes));
      } catch (err) {
        console.error("Live chart tick parse error:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("Live chart WebSocket error:", err);
    };

    return () => {
      socket.close();
    };
  }, [normalizedSymbol, range, intervalMinutes]);

  return { chartData, loading, error };
};

export default useLiveChart;
