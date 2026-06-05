import { useEffect, useState } from "react";
import { getBaseAsset } from "../utils/getCryptoIconPath";

function toPathSymbol(symbol) {
  return String(symbol).replace("/", "-");
}

function mapMarketData(data) {
  return {
    marketCap: data.marketCap ?? null,
    rank: data.marketRank ?? null,
    supply: data.circulatingSupply ?? null,
    volume: data.volume24h ?? null,
    ath: data.allTimeHigh != null ? Number(data.allTimeHigh) : null,
    athDate: data.athTimestamp ?? null,
  };
}

const useCoinStats = (symbol) => {
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    const baseSymbol = getBaseAsset(symbol);
    if (!baseSymbol) {
      setStats(null);
      setIsLoadingStats(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoadingStats(true);
    setStats(null);

    const fetchStats = async () => {
      try {
        const pathSymbol = toPathSymbol(symbol);
        const url = `${process.env.REACT_APP_API_URL}/api/market-stats/${encodeURIComponent(pathSymbol)}`;
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) setStats(null);
            return;
          }
          throw new Error(`Market stats request failed (${response.status})`);
        }

        const data = await response.json();
        if (cancelled) return;

        setStats(mapMarketData(data));
      } catch (err) {
        console.error("useCoinStats fetch error:", err);
        if (!cancelled) {
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { stats, isLoadingStats };
};

export default useCoinStats;
