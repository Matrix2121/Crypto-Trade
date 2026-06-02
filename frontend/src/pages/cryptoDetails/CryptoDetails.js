import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import useBuy from "../../hooks/useBuy";
import useLiveChart, { CHART_RANGES } from "../../hooks/useLiveChart";
import usePrices from "../../hooks/usePrices";
import useCoinStats from "../../hooks/useCoinStats";
import useSell from "../../hooks/useSell";
import FlashPrice from "../../components/FlashPrice";
import {
  getCryptoIconPath,
  handleCryptoIconError,
} from "../../utils/getCryptoIconPath";
import "./CryptoDetails.css";

// ─── Axis / tooltip formatting ────────────────────────────────────────────────

const TIME_AXIS_RANGES = new Set(["1Min", "5Min", "15Min", "1H", "1D"]);
const LONG_DATE_RANGES = new Set(["1Y", "5Y"]);
const SECONDS_RANGES = new Set(["1Min", "5Min", "15Min"]);

function toTimestampMs(ts) {
  const n = Number(ts);
  if (Number.isNaN(n)) return Date.now();
  if (n < 1e12) return n * 1000;
  return n;
}

function toChartDate(ts) {
  return new Date(toTimestampMs(ts));
}

function formatAxisTick(ts, range) {
  const date = toChartDate(ts);
  if (TIME_AXIS_RANGES.has(range)) {
    const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
    if (SECONDS_RANGES.has(range)) opts.second = "2-digit";
    return date.toLocaleTimeString("en-GB", opts);
  }
  if (LONG_DATE_RANGES.has(range)) {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDateTime(ts, range) {
  const date = toChartDate(ts);
  if (TIME_AXIS_RANGES.has(range)) {
    const opts = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
    if (SECONDS_RANGES.has(range)) opts.second = "2-digit";
    return date.toLocaleString("en-GB", opts);
  }
  if (LONG_DATE_RANGES.has(range)) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Price formatting ─────────────────────────────────────────────────────────

function formatQuote(value) {
  if (value == null || value === "---" || Number.isNaN(Number(value))) return "---";
  const num = Number(value);
  if (num >= 1000) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function formatChartPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${formatQuote(value)}`;
}

function formatPeriodChange(absoluteChange, percentChange) {
  if (absoluteChange == null || percentChange == null || Number.isNaN(absoluteChange) || Number.isNaN(percentChange)) return "—";
  const sign = absoluteChange >= 0 ? "+" : "";
  return `${sign}${formatQuote(absoluteChange)} (${sign}${percentChange.toFixed(2)}%)`;
}

function formatCompactUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2,
  }).format(value);
}

function formatSupply(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatAthDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Tick→OHLC aggregation (for candle mode on tick ranges) ──────────────────

function aggregateTicksToOhlc(ticks, windowMs) {
  const windows = {};
  for (const tick of ticks) {
    const key = Math.floor(tick.timestamp / windowMs) * windowMs;
    if (windows[key]) {
      const w = windows[key];
      w.high = Math.max(w.high, tick.price);
      w.low = Math.min(w.low, tick.price);
      w.close = tick.price;
    } else {
      windows[key] = { timestamp: key, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
    }
  }
  return Object.values(windows).sort((a, b) => a.timestamp - b.timestamp);
}

const TICK_CANDLE_WINDOW_MS = 60_000;

// ─── Candlestick custom shape ─────────────────────────────────────────────────

function renderCandleShape(props, yBounds) {
  const { x, width, background, payload } = props;
  if (!background || !payload || !yBounds || width <= 0) return null;

  const { open, high, low, close } = payload;
  if (open == null || high == null || low == null || close == null) return null;
  if (high === low) return null;

  const [yMin, yMax] = yBounds;
  if (yMax <= yMin) return null;

  const chartH    = background.height;
  const chartTopY = background.y;
  const toPx = (price) => chartTopY + (1 - (price - yMin) / (yMax - yMin)) * chartH;

  const highPx  = toPx(high);
  const lowPx   = toPx(low);
  const openPx  = toPx(open);
  const closePx = toPx(close);

  const isUp      = close >= open;
  const color     = isUp ? "var(--color-buy-text, #22c55e)" : "var(--color-sell-text, #ef4444)";
  const candleX   = x + width / 2;
  const halfBodyW = Math.max(Math.floor(width * 0.36), 2);
  const bodyTop   = Math.min(openPx, closePx);
  const bodyH     = Math.max(Math.abs(closePx - openPx), 1);

  return (
    <g>
      <line x1={candleX} y1={highPx} x2={candleX} y2={lowPx} stroke={color} strokeWidth={1} />
      <rect
        x={candleX - halfBodyW}
        y={bodyTop}
        width={halfBodyW * 2}
        height={bodyH}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}

// ─── UI sub-components ────────────────────────────────────────────────────────

function buildStatValueClassName(valueClassName) {
  return valueClassName ? `stat-value ${valueClassName}` : "stat-value";
}

function formatMarketRank(isLoadingStats, rank) {
  if (isLoadingStats) return "…";
  if (rank == null) return "—";
  return `#${rank.toLocaleString("en-US")}`;
}

function getPeriodChangeClassName(absoluteChange) {
  if (absoluteChange == null) return "";
  return absoluteChange >= 0 ? "positive" : "negative";
}

function StatCard({ label, value, subValue, valueClassName = "" }) {
  return (
    <div className="stat-block">
      <span className="stat-label">{label}</span>
      <span className={buildStatValueClassName(valueClassName)}>{value}</span>
      {subValue ? <span className="stat-subvalue">{subValue}</span> : null}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subValue: PropTypes.string,
  valueClassName: PropTypes.string,
};

function renderTooltipBody(point) {
  const isOhlc = point.close != null && point.open != null;
  if (isOhlc) {
    return (
      <div className="chart-tooltip__ohlc">
        <span>O: {formatChartPrice(point.open)}</span>
        <span>H: {formatChartPrice(point.high)}</span>
        <span>L: {formatChartPrice(point.low)}</span>
        <span>C: {formatChartPrice(point.close)}</span>
      </div>
    );
  }
  if (point.bid != null && point.ask != null) {
    return (
      <div className="chart-tooltip__spread">
        <span className="spread-ask">A: {formatChartPrice(point.ask)}</span>
        <span className="spread-bid">B: {formatChartPrice(point.bid)}</span>
      </div>
    );
  }
  return <p className="chart-tooltip__price">Price: {formatChartPrice(point.price)}</p>;
}

function CustomTooltip({ active, payload, range }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__datetime">{formatTooltipDateTime(point.timestamp, range)}</p>
      {renderTooltipBody(point)}
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      payload: PropTypes.object,
    })
  ),
  range: PropTypes.string.isRequired,
};

function computePeriodStats(displayData, isDisplayOhlc) {
  const empty = { periodHigh: null, periodLow: null, absoluteChange: null, percentChange: null };
  if (!displayData?.length) return empty;

  let periodHigh;
  let periodLow;
  if (isDisplayOhlc && displayData[0].high != null) {
    periodHigh = Math.max(...displayData.map((d) => d.high));
    periodLow = Math.min(...displayData.map((d) => d.low));
  } else {
    periodHigh = Math.max(...displayData.map((d) => d.price));
    periodLow = Math.min(...displayData.map((d) => d.price));
  }

  const first = displayData[0];
  const last = displayData[displayData.length - 1];
  const startPrice = isDisplayOhlc && first.open != null ? first.open : first.price;
  const endPrice = isDisplayOhlc && last.close != null ? last.close : last.price;

  if (
    startPrice == null
    || endPrice == null
    || Number.isNaN(startPrice)
    || Number.isNaN(endPrice)
    || startPrice === 0
  ) {
    return { periodHigh, periodLow, absoluteChange: null, percentChange: null };
  }

  const absoluteChange = endPrice - startPrice;
  const percentChange = (absoluteChange / startPrice) * 100;
  return { periodHigh, periodLow, absoluteChange, percentChange };
}

function ChartCandleView({ displayData, range, candleYBounds, OhlcCandleShape, sharedXAxis, sharedYAxis, sharedTooltip }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        key={`candle-${range}`}
        data={displayData}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
      >
        {sharedXAxis}
        {sharedYAxis(candleYBounds)}
        {sharedTooltip}
        <Bar
          dataKey="close"
          shape={OhlcCandleShape}
          isAnimationActive={false}
          maxBarSize={24}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

ChartCandleView.propTypes = {
  displayData: PropTypes.arrayOf(PropTypes.object).isRequired,
  range: PropTypes.string.isRequired,
  candleYBounds: PropTypes.arrayOf(PropTypes.number),
  OhlcCandleShape: PropTypes.func.isRequired,
  sharedXAxis: PropTypes.element.isRequired,
  sharedYAxis: PropTypes.func.isRequired,
  sharedTooltip: PropTypes.element.isRequired,
};

function ChartLineView({
  displayData,
  range,
  lineMode,
  hasSpreadData,
  chartType,
  sharedXAxis,
  sharedYAxis,
  sharedTooltip,
}) {
  const showSpread = lineMode === "spread" && hasSpreadData;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        key={`line-${range}`}
        data={displayData}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
      >
        {sharedXAxis}
        {sharedYAxis(null)}
        {sharedTooltip}
        {showSpread ? (
          <>
            <Line
              type="monotone"
              dataKey="ask"
              name="Ask"
              stroke="var(--color-buy-text, #ef4444)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 2, fill: "var(--color-buy-text, #ef4444)" }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="bid"
              name="Bid"
              stroke="var(--color-sell-text, #22c55e)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 2, fill: "var(--color-sell-text, #22c55e)" }}
              connectNulls
            />
          </>
        ) : (
          <Line
            type="monotone"
            dataKey={chartType === "OHLC" ? "close" : "price"}
            name={chartType === "OHLC" ? "Close" : "Price"}
            stroke="var(--color-accent-blue)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: "var(--color-accent-blue)" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

ChartLineView.propTypes = {
  displayData: PropTypes.arrayOf(PropTypes.object).isRequired,
  range: PropTypes.string.isRequired,
  lineMode: PropTypes.string.isRequired,
  hasSpreadData: PropTypes.bool.isRequired,
  chartType: PropTypes.string.isRequired,
  sharedXAxis: PropTypes.element.isRequired,
  sharedYAxis: PropTypes.func.isRequired,
  sharedTooltip: PropTypes.element.isRequired,
};

function StatsDashboard({ isLoadingStats, stats, periodStats }) {
  return (
    <div className="unified-stats-container" aria-label="Market and period statistics">
      <div className="stats-row">
        <StatCard label="Market Rank" value={formatMarketRank(isLoadingStats, stats?.rank)} />
        <StatCard label="Market Cap" value={isLoadingStats ? "…" : formatCompactUsd(stats?.marketCap)} />
        <StatCard label="Circulating Supply" value={isLoadingStats ? "…" : formatSupply(stats?.supply)} />
        <StatCard label="24h Volume" value={isLoadingStats ? "…" : formatCompactUsd(stats?.volume)} />
      </div>
      <div className="stats-row">
        <StatCard label="Period High" value={formatChartPrice(periodStats.periodHigh)} />
        <StatCard label="Period Low" value={formatChartPrice(periodStats.periodLow)} />
        <StatCard
          label="Period Change"
          value={formatPeriodChange(periodStats.absoluteChange, periodStats.percentChange)}
          valueClassName={getPeriodChangeClassName(periodStats.absoluteChange)}
        />
        <StatCard
          label="All-Time High"
          value={isLoadingStats ? "…" : formatCompactUsd(stats?.ath)}
          subValue={isLoadingStats || !stats?.athDate ? undefined : formatAthDate(stats.athDate)}
        />
      </div>
    </div>
  );
}

StatsDashboard.propTypes = {
  isLoadingStats: PropTypes.bool.isRequired,
  stats: PropTypes.shape({
    rank: PropTypes.number,
    marketCap: PropTypes.number,
    supply: PropTypes.number,
    volume: PropTypes.number,
    ath: PropTypes.number,
    athDate: PropTypes.string,
  }),
  periodStats: PropTypes.shape({
    periodHigh: PropTypes.number,
    periodLow: PropTypes.number,
    absoluteChange: PropTypes.number,
    percentChange: PropTypes.number,
  }).isRequired,
};

function OrderPanel({ bid, ask, previousBid, previousAsk, onBuy, onSell }) {
  return (
    <aside className="order-section" aria-label="Order panel">
      <div className="trading-panel">
        <div className="quote-column ask-column">
          <div className="ask-box">
            <p className="quote-label">ASK (Buy Price)</p>
            <p className="quote-price">
              <FlashPrice value={ask} previousValue={previousAsk} showChange changeLayout="stacked">
                {formatQuote(ask)}
              </FlashPrice>
            </p>
          </div>
          <button type="button" className="btn-buy" onClick={onBuy}>Buy</button>
        </div>
        <div className="quote-column bid-column">
          <div className="bid-box">
            <p className="quote-label">BID (Sell Price)</p>
            <p className="quote-price">
              <FlashPrice value={bid} previousValue={previousBid} showChange changeLayout="stacked">
                {formatQuote(bid)}
              </FlashPrice>
            </p>
          </div>
          <button type="button" className="btn-sell" onClick={onSell}>Sell</button>
        </div>
      </div>
    </aside>
  );
}

OrderPanel.propTypes = {
  bid: PropTypes.number,
  ask: PropTypes.number,
  previousBid: PropTypes.number,
  previousAsk: PropTypes.number,
  onBuy: PropTypes.func.isRequired,
  onSell: PropTypes.func.isRequired,
};

function renderChartStatus(displayData, isLoading, chartType) {
  if (displayData.length > 0) return null;
  if (isLoading) {
    return (
      <p className="chart-status">
        {chartType === "TICK" ? "Loading tick data…" : "Loading chart data…"}
      </p>
    );
  }
  return <p className="chart-status">No chart data available.</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

const CryptoDetails = () => {
  const { cryptoCode = "" } = useParams();
  const navigate = useNavigate();

  const buy  = useBuy();
  const sell = useSell();
  const prices = usePrices();

  const [chartMode, setChartMode] = useState("line"); // 'line' | 'candle'
  const [lineMode,  setLineMode]  = useState("mid");  // 'mid'  | 'spread'

  const symbol = String(cryptoCode).replace("-", "/").toUpperCase();
  const { chartData, isLoading, chartType, range, setRange } = useLiveChart(cryptoCode, "1Min", chartMode);
  const { stats, isLoadingStats } = useCoinStats(symbol);

  // ── Derived display data ────────────────────────────────────────────────────

  const displayData = useMemo(() => {
    if (chartMode !== "candle") return chartData;
    if (chartType === "OHLC") return chartData;
    return aggregateTicksToOhlc(chartData, TICK_CANDLE_WINDOW_MS);
  }, [chartMode, chartType, chartData]);

  const isDisplayOhlc = chartMode === "candle" || chartType === "OHLC";

  // Y-axis bounds for the candle chart (with 4% padding each side).
  const candleYBounds = useMemo(() => {
    if (chartMode !== "candle" || displayData.length === 0) return null;
    const first = displayData[0];
    if (first.high == null) return null;
    const minLow  = Math.min(...displayData.map((d) => d.low));
    const maxHigh = Math.max(...displayData.map((d) => d.high));
    const pad = (maxHigh - minLow) * 0.04;
    return [minLow - pad, maxHigh + pad];
  }, [chartMode, displayData]);

  const OhlcCandleShape = useCallback(
    (props) => renderCandleShape(props, candleYBounds),
    [candleYBounds]
  );

  // ── Period stats ────────────────────────────────────────────────────────────

  const periodStats = useMemo(
    () => computePeriodStats(displayData, isDisplayOhlc),
    [displayData, isDisplayOhlc]
  );

  // ── Live order book ─────────────────────────────────────────────────────────

  const liveTick = useMemo(
    () => prices.find((tick) => tick.symbol === symbol),
    [prices, symbol]
  );

  const bid         = liveTick?.bid         ?? null;
  const ask         = liveTick?.ask         ?? null;
  const previousBid = liveTick?.previousBid ?? null;
  const previousAsk = liveTick?.previousAsk ?? null;

  const hasSpreadData = chartType === "TICK" &&
    displayData.some((d) => d.bid != null && d.ask != null);

  // ── Trade handlers ──────────────────────────────────────────────────────────

  const handleBuy = async () => {
    if (ask == null) { alert("Ask price unavailable."); return; }
    const amount = Number.parseFloat(prompt(`Buy at ${formatQuote(ask)} — amount?`));
    if (!amount || Number.isNaN(amount)) return;
    try { await buy(symbol, amount); alert(`Buy successful at ask ${formatQuote(ask)}!`); }
    catch { alert("Buy failed."); }
  };

  const handleSell = async () => {
    if (bid == null) { alert("Bid price unavailable."); return; }
    const amount = Number.parseFloat(prompt(`Sell at ${formatQuote(bid)} — amount?`));
    if (!amount || Number.isNaN(amount)) return;
    try { await sell(symbol, amount); alert(`Sell successful at bid ${formatQuote(bid)}!`); }
    catch { alert("Sell failed."); }
  };

  // ── Chart building blocks ───────────────────────────────────────────────────

  const sharedXAxis = (
    <XAxis
      dataKey="timestamp"
      type="number"
      scale="time"
      domain={["dataMin", "dataMax"]}
      axisLine={false}
      tickLine={false}
      minTickGap={60}
      tickFormatter={(ts) => formatAxisTick(ts, range)}
      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
    />
  );

  const sharedYAxis = (domain) => (
    <YAxis
      axisLine={false}
      tickLine={false}
      domain={domain ?? ["auto", "auto"]}
      width={72}
      tickFormatter={(v) => formatQuote(v)}
      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
    />
  );

  const sharedTooltip = (
    <Tooltip
      content={<CustomTooltip range={range} />}
      cursor={{ stroke: "var(--color-border-subtle)", strokeWidth: 1 }}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="crypto-details-container">
      <header className="terminal-header">
        <button type="button" className="crypto-back-btn" onClick={() => navigate("/market")}>
          ← Markets
        </button>
        <div className="crypto-symbol-row">
          <img
            className="crypto-symbol-icon"
            src={getCryptoIconPath(symbol)}
            alt=""
            width={32}
            height={32}
            onError={handleCryptoIconError}
          />
          <h1 className="crypto-symbol">{symbol}</h1>
        </div>
      </header>

      <div className="terminal-main">
        <section className="chart-section" aria-label="Live price chart">

          {/* ── Timeframe + chart-mode controls ── */}
          <div className="chart-controls-bar">
            <div className="timeframe-selector" role="tablist" aria-label="Chart timeframe">
              {CHART_RANGES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  role="tab"
                  className={`timeframe-btn${range === tf ? " active" : ""}`}
                  onClick={() => setRange(tf)}
                  aria-selected={range === tf}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="chart-mode-controls">
              <fieldset className="chart-mode-group">
                <legend className="chart-mode-legend">Chart type</legend>
                <button
                  type="button"
                  className={`chart-mode-btn${chartMode === "line" ? " active" : ""}`}
                  onClick={() => setChartMode("line")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`chart-mode-btn${chartMode === "candle" ? " active" : ""}`}
                  onClick={() => setChartMode("candle")}
                >
                  Candle
                </button>
              </fieldset>

              {chartMode === "line" && (
                <fieldset className="chart-mode-group">
                  <legend className="chart-mode-legend">Line mode</legend>
                  <button
                    type="button"
                    className={`chart-mode-btn${lineMode === "mid" ? " active" : ""}`}
                    onClick={() => setLineMode("mid")}
                  >
                    Mid
                  </button>
                  <button
                    type="button"
                    className={`chart-mode-btn spread-btn${lineMode === "spread" ? " active" : ""}${hasSpreadData ? "" : " disabled"}`}
                    onClick={() => { if (hasSpreadData) setLineMode("spread"); }}
                    disabled={hasSpreadData === false}
                    title={hasSpreadData ? undefined : "Spread data available for live tick ranges only"}
                  >
                    Spread
                  </button>
                </fieldset>
              )}

              <button type="button" className="btn-ai-predict" disabled>
                ✦ AI Predict <span className="ai-badge">Beta</span>
              </button>
            </div>
          </div>

          {/* ── Chart area ── */}
          <div className="crypto-chart-wrapper">
            {renderChartStatus(displayData, isLoading, chartType)}

            {displayData.length > 0 && chartMode === "candle" && (
              <ChartCandleView
                displayData={displayData}
                range={range}
                candleYBounds={candleYBounds}
                OhlcCandleShape={OhlcCandleShape}
                sharedXAxis={sharedXAxis}
                sharedYAxis={sharedYAxis}
                sharedTooltip={sharedTooltip}
              />
            )}

            {displayData.length > 0 && chartMode === "line" && (
              <ChartLineView
                displayData={displayData}
                range={range}
                lineMode={lineMode}
                hasSpreadData={hasSpreadData}
                chartType={chartType}
                sharedXAxis={sharedXAxis}
                sharedYAxis={sharedYAxis}
                sharedTooltip={sharedTooltip}
              />
            )}

            {isLoading && displayData.length > 0 && (
              <div className="chart-loading-badge" aria-live="polite">Updating…</div>
            )}
          </div>

          <StatsDashboard
            isLoadingStats={isLoadingStats}
            stats={stats}
            periodStats={periodStats}
          />
        </section>

        <OrderPanel
          bid={bid}
          ask={ask}
          previousBid={previousBid}
          previousAsk={previousAsk}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      </div>
    </div>
  );
};

export default CryptoDetails;
