import { useEffect, useState } from "react";
import { getBaseAsset } from "../utils/getCryptoIconPath";

function mapMarketData(data) {
  return {
    marketCap: data.market_cap,
    rank: data.market_cap_rank,
    supply: data.circulating_supply,
    volume: data.total_volume,
    ath: data.ath,
    athDate: data.ath_date,
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
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${encodeURIComponent(baseSymbol)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`CoinGecko request failed (${response.status})`);
        }

        const json = await response.json();
        if (cancelled) return;

        if (Array.isArray(json) && json.length > 0) {
          setStats(mapMarketData(json[0]));
        } else {
          setStats(null);
        }
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
