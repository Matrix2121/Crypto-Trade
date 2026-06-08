import { useCallback, useState } from "react";

const API = process.env.REACT_APP_API_URL;

export default function useBacktest() {
  const [summary, setSummary] = useState(null);
  const [drift, setDrift] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async (asset) => {
    setLoading(true);
    try {
      const qs = asset ? `?asset=${encodeURIComponent(asset)}` : "";
      const res = await fetch(`${API}/api/predictions/backtest/summary${qs}`);
      if (!res.ok) throw new Error("Failed to load backtest summary");
      const data = await res.json();
      setSummary(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDrift = useCallback(async (symbol, days = 7) => {
    const res = await fetch(
      `${API}/api/predictions/backtest/drift/${encodeURIComponent(symbol)}?days=${days}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    setDrift(Array.isArray(data) ? data : []);
    return data;
  }, []);

  return { summary, drift, loading, fetchSummary, fetchDrift };
}
