import { formatBalanceUsd } from "../utils/formatBalance";
import {
  formatPredictionTargetTime,
  getPredictionTargetTimes,
} from "../utils/chartPredictions";
import { PREDICTION_PANEL_COLOR_VARS } from "../constants/predictionColors";
import "./PredictionPanel.css";

function ForecastCard({ title, forecast, variant }) {
  if (!forecast?.price) return null;
  return (
    <div className={`forecast-card ${variant}`}>
      <h4>{title}</h4>
      <p className="forecast-price">{formatBalanceUsd(forecast.price)}</p>
      <p className="forecast-ci">
        CI: {formatBalanceUsd(forecast.ciLow)} – {formatBalanceUsd(forecast.ciHigh)}
      </p>
    </div>
  );
}

function PrecedentCard({ item }) {
  return (
    <div className="rag-precedent-item">
      <div className="rag-precedent-header">
        <span className="rag-similarity">{(item.similarityScore * 100).toFixed(0)}% match</span>
        <span className="rag-date">{new Date(item.eventTimestamp).toLocaleDateString()}</span>
      </div>
      <p className="rag-summary">{item.conditionsSummary}</p>
      {item.actualChangePct24h != null && (
        <p className={`rag-outcome ${item.actualChangePct24h >= 0 ? "positive" : "negative"}`}>
          Actual 24h: {(item.actualChangePct24h * 100).toFixed(2)}%
        </p>
      )}
    </div>
  );
}

export default function PredictionPanel({ prediction, loading, error, onRefresh, visible }) {
  if (!visible) return null;

  if (loading) {
    return (
      <div className="prediction-panel loading" style={PREDICTION_PANEL_COLOR_VARS}>
        Loading prediction…
      </div>
    );
  }

  if (error) {
    return (
      <div className="prediction-panel error" style={PREDICTION_PANEL_COLOR_VARS}>
        <p>{error}</p>
        <button type="button" onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="prediction-panel empty" style={PREDICTION_PANEL_COLOR_VARS}>
        <p>No prediction data available from the server.</p>
      </div>
    );
  }

  const ml1h = prediction.ml1hPrediction || {};
  const ml24h = prediction.mlPrediction || {};
  const ctx = prediction.contextAwarePrediction || {};
  const ctxPred = prediction.contextPrediction || {};
  const snap = prediction.contextSnapshot || {};
  const precedents = prediction.ragPrecedents || [];
  const tuning = prediction.tuningApplied || {};
  const { target1h, target24h } = getPredictionTargetTimes(prediction);
  const target1hLabel = formatPredictionTargetTime(target1h);
  const target24hLabel = formatPredictionTargetTime(target24h);

  return (
    <div className="prediction-panel" style={PREDICTION_PANEL_COLOR_VARS}>
      <section className="prediction-horizon-section prediction-horizons-row">
        <div className="prediction-horizon-group">
          <h3 className="prediction-horizon-title">Next Hour</h3>
          <p className="prediction-horizon-subtitle">
            {target1hLabel
              ? `Model-based forecast for ${target1hLabel}`
              : "Model-based forecast"}
          </p>
          <ForecastCard title="Model-based" forecast={ml1h} variant="ml-1h" />
        </div>

        <div className="prediction-horizon-group prediction-horizon-group--24h">
          <h3 className="prediction-horizon-title">Next 24 Hours</h3>
          <p className="prediction-horizon-subtitle">
            {target24hLabel
              ? `Forecasts for ${target24hLabel}`
              : "Model-based and context-aware forecasts"}
          </p>
          <div className="prediction-forecasts">
            <ForecastCard title="Model-based" forecast={ml24h} variant="ml" />
            <ForecastCard
              title={`Context-aware${prediction.useRag ? " + RAG" : ""}`}
              forecast={ctx}
              variant="context-aware"
            />
          </div>
        </div>
      </section>

      <div className="prediction-reasoning">
        <h4>LLM Context Analysis</h4>
        <p>{ctxPred.reasoning}</p>
        {tuning.reasoning && (
          <>
            <h4>Tuning Applied</h4>
            <p>{tuning.reasoning}</p>
          </>
        )}
      </div>

      <div className="prediction-context">
        <h4>Market Context</h4>
        <div className="context-tags">
          <span>Fear/Greed: {snap.fearGreedIndex}</span>
          <span>Sentiment: {snap.socialSentimentScore}</span>
          {snap.googleTrendsDelta != null && snap.googleTrendsDelta !== 0 && (
            <span>Trends Δ: {(snap.googleTrendsDelta * 100).toFixed(1)}%</span>
          )}
          {(snap.sourcesUsed || []).map((s) => (
            <span key={s} className="source-tag">{s}</span>
          ))}
        </div>
        {(snap.onChainAlerts || []).map((alert, i) => (
          <p key={`alert-${i}`} className="context-headline">{alert}</p>
        ))}
        {(snap.headlines || []).slice(0, 3).map((h, i) => (
          <p key={i} className="context-headline">{h.title}</p>
        ))}
      </div>

      {precedents.length > 0 && (
        <div className="prediction-rag">
          <h4>Similar Historical Events</h4>
          {precedents.map((p, i) => (
            <PrecedentCard key={i} item={p} />
          ))}
        </div>
      )}
    </div>
  );
}
