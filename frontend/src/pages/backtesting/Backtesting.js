import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppContext } from "../../context/AppContext";
import useBacktest from "../../hooks/useBacktest";
import "./Backtesting.css";

function pct(val) {
  if (val == null) return "—";
  return `${(Number(val) * 100).toFixed(1)}%`;
}

function toDriftChartData(drift) {
  return (Array.isArray(drift) ? drift : []).map((d) => ({
    day: d.day ? String(d.day).slice(0, 10) : "",
    mlHit: Number(d.ml_hit || 0) * 100,
    hybridRagHit: Number(d.hybrid_rag_hit || 0) * 100,
    hybridNoRagHit: Number(d.hybrid_no_rag_hit || 0) * 100,
  }));
}

export default function Backtesting() {
  const { user } = useContext(AppContext);
  const { summary, loading, error, fetchSummary, fetchDrift } = useBacktest();
  const [driftByAsset, setDriftByAsset] = useState({});

  useEffect(() => {
    if (!user?.isAdmin) return;

    let cancelled = false;

    (async () => {
      const data = await fetchSummary();
      if (cancelled || !data) return;

      const assets = (data.byAsset || []).map((row) => row.asset);
      const driftEntries = await Promise.all(
        assets.map(async (asset) => [asset, await fetchDrift(asset, 7)])
      );

      if (!cancelled) {
        setDriftByAsset(Object.fromEntries(driftEntries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, fetchSummary, fetchDrift]);

  const rows = summary?.byAsset || [];

  const driftSections = useMemo(
    () =>
      rows.map((row) => ({
        asset: row.asset,
        data: toDriftChartData(driftByAsset[row.asset]),
      })),
    [rows, driftByAsset]
  );

  if (!user?.isAdmin) {
    return <Navigate to="/market" replace />;
  }

  return (
    <div className="backtesting-page">
      <h2>Prediction Backtesting</h2>
      <p className="backtesting-subtitle">
        Four-way ablation across all tracked assets: model-only, LLM-only, hybrid
        without RAG, hybrid with RAG
      </p>

      {loading && <p>Loading…</p>}
      {error && !loading && <p className="backtest-error">{error}</p>}

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
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5}>
                  No backtest data yet — run walk-forward evaluation first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {driftSections.length > 0 && (
        <section className="drift-section">
          <h3>Rolling 7-day Hit Rate</h3>
          <div className="drift-grid">
            {driftSections.map(({ asset, data }) => (
              <div key={asset} className="drift-panel">
                <h4>{asset}</h4>
                {data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                      <Line
                        type="monotone"
                        dataKey="mlHit"
                        name="ML"
                        stroke="#3b82f6"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hybridNoRagHit"
                        name="Hybrid no RAG"
                        stroke="#f59e0b"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hybridRagHit"
                        name="Hybrid + RAG"
                        stroke="#a855f7"
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="drift-empty">
                    Drift chart populates as live predictions accumulate.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
