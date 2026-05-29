import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import useBuy from "../../hooks/useBuy";
import useLiveChart, { formatChartTime } from "../../hooks/useLiveChart";
import usePrices from "../../hooks/usePrices";
import useSell from "../../hooks/useSell";
import FlashPrice from "../../components/FlashPrice";
import "./CryptoDetails.css";

const TIMEFRAMES = ["1M", "5M", "1H", "1D", "1W"];

function formatQuote(value) {
  if (value == null || value === "---" || Number.isNaN(Number(value))) {
    return "---";
  }
  const num = Number(value);
  if (num >= 1000) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

const CryptoDetails = () => {
  const { cryptoCode = "" } = useParams();
  const navigate = useNavigate();

  const [range, setRange] = useState("5M");

  const buy = useBuy();
  const sell = useSell();
  const prices = usePrices();
  const { chartData, loading, error } = useLiveChart(cryptoCode, range);

  const symbol = String(cryptoCode).replace("-", "/").toUpperCase();

  const liveTick = useMemo(
    () => prices.find((tick) => tick.symbol === symbol),
    [prices, symbol]
  );

  const bid = liveTick?.bid ?? null;
  const ask = liveTick?.ask ?? null;
  const previousBid = liveTick?.previousBid ?? null;
  const previousAsk = liveTick?.previousAsk ?? null;

  const handleBuy = async () => {
    if (ask == null) {
      alert("Ask price unavailable.");
      return;
    }
    const amount = parseFloat(prompt(`Buy at ${formatQuote(ask)} — amount?`));
    if (!amount || Number.isNaN(amount)) return;
    try {
      await buy(symbol, amount);
      alert(`Buy successful at ask ${formatQuote(ask)}!`);
    } catch {
      alert("Buy failed.");
    }
  };

  const handleSell = async () => {
    if (bid == null) {
      alert("Bid price unavailable.");
      return;
    }
    const amount = parseFloat(prompt(`Sell at ${formatQuote(bid)} — amount?`));
    if (!amount || Number.isNaN(amount)) return;
    try {
      await sell(symbol, amount);
      alert(`Sell successful at bid ${formatQuote(bid)}!`);
    } catch {
      alert("Sell failed.");
    }
  };

  return (
    <div className="crypto-details-container">
      <header className="terminal-header">
        <button type="button" className="crypto-back-btn" onClick={() => navigate("/market")}>
          ← Markets
        </button>
        <h1 className="crypto-symbol">{symbol}</h1>
      </header>

      <div className="terminal-main">
        <section className="chart-section" aria-label="Live price chart">
          <div className="crypto-chart-wrapper">
            {loading && <p className="chart-status">Loading chart data...</p>}
            {error && !loading && <p className="chart-status error">Error loading chart</p>}
            {!loading && !error && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(ts) => formatChartTime(ts, range)}
                    tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    width={72}
                    tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-bg-panel)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "var(--color-text-secondary)" }}
                    itemStyle={{ color: "var(--color-accent-blue)" }}
                    labelFormatter={(ts) => formatChartTime(ts, range)}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="Price"
                    stroke="var(--color-accent-blue)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "var(--color-accent-blue)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="timeframe-selector" role="group" aria-label="Candle interval">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`timeframe-btn${range === tf ? " active" : ""}`}
                onClick={() => setRange(tf)}
                aria-pressed={range === tf}
              >
                {tf}
              </button>
            ))}
          </div>
        </section>

        <aside className="order-section" aria-label="Order panel">
          <div className="trading-panel">
            <div className="quote-column ask-column">
              <div className="ask-box">
                <p className="quote-label">ASK (Buy Price)</p>
                <p className="quote-price">
                  <FlashPrice
                    value={ask}
                    previousValue={previousAsk}
                    showChange
                    changeLayout="stacked"
                  >
                    {formatQuote(ask)}
                  </FlashPrice>
                </p>
              </div>
              <button type="button" className="btn-buy" onClick={handleBuy}>
                Buy
              </button>
            </div>

            <div className="quote-column bid-column">
              <div className="bid-box">
                <p className="quote-label">BID (Sell Price)</p>
                <p className="quote-price">
                  <FlashPrice
                    value={bid}
                    previousValue={previousBid}
                    showChange
                    changeLayout="stacked"
                  >
                    {formatQuote(bid)}
                  </FlashPrice>
                </p>
              </div>
              <button type="button" className="btn-sell" onClick={handleSell}>
                Sell
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CryptoDetails;
