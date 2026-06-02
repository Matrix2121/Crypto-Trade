import { useEffect, useState } from "react";

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false";

function buildStatsDict(data) {
  const statsDict = {};
  data.forEach((coin) => {
    statsDict[coin.symbol.toLowerCase()] = {
      rank: coin.market_cap_rank,
      marketCap: coin.market_cap,
      change24h: coin.price_change_percentage_24h,
    };
  });
  return statsDict;
}

const useGlobalMarketStats = () => {
  const [globalStats, setGlobalStats] = useState({});
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchGlobalStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch(COINGECKO_MARKETS_URL);
        if (!response.ok) {
          throw new Error(`CoinGecko request failed (${response.status})`);
        }

        const data = await response.json();
        if (cancelled) return;

        if (Array.isArray(data)) {
          setGlobalStats(buildStatsDict(data));
        } else {
          setGlobalStats({});
        }
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

    return () => {
      cancelled = true;
    };
  }, []);

  return { globalStats, isLoadingStats };
};

export default useGlobalMarketStats;
