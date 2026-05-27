import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import useBuy from "../../hooks/useBuy";
import useSell from "../../hooks/useSell";
import "./CryptoDetails.css";

function formatSofiaTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getSofiaHour(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(hourPart);
}

function buildMockSeries(cryptoCode) {
  // Clean separation point: replace this with fetch() later.
  const base = cryptoCode === "BTC" ? 65000 : cryptoCode === "ETH" ? 3200 : 120;
  const points = [
    { t: "00:00", actual: base * 1.0, predicted: base * 0.995 },
    { t: "03:00", actual: base * 1.012, predicted: base * 1.006 },
    { t: "06:00", actual: base * 1.007, predicted: base * 1.01 },
    { t: "09:00", actual: base * 1.02, predicted: base * 1.015 },
    { t: "12:00", actual: base * 1.01, predicted: base * 1.018 },
    { t: "15:00", actual: base * 1.03, predicted: base * 1.025 },
    { t: "18:00", actual: base * 1.028, predicted: base * 1.032 },
    { t: "21:00", actual: base * 1.04, predicted: base * 1.038 },
  ];
  return points.map((p) => ({
    time: p.t,
    actual: Number(p.actual.toFixed(4)),
    predicted: Number(p.predicted.toFixed(4)),
  }));
}

const CryptoDetails = () => {
  const { cryptoCode = "" } = useParams();
  const symbol = String(cryptoCode).replace('-', '/').toUpperCase();
  const navigate = useNavigate();

  const buy = useBuy();
  const sell = useSell();

  const [predictionGeneratedAt, setPredictionGeneratedAt] = useState(null);

  const series = useMemo(() => buildMockSeries(symbol), [symbol]);
  const currentPrice = series?.[series.length - 1]?.actual ?? null;

  const now = new Date();
  const nowSofia = formatSofiaTime(now);
  const sofiaHour = getSofiaHour(now);
  const canGenerate = sofiaHour >= 3;

  const handleBuy = () => {
    const amount = parseFloat(prompt(`Buy how much ${symbol}?`));
    if (!amount || Number.isNaN(amount)) return;
    try {
      buy(symbol, amount);
      alert("Buy successful!");
    } catch {
      alert("Buy failed.");
    }
  };

  const handleSell = () => {
    const amount = parseFloat(prompt(`Sell how much ${symbol}?`));
    if (!amount || Number.isNaN(amount)) return;
    try {
      sell(symbol, amount);
      alert("Sell successful!");
    } catch {
      alert("Sell failed.");
    }
  };

  const handleGeneratePrediction = () => {
    // Clean separation point: replace with backend call later.
    setPredictionGeneratedAt(new Date());
  };

  return (
    <div className="crypto-details">
      <div className="crypto-details-top">
        <button className="crypto-details-back" type="button" onClick={() => navigate("/market")}>
          ← Back to Market
        </button>

        <div className="crypto-details-header">
          <div>
            <h2 className="crypto-details-title">{symbol}</h2>
            <p className="crypto-details-subtitle">
              Current price:{" "}
              <span className="crypto-details-price">
                {currentPrice !== null ? `${Number(currentPrice).toFixed(6)}$` : "—"}
              </span>
            </p>
          </div>

          <div className="crypto-details-actions">
            <button className="buy-button" type="button" onClick={handleBuy}>
              Buy
            </button>
            <button className="sell-button" type="button" onClick={handleSell}>
              Sell
            </button>
          </div>
        </div>

        <div className="crypto-details-note">
          <div className="crypto-details-note-row">
            <span className="crypto-details-note-label">Bulgarian time (Europe/Sofia):</span>
            <span className="crypto-details-note-value">{nowSofia}</span>
          </div>
          <div className="crypto-details-note-row">
            <span className="crypto-details-note-label">Prediction schedule:</span>
            <span className="crypto-details-note-value">
              Official predictions are calculated at exactly <strong>03:00</strong> Bulgarian time
              (EEST).
            </span>
          </div>
        </div>

        <div className="crypto-details-predict">
          <button
            type="button"
            className="crypto-details-predict-button"
            onClick={handleGeneratePrediction}
            disabled={!canGenerate}
            title={
              canGenerate
                ? "Generate (mock) next-day prediction"
                : "Available after 03:00 Bulgarian time (Europe/Sofia)"
            }
          >
            Generate Next Day Prediction
          </button>
          {predictionGeneratedAt && (
            <p className="crypto-details-predict-meta">
              Generated (mock) at {formatSofiaTime(predictionGeneratedAt)} Bulgarian time.
            </p>
          )}
          {!canGenerate && (
            <p className="crypto-details-predict-meta warning">
              Button is disabled until 03:00 Bulgarian time.
            </p>
          )}
        </div>
      </div>

      <div className="crypto-details-chart">
        <div className="crypto-details-chart-title">Price History vs Prediction</div>
        <div className="crypto-details-chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={64} />
              <Tooltip />
              <Legend />
              <Line
                name="Actual Price"
                type="monotone"
                dataKey="actual"
                stroke="var(--color-accent-blue)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                name="Predicted Price"
                type="monotone"
                dataKey="predicted"
                stroke="var(--color-text-secondary)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="6 6"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CryptoDetails;

