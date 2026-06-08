import { useCallback, useState } from "react";

const API = process.env.REACT_APP_API_URL;

export default function usePortfolioAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async (userId) => {
    if (!userId) return null;
    setLoading(true);
    try {
      const token = localStorage.getItem("jwt");
      const res = await fetch(`${API}/api/portfolio/analytics/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load portfolio analytics");
      const data = await res.json();
      setAnalytics(data);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analytics, loading, fetchAnalytics };
}
