import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import useBacktest from "../../hooks/useBacktest";
import "./Backtesting.css";

import { PREDICTION_ASSETS } from "../../constants/predictionAssets";

function pct(val) {
  if (val == null) return "—";
  return `${(Number(val) * 100).toFixed(1)}%`;
}

export default function Backtesting() {
  const { summary, drift, loading, fetchSummary, fetchDrift } = useBacktest();
  const [asset, setAsset] = useState(PREDICTION_ASSETS[0]);

  useEffect(() => {
    fetchSummary(asset);
    fetchDrift(asset, 7);
  }, [asset, fetchSummary, fetchDrift]);

  const rows = summary?.byAsset || [];

  const driftData = (Array.isArray(drift) ? drift : []).map((d) => ({
    day: d.day ? String(d.day).slice(0, 10) : "",
    mlHit: Number(d.ml_hit || 0) * 100,
    hybridRagHit: Number(d.hybrid_rag_hit || 0) * 100,
    hybridNoRagHit: Number(d.hybrid_no_rag_hit || 0) * 100,
  }));

  return (
    <div className="backtesting-page">
      <h2>Prediction Backtesting</h2>
      <p className="backtesting-subtitle">
        Four-way ablation: model-only, LLM-only, hybrid without RAG, hybrid with RAG
      </p>

      <div className="backtest-controls">
        <label>
          Asset
          <select value={asset} onChange={(e) => setAsset(e.target.value)}>
            {PREDICTION_ASSETS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Loading…</p>}

      <div className="backtest-table-wrap">
        <table className="backtest-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>ML Hit Rate</th>
              <th>Hybrid (no RAG)</th>
              <th>Hybrid (with RAG)</th>
              <th>Windows</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset}>
                <td>{r.asset}</td>
                <td>{pct(r.ml_hit)}</td>
                <td>{pct(r.hybrid_no_rag_hit)}</td>
                <td>{pct(r.hybrid_rag_hit)}</td>
                <td>{r.ml_n ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>No backtest data yet — run walk-forward evaluation first.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="drift-panel">
        <h3>Rolling 7-day Hit Rate — {asset}</h3>
        {driftData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={driftData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              <Line type="monotone" dataKey="mlHit" name="ML" stroke="#3b82f6" dot={false} />
              <Line type="monotone" dataKey="hybridNoRagHit" name="Hybrid no RAG" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="hybridRagHit" name="Hybrid + RAG" stroke="#a855f7" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="drift-empty">Drift chart populates as live predictions accumulate.</p>
        )}
      </section>
    </div>
  );
}
