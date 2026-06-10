import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useNavigate, useParams } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Customized,
} from "recharts";
import useAssets from "../../hooks/useAssets";
import useBuy from "../../hooks/useBuy";
import useLiveChart from "../../hooks/useLiveChart";
import usePrices from "../../hooks/usePrices";
import useCoinStats from "../../hooks/useCoinStats";
import useSell from "../../hooks/useSell";
import FlashPrice from "../../components/FlashPrice";
import {
  cryptoAmountFromFiat,
  formatBalance,
  formatBalanceUsd,
  formatCryptoAmount,
} from "../../utils/formatBalance";
import {
  AGGREGATED_CHART_RANGE_OPTIONS,
  CHART_BUCKET_MS,
  LIVE_CANDLE_PERIOD_MS,
  LIVE_CHART_RANGE_OPTIONS,
  TICK_CANDLE_WINDOW_MS,
} from "../../constants/chartConfig";
import { PREDICTION_ASSET_SET } from "../../constants/predictionAssets";
import {
  getBaseAsset,
  getCryptoIconPath,
  handleCryptoIconError,
} from "../../utils/getCryptoIconPath";
import { useFavorites } from "../../context/FavoritesContext";
import usePredictions from "../../hooks/usePredictions";
import PredictionPanel from "../../components/PredictionPanel";
import {
  applyForecastOverlay,
  buildHistoricalPredictionOverlay,
  buildPredictionChartOverlay,
  collectForecastPrices,
  getPredictionFilterLabel,
  HISTORY_FETCH_LIMIT,
  HISTORICAL_CI_KEYS,
  isPredictionChartRange,
  mergePredictionOverlays,
  msUntilNextHourlyPredictionRefresh,
  isPredictionEndpoint,
  isPredictionTargetEndpoint,
  FORECAST_CI_KEYS,
  PREDICTION_LINE_KEYS,
} from "../../utils/chartPredictions";
import "./CryptoDetails.css";

// ─── Axis / tooltip formatting ────────────────────────────────────────────────

const TIME_AXIS_RANGES = new Set(["1Min", "5Min", "15Min", "1H", "1D"]);
const LONG_DATE_RANGES = new Set(["1Y", "ALL"]);
const SECONDS_RANGES = new Set(["1Min", "5Min", "15Min"]);

const CANDLE_PERIOD_MS = CHART_BUCKET_MS;

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
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDateTime(ts, range) {
  const date = toChartDate(ts);
  if (TIME_AXIS_RANGES.has(range)) {
    const opts = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    if (SECONDS_RANGES.has(range)) opts.second = "2-digit";
    return date.toLocaleString("en-GB", opts);
  }
  if (LONG_DATE_RANGES.has(range)) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getCandlePeriodMs(range, chartMode, chartType) {
  if (chartMode === "candle" && chartType === "TICK") {
    return TICK_CANDLE_WINDOW_MS;
  }
  return CANDLE_PERIOD_MS[range] ?? 60_000;
}

function formatTimeEndpoint(date, periodMs) {
  const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
  if (periodMs <= LIVE_CANDLE_PERIOD_MS) opts.second = "2-digit";
  return date.toLocaleTimeString("en-GB", opts);
}

function formatDateEndpoint(date, includeYear) {
  const opts = { month: "short", day: "numeric" };
  if (includeYear) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

function formatCandlePeriod(startTs, periodMs, range) {
  const start = toChartDate(startTs);
  const end = new Date(startTs + periodMs);
  const includeYear =
    LONG_DATE_RANGES.has(range) || periodMs > 365 * 24 * 60 * 60_000;

  if (periodMs <= 24 * 60 * 60_000) {
    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
      const dayLabel = TIME_AXIS_RANGES.has(range)
        ? ""
        : `${formatDateEndpoint(start, false)}, `;
      return `${dayLabel}${formatTimeEndpoint(start, periodMs)} – ${formatTimeEndpoint(end, periodMs)}`;
    }
    return `${formatDateEndpoint(start, false)} ${formatTimeEndpoint(start, periodMs)} – ${formatDateEndpoint(end, false)} ${formatTimeEndpoint(end, periodMs)}`;
  }

  return `${formatDateEndpoint(start, includeYear)} – ${formatDateEndpoint(end, includeYear)}`;
}

// ─── Price formatting ─────────────────────────────────────────────────────────

function formatQuote(value) {
  if (value == null || value === "---" || Number.isNaN(Number(value)))
    return "---";
  const num = Number(value);
  if (num >= 1000)
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function formatChartPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${formatQuote(value)}`;
}

function formatPeriodChange(absoluteChange, percentChange) {
  if (
    absoluteChange == null ||
    percentChange == null ||
    Number.isNaN(absoluteChange) ||
    Number.isNaN(percentChange)
  )
    return "—";
  const sign = absoluteChange >= 0 ? "+" : "";
  return `${sign}${formatQuote(absoluteChange)} (${sign}${percentChange.toFixed(2)}%)`;
}

function formatCompactUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
      windows[key] = {
        timestamp: key,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
      };
    }
  }
  return Object.values(windows).sort((a, b) => a.timestamp - b.timestamp);
}


// ─── Candlestick custom shape ─────────────────────────────────────────────────

function renderCandleShape(props, yBounds) {
  const { x, width, background, payload } = props;
  if (!background || !payload || !yBounds || width <= 0) return null;

  const { open, high, low, close } = payload;
  if (open == null || high == null || low == null || close == null) return null;
  if (high === low) return null;

  const [yMin, yMax] = yBounds;
  if (yMax <= yMin) return null;

  const chartH = background.height;
  const chartTopY = background.y;
  const toPx = (price) =>
    chartTopY + (1 - (price - yMin) / (yMax - yMin)) * chartH;

  const highPx = toPx(high);
  const lowPx = toPx(low);
  const openPx = toPx(open);
  const closePx = toPx(close);

  const isUp = close >= open;
  const color = isUp
    ? "var(--color-buy-text, #22c55e)"
    : "var(--color-sell-text, #ef4444)";
  const candleX = x + width / 2;
  const halfBodyW = Math.max(Math.floor(width * 0.36), 2);
  const bodyTop = Math.min(openPx, closePx);
  const bodyH = Math.max(Math.abs(closePx - openPx), 1);

  return (
    <g>
      <line
        x1={candleX}
        y1={highPx}
        x2={candleX}
        y2={lowPx}
        stroke={color}
        strokeWidth={1}
      />
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

function renderMarketTooltipBody(point) {
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
  if (point.price != null) {
    return (
      <p className="chart-tooltip__price">
        Price: {formatChartPrice(point.price)}
      </p>
    );
  }
  return null;
}

function renderForecastCiTooltipRow(key, label, point, ciKeys) {
  const low = point[ciKeys.low];
  const high = point[ciKeys.high];
  if (typeof low !== "number" || typeof high !== "number") return null;

  return (
    <span key={key}>
      {label}: {formatChartPrice(low)} – {formatChartPrice(high)}
    </span>
  );
}

function renderForecastTooltipBody(point) {
  const { FUTURE, HOURLY, DAILY, CONTEXT_AWARE } = PREDICTION_LINE_KEYS;
  const rows = [];

  const ciRows = [
    ["future-target", "Model hourly CI", FORECAST_CI_KEYS[FUTURE]],
    ["hist-future", "Past model hourly CI", HISTORICAL_CI_KEYS[FUTURE]],
    ["hourly", "Model hourly CI", FORECAST_CI_KEYS[HOURLY]],
    ["hist-hourly", "Past model hourly CI", HISTORICAL_CI_KEYS[HOURLY]],
    ["daily", "Model daily CI", FORECAST_CI_KEYS[DAILY]],
    ["hist-daily", "Past model daily CI", HISTORICAL_CI_KEYS[DAILY]],
    ["context-aware", "Context-aware CI", FORECAST_CI_KEYS[CONTEXT_AWARE]],
    ["hist-context-aware", "Past context-aware CI", HISTORICAL_CI_KEYS[CONTEXT_AWARE]],
  ];

  for (const [key, label, ciKeys] of ciRows) {
    const row = renderForecastCiTooltipRow(key, label, point, ciKeys);
    if (row) rows.push(row);
  }

  if (!rows.length) return null;
  return <div className="chart-tooltip__forecast">{rows}</div>;
}

function renderTooltipBody(point) {
  if (point.isFutureSlot) {
    return (
      <p className="chart-tooltip__period">
        Forecast window (no price data yet)
      </p>
    );
  }

  const market = renderMarketTooltipBody(point);
  const forecast = renderForecastTooltipBody(point);

  if (market || forecast) {
    return (
      <>
        {market}
        {forecast}
      </>
    );
  }

  return null;
}

function resolveTooltipPoint(payload) {
  if (!payload?.length) return null;

  let point = {};
  for (const entry of payload) {
    if (entry?.payload) {
      point = { ...point, ...entry.payload };
    }
  }

  return point.timestamp != null ? point : null;
}

function findMarketDataAt(chartData, timestamp) {
  const exact = chartData.find((p) => p.timestamp === timestamp);
  if (exact) return exact;

  let nearest = null;
  for (const row of chartData) {
    if (row.timestamp > timestamp) break;
    if (row.close != null || row.price != null) nearest = row;
  }
  return nearest;
}

function enrichPointWithMarketData(point, chartData) {
  if (!point || !chartData?.length) return point;

  const hasOhlc = point.close != null && point.open != null;
  const hasPrice = point.price != null;
  const hasSpread = point.bid != null && point.ask != null;
  if (hasOhlc || hasPrice || hasSpread) return point;

  const row = findMarketDataAt(chartData, point.timestamp);
  if (!row) return point;

  return {
    ...point,
    open: point.open ?? row.open,
    high: point.high ?? row.high,
    low: point.low ?? row.low,
    close: point.close ?? row.close,
    price: point.price ?? row.price,
    bid: point.bid ?? row.bid,
    ask: point.ask ?? row.ask,
  };
}

function CustomTooltip({
  active,
  payload,
  chartData,
  range,
  chartMode,
  chartType,
}) {
  if (!active || !payload?.length) return null;
  const point = enrichPointWithMarketData(
    resolveTooltipPoint(payload),
    chartData,
  );
  if (!point) return null;

  const isOhlc = point.close != null && point.open != null;
  const periodMs = isOhlc
    ? getCandlePeriodMs(range, chartMode, chartType)
    : null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__datetime">
        {formatTooltipDateTime(point.timestamp, range)}
      </p>
      {periodMs != null && (
        <p className="chart-tooltip__period">
          {formatCandlePeriod(point.timestamp, periodMs, range)}
        </p>
      )}
      {renderTooltipBody(point)}
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  chartData: PropTypes.arrayOf(PropTypes.object),
  chartMode: PropTypes.string,
  chartType: PropTypes.string,
  range: PropTypes.string.isRequired,
};

function computePeriodStats(displayData, isDisplayOhlc) {
  const empty = {
    periodHigh: null,
    periodLow: null,
    absoluteChange: null,
    percentChange: null,
  };
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
  const startPrice =
    isDisplayOhlc && first.open != null ? first.open : first.price;
  const endPrice =
    isDisplayOhlc && last.close != null ? last.close : last.price;

  if (
    startPrice == null ||
    endPrice == null ||
    Number.isNaN(startPrice) ||
    Number.isNaN(endPrice) ||
    startPrice === 0
  ) {
    return { periodHigh, periodLow, absoluteChange: null, percentChange: null };
  }

  const absoluteChange = endPrice - startPrice;
  const percentChange = (absoluteChange / startPrice) * 100;
  return { periodHigh, periodLow, absoluteChange, percentChange };
}

function buildBandPolygon(bandPoints, ciLowKey, ciHighKey, xAxis, yAxis, offset) {
  const validPoints = (bandPoints || []).filter(
    (point) =>
      typeof point[ciLowKey] === "number" && typeof point[ciHighKey] === "number",
  );
  if (validPoints.length < 2) return null;

  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;
  const toCoord = (timestamp, price) => {
    const x = xAxis.scale(timestamp) + left;
    const y = yAxis.scale(price) + top;
    return `${x},${y}`;
  };

  const upper = validPoints.map((point) =>
    toCoord(point.timestamp, point[ciHighKey]),
  );
  const lower = [...validPoints]
    .reverse()
    .map((point) => toCoord(point.timestamp, point[ciLowKey]));

  return [...upper, ...lower].join(" ");
}

function ForecastCiBandFill({
  lineConfigs,
  chartData,
  xAxisMap,
  yAxisMap,
  offset,
}) {
  const xAxis = xAxisMap?.[Object.keys(xAxisMap ?? {})[0]];
  const yAxis = yAxisMap?.[Object.keys(yAxisMap ?? {})[0]];
  if (!xAxis?.scale || !yAxis?.scale || !lineConfigs?.length || !chartData?.length) {
    return null;
  }

  const fills = [];
  for (const cfg of lineConfigs) {
    if (cfg.type !== "band") continue;

    const { ciLowKey, ciHighKey, stroke, fillOpacity = 0.2, bandSegments } = cfg;
    const segmentGroups = bandSegments?.length
      ? bandSegments
      : [
          (chartData || []).filter(
            (point) =>
              typeof point[ciLowKey] === "number"
              && typeof point[ciHighKey] === "number",
          ),
        ];

    segmentGroups.forEach((segmentPoints, index) => {
      const points = buildBandPolygon(
        segmentPoints,
        ciLowKey,
        ciHighKey,
        xAxis,
        yAxis,
        offset,
      );
      if (!points) return;

      fills.push(
        <polygon
          key={`fill-${ciLowKey}-${ciHighKey}-${index}`}
          points={points}
          fill={stroke}
          fillOpacity={fillOpacity}
          stroke="none"
        />,
      );
    });
  }

  if (!fills.length) return null;
  return <g className="forecast-ci-bands">{fills}</g>;
}

ForecastCiBandFill.propTypes = {
  lineConfigs: PropTypes.array,
  chartData: PropTypes.arrayOf(PropTypes.object),
  xAxisMap: PropTypes.object,
  yAxisMap: PropTypes.object,
  offset: PropTypes.shape({
    left: PropTypes.number,
    top: PropTypes.number,
  }),
};

function PredictionForecastBands({ lineConfigs }) {
  if (!lineConfigs?.length) return null;

  return lineConfigs.map((cfg) => {
    if (cfg.type !== "band") return null;

    const {
      ciLowKey,
      ciHighKey,
      stroke,
      strokeWidth = 1.5,
      strokeDasharray,
      strokeOpacity = 1,
      connectNulls = true,
    } = cfg;
    const bandKey = `band-${ciLowKey}-${ciHighKey}`;
    const hoverDot = {
      r: 3.5,
      fill: stroke,
      stroke: "var(--color-bg-page, #fff)",
      strokeWidth: 1.5,
    };

    return (
      <Fragment key={bandKey}>
        <Line
          type="linear"
          dataKey={ciLowKey}
          name={`${cfg.name} (low)`}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeDasharray={strokeDasharray ?? undefined}
          dot={false}
          activeDot={hoverDot}
          isAnimationActive={false}
          connectNulls={connectNulls}
          legendType="none"
        />
        <Line
          type="linear"
          dataKey={ciHighKey}
          name={`${cfg.name} (high)`}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeDasharray={strokeDasharray ?? undefined}
          dot={false}
          activeDot={hoverDot}
          isAnimationActive={false}
          connectNulls={connectNulls}
          legendType="none"
        />
      </Fragment>
    );
  });
}

PredictionForecastBands.propTypes = {
  lineConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      ciLowKey: PropTypes.string,
      ciHighKey: PropTypes.string,
      name: PropTypes.string,
      stroke: PropTypes.string,
      fillOpacity: PropTypes.number,
      strokeWidth: PropTypes.number,
      strokeDasharray: PropTypes.string,
      strokeOpacity: PropTypes.number,
    }),
  ),
};

function PredictionForecastDots({
  lineConfigs,
  chartData,
  xAxisMap,
  yAxisMap,
  offset,
}) {
  const xAxis = xAxisMap?.[Object.keys(xAxisMap ?? {})[0]];
  const yAxis = yAxisMap?.[Object.keys(yAxisMap ?? {})[0]];
  if (
    !xAxis?.scale
    || !yAxis?.scale
    || !lineConfigs?.length
    || !chartData?.length
  ) {
    return null;
  }

  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;
  const dots = [];

  for (const cfg of lineConfigs) {
    if (cfg.type !== "band") continue;

    const { ciLowKey, ciHighKey, stroke } = cfg;

    for (const point of chartData) {
      if (!isPredictionEndpoint(point)) continue;

      const low = point[ciLowKey];
      const high = point[ciHighKey];
      if (typeof low !== "number" || typeof high !== "number") continue;

      const x = xAxis.scale(point.timestamp) + left;
      const yLow = yAxis.scale(low) + top;
      const yHigh = yAxis.scale(high) + top;
      const isTarget = isPredictionTargetEndpoint(point);
      const radius = isTarget ? 4.5 : 3.5;
      const keyBase = `${ciLowKey}-${point.timestamp}`;

      if (Math.abs(yLow - yHigh) < 0.5) {
        dots.push(
          <circle
            key={`${keyBase}-mid`}
            cx={x}
            cy={yLow}
            r={radius}
            fill={stroke}
            stroke="var(--color-bg-page, #fff)"
            strokeWidth={1.5}
          />,
        );
      } else {
        dots.push(
          <circle
            key={`${keyBase}-lo`}
            cx={x}
            cy={yLow}
            r={radius}
            fill={stroke}
            stroke="var(--color-bg-page, #fff)"
            strokeWidth={1.5}
          />,
          <circle
            key={`${keyBase}-hi`}
            cx={x}
            cy={yHigh}
            r={radius}
            fill={stroke}
            stroke="var(--color-bg-page, #fff)"
            strokeWidth={1.5}
          />,
        );
      }
    }
  }

  if (!dots.length) return null;
  return <g className="forecast-ci-dots">{dots}</g>;
}

PredictionForecastDots.propTypes = {
  lineConfigs: PropTypes.array,
  chartData: PropTypes.arrayOf(PropTypes.object),
  xAxisMap: PropTypes.object,
  yAxisMap: PropTypes.object,
  offset: PropTypes.shape({
    left: PropTypes.number,
    top: PropTypes.number,
  }),
};

function ChartCandleView({
  displayData,
  range,
  candleYBounds,
  OhlcCandleShape,
  sharedXAxis,
  sharedYAxis,
  sharedTooltip,
  predictionLineConfigs,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={displayData}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
      >
        {sharedXAxis}
        {sharedYAxis(candleYBounds)}
        {sharedTooltip}
        <Customized
          component={(props) => (
            <ForecastCiBandFill
              {...props}
              lineConfigs={predictionLineConfigs}
              chartData={displayData}
            />
          )}
        />
        <Bar
          dataKey="close"
          shape={OhlcCandleShape}
          isAnimationActive={false}
          maxBarSize={range === "1H" ? 8 : 24}
        />
        <PredictionForecastBands lineConfigs={predictionLineConfigs} />
        <Customized
          component={(props) => (
            <PredictionForecastDots
              {...props}
              lineConfigs={predictionLineConfigs}
              chartData={displayData}
            />
          )}
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
  predictionLineConfigs: PropTypes.array,
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
  predictionLineConfigs,
}) {
  const showSpread = lineMode === "spread" && hasSpreadData;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={displayData}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
      >
        {sharedXAxis}
        {sharedYAxis(null)}
        {sharedTooltip}
        <Customized
          component={(props) => (
            <ForecastCiBandFill
              {...props}
              lineConfigs={predictionLineConfigs}
              chartData={displayData}
            />
          )}
        />
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
        <PredictionForecastBands lineConfigs={predictionLineConfigs} />
        <Customized
          component={(props) => (
            <PredictionForecastDots
              {...props}
              lineConfigs={predictionLineConfigs}
              chartData={displayData}
            />
          )}
        />
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
  predictionLineConfigs: PropTypes.array,
};

function StatsDashboard({
  isLoadingStats,
  stats,
  periodStats,
  avgEntryPrice,
  currentPrice,
}) {
  return (
    <div
      className="unified-stats-container"
      aria-label="Market and period statistics"
    >
      <div className="stats-row">
        <StatCard
          label="Market Rank"
          value={formatMarketRank(isLoadingStats, stats?.rank)}
        />
        <StatCard
          label="Market Cap"
          value={isLoadingStats ? "…" : formatCompactUsd(stats?.marketCap)}
        />
        <StatCard
          label="Circulating Supply"
          value={isLoadingStats ? "…" : formatSupply(stats?.supply)}
        />
        <StatCard
          label="24h Volume"
          value={isLoadingStats ? "…" : formatCompactUsd(stats?.volume)}
        />
      </div>
      <div className="stats-row">
        <StatCard
          label="Period High"
          value={formatChartPrice(periodStats.periodHigh)}
        />
        <StatCard
          label="Period Low"
          value={formatChartPrice(periodStats.periodLow)}
        />
        <StatCard
          label="Period Change"
          value={formatPeriodChange(
            periodStats.absoluteChange,
            periodStats.percentChange,
          )}
          valueClassName={getPeriodChangeClassName(periodStats.absoluteChange)}
        />
        <StatCard
          label="All-Time High"
          value={isLoadingStats ? "…" : formatCompactUsd(stats?.ath)}
          subValue={
            isLoadingStats || !stats?.athDate
              ? undefined
              : formatAthDate(stats.athDate)
          }
        />
        {avgEntryPrice != null && (
          <StatCard
            label="Your Avg Entry"
            value={formatChartPrice(avgEntryPrice)}
            subValue={
              currentPrice != null
                ? `${((currentPrice / avgEntryPrice - 1) * 100).toFixed(2)}% vs current`
                : undefined
            }
          />
        )}
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

const TRADE_NOTICE_DURATION_MS = 7000;
const TRADE_ERROR_DURATION_MS = 6000;

function createTradeFeedbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildTradeNotice(mode, result, baseAsset) {
  const isBuy = mode === "buy";
  const amount = formatCryptoAmount(result?.cryptoAmount);
  const price = formatBalanceUsd(result?.unitPrice);
  const total = formatBalanceUsd(
    result?.fiatChange != null ? Math.abs(Number(result.fiatChange)) : null,
  );

  return {
    mode,
    title: isBuy ? "Buy confirmed" : "Sell confirmed",
    description: isBuy
      ? `Purchased ${amount} ${baseAsset} at ${price} for a total of ${total}.`
      : `Sold ${amount} ${baseAsset} at ${price} and received ${total}.`,
  };
}

function TradeFeedbackCard({ item }) {
  if (item.type === "error") {
    return (
      <div
        className="trade-form-error order-panel-feed-item"
        role="alert"
        aria-live="assertive"
      >
        <span className="trade-form-error-icon" aria-hidden="true">
          !
        </span>
        <p className="trade-form-error-text">{item.message}</p>
        <div
          className="trade-form-error-progress"
          style={{ animationDuration: `${item.durationMs}ms` }}
        />
      </div>
    );
  }

  return (
    <div
      className={`trade-notice trade-notice--${item.mode} order-panel-feed-item`}
      role="status"
    >
      <p className="trade-notice-title">{item.title}</p>
      <p className="trade-notice-desc">{item.description}</p>
      <div
        className="trade-notice-progress"
        style={{ animationDuration: `${item.durationMs}ms` }}
      />
    </div>
  );
}

TradeFeedbackCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.oneOf(["error", "notice"]).isRequired,
    durationMs: PropTypes.number.isRequired,
    message: PropTypes.string,
    mode: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
};

function OrderPanel({
  bid,
  ask,
  previousBid,
  previousAsk,
  ownedAmount,
  usdBalance,
  baseAsset,
  onConfirm,
}) {
  const [tradeMode, setTradeMode] = useState("buy");
  const [cryptoInput, setCryptoInput] = useState("");
  const [usdInput, setUsdInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeFeedbacks, setTradeFeedbacks] = useState([]);
  const lastEditedRef = useRef(null);
  const cryptoInputRef = useRef(cryptoInput);
  const usdInputRef = useRef(usdInput);
  const feedbackTimersRef = useRef(new Map());

  cryptoInputRef.current = cryptoInput;
  usdInputRef.current = usdInput;

  const ownedValue = bid != null && ownedAmount > 0 ? ownedAmount * bid : null;
  const activePrice = tradeMode === "buy" ? ask : bid;

  const resolveTradeAmount = useCallback(() => {
    if (activePrice == null || activePrice <= 0) return null;

    if (lastEditedRef.current === "usd") {
      const parsedUsd = Number.parseFloat(usdInput);
      if (Number.isNaN(parsedUsd) || parsedUsd <= 0) return null;
      return cryptoAmountFromFiat(parsedUsd, activePrice);
    }

    const parsedCrypto = Number.parseFloat(cryptoInput);
    if (Number.isNaN(parsedCrypto) || parsedCrypto <= 0) return null;
    return parsedCrypto;
  }, [activePrice, cryptoInput, usdInput]);

  const tradeAmount = resolveTradeAmount();
  const isValidAmount = tradeAmount != null && tradeAmount > 0;
  const exceedsOwned =
    tradeMode === "sell" && isValidAmount && tradeAmount > ownedAmount;

  const syncFromCrypto = useCallback((cryptoValue, price) => {
    const num = Number.parseFloat(cryptoValue);
    if (Number.isNaN(num) || num <= 0 || price == null) {
      setUsdInput("");
      return;
    }
    setUsdInput(formatBalance(num * price));
  }, []);

  const syncFromUsd = useCallback((usdValue, price) => {
    const num = Number.parseFloat(usdValue);
    if (Number.isNaN(num) || num <= 0 || price == null) {
      setCryptoInput("");
      return;
    }
    const amount = cryptoAmountFromFiat(num, price) ?? num / price;
    setCryptoInput(formatCryptoAmount(amount));
  }, []);

  useEffect(() => {
    if (activePrice == null || lastEditedRef.current == null) return;
    if (lastEditedRef.current === "crypto") {
      syncFromCrypto(cryptoInputRef.current, activePrice);
    } else if (lastEditedRef.current === "usd") {
      syncFromUsd(usdInputRef.current, activePrice);
    }
  }, [activePrice, syncFromCrypto, syncFromUsd]);

  const removeTradeFeedback = useCallback((id) => {
    const timerId = feedbackTimersRef.current.get(id);
    if (timerId != null) {
      clearTimeout(timerId);
      feedbackTimersRef.current.delete(id);
    }
    setTradeFeedbacks((items) => items.filter((item) => item.id !== id));
  }, []);

  const scheduleTradeFeedbackRemoval = useCallback(
    (id, durationMs) => {
      const timerId = setTimeout(() => removeTradeFeedback(id), durationMs);
      feedbackTimersRef.current.set(id, timerId);
    },
    [removeTradeFeedback],
  );

  const pushTradeFeedback = useCallback(
    (item) => {
      setTradeFeedbacks((items) => [item, ...items]);
      scheduleTradeFeedbackRemoval(item.id, item.durationMs);
    },
    [scheduleTradeFeedbackRemoval],
  );

  useEffect(
    () => () => {
      feedbackTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      feedbackTimersRef.current.clear();
    },
    [],
  );

  const clearTradeErrors = useCallback(() => {
    setTradeFeedbacks((items) => {
      items
        .filter((item) => item.type === "error")
        .forEach((item) => {
          const timerId = feedbackTimersRef.current.get(item.id);
          if (timerId != null) {
            clearTimeout(timerId);
            feedbackTimersRef.current.delete(item.id);
          }
        });
      return items.filter((item) => item.type !== "error");
    });
  }, []);

  const showTradeError = useCallback(
    (message) => {
      pushTradeFeedback({
        id: createTradeFeedbackId(),
        type: "error",
        message,
        durationMs: TRADE_ERROR_DURATION_MS,
      });
    },
    [pushTradeFeedback],
  );

  const showTradeNotice = useCallback(
    (notice) => {
      pushTradeFeedback({
        id: createTradeFeedbackId(),
        type: "notice",
        durationMs: TRADE_NOTICE_DURATION_MS,
        ...notice,
      });
    },
    [pushTradeFeedback],
  );

  const hasActiveError = tradeFeedbacks.some((item) => item.type === "error");

  const handleCryptoChange = (e) => {
    const value = e.target.value;
    if (hasActiveError) clearTradeErrors();
    lastEditedRef.current = "crypto";
    setCryptoInput(value);
    if (value === "") {
      setUsdInput("");
      return;
    }
    syncFromCrypto(value, activePrice);
  };

  const handleUsdChange = (e) => {
    const value = e.target.value;
    if (hasActiveError) clearTradeErrors();
    lastEditedRef.current = "usd";
    setUsdInput(value);
    if (value === "") {
      setCryptoInput("");
      return;
    }
    syncFromUsd(value, activePrice);
  };

  const handleMaxCrypto = () => {
    if (ownedAmount <= 0) return;
    if (hasActiveError) clearTradeErrors();
    lastEditedRef.current = "crypto";
    const formatted = formatCryptoAmount(ownedAmount);
    setCryptoInput(formatted);
    syncFromCrypto(formatted, activePrice);
  };

  const handleMaxUsd = () => {
    if (usdBalance <= 0) return;
    if (hasActiveError) clearTradeErrors();
    lastEditedRef.current = "usd";
    const formatted = formatBalance(usdBalance);
    setUsdInput(formatted);
    syncFromUsd(formatted, activePrice);
  };

  const canConfirm =
    isValidAmount && !exceedsOwned && activePrice != null && !isSubmitting;

  const resolveInvalidTradeMessage = () => {
    if (isSubmitting) return "Trade already in progress";

    if (activePrice == null) {
      return tradeMode === "buy"
        ? "Ask price unavailable"
        : "Bid price unavailable";
    }

    if (exceedsOwned) {
      return `You only own ${formatCryptoAmount(ownedAmount)} ${baseAsset}`;
    }

    const hasInput = cryptoInput.trim() !== "" || usdInput.trim() !== "";
    if (!hasInput) return "Enter an amount to trade";

    if (lastEditedRef.current === "usd") {
      const parsedUsd = Number.parseFloat(usdInput);
      if (Number.isNaN(parsedUsd) || parsedUsd <= 0) {
        return "Enter a valid USD amount";
      }
    } else {
      const parsedCrypto = Number.parseFloat(cryptoInput);
      if (Number.isNaN(parsedCrypto) || parsedCrypto <= 0) {
        return `Enter a valid ${baseAsset} amount`;
      }
    }

    return "Enter a valid amount to trade";
  };

  const buildTradePayload = () => {
    if (lastEditedRef.current === "usd") {
      const trimmedUsd = usdInput.trim();
      const parsedUsd = Number.parseFloat(trimmedUsd);
      if (Number.isNaN(parsedUsd) || parsedUsd <= 0) return null;
      return { fiatAmount: trimmedUsd };
    }

    if (tradeAmount == null) return null;
    return { cryptoAmount: tradeAmount.toFixed(8) };
  };

  const handleConfirm = async () => {
    if (!canConfirm) {
      showTradeError(resolveInvalidTradeMessage());
      return;
    }

    const tradePayload = buildTradePayload();
    if (!tradePayload) {
      showTradeError(resolveInvalidTradeMessage());
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onConfirm(tradeMode, tradePayload);
      showTradeNotice(buildTradeNotice(tradeMode, result, baseAsset));
      setCryptoInput("");
      setUsdInput("");
      lastEditedRef.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trade failed";
      showTradeError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTradeInputKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleConfirm();
  };

  return (
    <aside className="order-section" aria-label="Order panel">
      <div className="order-panel-controls">
        <div
          className="owned-holdings"
          aria-label="Your holdings for this asset"
        >
          <span className="owned-holdings-label">You own</span>
          <span className="owned-holdings-amount">
            {formatCryptoAmount(ownedAmount)} {baseAsset}
          </span>
          {ownedValue != null && (
            <span className="owned-holdings-value">
              ≈ {formatBalanceUsd(ownedValue)}
            </span>
          )}
        </div>

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
          </div>
        </div>

        <div
          className={`trade-mode-toggle trade-mode-toggle--${tradeMode}`}
          role="radiogroup"
          aria-label="Trade operation"
        >
          <span className="trade-mode-indicator" aria-hidden="true" />
          <label
            className={`trade-mode-option${tradeMode === "buy" ? " active" : ""}`}
          >
            <input
              type="radio"
              name="trade-mode"
              value="buy"
              checked={tradeMode === "buy"}
              onChange={() => {
                clearTradeErrors();
                setTradeMode("buy");
              }}
            />
            <span className="trade-mode-label">Buy</span>
          </label>
          <label
            className={`trade-mode-option${tradeMode === "sell" ? " active" : ""}`}
          >
            <input
              type="radio"
              name="trade-mode"
              value="sell"
              checked={tradeMode === "sell"}
              onChange={() => {
                clearTradeErrors();
                setTradeMode("sell");
              }}
            />
            <span className="trade-mode-label">Sell</span>
          </label>
        </div>

        <div
          className={`trade-form trade-form--${tradeMode}${hasActiveError ? " trade-form--error" : ""}`}
        >
          <label className="trade-field" htmlFor="trade-amount">
            <span className="trade-field-label">Amount ({baseAsset})</span>
            <div className="trade-input-wrap">
              <input
                id="trade-amount"
                className="trade-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00000"
                value={cryptoInput}
                onChange={handleCryptoChange}
                onKeyDown={handleTradeInputKeyDown}
              />
              {tradeMode === "sell" && ownedAmount > 0 && (
                <button
                  type="button"
                  className="trade-max-btn"
                  onClick={handleMaxCrypto}
                  aria-label={`Use full balance of ${formatCryptoAmount(ownedAmount)} ${baseAsset}`}
                >
                  MAX
                </button>
              )}
            </div>
          </label>

          <label className="trade-field" htmlFor="trade-usd">
            <span className="trade-field-label">
              {tradeMode === "buy" ? "Cost (USD)" : "Proceeds (USD)"}
            </span>
            <div className="trade-input-wrap">
              <input
                id="trade-usd"
                className="trade-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00000"
                value={usdInput}
                onChange={handleUsdChange}
                onKeyDown={handleTradeInputKeyDown}
              />
              {tradeMode === "buy" && usdBalance > 0 && (
                <button
                  type="button"
                  className="trade-max-btn"
                  onClick={handleMaxUsd}
                  aria-label={`Use full USD balance of ${formatBalanceUsd(usdBalance)}`}
                >
                  MAX
                </button>
              )}
            </div>
          </label>

          <p className="trade-rate-hint">@ {formatQuote(activePrice)}</p>

          {exceedsOwned && (
            <p className="trade-error">
              You only own {formatCryptoAmount(ownedAmount)} {baseAsset}
            </p>
          )}

          <button
            type="button"
            className={`btn-confirm btn-confirm--${tradeMode}`}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isSubmitting
              ? "Processing…"
              : `Confirm ${tradeMode === "buy" ? "Buy" : "Sell"}`}
          </button>
        </div>
      </div>

      <div className="order-panel-feed" aria-live="polite">
        {tradeFeedbacks.map((item) => (
          <TradeFeedbackCard key={item.id} item={item} />
        ))}
      </div>
    </aside>
  );
}

OrderPanel.propTypes = {
  bid: PropTypes.number,
  ask: PropTypes.number,
  previousBid: PropTypes.number,
  previousAsk: PropTypes.number,
  ownedAmount: PropTypes.number.isRequired,
  usdBalance: PropTypes.number.isRequired,
  baseAsset: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
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
  const { assets, balance, transactions } = useContext(AppContext);
  const { isFavorite, toggleFavorite, registerOpened, unregisterOpened } =
    useFavorites();

  const buy = useBuy();
  const sell = useSell();
  const prices = usePrices();
  useAssets();

  const [chartMode, setChartMode] = useState("line"); // 'line' | 'candle'
  const [lineMode, setLineMode] = useState("mid"); // 'mid'  | 'spread'
  const [showPredictions, setShowPredictions] = useState(false);
  const [showHistoricalPredictions, setShowHistoricalPredictions] = useState(false);

  const symbol = String(cryptoCode).replace("-", "/").toUpperCase();
  const baseAsset = getBaseAsset(symbol).toUpperCase();
  const favorited = isFavorite(cryptoCode);

  useEffect(() => {
    registerOpened(cryptoCode);
    return () => unregisterOpened(cryptoCode);
  }, [cryptoCode, registerOpened, unregisterOpened]);
  const ownedAmount = useMemo(() => {
    const asset = assets.find((item) => item.cryptoCode === symbol);
    return asset ? Number(asset.cryptoAmount) : 0;
  }, [assets, symbol]);
  const usdBalance = useMemo(() => {
    if (balance?.balance == null) return 0;
    const parsed = Number(balance.balance);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [balance]);
  const { chartData, isLoading, chartType, range, setRange } = useLiveChart(
    cryptoCode,
    "1D",
    chartMode,
  );
  const { stats, isLoadingStats } = useCoinStats(symbol);
  const {
    prediction,
    history: predictionHistory,
    loading: predictionLoading,
    error: predictionError,
    loadPredictions,
  } = usePredictions();

  const canPredict = PREDICTION_ASSET_SET.has(symbol);

  useEffect(() => {
    setShowPredictions(false);
    setShowHistoricalPredictions(false);
  }, [symbol]);

  const predictionPath = symbol.replace("/", "-");

  useEffect(() => {
    if (!showPredictions || !canPredict) return undefined;

    let timeoutId;
    const scheduleRefresh = () => {
      timeoutId = setTimeout(async () => {
        const limit = HISTORY_FETCH_LIMIT[range] ?? 50;
        await loadPredictions(predictionPath, limit);
        scheduleRefresh();
      }, msUntilNextHourlyPredictionRefresh());
    };

    scheduleRefresh();
    return () => clearTimeout(timeoutId);
  }, [showPredictions, canPredict, predictionPath, range, loadPredictions]);

  useEffect(() => {
    if (!showPredictions || !canPredict) return;
    const limit = HISTORY_FETCH_LIMIT[range] ?? 50;
    loadPredictions(predictionPath, limit);
  }, [showPredictions, canPredict, range, predictionPath, loadPredictions]);

  useEffect(() => {
    if (!showPredictions || !showHistoricalPredictions || !canPredict) return;
    const limit = HISTORY_FETCH_LIMIT[range] ?? 50;
    loadPredictions(predictionPath, limit);
  }, [
    showPredictions,
    showHistoricalPredictions,
    canPredict,
    range,
    predictionPath,
    loadPredictions,
  ]);

  const handlePredictToggle = async () => {
    if (showPredictions) {
      setShowPredictions(false);
      return;
    }
    const limit = HISTORY_FETCH_LIMIT[range] ?? 50;
    try {
      await loadPredictions(predictionPath, limit);
    } catch {
      // Panel shows error when visible
    }
    setShowPredictions(true);
  };

  // ── Derived display data ────────────────────────────────────────────────────

  const displayData = useMemo(() => {
    if (chartMode !== "candle") return chartData;
    if (chartType === "OHLC") return chartData;
    return aggregateTicksToOhlc(chartData, TICK_CANDLE_WINDOW_MS);
  }, [chartMode, chartType, chartData]);

  const predictionChartOverlay = useMemo(() => {
    if (!showPredictions || !canPredict) {
      return { points: [], lineConfigs: [], predictionWindowEnd: null };
    }

    const forwardOverlay = buildPredictionChartOverlay(
      displayData,
      prediction,
      true,
      range,
      chartMode,
      chartType,
    );

    const historicalOverlay = showHistoricalPredictions
      ? buildHistoricalPredictionOverlay(displayData, predictionHistory, range)
      : { points: [], lineConfigs: [], predictionWindowEnd: null };

    return mergePredictionOverlays(historicalOverlay, forwardOverlay);
  }, [
    displayData,
    prediction,
    predictionHistory,
    showPredictions,
    showHistoricalPredictions,
    canPredict,
    range,
    chartMode,
    chartType,
  ]);

  const chartRenderData = useMemo(
    () => applyForecastOverlay(displayData, predictionChartOverlay),
    [displayData, predictionChartOverlay],
  );
  const predictionLineConfigs = predictionChartOverlay.lineConfigs;
  const predictionWindowEnd = predictionChartOverlay.predictionWindowEnd;

  const predictionFilterLabel = useMemo(
    () =>
      getPredictionFilterLabel(
        showPredictions && canPredict,
        range,
        prediction,
        predictionLineConfigs.length > 0,
        predictionWindowEnd,
      ),
    [
      showPredictions,
      canPredict,
      range,
      prediction,
      predictionLineConfigs.length,
      predictionWindowEnd,
    ],
  );

  const isDisplayOhlc = chartMode === "candle" || chartType === "OHLC";

  // ── Period stats ────────────────────────────────────────────────────────────

  const periodStats = useMemo(
    () => computePeriodStats(displayData, isDisplayOhlc),
    [displayData, isDisplayOhlc],
  );

  // ── Live order book ─────────────────────────────────────────────────────────

  const liveTick = useMemo(
    () => prices.find((tick) => tick.symbol === symbol),
    [prices, symbol],
  );

  const bid = liveTick?.bid ?? null;
  const ask = liveTick?.ask ?? null;
  const previousBid = liveTick?.previousBid ?? null;
  const previousAsk = liveTick?.previousAsk ?? null;

  const hasSpreadData =
    chartType === "TICK" &&
    displayData.some((d) => d.bid != null && d.ask != null);

  const avgEntryPrice = useMemo(() => {
    let qty = 0;
    let cost = 0;
    const sorted = [...transactions]
      .filter((t) => t.cryptoCode === symbol)
      .sort((a, b) => new Date(a.tradeTimestamp) - new Date(b.tradeTimestamp));
    for (const tx of sorted) {
      const amount = Number(tx.cryptoAmount);
      const usd = Number(tx.localCurrencyAmount);
      if (Number.isNaN(amount) || Number.isNaN(usd)) continue;
      if (tx.isPurchase) {
        qty += amount;
        cost += usd;
      } else if (qty > 0) {
        const avg = cost / qty;
        cost -= avg * amount;
        qty = Math.max(0, qty - amount);
      }
    }
    return qty > 0 ? cost / qty : null;
  }, [transactions, symbol]);

  const currentMidPrice =
    bid != null && ask != null ? (bid + ask) / 2 : (bid ?? ask);

  // Y-axis bounds for the candle chart (with 4% padding each side).
  const candleYBounds = useMemo(() => {
    if (chartMode !== "candle" || chartRenderData.length === 0) return null;
    const first = chartRenderData[0];
    if (first.high == null) return null;
    const lows = chartRenderData.map((d) => d.low).filter((v) => v != null);
    const highs = chartRenderData.map((d) => d.high).filter((v) => v != null);
    const forecastPrices = collectForecastPrices(chartRenderData);
    if (!lows.length || !highs.length) return null;
    const minLow = Math.min(...lows, ...forecastPrices);
    const maxHigh = Math.max(...highs, ...forecastPrices);
    const pad = (maxHigh - minLow) * 0.04;
    return [minLow - pad, maxHigh + pad];
  }, [chartMode, chartRenderData]);

  const OhlcCandleShape = useCallback(
    (props) => renderCandleShape(props, candleYBounds),
    [candleYBounds],
  );

  // ── Trade handlers ──────────────────────────────────────────────────────────

  const handleConfirm = async (mode, tradePayload) => {
    if (mode === "buy") {
      if (ask == null) throw new Error("Ask price unavailable");
      return buy(symbol, tradePayload);
    }
    if (bid == null) throw new Error("Bid price unavailable");
    return sell(symbol, tradePayload);
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
      content={
        <CustomTooltip
          chartData={chartRenderData}
          range={range}
          chartMode={chartMode}
          chartType={chartType}
        />
      }
      cursor={{ stroke: "var(--color-border-subtle)", strokeWidth: 1 }}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="crypto-details-container crypto-details-page">
      <header className="terminal-header">
        <button
          type="button"
          className="crypto-back-btn"
          onClick={() => navigate("/market")}
        >
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
          <button
            type="button"
            className={`crypto-favorite-btn${favorited ? " active" : ""}`}
            onClick={() => toggleFavorite(cryptoCode)}
            aria-label={
              favorited ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={favorited}
            title={favorited ? "Remove from favorites" : "Add to favorites"}
          >
            {favorited ? "★" : "☆"}
          </button>
        </div>
      </header>

      <div className="terminal-main">
        <div className="chart-column">
          <section className="chart-section" aria-label="Live price chart">
            {/* ── Timeframe + chart-mode controls ── */}
            <div className="chart-controls-bar">
              <div
                className="timeframe-selectors"
                role="tablist"
                aria-label="Chart timeframe"
              >
                <div className="timeframe-selector-row">
                  <span className="timeframe-selector-label timeframe-selector-label--live">
                    Live:
                  </span>
                  <div className="timeframe-selector">
                    {LIVE_CHART_RANGE_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        className={`timeframe-btn${range === value ? " active" : ""}`}
                        onClick={() => setRange(value)}
                        aria-selected={range === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="timeframe-selector-row timeframe-selector-row--aggregated">
                  <div className="timeframe-selector-aggregated-group">
                    <span className="timeframe-selector-label timeframe-selector-label--aggregated">
                      Aggregated:
                    </span>
                    <div className="timeframe-selector timeframe-selector--aggregated">
                      {AGGREGATED_CHART_RANGE_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          role="tab"
                          className={`timeframe-btn${range === value ? " active" : ""}`}
                          onClick={() => setRange(value)}
                          aria-selected={range === value}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="chart-mode-controls">
                <div className="chart-mode-toolbar">
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
                        onClick={() => {
                          if (hasSpreadData) setLineMode("spread");
                        }}
                        disabled={hasSpreadData === false}
                        title={
                          hasSpreadData
                            ? undefined
                            : "Spread data available for live tick ranges only"
                        }
                      >
                        Spread
                      </button>
                    </fieldset>
                  )}

                  {canPredict && (
                    <button
                      type="button"
                      className={`btn-ai-predict${showPredictions ? " active" : ""}`}
                      onClick={handlePredictToggle}
                      disabled={predictionLoading}
                      aria-pressed={showPredictions}
                    >
                      ✦ AI Predict{predictionLoading ? " …" : ""}
                    </button>
                  )}
                </div>

                {canPredict && (
                  <div className="chart-predict-secondary-row">
                    {showPredictions ? (
                      <>
                        {predictionFilterLabel &&
                          isPredictionChartRange(range) && (
                            <p
                              className="prediction-chart-filter"
                              role="status"
                            >
                              Chart overlay: {predictionFilterLabel}
                            </p>
                          )}
                        {!predictionFilterLabel &&
                          isPredictionChartRange(range) && (
                            <p
                              className="prediction-chart-filter prediction-chart-filter--muted"
                              role="status"
                            >
                              Loading forecast…
                            </p>
                          )}
                        {!predictionFilterLabel &&
                          !isPredictionChartRange(range) && (
                            <p
                              className="prediction-chart-filter prediction-chart-filter--muted"
                              role="status"
                            >
                              Switch to 1H–1Y for forecast overlay
                            </p>
                          )}
                        {isPredictionChartRange(range) && (
                          <button
                            type="button"
                            className={`btn-predict-history${showHistoricalPredictions ? " active" : ""}`}
                            onClick={() =>
                              setShowHistoricalPredictions((v) => !v)
                            }
                            disabled={predictionLoading}
                            aria-pressed={showHistoricalPredictions}
                          >
                            Past predictions
                          </button>
                        )}
                      </>
                    ) : (
                      <span
                        className="chart-predict-secondary-placeholder"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Chart area ── */}
            <div className="crypto-chart-wrapper">
              {renderChartStatus(displayData, isLoading, chartType)}

              {chartRenderData.length > 0 && chartMode === "candle" && (
                <ChartCandleView
                  displayData={chartRenderData}
                  range={range}
                  candleYBounds={candleYBounds}
                  OhlcCandleShape={OhlcCandleShape}
                  sharedXAxis={sharedXAxis}
                  sharedYAxis={sharedYAxis}
                  sharedTooltip={sharedTooltip}
                  predictionLineConfigs={
                    showPredictions ? predictionLineConfigs : []
                  }
                />
              )}

              {chartRenderData.length > 0 && chartMode === "line" && (
                <ChartLineView
                  displayData={chartRenderData}
                  range={range}
                  lineMode={lineMode}
                  hasSpreadData={hasSpreadData}
                  chartType={chartType}
                  sharedXAxis={sharedXAxis}
                  sharedYAxis={sharedYAxis}
                  sharedTooltip={sharedTooltip}
                  predictionLineConfigs={
                    showPredictions ? predictionLineConfigs : []
                  }
                />
              )}

              {isLoading && displayData.length > 0 && (
                <div className="chart-loading-badge" aria-live="polite">
                  Updating…
                </div>
              )}
            </div>

            <StatsDashboard
              isLoadingStats={isLoadingStats}
              stats={stats}
              periodStats={periodStats}
              avgEntryPrice={avgEntryPrice}
              currentPrice={currentMidPrice}
            />

            {canPredict && (
              <PredictionPanel
                prediction={prediction}
                loading={predictionLoading}
                error={predictionError}
                onRefresh={() =>
                  loadPredictions(
                    predictionPath,
                    HISTORY_FETCH_LIMIT[range] ?? 50,
                  )
                }
                visible={showPredictions}
              />
            )}
          </section>

          {range === "ALL" && (
            <p className="all-time-disclaimer" role="note">
              All-time data means price history since this asset started trading
              on the Kraken platform.
            </p>
          )}
        </div>

        <OrderPanel
          bid={bid}
          ask={ask}
          previousBid={previousBid}
          previousAsk={previousAsk}
          ownedAmount={ownedAmount}
          usdBalance={usdBalance}
          baseAsset={baseAsset}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
};

export default CryptoDetails;
