import { useEffect, useState } from "react";

function buildStatsDict(assets) {
  const statsDict = {};
  if (!Array.isArray(assets)) {
    return statsDict;
  }
  assets.forEach((asset) => {
    if (!asset?.symbol) return;
    const base = asset.symbol.split("/")[0].toLowerCase();
    statsDict[base] = {
      rank: asset.marketRank ?? null,
      marketCap: asset.marketCap ?? null,
      change24h: asset.change24h ?? null,
    };
  });
  return statsDict;
}

const REFRESH_MS = 5 * 60 * 1000;

const useGlobalMarketStats = () => {
  const [globalStats, setGlobalStats] = useState({});
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchGlobalStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/market-stats/global`
        );
        if (!response.ok) {
          throw new Error(`Market stats request failed (${response.status})`);
        }

        const data = await response.json();
        if (cancelled) return;

        setGlobalStats(buildStatsDict(data));
      } catch (err) {
        console.error("useGlobalMarketStats fetch error:", err);
        if (!cancelled) {
          setGlobalStats({});
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchGlobalStats();

    const retryTimer = setTimeout(() => {
      if (!cancelled) {
        fetchGlobalStats();
      }
    }, 8000);

    const refreshTimer = setInterval(() => {
      if (!cancelled) {
        fetchGlobalStats();
      }
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(refreshTimer);
    };
  }, []);

  return { globalStats, isLoadingStats };
};

export default useGlobalMarketStats;
