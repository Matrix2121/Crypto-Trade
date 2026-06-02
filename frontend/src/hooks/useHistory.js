import { useEffect, useState } from "react";

const INTERVAL_MAP = {
  "1D": 15,
  "1W": 60,
  "1M": 240,
  "3M": 1440,
  "1Y": 10080,
  ALL: 10080,
};

const RANGE_SECONDS = {
  "1D": 24 * 60 * 60,
  "1W": 7 * 24 * 60 * 60,
  "1M": 30 * 24 * 60 * 60,
  "3M": 90 * 24 * 60 * 60,
  "1Y": 365 * 24 * 60 * 60,
  ALL: null,
};

function filterByRange(items, range) {
  const windowSeconds = RANGE_SECONDS[range];
  if (windowSeconds == null || items.length === 0) {
    return items;
  }
  const latestTs = items[items.length - 1].timestamp;
  const cutoff = latestTs - windowSeconds;
  return items.filter((item) => item.timestamp >= cutoff);
}

export function formatTime(ts, range) {
  const date = new Date(ts * 1000);

  if (range === "1D") {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (range === "1W" || range === "1M" || range === "3M") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  }

  if (range === "1Y" || range === "ALL") {
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

function mapToChartData(items, range) {
  return items.map((item) => ({
    timestamp: item.timestamp,
    time: formatTime(item.timestamp, range),
    price: Number(item.close),
  }));
}

const useHistory = (symbol, range) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol || !range) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const token = localStorage.getItem("jwt");
    if (!token) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const interval = INTERVAL_MAP[range];
    if (interval === undefined) {
      setData([]);
      setLoading(false);
      setError("Invalid chart range");
      return;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      const pathSymbol = symbol.replace("/", "");
      const fetchUrl = `${process.env.REACT_APP_URL}/api/history/${pathSymbol}/ohlc?interval=${interval}`;

      try {
        const response = await fetch(fetchUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch history (${response.status})`);
        }

        const json = await response.json();
        const filtered = filterByRange(json, range);

        if (!cancelled) {
          setData(mapToChartData(filtered, range));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Error loading chart");
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  return { data, loading, error };
};

export default useHistory;
