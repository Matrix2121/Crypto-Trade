import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePrices from "../../hooks/usePrices";
import useGlobalMarketStats from "../../hooks/useGlobalMarketStats";
import { normalizeCryptoCode, useFavorites } from "../../context/FavoritesContext";
import FlashPrice from "../../components/FlashPrice";
import {
  getCryptoIconPath,
  handleCryptoIconError,
} from "../../utils/getCryptoIconPath";
import "./Market.css";

const TABS = [
  { id: "all", label: "All Cryptos" },
  { id: "gainers", label: "Top Gainers" },
  { id: "losers", label: "Top Losers" },
];

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  if (num >= 1000) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function formatChange(value) {
  if (value == null || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatLastUpdated(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRowUpdated(timestamp) {
  if (timestamp == null) return "—";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

function isEffectivelyZero(value) {
  return value === 0 || (value != null && Math.abs(value) < 1e-10);
}

function computeTickChange(current, previous) {
  if (current == null || previous == null) return null;
  const cur = Number(current);
  const prev = Number(previous);
  if (Number.isNaN(cur) || Number.isNaN(prev)) return null;
  const change = cur - prev;
  if (isEffectivelyZero(change)) return null;
  return change;
}

function getChangeClass(change24h) {
  if (change24h == null || Number.isNaN(change24h)) return "neutral";
  if (change24h > 0) return "positive";
  if (change24h < 0) return "negative";
  return "neutral";
}

function compareByRank(a, b) {
  const rankA = a.rank ?? Number.POSITIVE_INFINITY;
  const rankB = b.rank ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;
  return a.symbol.localeCompare(b.symbol);
}

const Market = () => {
  const navigate = useNavigate();
  const prices = usePrices();
  const deferredPrices = useDeferredValue(prices);
  const { globalStats } = useGlobalMarketStats();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const tickSignature = useMemo(
    () => prices.map((p) => `${p.symbol}:${p.bid}:${p.ask}`).join("|"),
    [prices]
  );

  useEffect(() => {
    if (!tickSignature) return;
    setLastUpdate(new Date());
  }, [tickSignature]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = deferredPrices
      .filter((tick) => tick?.symbol)
      .map((tick) => {
        const base = tick.symbol.split("/")[0];
        const baseAsset = base.toLowerCase();
        const stats = globalStats[baseAsset] || {};

        return {
          ...tick,
          base,
          rank: stats.rank,
          marketCap: stats.marketCap,
          change24h: stats.change24h ?? null,
          bidTickChange: computeTickChange(tick.bid, tick.previousBid),
          askTickChange: computeTickChange(tick.ask, tick.previousAsk),
        };
      });

    if (query) {
      list = list.filter(
        (row) =>
          row.symbol.toLowerCase().includes(query) ||
          row.base.toLowerCase().includes(query)
      );
    }

    if (activeTab === "gainers") {
      list = list
        .filter((row) => row.change24h != null && row.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h);
    } else if (activeTab === "losers") {
      list = list
        .filter((row) => row.change24h != null && row.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h);
    } else {
      list = [...list].sort(compareByRank);
    }

    return list;
  }, [deferredPrices, search, activeTab, globalStats]);

  const rowTarget = (symbol) => `/market/${symbol.replace("/", "-")}`;

  const handleRowNavigate = (symbol) => {
    navigate(rowTarget(symbol));
  };

  if (!deferredPrices.length) {
    return (
      <div className="market-dashboard">
        <p className="market-status">Loading market data...</p>
      </div>
    );
  }

  return (
    <div className="market-dashboard">
      <header className="market-header">
        <div>
          <h1 className="market-title">Markets</h1>
          <p className="market-subtitle">
            Live spot prices · {deferredPrices.length} pairs · Last updated {formatLastUpdated(lastUpdate)}
          </p>
        </div>
      </header>

      <div className="market-toolbar">
        <input
          type="search"
          className="market-search"
          placeholder="Search by name or symbol (e.g. BTC, ETH/USD)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search markets"
        />

        <div className="market-tabs" role="tablist" aria-label="Market categories">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`market-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="market-table-wrap">
        <table className="market-table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-asset">Asset</th>
              <th className="col-bid-ask">Bid / Ask</th>
              <th className="col-mcap">Market Cap</th>
              <th className="col-change">24h Change</th>
              <th className="col-updated">Updated</th>
              <th className="col-favorite" aria-label="Favorites" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="market-empty">
                  No markets match your search.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const changeClass = getChangeClass(row.change24h);
                const target = rowTarget(row.symbol);
                const cryptoCode = normalizeCryptoCode(row.symbol);
                const favorited = isFavorite(cryptoCode);

                return (
                  <tr
                    key={row.symbol}
                    className="market-row"
                    onClick={() => handleRowNavigate(row.symbol)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowNavigate(row.symbol);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open ${row.symbol} trading page`}
                  >
                    <td className="col-rank mono">{row.rank ?? "-"}</td>
                    <td className="col-asset">
                      <div className="asset-cell">
                        <img
                          className="asset-icon"
                          src={getCryptoIconPath(row.symbol)}
                          alt=""
                          width={20}
                          height={20}
                          onError={handleCryptoIconError}
                        />
                        <div className="asset-names">
                          <Link className="asset-base" to={target} title={row.symbol} onClick={(e) => e.stopPropagation()}>
                            {row.base}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="col-bid-ask mono">
                      <div className="price-stack">
                        <div className="price-stack-row">
                          <span className="price-label">B:</span>
                          <FlashPrice
                            value={row.bid}
                            previousValue={row.previousBid}
                            delta={row.bidTickChange}
                            showChange
                            changeLayout="inline"
                          >
                            {formatPrice(row.bid)}
                          </FlashPrice>
                        </div>
                        <div className="price-stack-row">
                          <span className="price-label">A:</span>
                          <FlashPrice
                            value={row.ask}
                            previousValue={row.previousAsk}
                            delta={row.askTickChange}
                            showChange
                            changeLayout="inline"
                          >
                            {formatPrice(row.ask)}
                          </FlashPrice>
                        </div>
                      </div>
                    </td>
                    <td className="col-mcap mono">
                      {row.marketCap
                        ? `$${row.marketCap.toLocaleString("en-US")}`
                        : "-"}
                    </td>
                    <td className={`col-change mono ${changeClass}`}>
                      {formatChange(row.change24h)}
                    </td>
                    <td className="col-updated mono">{formatRowUpdated(row.timestamp)}</td>
                    <td className="col-favorite">
                      <button
                        type="button"
                        className={`market-favorite-btn${favorited ? " active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(cryptoCode);
                        }}
                        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                        aria-pressed={favorited}
                        title={favorited ? "Remove from favorites" : "Add to favorites"}
                      >
                        {favorited ? "★" : "☆"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Market;
