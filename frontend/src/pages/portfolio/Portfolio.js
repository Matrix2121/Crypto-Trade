import React, { useContext, useMemo, useState } from "react";
import { AppContext } from "../../context/AppContext";
import useBalance from "../../hooks/useBalance";
import useTransactions from "../../hooks/useTransactions";
import useAssets from "../../hooks/useAssets";
import usePrices from "../../hooks/usePrices";
import useSell from "../../hooks/useSell";
import useReset from "../../hooks/useReset";
import FlashPrice from "../../components/FlashPrice";
import {
  formatBalance,
  formatBalanceUsd,
  formatCryptoAmount,
} from "../../utils/formatBalance";
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

function TransactionDot({ cx, cy, payload }) {
  if (cx == null || cy == null || !payload?.isTransaction) {
    return null;
  }

  const isBuy = payload.transaction?.isPurchase;
  const fill = isBuy ? "var(--color-buy)" : "var(--color-sell)";

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

function formatChartBalanceTick(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0";
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}k`;
  }
  return `$${num.toFixed(0)}`;
}

function formatSellPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  if (num >= 1000) {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function computeYDomain(points) {
  const values = (points || [])
    .map((point) => Number(point.balance))
    .filter((value) => !Number.isNaN(value));

  if (values.length === 0) {
    return [0, 10000];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padding = span > 0 ? span * 0.08 : Math.max(max * 0.05, 100);

  return [Math.max(0, min - padding), max + padding];
}

const Portfolio = () => {
  const { balance, assets, transactions, doReset } = useContext(AppContext);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sellingCode, setSellingCode] = useState(null);
  const [sellingAll, setSellingAll] = useState(false);
  const [holdingsMessage, setHoldingsMessage] = useState(null);

  useBalance();
  useTransactions();
  useAssets();
  useReset();
  const prices = usePrices();
  const sell = useSell();

  const { startBalance, points: chartData } = useMemo(
    () => buildBalanceChartData(transactions, balance),
    [transactions, balance]
  );

  const yDomain = useMemo(() => computeYDomain(chartData), [chartData]);

  const usdBalance = useMemo(() => {
    if (balance?.balance == null) return 0;
    const parsed = Number(balance.balance);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [balance]);

  const holdings = useMemo(() => {
    return (assets || [])
      .map((asset) => {
        const amount = Number(asset.cryptoAmount);
        const tick = prices.find((price) => price.symbol === asset.cryptoCode);
        const bid = tick?.bid != null ? Number(tick.bid) : null;
        const usdValue =
          bid != null && !Number.isNaN(amount) ? amount * bid : null;

        return {
          cryptoCode: asset.cryptoCode,
          amount: Number.isNaN(amount) ? 0 : amount,
          bid,
          previousBid: tick?.previousBid ?? null,
          usdValue,
        };
      })
      .filter((holding) => holding.amount > 0)
      .sort((a, b) => a.cryptoCode.localeCompare(b.cryptoCode));
  }, [assets, prices]);

  const totalBalance = useMemo(() => {
    const cryptoTotal = holdings.reduce(
      (sum, holding) => sum + (holding.usdValue ?? 0),
      0
    );
    return usdBalance + cryptoTotal;
  }, [usdBalance, holdings]);

  const isSelling = sellingCode != null || sellingAll;

  const handleConfirmReset = () => {
    setHoldingsMessage(null);
    doReset();
    setShowResetConfirm(false);
  };

  const handleSellOne = async (holding) => {
    if (holding.bid == null) {
      setHoldingsMessage({
        type: "error",
        text: `Sell price unavailable for ${holding.cryptoCode}`,
      });
      return;
    }

    setSellingCode(holding.cryptoCode);
    setHoldingsMessage(null);

    try {
      await sell(holding.cryptoCode, {
        cryptoAmount: formatCryptoAmount(holding.amount),
      });
      setHoldingsMessage({
        type: "success",
        text: `Sold all ${holding.cryptoCode}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sell failed";
      setHoldingsMessage({ type: "error", text: message });
    } finally {
      setSellingCode(null);
    }
  };

  const handleSellAll = async () => {
    const sellable = holdings.filter((holding) => holding.bid != null);
    if (sellable.length === 0) {
      setHoldingsMessage({
        type: "error",
        text: "No crypto holdings available to sell",
      });
      return;
    }

    setSellingAll(true);
    setHoldingsMessage(null);

    try {
      for (const holding of sellable) {
        await sell(holding.cryptoCode, {
          cryptoAmount: formatCryptoAmount(holding.amount),
        });
      }
      setHoldingsMessage({
        type: "success",
        text: "Sold all crypto holdings",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sell failed";
      setHoldingsMessage({ type: "error", text: message });
    } finally {
      setSellingAll(false);
    }
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
        <div className="portfolio-chart-title">Balance History</div>
        <div
          className="portfolio-chart-frame"
          role="img"
          aria-label="Balance history chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 16, left: 4, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                type="number"
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={formatChartBalanceTick}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                domain={yDomain}
                allowDataOverflow
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
                dot={<TransactionDot />}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="portfolio-holdings">
        <div className="portfolio-holdings-header">
          <div className="portfolio-section-title">Holdings</div>
          {holdings.length > 0 && (
            <button
              type="button"
              className="portfolio-sell-all-btn"
              onClick={handleSellAll}
              disabled={isSelling}
            >
              {sellingAll ? "Selling…" : "Sell all crypto"}
            </button>
          )}
        </div>

        <div className="portfolio-total-balance">
          <span className="portfolio-total-balance-label">Total balance</span>
          <strong className="portfolio-total-balance-value">
            {formatBalanceUsd(totalBalance)}
          </strong>
        </div>

        {holdingsMessage && (
          <p
            className={`portfolio-holdings-message portfolio-holdings-message-${holdingsMessage.type}`}
            role="status"
          >
            {holdingsMessage.text}
          </p>
        )}

        <ul className="portfolio-holdings-list">
          <li className="portfolio-holding-row portfolio-holding-usd">
            <div className="portfolio-holding-main">
              <span className="portfolio-holding-symbol">USD</span>
              <span className="portfolio-holding-detail">Cash balance</span>
            </div>
            <strong className="portfolio-holding-value">
              {formatBalanceUsd(usdBalance)}
            </strong>
          </li>

          {holdings.map((holding) => {
            const baseAsset = holding.cryptoCode.split("/")[0];
            const isRowSelling = sellingCode === holding.cryptoCode;

            return (
              <li key={holding.cryptoCode} className="portfolio-holding-row">
                <div className="portfolio-holding-main">
                  <img
                    src={getCryptoIconPath(holding.cryptoCode)}
                    alt={holding.cryptoCode}
                    width={28}
                    height={28}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                    }}
                  />
                  <div className="portfolio-holding-text">
                    <span className="portfolio-holding-symbol">
                      {holding.cryptoCode}
                    </span>
                    <span className="portfolio-holding-detail">
                      {formatBalance(holding.amount)} {baseAsset}
                    </span>
                  </div>
                </div>

                <div className="portfolio-holding-price">
                  <span className="portfolio-holding-price-label">
                    Sell price
                  </span>
                  <span className="portfolio-holding-price-value">
                    <FlashPrice
                      value={holding.bid}
                      previousValue={holding.previousBid}
                      showChange
                      changeLayout="inline"
                    >
                      {formatSellPrice(holding.bid)}
                    </FlashPrice>
                  </span>
                </div>

                <strong className="portfolio-holding-value">
                  {holding.usdValue != null
                    ? formatBalanceUsd(holding.usdValue)
                    : "—"}
                </strong>

                <button
                  type="button"
                  className="portfolio-sell-one-btn"
                  onClick={() => handleSellOne(holding)}
                  disabled={isSelling || holding.bid == null}
                >
                  {isRowSelling ? "Selling…" : "Sell all"}
                </button>
              </li>
            );
          })}
        </ul>
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
