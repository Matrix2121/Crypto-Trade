import { useCallback, useState } from "react";

const API = process.env.REACT_APP_API_URL;

function authHeaders() {
  const token = localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function usePredictions() {
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPredictions = useCallback(async (symbol, limit = 50) => {
    setLoading(true);
    setError(null);
    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch(
          `${API}/api/predictions/${encodeURIComponent(symbol)}/latest`,
          { headers: authHeaders() },
        ),
        fetch(
          `${API}/api/predictions/${encodeURIComponent(symbol)}/history?limit=${limit}`,
          { headers: authHeaders() },
        ),
      ]);
      if (!latestRes.ok) {
        if (latestRes.status === 404) {
          throw new Error("No predictions yet — run hourly/daily predictions from the admin panel.");
        }
        throw new Error("Failed to load prediction");
      }
      if (!historyRes.ok) throw new Error("Failed to load prediction history");
      const latest = await latestRes.json();
      const historyData = await historyRes.json();
      const rows = Array.isArray(historyData) ? historyData : [];
      setPrediction(latest);
      setHistory(rows);
      return { latest, history: rows };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    prediction,
    history,
    loading,
    error,
    loadPredictions,
  };
}
