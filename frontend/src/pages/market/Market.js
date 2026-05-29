import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePrices from "../../hooks/usePrices";
import FlashPrice from "../../components/FlashPrice";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
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
  if (value == null || Number.isNaN(value)) return "—";
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

async function fetch24hChange(symbol) {
  const token = localStorage.getItem("jwt");
  if (!token) return null;

  const pathSymbol = symbol.replace("/", "-");
  const response = await fetch(
    `${process.env.REACT_APP_URL}/api/history/${pathSymbol}?interval=1440`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) return null;

  const candles = await response.json();
  if (!Array.isArray(candles) || candles.length < 2) return null;

  const prev = Number(candles[candles.length - 2].closePrice);
  const latest = Number(candles[candles.length - 1].closePrice);
  if (!prev || Number.isNaN(prev) || Number.isNaN(latest)) return null;

  return ((latest - prev) / prev) * 100;
}

const Market = () => {
  const navigate = useNavigate();
  const prices = usePrices();
  const deferredPrices = useDeferredValue(prices);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [changes, setChanges] = useState({});
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const tickSignature = useMemo(
    () => prices.map((p) => `${p.symbol}:${p.bid}:${p.ask}`).join("|"),
    [prices]
  );

  useEffect(() => {
    if (!tickSignature) return;
    setLastUpdate(new Date());
  }, [tickSignature, prices.length]);

  const symbolKey = [...new Set(deferredPrices.map((p) => p.symbol))].sort().join("|");

  useEffect(() => {
    if (!symbolKey) return;

    let cancelled = false;
    const symbols = symbolKey.split("|");

    const loadChanges = async () => {
      const entries = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const change = await fetch24hChange(sym);
            return [sym, change];
          } catch {
            return [sym, null];
          }
        })
      );

      if (!cancelled) {
        setChanges(Object.fromEntries(entries));
      }
    };

    loadChanges();
    return () => {
      cancelled = true;
    };
  }, [symbolKey]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = deferredPrices
      .filter((tick) => tick && tick.symbol)
      .map((tick) => {
        const base = tick.symbol.split("/")[0];
        return {
          ...tick,
          base,
          change24h: changes[tick.symbol] ?? null,
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
      list = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    return list;
  }, [deferredPrices, search, activeTab, changes]);

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
              <th className="col-asset">Asset</th>
              <th className="col-bid-ask">Bid / Ask</th>
              <th className="col-change">24h Change</th>
              <th className="col-updated">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="market-empty">
                  No markets match your search.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const changeClass =
                  row.change24h == null
                    ? "neutral"
                    : row.change24h >= 0
                      ? "positive"
                      : "negative";

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
                    role="link"
                    aria-label={`Open ${row.symbol} trading page`}
                  >
                    <td className="col-asset">
                      <div className="asset-cell">
                        <img
                          className="asset-icon"
                          src={getCryptoIconPath(row.symbol, 20)}
                          alt=""
                          width={20}
                          height={20}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                          }}
                        />
                        <div className="asset-names">
                          <span className="asset-base" title={row.symbol}>{row.base}</span>
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
                    <td className={`col-change mono ${changeClass}`}>
                      {formatChange(row.change24h)}
                    </td>
                    <td className="col-updated mono">{formatRowUpdated(row.timestamp)}</td>
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
