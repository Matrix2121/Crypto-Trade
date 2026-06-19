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

/** Stagger wedge anchors off the live candle timestamp so series do not collide. */
const WEDGE_ANCHOR_STAGGER_MS = 1;

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
  hasLines,
  predictionWindowEnd,
  showHistoricalPredictions = false,
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
    if (showHistoricalPredictions) {
      return "Past model daily & context-aware predictions";
    }
    const dailyTo = formatDayLabel(
      predictionWindowEnd ?? floorToDayMs(Date.now()) + DAY_MS,
    );
    return `Model daily & context-aware to ${dailyTo}`;
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

function buildWedgeAnchorPoint(lastLive, ciKeys, seriesIndex) {
  return {
    timestamp: lastLive.timestamp + (seriesIndex + 1) * WEDGE_ANCHOR_STAGGER_MS,
    isForecastAnchor: true,
    [ciKeys.low]: lastLive.price,
    [ciKeys.high]: lastLive.price,
  };
}

function buildLiveAnchoredWedgeBands(lastLive, wedges) {
  const pointMap = new Map();
  const lineConfigs = [];
  let predictionWindowEnd = lastLive.timestamp;

  wedges.forEach((wedge) => {
    const { targetTs, ci, ciKeys, lineConfig, targetFlags } = wedge;
    if (!ci || targetTs <= Date.now()) return;

    const existingAnchor = pointMap.get(lastLive.timestamp) ?? {
      timestamp: lastLive.timestamp,
      isForecastAnchor: true,
    };
    pointMap.set(lastLive.timestamp, {
      ...existingAnchor,
      isForecastAnchor: true,
      [ciKeys.low]: lastLive.price,
      [ciKeys.high]: lastLive.price,
    });

    const anchorPoint = pointMap.get(lastLive.timestamp);
    const target = {
      timestamp: targetTs,
      [ciKeys.low]: ci.ciLow,
      [ciKeys.high]: ci.ciHigh,
      ...targetFlags,
    };
    const existingTarget = pointMap.get(targetTs) ?? { timestamp: targetTs };
    pointMap.set(targetTs, { ...existingTarget, ...target });

    lineConfigs.push({
      ...lineConfig,
      bandSegments: [[anchorPoint, target]],
      connectNulls: true,
    });
    predictionWindowEnd = Math.max(predictionWindowEnd, targetTs);
  });

  if (!lineConfigs.length) return null;

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
 * 1M, 3M, and 1Y chart overlay: daily + context-aware wedges to tomorrow,
 * anchored at the last live price (same style as 1D/1W, without hourly).
 */
function buildDailyOnlyPredictionOverlay(displayData, prediction) {
  if (!displayData.length || !prediction) return EMPTY_OVERLAY;

  const lastLive = getLastLivePoint(displayData);
  if (!lastLive) return EMPTY_OVERLAY;

  const tomorrowStart = floorToDayMs(Date.now()) + DAY_MS;
  const dailyCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.DAILY];
  const contextCiKeys = FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE];

  const wedges = [
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
 * In-range past target dots only (no chart-edge or live-price anchors).
 * Uses forecast CI keys so the series can connect to the forward overlay.
 */
function buildPastCorridorTargetPoints({
  bounds,
  byIndex,
  horizonMs,
  getCi,
  ciKeys,
  histKeys,
  targetFlag,
}) {
  const nowMs = Date.now();
  const targets = [];

  for (const [predTs, record] of byIndex) {
    const targetTs = predTs + horizonMs;
    const ci = getCi(record);
    if (!ci || targetTs > nowMs) continue;
    if (targetTs < bounds.minTs || targetTs > bounds.maxTs) continue;

    const point = {
      timestamp: targetTs,
      [ciKeys.low]: ci.ciLow,
      [ciKeys.high]: ci.ciHigh,
      [targetFlag]: true,
    };
    if (histKeys) {
      point[histKeys.low] = ci.ciLow;
      point[histKeys.high] = ci.ciHigh;
    }
    targets.push(point);
  }

  return targets.sort((a, b) => a.timestamp - b.timestamp);
}

function getLinkedSeriesDefinitions(range, byHour, byDay) {
  const defs = [];

  if (range === "1H" || range === "1D" || range === "1W") {
    const hourlyLineKey = range === "1H"
      ? PREDICTION_LINE_KEYS.FUTURE
      : PREDICTION_LINE_KEYS.HOURLY;
    defs.push({
      byIndex: byHour,
      horizonMs: HOUR_MS,
      getCi: (record) => getForecastCi(record?.ml1hPrediction),
      ciKeys: FORECAST_CI_KEYS[hourlyLineKey],
      histKeys: HISTORICAL_CI_KEYS[hourlyLineKey],
      targetFlag: range === "1H"
        ? "isHistoricalFutureTarget"
        : "isHistoricalHourlyTarget",
      futureTargetFlag: range === "1H" ? "isFutureTarget" : "isHourlyFutureTarget",
      bandConfig: range === "1H" ? build1hBandConfig()[0] : buildHourlyBandConfig(),
    });
  }

  if (range === "1D" || range === "1W" || DAILY_ONLY_CHART_RANGES.has(range)) {
    defs.push({
      byIndex: byDay,
      horizonMs: DAY_MS,
      getCi: (record) => getForecastCi(record?.mlPrediction),
      ciKeys: FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.DAILY],
      histKeys: HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.DAILY],
      targetFlag: "isHistoricalDailyTarget",
      futureTargetFlag: "isDailyFutureTarget",
      bandConfig: buildDailyBandConfig(),
    });
    defs.push({
      byIndex: byDay,
      horizonMs: DAY_MS,
      getCi: (record) => getForecastCi(record?.contextAwarePrediction),
      ciKeys: FORECAST_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE],
      histKeys: HISTORICAL_CI_KEYS[PREDICTION_LINE_KEYS.CONTEXT_AWARE],
      targetFlag: "isHistoricalContextAwareTarget",
      futureTargetFlag: "isContextAwareFutureTarget",
      bandConfig: buildContextAwareBandConfig(),
    });
  }

  return defs;
}

/**
 * Past corridors linked directly to future targets (no live-price pin at now).
 */
export function buildCombinedPredictionOverlay(
  displayData,
  prediction,
  history,
  range,
) {
  const forwardOverlay = buildPredictionChartOverlay(
    displayData,
    prediction,
    true,
    range,
    null,
    null,
  );

  if (!displayData?.length || !isPredictionChartRange(range)) {
    return forwardOverlay;
  }
  if (!history?.length) {
    return forwardOverlay;
  }

  const bounds = getHistoricalChartBounds(displayData);
  if (!bounds) {
    return forwardOverlay;
  }

  const { byHour, byDay } = buildPredictionIndex(history);
  const seriesDefs = getLinkedSeriesDefinitions(range, byHour, byDay);
  const lastLive = getLastLivePoint(displayData);
  const pointMap = new Map();
  const lineConfigs = [];

  seriesDefs.forEach((def, seriesIndex) => {
    const pastPoints = buildPastCorridorTargetPoints({
      bounds,
      byIndex: def.byIndex,
      horizonMs: def.horizonMs,
      getCi: def.getCi,
      ciKeys: def.ciKeys,
      histKeys: def.histKeys,
      targetFlag: def.targetFlag,
    });

    const forwardTarget = (forwardOverlay.points || []).find(
      (point) => point[def.futureTargetFlag]
        && typeof point[def.ciKeys.low] === "number"
        && typeof point[def.ciKeys.high] === "number",
    );

    let bandSegments;
    let overlayPoints;

    if (pastPoints.length && forwardTarget) {
      overlayPoints = [...pastPoints, forwardTarget];
      bandSegments = [overlayPoints];
    } else if (pastPoints.length) {
      overlayPoints = pastPoints;
      bandSegments = [pastPoints];
    } else if (forwardTarget && lastLive) {
      overlayPoints = [
        buildWedgeAnchorPoint(lastLive, def.ciKeys, seriesIndex),
        forwardTarget,
      ];
      bandSegments = [overlayPoints];
    } else {
      return;
    }

    for (const point of overlayPoints) {
      const existing = pointMap.get(point.timestamp);
      pointMap.set(point.timestamp, existing ? { ...existing, ...point } : { ...point });
    }

    lineConfigs.push({
      ...def.bandConfig,
      connectNulls: true,
      bandSegments,
    });
  });

  if (!lineConfigs.length) {
    return forwardOverlay;
  }

  const points = [...pointMap.values()].sort((a, b) => a.timestamp - b.timestamp);
  return {
    points,
    lineConfigs,
    predictionWindowEnd: forwardOverlay.predictionWindowEnd
      ?? points.at(-1)?.timestamp
      ?? null,
  };
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
    return buildDailyOnlyPredictionOverlay(displayData, prediction);
  }

  return EMPTY_OVERLAY;
}

/**
 * Merge forecast points into a fresh copy of live chart data.
 * Keeps live updates intact while extending the series to forecast targets.
 */
function overlayPointTouchesMarketRow(row) {
  return row.close != null || row.price != null || (row.bid != null && row.ask != null);
}

function shouldMergeOverlayPoint(row, fp) {
  if (isPredictionTargetEndpoint(fp)) return true;
  if (fp.isForecastAnchor && overlayPointTouchesMarketRow(row)) return true;
  return !overlayPointTouchesMarketRow(row);
}

export function applyForecastOverlay(displayData, overlay) {
  if (!overlay?.lineConfigs?.length || !overlay?.points?.length) {
    return displayData;
  }
  if (!displayData?.length) return displayData;

  const rows = [...displayData];
  for (const fp of overlay.points) {
    const idx = rows.findIndex((p) => p.timestamp === fp.timestamp);
    if (idx >= 0) {
      if (shouldMergeOverlayPoint(rows[idx], fp)) {
        rows[idx] = { ...rows[idx], ...fp };
      }
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
