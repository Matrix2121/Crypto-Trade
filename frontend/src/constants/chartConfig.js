export const LIVE_CANDLE_PERIOD_MS = 15_000;

export const TICK_CANDLE_WINDOW_MS = 60_000;

/** Candle bucket sizes — must match ChartDataService interval strings. */
export const CHART_BUCKET_MS = {
  "1Min": LIVE_CANDLE_PERIOD_MS,
  "5Min": LIVE_CANDLE_PERIOD_MS,
  "15Min": LIVE_CANDLE_PERIOD_MS,
  "1H": 60_000,
  "1D": 30 * 60_000,
  "1W": 2 * 60 * 60_000,
  "1M": 8 * 60 * 60_000,
  "3M": 24 * 60 * 60_000,
  "1Y": 5 * 24 * 60 * 60_000,
  ALL: 30 * 24 * 60 * 60_000,
};

/** Short-term tick ranges — no chart prediction overlays. */
export const LIVE_CHART_RANGE_IDS = new Set(["1Min", "5Min", "15Min"]);

export const LIVE_CHART_RANGE_OPTIONS = [
  { value: "1Min", label: "1 min" },
  { value: "5Min", label: "5 min" },
  { value: "15Min", label: "15 min" },
];

export const AGGREGATED_CHART_RANGE_OPTIONS = [
  { value: "1H", label: "1H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

export const OHLC_WINDOW_MS = {
  "1H": 1 * 60 * 60 * 1_000,
  "1D": 24 * 60 * 60 * 1_000,
  "1W": 7 * 24 * 60 * 60 * 1_000,
  "1M": 30 * 24 * 60 * 60 * 1_000,
  "3M": 90 * 24 * 60 * 60 * 1_000,
  "1Y": 365 * 24 * 60 * 60 * 1_000,
  ALL: null,
};

export const CHART_RANGES = [
  "1Min",
  "5Min",
  "15Min",
  ...AGGREGATED_CHART_RANGE_OPTIONS.map(({ value }) => value),
];
