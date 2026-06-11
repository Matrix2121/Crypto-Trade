/** Chart + overlay colors for prediction bands (distinct from price line blue). */
export const PREDICTION_COLORS = {
  ML_HOURLY: "#f59e0b",
  ML_DAILY: "#14b8a6",
  CONTEXT_AWARE: "#a855f7",
};

/** CSS custom properties for panel legend / forecast cards. */
export const PREDICTION_PANEL_COLOR_VARS = {
  "--prediction-ml-hourly": PREDICTION_COLORS.ML_HOURLY,
  "--prediction-ml-daily": PREDICTION_COLORS.ML_DAILY,
  "--prediction-context-aware": PREDICTION_COLORS.CONTEXT_AWARE,
};
