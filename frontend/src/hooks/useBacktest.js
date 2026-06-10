import { useCallback, useState } from "react";
import { apiUrl } from "../config/api";

export default function useBacktest() {
  const [summary, setSummary] = useState(null);
  const [drift, setDrift] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async (asset) => {
    setLoading(true);
    setError(null);
    try {
      const qs = asset ? `?asset=${encodeURIComponent(asset)}` : "";
      const res = await fetch(apiUrl(`/api/predictions/backtest/summary${qs}`));
      if (!res.ok) throw new Error("Failed to load backtest summary");
      const data = await res.json();
      setSummary(data);
      return data;
    } catch (err) {
      console.error("Backtest summary fetch error:", err);
      setSummary(null);
      setError(err.message || "Failed to load backtest summary");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDrift = useCallback(async (symbol, days = 7) => {
    try {
      const res = await fetch(
        apiUrl(`/api/predictions/backtest/drift/${encodeURIComponent(symbol)}?days=${days}`)
      );
      if (!res.ok) return [];
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setDrift(rows);
      return rows;
    } catch (err) {
      console.error("Backtest drift fetch error:", err);
      setDrift([]);
      return [];
    }
  }, []);

  return { summary, drift, loading, error, fetchSummary, fetchDrift };
}
