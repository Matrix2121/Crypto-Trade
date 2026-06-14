import { useCallback, useState } from "react";
import { apiUrl } from "../config/api";

function authHeaders() {
  const token = localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function useBacktest() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/predictions/backtest/summary"), {
        headers: authHeaders(),
      });
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
        apiUrl(
          `/api/predictions/backtest/drift/${encodeURIComponent(symbol)}?days=${days}`
        ),
        { headers: authHeaders() }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Backtest drift fetch error:", err);
      return [];
    }
  }, []);

  return { summary, loading, error, fetchSummary, fetchDrift };
}
