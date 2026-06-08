import {
  CHART_BUCKET_MS,
  LIVE_CHART_RANGE_IDS,
} from "../constants/chartConfig";
import { PREDICTION_COLORS } from "../constants/predictionColors";

const HOUR_MS = 60 * 60 * 1000;

/** Ranges that currently support a chart prediction overlay. */
export const PREDICTION_CHART_RANGES = new Set([
  "1H", "1D", "1W", "1M", "3M", "1Y",
]);

/** Long-range charts: daily wedge only (no hourly overlay). */
const DAILY_ONLY_CHART_RANGES = new Set(["1M", "3M", "1Y"]);

export { CHART_BUCKET_MS, PREDICTION_COLORS };

export const PREDICTION_LINE_KEYS = {
  FUTURE: "futurePrediction",
  HOURLY: "hourlyPrediction",
  DAILY: "dailyPrediction",
  CONTEXT_AWARE: "contextAwarePrediction",
};

export const FORECAST_CI_KEYS = {
  [PREDICTION_LINE_KEYS.FUTURE]: {
    low: "futureCiLow",
    high: "futureCiHigh",
  },
  [PREDICTION_LINE_KEYS.HOURLY]: {
    low: "hourlyCiLow",
    high: "hourlyCiHigh",
  },
  [PREDICTION_LINE_KEYS.DAILY]: {
    low: "dailyCiLow",
    high: "dailyCiHigh",
  },
  [PREDICTION_LINE_KEYS.CONTEXT_AWARE]: {
    low: "contextAwareCiLow",
    high: "contextAwareCiHigh",
  },
};

export const HISTORICAL_CI_KEYS = {
  [PREDICTION_LINE_KEYS.FUTURE]: {
    low: "histFutureCiLow",
    high: "histFutureCiHigh",
  },
  [PREDICTION_LINE_KEYS.HOURLY]: {
    low: "histHourlyCiLow",
    high: "histHourlyCiHigh",
  },
  [PREDICTION_LINE_KEYS.DAILY]: {
    low: "histDailyCiLow",
    high: "histDailyCiHigh",
  },
  [PREDICTION_LINE_KEYS.CONTEXT_AWARE]: {
    low: "histContextAwareCiLow",
    high: "histContextAwareCiHigh",
  },
};

function getForecastCi(forecast) {
  const ciLow = forecast?.ciLow;
  const ciHigh = forecast?.ciHigh;
  if (typeof ciLow === "number" && typeof ciHigh === "number") {
    return { ciLow, ciHigh, mid: (ciLow + ciHigh) / 2 };
  }

  const price = forecast?.price;
  if (typeof price === "number") {
    return { ciLow: price, ciHigh: price, mid: price };
  }

  return null;
}

/** How many stored predictions to load per chart range (fits visible window). */
export const HISTORY_FETCH_LIMIT = {
  "1Min": 1,
  "5Min": 1,
  "15Min": 1,
  "1H": 12,
  "1D": 30,
  "1W": 200,
  "1M": 40,
  "3M": 100,
  "1Y": 400,
  ALL: 1,
};

const DAY_MS = 24 * HOUR_MS;

const EMPTY_OVERLAY = {
  points: [],
  lineConfigs: [],
  predictionWindowEnd: null,
};

/** Flags marking vertices where prediction band dots should render. */
export const PREDICTION_ENDPOINT_FLAGS = [
  "isForecastAnchor",
  "isHistoricalAnchor",
  "isFutureTarget",
  "isHistoricalFutureTarget",
  "isHourlyFutureTarget",
  "isHistoricalHourlyTarget",
  "isDailyFutureTarget",
  "isHistoricalDailyTarget",
  "isContextAwareFutureTarget",
  "isHistoricalContextAwareTarget",
];

const PREDICTION_TARGET_FLAGS = new Set([
  "isFutureTarget",
  "isHistoricalFutureTarget",
  "isHourlyFutureTarget",
  "isHistoricalHourlyTarget",
  "isDailyFutureTarget",
  "isHistoricalDailyTarget",
  "isContextAwareFutureTarget",
  "isHistoricalContextAwareTarget",
]);

export function isPredictionEndpoint(point) {
  if (!point) return false;
  return PREDICTION_ENDPOINT_FLAGS.some((flag) => point[flag]);
}

export function isPredictionTargetEndpoint(point) {
  if (!point) return false;
  return PREDICTION_ENDPOINT_FLAGS.some(
    (flag) => PREDICTION_TARGET_FLAGS.has(flag) && point[flag],
  );
}

export function floorToHourMs(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function floorToDayMs(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatHourLabel(ts) {
  return new Date(ts).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parsePredictedAtMs(record) {
  const raw = record?.predictedAt ?? record?.predicted_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatDayLabel(ts) {
  return new Date(ts).toLocaleString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour12: false,
  });
}

export function isPredictionChartRange(range) {
  return PREDICTION_CHART_RANGES.has(range);
}

/** Target timestamps for panel labels (1h uses next :00 from now, matching the 1H chart). */
export function getPredictionTargetTimes(prediction) {
  const nowHour = floorToHourMs(Date.now());
  const anchor = floorToHourMs(prediction?.predictedAt ?? Date.now());
  if (nowHour == null || anchor == null) {
    return { anchor: null, target1h: null, target24h: null };
  }
  return {
    anchor: nowHour,
    target1h: nowHour + HOUR_MS,
    target24h: anchor + DAY_MS,
  };
}

export function formatPredictionTargetTime(ts) {
  if (ts == null) return null;
  return new Date(ts).toLocaleString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getPredictionFilterLabel(
  showPredictions,
  range,
  prediction,
  hasLines,
  predictionWindowEnd,
) {
  if (!showPredictions || !isPredictionChartRange(range)) return null;
  if (!hasLines) return null;

  if (range === "1D" || range === "1W") {
    const hourlyTo = formatHourLabel(
      predictionWindowEnd ?? floorToHourMs(Date.now()) + HOUR_MS,
    );
    const dailyTo = formatDayLabel(
      predictionWindowEnd ?? floorToDayMs(Date.now()) + DAY_MS,
    );
    return `Model hourly to ${hourlyTo}, model daily & context-aware to ${dailyTo}`;
  }

  if (DAILY_ONLY_CHART_RANGES.has(range)) {
    const to = formatDayLabel(predictionWindowEnd ?? floorToDayMs(Date.now()) + DAY_MS);
    return `Model daily & context-aware forecast to ${to}`;
  }

  const to = formatHourLabel(predictionWindowEnd ?? floorToHourMs(Date.now()) + HOUR_MS);
  return `Model hourly forecast to ${to}`;
}

function hasHourlyForecast(record) {
  return getForecastCi(record?.ml1hPrediction) != null;
}

function hasDailyForecast(record) {
  return getForecastCi(record?.mlPrediction) != null;
}

function buildPredictionIndex(history) {
  const byHour = new Map();
  const byDay = new Map();

  for (const record of history || []) {
    const ms = parsePredictedAtMs(record);
    if (ms == null) continue;
    const hour = floorToHourMs(ms);
    const day = floorToDayMs(ms);
    if (hour != null && hasHourlyForecast(record)) byHour.set(hour, record);
    if (day != null && hasDailyForecast(record)) byDay.set(day, record);
  }

  return { byHour, byDay };
}

function getChartTimeBounds(displayData) {
  if (!displayData?.length) return null;
  return {
    minTs: displayData[0].timestamp,
    maxTs: displayData[displayData.length - 1].timestamp,
  };
}

/** Extend chart bounds to now so recent prediction targets are not clipped. */
function getHistoricalChartBounds(displayData) {
  const bounds = getChartTimeBounds(displayData);
  if (!bounds) return null;
  const nowMs = Date.now();
  return {
    minTs: bounds.minTs,
    maxTs: Math.max(bounds.maxTs, nowMs),
  };
}

function getLastLivePoint(displayData) {
  for (let i = displayData.length - 1; i >= 0; i--) {
    const row = displayData[i];
    if (row.isFutureSlot || row.isFutureTarget) continue;
    const price = row.close ?? row.price;
    if (typeof price === "number" && !Number.isNaN(price)) {
      return { timestamp: row.timestamp, price };
    }
  }
  return null;
}

function getPriceNearTimestamp(displayData, timestamp) {
  let priceBefore = null;
  let priceAfter = null;

  for (const row of displayData || []) {
    if (row.isFutureSlot || row.isFutureTarget) continue;
    const price = row.close ?? row.price;
    if (typeof price !== "number" || Number.isNaN(price)) continue;

    if (row.timestamp <= timestamp) {
      priceBefore = price;
    } else if (priceAfter == null) {
      priceAfter = price;
      break;
    }
  }

  return priceBefore ?? priceAfter ?? null;
}

function getHistoricalAnchorPrice(record, displayData, predTs) {
  const snapshotClose =
    record?.contextSnapshot?.ohlcvState?.close
    ?? record?.contextSnapshot?.ohlcv_state?.close;
  if (typeof snapshotClose === "number" && !Number.isNaN(snapshotClose)) {
    return snapshotClose;
  }
  return getPriceNearTimestamp(displayData, predTs);
}

function predictionOverlapsChart(predTs, targetTs, bounds) {
  return targetTs >= bounds.minTs && predTs <= bounds.maxTs;
}

function flattenBandSegmentsForChart(segments, ciLowKey, ciHighKey) {
  const rows = [];
  segments.forEach(([anchor, target], index) => {
    rows.push(anchor, target);
    if (index < segments.length - 1) {
      rows.push({
        timestamp: target.timestamp + 1,
        [ciLowKey]: null,
        [ciHighKey]: null,
      });
    }
  });
  return rows;
}

function buildHistoricalWedgeSegments({
  displayData,
  bounds,
  byIndex,
  horizonMs,
  getCi,
  histKeys,
  anchorFlag,
  targetFlag,
}) {
  const segments = [];
  const nowMs = Date.now();

  for (const [predTs, record] of byIndex) {
    const targetTs = predTs + horizonMs;
    const ci = getCi(record);
    if (!ci || targetTs > nowMs) continue;
    if (!predictionOverlapsChart(predTs, targetTs, bounds)) continue;

    const anchorPrice = getHistoricalAnchorPrice(record, displayData, predTs);
    if (anchorPrice == null) continue;

    segments.push([
      {
        timestamp: predTs,
        [histKeys.low]: anchorPrice,
        [histKeys.high]: anchorPrice,
        [anchorFlag]: true,
      },
      {
        timestamp: targetTs,
        [histKeys.low]: ci.ciLow,
        [histKeys.high]: ci.ciHigh,
        [targetFlag]: true,
      },
    ]);
  }

  return segments;
}

function applyHistoricalWedgeBand(
  pointMap,
  lineConfigs,
  segments,
  bandConfig,
  ciLowKey,
  ciHighKey,
) {
  if (!segments.length) return;

  for (const point of flattenBandSegmentsForChart(segments, ciLowKey, ciHighKey)) {
    const existing = pointMap.get(point.timestamp);
    pointMap.set(point.timestamp, existing ? { ...existing, ...point } : point);
  }

  lineConfigs.push({
    ...bandConfig,
    bandSegments: segments,
    connectNulls: segments.length <= 1,
  });
}

function build1hBandConfig() {
  const { FUTURE } = PREDICTION_LINE_KEYS;
  const ciKeys = FORECAST_CI_KEYS[FUTURE];
  return [{
    type: "band",
    ciLowKey: ciKeys.low,
    ciHighKey: ciKeys.high,
    name: "Model hourly forecast",
    stroke: PREDICTION_COLORS.ML_HOURLY,
    fillOpacity: 0.18,
    strokeWidth: 1.5,
    strokeDasharray: "6 4",
    strokeOpacity: 0.95,
  }];
}

function buildHourlyBandConfig() {
  const hourlyCi = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.HOURLY];
  return {
    type: "band",
    ciLowKey: hourlyCi.low,
    ciHighKey: hourlyCi.high,
    name: "Model hourly forecast",
    stroke: PREDICTION_COLORS.ML_HOURLY,
    fillOpacity: 0.16,
    strokeWidth: 1.5,
    strokeDasharray: "6 4",
    strokeOpacity: 0.95,
  };
}

function buildDailyBandConfig() {
  const dailyCi = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
  return {
    type: "band",
    ciLowKey: dailyCi.low,
    ciHighKey: dailyCi.high,
    name: "Model daily forecast",
    stroke: PREDICTION_COLORS.ML_DAILY,
    fillOpacity: 0.16,
    strokeWidth: 1.5,
    strokeDasharray: "6 4",
    strokeOpacity: 0.95,
  };
}

function buildContextAwareBandConfig() {
  const ctxCi = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];
  return {
    type: "band",
    ciLowKey: ctxCi.low,
    ciHighKey: ctxCi.high,
    name: "Context-aware forecast",
    stroke: PREDICTION_COLORS.CONTEXT_AWARE,
    fillOpacity: 0.14,
    strokeWidth: 1.5,
    strokeDasharray: "6 4",
    strokeOpacity: 0.95,
  };
}

function buildHistorical1hBandConfig() {
  const histCi = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.FUTURE];
  return {
    type: "band",
    ciLowKey: histCi.low,
    ciHighKey: histCi.high,
    name: "Past model hourly forecasts",
    stroke: "#4ade80",
    fillOpacity: 0.1,
    strokeWidth: 1.25,
    strokeDasharray: "3 5",
    strokeOpacity: 0.85,
  };
}

function buildHistoricalHourlyBandConfig() {
  const histCi = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.HOURLY];
  return {
    type: "band",
    ciLowKey: histCi.low,
    ciHighKey: histCi.high,
    name: "Past model hourly forecasts",
    stroke: "#4ade80",
    fillOpacity: 0.08,
    strokeWidth: 1.25,
    strokeDasharray: "3 5",
    strokeOpacity: 0.85,
  };
}

function buildHistoricalDailyBandConfig() {
  const histCi = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
  return {
    type: "band",
    ciLowKey: histCi.low,
    ciHighKey: histCi.high,
    name: "Past model daily forecasts",
    stroke: "#60a5fa",
    fillOpacity: 0.1,
    strokeWidth: 1.25,
    strokeDasharray: "3 5",
    strokeOpacity: 0.85,
  };
}

function buildHistoricalContextAwareBandConfig() {
  const histCi = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];
  return {
    type: "band",
    ciLowKey: histCi.low,
    ciHighKey: histCi.high,
    name: "Past context-aware forecasts",
    stroke: "#c084fc",
    fillOpacity: 0.08,
    strokeWidth: 1.25,
    strokeDasharray: "3 5",
    strokeOpacity: 0.85,
  };
}

function buildLiveAnchoredWedgeBands(lastLive, wedges) {
  const pointMap = new Map();
  const lineConfigs = [];
  let predictionWindowEnd = lastLive.timestamp;

  const anchorPoint = {
    timestamp: lastLive.timestamp,
    isForecastAnchor: true,
  };

  for (const wedge of wedges) {
    const { targetTs, ci, ciKeys, lineConfig, targetFlags } = wedge;
    if (!ci || targetTs <= Date.now()) continue;

    anchorPoint[ciKeys.low] = lastLive.price;
    anchorPoint[ciKeys.high] = lastLive.price;

    const existingTarget = pointMap.get(targetTs) ?? { timestamp: targetTs };
    pointMap.set(targetTs, {
      ...existingTarget,
      [ciKeys.low]: ci.ciLow,
      [ciKeys.high]: ci.ciHigh,
      ...targetFlags,
    });
    lineConfigs.push(lineConfig);
    predictionWindowEnd = Math.max(predictionWindowEnd, targetTs);
  }

  if (!lineConfigs.length) return null;

  pointMap.set(lastLive.timestamp, anchorPoint);
  return {
    points: [...pointMap.values()].sort((a, b) => a.timestamp - b.timestamp),
    lineConfigs,
    predictionWindowEnd,
  };
}

/**
 * 1H chart overlay: two dashed CI boundary lines from the last live price
 * to the next-hour ml1h forecast, with a filled band between them.
 */
function build1hPredictionOverlay(displayData, prediction) {
  if (!displayData.length || !prediction) return EMPTY_OVERLAY;

  const lastLive = getLastLivePoint(displayData);
  if (!lastLive) return EMPTY_OVERLAY;

  const nowHour = floorToHourMs(Date.now());
  if (nowHour == null) return EMPTY_OVERLAY;

  const targetTs = nowHour + HOUR_MS;
  const futureCi = getForecastCi(prediction.ml1hPrediction);
  const futureCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.FUTURE];

  const overlay = buildLiveAnchoredWedgeBands(lastLive, [{
    targetTs,
    ci: futureCi,
    ciKeys: futureCiKeys,
    lineConfig: build1hBandConfig()[0],
    targetFlags: { isFutureTarget: true },
  }]);

  return overlay ?? EMPTY_OVERLAY;
}

/**
 * 1D and 1W chart overlay: hourly wedge to next hour + daily wedge to tomorrow,
 * both anchored at the last live price (same style as the 1H chart).
 */
function build1d1wPredictionOverlay(displayData, prediction) {
  if (!displayData.length || !prediction) return EMPTY_OVERLAY;

  const lastLive = getLastLivePoint(displayData);
  if (!lastLive) return EMPTY_OVERLAY;

  const nowHour = floorToHourMs(Date.now());
  if (nowHour == null) return EMPTY_OVERLAY;

  const hourlyTargetTs = nowHour + HOUR_MS;
  const tomorrowStart = floorToDayMs(Date.now()) + DAY_MS;
  const hourlyCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.HOURLY];
  const dailyCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
  const contextCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];

  const wedges = [
    {
      targetTs: hourlyTargetTs,
      ci: getForecastCi(prediction.ml1hPrediction),
      ciKeys: hourlyCiKeys,
      lineConfig: buildHourlyBandConfig(),
      targetFlags: { isHourlyFutureTarget: true },
    },
    {
      targetTs: tomorrowStart,
      ci: getForecastCi(prediction.mlPrediction),
      ciKeys: dailyCiKeys,
      lineConfig: buildDailyBandConfig(),
      targetFlags: { isDailyFutureTarget: true },
    },
    {
      targetTs: tomorrowStart,
      ci: getForecastCi(prediction.contextAwarePrediction),
      ciKeys: contextCiKeys,
      lineConfig: buildContextAwareBandConfig(),
      targetFlags: { isContextAwareFutureTarget: true },
    },
  ];

  const overlay = buildLiveAnchoredWedgeBands(lastLive, wedges);

  return overlay ?? EMPTY_OVERLAY;
}

/**
 * 1M, 3M, and 1Y chart overlay: daily wedge to tomorrow, anchored at the last live price.
 */
function buildLongRangeDailyPredictionOverlay(displayData, prediction) {
  if (!displayData.length || !prediction) return EMPTY_OVERLAY;

  const lastLive = getLastLivePoint(displayData);
  if (!lastLive) return EMPTY_OVERLAY;

  const tomorrowStart = floorToDayMs(Date.now()) + DAY_MS;
  const dailyCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
  const contextCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];

  const overlay = buildLiveAnchoredWedgeBands(lastLive, [
    {
      targetTs: tomorrowStart,
      ci: getForecastCi(prediction.mlPrediction),
      ciKeys: dailyCiKeys,
      lineConfig: buildDailyBandConfig(),
      targetFlags: { isDailyFutureTarget: true },
    },
    {
      targetTs: tomorrowStart,
      ci: getForecastCi(prediction.contextAwarePrediction),
      ciKeys: contextCiKeys,
      lineConfig: buildContextAwareBandConfig(),
      targetFlags: { isContextAwareFutureTarget: true },
    },
  ]);

  return overlay ?? EMPTY_OVERLAY;
}

function addHistoricalHourlyTargetsFromHistory(
  pointMap,
  bounds,
  history,
  histKeys,
  flagKey,
) {
  let count = 0;
  const nowMs = Date.now();

  for (const record of history || []) {
    const predMs = parsePredictedAtMs(record);
    if (predMs == null) continue;
    const predHour = floorToHourMs(predMs);
    if (predHour == null) continue;

    const targetHour = predHour + HOUR_MS;
    const ci = getForecastCi(record?.ml1hPrediction);
    if (!ci || targetHour > nowMs) continue;
    if (targetHour < bounds.minTs || targetHour > bounds.maxTs) continue;

    const existing = pointMap.get(targetHour) ?? { timestamp: targetHour };
    pointMap.set(targetHour, {
      ...existing,
      [histKeys.low]: ci.ciLow,
      [histKeys.high]: ci.ciHigh,
      [flagKey]: true,
    });
    count += 1;
  }

  return count;
}

function addHistoricalDailyTargetsFromHistory(
  pointMap,
  bounds,
  history,
  histKeys,
  flagKey,
) {
  let count = 0;
  const nowMs = Date.now();

  for (const record of history || []) {
    const predMs = parsePredictedAtMs(record);
    if (predMs == null) continue;
    const predDay = floorToDayMs(predMs);
    if (predDay == null) continue;

    const targetDay = predDay + DAY_MS;
    const ci = getForecastCi(record?.mlPrediction);
    if (!ci || targetDay > nowMs) continue;
    if (targetDay < bounds.minTs || targetDay > bounds.maxTs) continue;

    const existing = pointMap.get(targetDay) ?? { timestamp: targetDay };
    pointMap.set(targetDay, {
      ...existing,
      [histKeys.low]: ci.ciLow,
      [histKeys.high]: ci.ciHigh,
      [flagKey]: true,
    });
    count += 1;
  }

  return count;
}

function addHistoricalContextAwareTargetsFromHistory(
  pointMap,
  bounds,
  history,
  histKeys,
  flagKey,
) {
  let count = 0;
  const nowMs = Date.now();

  for (const record of history || []) {
    const predMs = parsePredictedAtMs(record);
    if (predMs == null) continue;
    const predDay = floorToDayMs(predMs);
    if (predDay == null) continue;

    const targetDay = predDay + DAY_MS;
    const ci = getForecastCi(record?.contextAwarePrediction);
    if (!ci || targetDay > nowMs) continue;
    if (targetDay < bounds.minTs || targetDay > bounds.maxTs) continue;

    const existing = pointMap.get(targetDay) ?? { timestamp: targetDay };
    pointMap.set(targetDay, {
      ...existing,
      [histKeys.low]: ci.ciLow,
      [histKeys.high]: ci.ciHigh,
      [flagKey]: true,
    });
    count += 1;
  }

  return count;
}

function getEarliestBandTimestamp(pointMap, ciLowKey) {
  let earliest = null;
  for (const [ts, point] of pointMap) {
    if (typeof point[ciLowKey] !== "number") continue;
    if (earliest == null || ts < earliest) earliest = ts;
  }
  return earliest;
}

function countBandPoints(pointMap, ciLowKey) {
  let count = 0;
  for (const point of pointMap.values()) {
    if (typeof point[ciLowKey] === "number") count += 1;
  }
  return count;
}

function ensureHistoricalCorridorAnchor(
  pointMap,
  bounds,
  displayData,
  ciLowKey,
  ciHighKey,
) {
  const earliest = getEarliestBandTimestamp(pointMap, ciLowKey);
  if (earliest == null || earliest <= bounds.minTs) return;

  const price =
    getPriceNearTimestamp(displayData, bounds.minTs)
    ?? getPriceNearTimestamp(displayData, earliest);
  if (price == null) return;

  const existing = pointMap.get(bounds.minTs) ?? { timestamp: bounds.minTs };
  pointMap.set(bounds.minTs, {
    ...existing,
    [ciLowKey]: price,
    [ciHighKey]: price,
  });
}

function tryAddHistoricalCorridorBand(
  pointMap,
  lineConfigs,
  bounds,
  displayData,
  targetCount,
  bandConfig,
  ciLowKey,
  ciHighKey,
) {
  if (targetCount < 1) return;
  ensureHistoricalCorridorAnchor(
    pointMap,
    bounds,
    displayData,
    ciLowKey,
    ciHighKey,
  );
  if (countBandPoints(pointMap, ciLowKey) >= 2) lineConfigs.push(bandConfig);
}

/**
 * Past prediction corridors: dotted CI lines through historical targets
 * that fit inside the current chart window.
 */
export function buildHistoricalPredictionOverlay(
  displayData,
  history,
  range,
) {
  if (!displayData?.length || !history?.length || !isPredictionChartRange(range)) {
    return EMPTY_OVERLAY;
  }

  const bounds = getHistoricalChartBounds(displayData);
  if (!bounds) return EMPTY_OVERLAY;

  const { byHour } = buildPredictionIndex(history);
  const pointMap = new Map();
  const lineConfigs = [];

  if (range === "1H") {
    const histKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.FUTURE];
    const segments = buildHistoricalWedgeSegments({
      displayData,
      bounds,
      byIndex: byHour,
      horizonMs: HOUR_MS,
      getCi: (record) => getForecastCi(record?.ml1hPrediction),
      histKeys,
      anchorFlag: "isHistoricalAnchor",
      targetFlag: "isHistoricalFutureTarget",
    });
    applyHistoricalWedgeBand(
      pointMap,
      lineConfigs,
      segments,
      buildHistorical1hBandConfig(),
      histKeys.low,
      histKeys.high,
    );
  }

  if (range === "1D" || range === "1W") {
    const hourlyHistKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.HOURLY];
    const dailyHistKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
    const contextHistKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];
    const hourlyCount = addHistoricalHourlyTargetsFromHistory(
      pointMap,
      bounds,
      history,
      hourlyHistKeys,
      "isHistoricalHourlyTarget",
    );
    const dailyCount = addHistoricalDailyTargetsFromHistory(
      pointMap,
      bounds,
      history,
      dailyHistKeys,
      "isHistoricalDailyTarget",
    );
    const contextCount = addHistoricalContextAwareTargetsFromHistory(
      pointMap,
      bounds,
      history,
      contextHistKeys,
      "isHistoricalContextAwareTarget",
    );
    tryAddHistoricalCorridorBand(
      pointMap,
      lineConfigs,
      bounds,
      displayData,
      hourlyCount,
      buildHistoricalHourlyBandConfig(),
      hourlyHistKeys.low,
      hourlyHistKeys.high,
    );
    tryAddHistoricalCorridorBand(
      pointMap,
      lineConfigs,
      bounds,
      displayData,
      dailyCount,
      buildHistoricalDailyBandConfig(),
      dailyHistKeys.low,
      dailyHistKeys.high,
    );
    tryAddHistoricalCorridorBand(
      pointMap,
      lineConfigs,
      bounds,
      displayData,
      contextCount,
      buildHistoricalContextAwareBandConfig(),
      contextHistKeys.low,
      contextHistKeys.high,
    );
  }

  if (DAILY_ONLY_CHART_RANGES.has(range)) {
    const dailyHistKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
    const contextHistKeys = HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];
    const dailyCount = addHistoricalDailyTargetsFromHistory(
      pointMap,
      bounds,
      history,
      dailyHistKeys,
      "isHistoricalDailyTarget",
    );
    const contextCount = addHistoricalContextAwareTargetsFromHistory(
      pointMap,
      bounds,
      history,
      contextHistKeys,
      "isHistoricalContextAwareTarget",
    );
    tryAddHistoricalCorridorBand(
      pointMap,
      lineConfigs,
      bounds,
      displayData,
      dailyCount,
      buildHistoricalDailyBandConfig(),
      dailyHistKeys.low,
      dailyHistKeys.high,
    );
    tryAddHistoricalCorridorBand(
      pointMap,
      lineConfigs,
      bounds,
      displayData,
      contextCount,
      buildHistoricalContextAwareBandConfig(),
      contextHistKeys.low,
      contextHistKeys.high,
    );
  }

  if (!lineConfigs.length) return EMPTY_OVERLAY;

  const points = [...pointMap.values()].sort((a, b) => a.timestamp - b.timestamp);
  return {
    points,
    lineConfigs,
    predictionWindowEnd: points[points.length - 1]?.timestamp ?? null,
  };
}

export function mergePredictionOverlays(...overlays) {
  const points = [];
  const lineConfigs = [];
  let predictionWindowEnd = null;

  for (const overlay of overlays) {
    if (!overlay?.lineConfigs?.length) continue;
    points.push(...(overlay.points || []));
    lineConfigs.push(...overlay.lineConfigs);
    if (overlay.predictionWindowEnd != null) {
      predictionWindowEnd = predictionWindowEnd == null
        ? overlay.predictionWindowEnd
        : Math.max(predictionWindowEnd, overlay.predictionWindowEnd);
    }
  }

  if (!lineConfigs.length) return EMPTY_OVERLAY;
  return { points, lineConfigs, predictionWindowEnd };
}

export function buildPredictionChartOverlay(
  displayData,
  prediction,
  showPredictions,
  range,
  chartMode,
  chartType,
) {
  if (!showPredictions || !displayData?.length || LIVE_CHART_RANGE_IDS.has(range)) {
    return EMPTY_OVERLAY;
  }

  if (range === "1H") {
    return build1hPredictionOverlay(displayData, prediction);
  }

  if (range === "1D" || range === "1W") {
    return build1d1wPredictionOverlay(displayData, prediction);
  }

  if (DAILY_ONLY_CHART_RANGES.has(range)) {
    return buildLongRangeDailyPredictionOverlay(displayData, prediction);
  }

  return EMPTY_OVERLAY;
}

/**
 * Merge forecast points into a fresh copy of live chart data.
 * Keeps live updates intact while extending the series to forecast targets.
 */
export function applyForecastOverlay(displayData, overlay) {
  if (!overlay?.lineConfigs?.length || !overlay?.points?.length) {
    return displayData;
  }
  if (!displayData?.length) return displayData;

  const rows = [...displayData];
  for (const fp of overlay.points) {
    const idx = rows.findIndex((p) => p.timestamp === fp.timestamp);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...fp };
    } else {
      rows.push({ ...fp });
    }
  }

  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export function collectForecastPrices(chartData) {
  const keys = [
    ...Object.values(FORECAST_CI_KEYS),
    ...Object.values(HISTORICAL_CI_KEYS),
  ].flatMap((ci) => [ci.low, ci.high]);
  const prices = [];
  for (const point of chartData || []) {
    for (const key of keys) {
      if (typeof point[key] === "number") prices.push(point[key]);
    }
  }
  return prices;
}

export function msUntilNextHourlyPredictionRefresh(delayAfterHourMs = 8000) {
  const now = new Date();
  const msUntilHour =
    (60 - now.getMinutes()) * 60 * 1000
    - now.getSeconds() * 1000
    - now.getMilliseconds();
  return msUntilHour + delayAfterHourMs;
}
