import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../../context/AppContext";
import useBalance from "../../hooks/useBalance";
import useTransactions from "../../hooks/useTransactions";
import useReset from "../../hooks/useReset";
import { formatBalance, formatBalanceUsd } from "../../utils/formatBalance";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import { buildBalanceChartData } from "../../utils/buildBalanceChartData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import "./Portfolio.css";

function TransactionDot({ cx, cy, payload, selectedId, hoveredId }) {
  if (cx == null || cy == null || !payload?.isTransaction) {
    return null;
  }

  const txId = payload.id;
  const isSelected = selectedId === txId;
  const isHovered = hoveredId === txId;
  const isBuy = payload.transaction?.isPurchase;
  const fill = isBuy ? "var(--color-buy)" : "var(--color-sell)";

  if (isSelected) {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="none"
          stroke="var(--color-accent-blue)"
          strokeWidth={2}
          opacity={0.45}
        />
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill={fill}
          stroke="var(--color-text-primary)"
          strokeWidth={2.5}
        />
      </g>
    );
  }

  if (isHovered) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={fill}
        stroke="var(--color-accent-blue)"
        strokeWidth={2.5}
      />
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="var(--color-bg-panel)"
      strokeWidth={2}
    />
  );
}

function BalanceTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  if (point.isTransaction && point.transaction) {
    const tx = point.transaction;
    const isBuy = tx.isPurchase;
    return (
      <div className="portfolio-chart-tooltip">
        <div className="portfolio-chart-tooltip-header">
          <span className={isBuy ? "tx-buy" : "tx-sell"}>
            {isBuy ? "Buy" : "Sell"}
          </span>
          <strong>{tx.cryptoCode}</strong>
        </div>
        <p>
          <span>Amount</span>
          <strong>{formatBalance(tx.cryptoAmount)}</strong>
        </p>
        <p>
          <span>Unit price</span>
          <strong>{formatBalanceUsd(tx.unitPrice)}</strong>
        </p>
        <p>
          <span>Total</span>
          <strong>{formatBalanceUsd(tx.localCurrencyAmount)}</strong>
        </p>
        <p>
          <span>Balance after</span>
          <strong>{formatBalanceUsd(point.balance)}</strong>
        </p>
        <p className="portfolio-chart-tooltip-date">
          {new Date(tx.tradeTimestamp).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="portfolio-chart-tooltip">
      <div className="portfolio-chart-tooltip-header">
        <strong>Starting balance</strong>
      </div>
      <p>
        <span>Balance</span>
        <strong>{formatBalanceUsd(point.balance)}</strong>
      </p>
    </div>
  );
}

function formatBalanceTick(value) {
  return formatBalanceUsd(value);
}

const Portfolio = () => {
  const { balance, transactions, doReset } = useContext(AppContext);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hoveredTxId, setHoveredTxId] = useState(null);
  const [selectedTxId, setSelectedTxId] = useState(null);

  useBalance();
  useTransactions();
  useReset();

  const { startBalance, points: chartData } = useMemo(
    () => buildBalanceChartData(transactions, balance),
    [transactions, balance]
  );

  const transactionPoints = useMemo(
    () => chartData.filter((point) => point.isTransaction),
    [chartData]
  );

  const listItems = useMemo(
    () => [...transactionPoints].reverse(),
    [transactionPoints]
  );

  useEffect(() => {
    if (selectedTxId == null) return;
    const stillExists = transactionPoints.some((point) => point.id === selectedTxId);
    if (!stillExists) {
      setSelectedTxId(null);
    }
  }, [transactionPoints, selectedTxId]);

  const handleSelectTx = (txId) => {
    setSelectedTxId((prev) => (prev === txId ? null : txId));
  };

  const handleConfirmReset = () => {
    setHoveredTxId(null);
    setSelectedTxId(null);
    doReset();
    setShowResetConfirm(false);
  };

  const renderTransactionDot = (props) => (
    <TransactionDot
      {...props}
      selectedId={selectedTxId}
      hoveredId={hoveredTxId}
    />
  );

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
        <div className="portfolio-chart-title">Balance History</div>
        <div
          className="portfolio-chart-frame"
          role="img"
          aria-label="Balance history chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={formatBalanceTick}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<BalanceTooltip />} />
              <ReferenceLine
                y={startBalance}
                stroke="var(--color-text-muted)"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: `Start ${formatBalanceUsd(startBalance)}`,
                  position: "insideTopRight",
                  fill: "var(--color-text-muted)",
                  fontSize: 11,
                }}
              />
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke="var(--color-accent-blue)"
                strokeWidth={2}
                dot={renderTransactionDot}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="portfolio-tx-section">
        <div className="portfolio-section-title">Transactions</div>
        {listItems.length === 0 ? (
          <p className="portfolio-tx-empty">No transactions yet.</p>
        ) : (
          <ul className="portfolio-tx-list">
            {listItems.map((point) => {
              const tx = point.transaction;
              const isSelected = selectedTxId === point.id;
              const isHovered = hoveredTxId === point.id;
              const itemClass = [
                "portfolio-tx-item",
                isSelected ? "selected" : "",
                isHovered && !isSelected ? "hovered" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li key={point.id}>
                  <button
                    type="button"
                    className={itemClass}
                    onMouseEnter={() => setHoveredTxId(point.id)}
                    onMouseLeave={() => setHoveredTxId(null)}
                    onClick={() => handleSelectTx(point.id)}
                    aria-pressed={isSelected}
                  >
                    <img
                      src={getCryptoIconPath(tx.cryptoCode)}
                      alt={tx.cryptoCode}
                      width={24}
                      height={24}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                      }}
                    />
                    <span className="portfolio-tx-item-main">
                      <strong>{tx.cryptoCode}</strong>
                      <span className={tx.isPurchase ? "tx-buy" : "tx-sell"}>
                        {tx.isPurchase ? "Buy" : "Sell"}
                      </span>
                    </span>
                    <span className="portfolio-tx-item-meta">
                      {formatBalanceUsd(tx.localCurrencyAmount)}
                    </span>
                    <span className="portfolio-tx-item-date">
                      {new Date(tx.tradeTimestamp).toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
