import React, { useContext, useMemo, useState } from "react";
import { AppContext } from "../../context/AppContext";
import useAssets from "../../hooks/useAssets";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./Portfolio.css";

const Portfolio = () => {
  const { assets, doReset } = useContext(AppContext);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Fetch assets on mount
  useAssets();

  const mockChartData = useMemo(
    () => [
      { name: "Mon", value: 10000 },
      { name: "Tue", value: 10350 },
      { name: "Wed", value: 10120 },
      { name: "Thu", value: 10840 },
      { name: "Fri", value: 10610 },
      { name: "Sat", value: 11190 },
      { name: "Sun", value: 11450 },
    ],
    []
  );

  const handleConfirmReset = () => {
    doReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="portfolio-page">
      <div className="portfolio-header">
        <h2>Your Portfolio</h2>
        <button
          className="portfolio-reset"
          type="button"
          onClick={() => setShowResetConfirm(true)}
        >
          Reset
        </button>
      </div>

      <div className="portfolio-chart">
        <div className="portfolio-chart-title">Portfolio Value Chart</div>
        <div className="portfolio-chart-frame" role="img" aria-label="Portfolio value chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={46} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent-blue)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {assets.length === 0 ? (
        <div className="empty-state">
          <p>You don't own any assets yet. Head to the Market to start trading!</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={`${asset.cryptoCode}-${asset.cryptoAmount}`}>
                  <td className="asset-cell">
                    <img
                      src={getCryptoIconPath(asset.cryptoCode)}
                      alt={asset.cryptoCode}
                      width={32}
                      height={32}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                      }}
                    />
                    <strong>{asset.cryptoCode}</strong>
                  </td>
                  <td className="amount-cell">{asset.cryptoAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showResetConfirm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm reset"
        >
          <div className="modal">
            <h3>Reset simulated portfolio?</h3>
            <p>Are you sure? This will wipe your simulated portfolio.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button secondary"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-button danger"
                onClick={handleConfirmReset}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;