import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../../context/AppContext";
import usePortfolioAnalytics from "../../hooks/usePortfolioAnalytics";
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
import { getCryptoIconPath, handleCryptoIconError } from "../../utils/getCryptoIconPath";
import { buildBalanceChartData, formatChartAxisTick } from "../../utils/buildBalanceChartData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Sector,
  BarChart,
  Bar,
  CartesianGrid,
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

  const point =
    payload.find((entry) => entry?.payload?.isTransaction)?.payload
    ?? payload[0]?.payload;

  if (!point) return null;

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

function AllocationTooltip({ active, payload, totalPortfolio }) {
  if (!active || !payload?.length) {
    return null;
  }

  const slice = payload[0].payload;
  if (!slice) return null;

  const percent =
    totalPortfolio > 0
      ? ((Number(slice.valueUsd) / totalPortfolio) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="portfolio-chart-tooltip">
      <div className="portfolio-chart-tooltip-header">
        <strong>{slice.label}</strong>
      </div>
      <p>
        <span>Value</span>
        <strong>{formatBalanceUsd(slice.valueUsd)}</strong>
      </p>
      <p>
        <span>Share</span>
        <strong>{percent}% of portfolio</strong>
      </p>
      <p className="portfolio-allocation-total">
        Total portfolio: {formatBalanceUsd(totalPortfolio)}
      </p>
    </div>
  );
}

function AllocationActiveShape(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 3}
      outerRadius={outerRadius + 10}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--color-bg-panel, #0f172a)"
      strokeWidth={2}
    />
  );
}

function AssetAllocationChart({ slices, totalBalance, colors }) {
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    setActiveIndex(null);
  }, [slices]);

  if (!slices.length) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="valueUsd"
          nameKey="label"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={slices.length > 1 ? 2 : 0}
          stroke="none"
          activeIndex={activeIndex ?? undefined}
          activeShape={AllocationActiveShape}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          style={{ cursor: "pointer" }}
        >
          {slices.map((slice, i) => (
            <Cell
              key={slice.label}
              fill={colors[i % colors.length]}
              stroke="none"
              fillOpacity={activeIndex == null || activeIndex === i ? 1 : 0.35}
              className="portfolio-allocation-slice"
            />
          ))}
        </Pie>
        <Tooltip content={<AllocationTooltip totalPortfolio={totalBalance} />} />
      </PieChart>
    </ResponsiveContainer>
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

function getPnlTone(pnl) {
  if (pnl == null || Number.isNaN(Number(pnl))) return "neutral";
  const num = Number(pnl);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "neutral";
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

const PNL_AXIS_MIN_BOUND = 2;

/** Keep P&L axis stable: ±2, ±4, ±8… until data breaches the current bound. */
function computeDoublingPnlAxis(pnlValues) {
  const values = (pnlValues || [])
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  let bound = PNL_AXIS_MIN_BOUND;
  if (values.length) {
    const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 0);
    while (maxAbs > bound) {
      bound *= 2;
    }
  }

  const ticks = [0];
  const step = bound <= PNL_AXIS_MIN_BOUND ? PNL_AXIS_MIN_BOUND : bound / 2;
  for (let tick = step; tick <= bound; tick += step) {
    ticks.push(tick, -tick);
  }

  return {
    domain: [-bound, bound],
    ticks: [...new Set(ticks)].sort((a, b) => a - b),
  };
}

function formatSignedBalanceUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  if (num === 0) return formatBalanceUsd(0);
  const body = formatBalanceUsd(Math.abs(num));
  return num > 0 ? `+${body}` : `-${body}`;
}

function formatPnlAxisTick(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0";
  if (Number.isInteger(num)) return `$${num}`;
  return `$${num.toFixed(2)}`;
}

const ALLOCATION_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

const Portfolio = () => {
  const { user, balance, assets, transactions, doReset } = useContext(AppContext);
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
  const { analytics, fetchAnalytics } = usePortfolioAnalytics();

  useEffect(() => {
    if (user?.id) fetchAnalytics(user.id);
  }, [user?.id, fetchAnalytics, assets, balance, transactions]);

  const { startBalance, points: chartData } = useMemo(
    () => buildBalanceChartData(transactions, balance),
    [transactions, balance]
  );

  const yDomain = useMemo(() => computeYDomain(chartData), [chartData]);

  const chartXDomain = useMemo(() => {
    const timestamps = chartData
      .map((point) => point.timestamp)
      .filter((value) => typeof value === "number" && !Number.isNaN(value));
    if (!timestamps.length) return ["dataMin", "dataMax"];
    return [Math.min(...timestamps), Math.max(...timestamps)];
  }, [chartData]);

  const usdBalance = useMemo(() => {
    if (balance?.balance == null) return 0;
    const parsed = Number(balance.balance);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [balance]);

  const holdings = useMemo(() => {
    const analyticsByCode = new Map(
      (analytics?.holdings || []).map((holding) => [holding.cryptoCode, holding]),
    );

    return (assets || [])
      .map((asset) => {
        const amount = Number(asset.cryptoAmount);
        const tick = prices.find((price) => price.symbol === asset.cryptoCode);
        const bid = tick?.bid != null ? Number(tick.bid) : null;
        const previousBid =
          tick?.previousBid != null ? Number(tick.previousBid) : null;
        const analyticsRow = analyticsByCode.get(asset.cryptoCode);
        const fallbackUsd =
          analyticsRow?.marketValue != null
            ? Number(analyticsRow.marketValue)
            : null;
        const costBasis =
          analyticsRow?.costBasisTotal != null
            ? Number(analyticsRow.costBasisTotal)
            : null;
        const liveUsd =
          bid != null && !Number.isNaN(amount) ? amount * bid : null;
        const previousSellValue =
          previousBid != null && !Number.isNaN(amount)
            ? amount * previousBid
            : null;
        const usdValue = liveUsd ?? fallbackUsd;
        const unrealizedPnl =
          liveUsd != null && costBasis != null
            ? liveUsd - costBasis
            : analyticsRow?.unrealizedPnl != null
              ? Number(analyticsRow.unrealizedPnl)
              : null;
        const previousUnrealizedPnl =
          previousSellValue != null && costBasis != null
            ? previousSellValue - costBasis
            : null;

        return {
          cryptoCode: asset.cryptoCode,
          amount: Number.isNaN(amount) ? 0 : amount,
          bid,
          previousBid,
          usdValue,
          sellValue: liveUsd,
          costBasis,
          unrealizedPnl,
          previousUnrealizedPnl,
        };
      })
      .filter((holding) => holding.amount > 0)
      .sort((a, b) => a.cryptoCode.localeCompare(b.cryptoCode));
  }, [assets, prices, analytics?.holdings]);

  const totalBalance = useMemo(() => {
    const cryptoTotal = holdings.reduce(
      (sum, holding) => sum + (holding.usdValue ?? 0),
      0
    );
    return usdBalance + cryptoTotal;
  }, [usdBalance, holdings]);

  const allocationSlices = useMemo(() => {
    if (totalBalance <= 0) return [];

    const slices = [];
    if (usdBalance > 0) {
      slices.push({
        label: "USD",
        valueUsd: usdBalance,
        percent: (usdBalance / totalBalance) * 100,
      });
    }

    for (const holding of holdings) {
      if (holding.usdValue == null || holding.usdValue <= 0) continue;
      slices.push({
        label: holding.cryptoCode,
        valueUsd: holding.usdValue,
        percent: (holding.usdValue / totalBalance) * 100,
      });
    }

    return slices;
  }, [holdings, totalBalance, usdBalance]);

  const pnlByAsset = useMemo(
    () =>
      holdings
        .filter((holding) => holding.unrealizedPnl != null)
        .map((holding) => ({
          name: holding.cryptoCode,
          pnl: holding.unrealizedPnl,
        })),
    [holdings],
  );

  const liveUnrealizedPnl = useMemo(() => {
    const valued = holdings.filter((holding) => holding.unrealizedPnl != null);
    if (!valued.length) return null;
    return valued.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
  }, [holdings]);

  const displayedUnrealizedPnl =
    liveUnrealizedPnl ?? Number(analytics?.unrealizedPnl ?? 0);

  const pnlYAxis = useMemo(
    () => computeDoublingPnlAxis(pnlByAsset.map((entry) => entry.pnl)),
    [pnlByAsset],
  );

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
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={chartXDomain}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                minTickGap={48}
                tickFormatter={formatChartAxisTick}
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
              <Tooltip content={<BalanceTooltip />} shared={false} />
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
          <li className="portfolio-holding-header" aria-hidden="true">
            <span>Asset</span>
            <span>Spent</span>
            <span>If sold</span>
            <span>P&amp;L</span>
            <span />
          </li>

          <li className="portfolio-holding-row portfolio-holding-usd">
            <div className="portfolio-holding-main">
              <span className="portfolio-holding-symbol">USD</span>
              <span className="portfolio-holding-detail">Cash balance</span>
            </div>
            <span className="portfolio-holding-spent">—</span>
            <strong className="portfolio-holding-if-sold">
              {formatBalanceUsd(usdBalance)}
            </strong>
            <span className="portfolio-holding-pnl">—</span>
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
                    onError={handleCryptoIconError}
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

                <div className="portfolio-holding-spent">
                  <span className="portfolio-holding-metric-label">Spent</span>
                  <strong className="portfolio-holding-metric-value">
                    {holding.costBasis != null
                      ? formatBalanceUsd(holding.costBasis)
                      : "—"}
                  </strong>
                </div>

                <div className="portfolio-holding-if-sold">
                  <span className="portfolio-holding-metric-label">If sold</span>
                  <strong className="portfolio-holding-metric-value">
                    {holding.sellValue != null
                      ? formatBalanceUsd(holding.sellValue)
                      : "—"}
                  </strong>
                </div>

                <div
                  className={`portfolio-holding-pnl portfolio-holding-pnl--${getPnlTone(holding.unrealizedPnl)}`}
                >
                  <span className="portfolio-holding-metric-label">P&amp;L</span>
                  {holding.unrealizedPnl != null ? (
                    <FlashPrice
                      value={holding.unrealizedPnl}
                      previousValue={holding.previousUnrealizedPnl}
                      showChange
                      changeLayout="inline"
                      className="portfolio-holding-pnl-flash"
                    >
                      {formatSignedBalanceUsd(holding.unrealizedPnl)}
                    </FlashPrice>
                  ) : (
                    <strong className="portfolio-holding-metric-value">—</strong>
                  )}
                </div>

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

      {analytics && (
        <div className="portfolio-analytics">
          <div className="portfolio-analytics-summary">
            <div>
              <span className="pa-label">Total portfolio</span>
              <strong>{formatBalanceUsd(totalBalance)}</strong>
            </div>
            <div>
              <span className="pa-label">Unrealized P&amp;L</span>
              <strong className={displayedUnrealizedPnl >= 0 ? "positive" : "negative"}>
                {formatBalanceUsd(displayedUnrealizedPnl)}
              </strong>
            </div>
            <div>
              <span className="pa-label">Realized P&amp;L</span>
              <strong className={Number(analytics.realizedPnl) >= 0 ? "positive" : "negative"}>
                {formatBalanceUsd(analytics.realizedPnl)}
              </strong>
            </div>
          </div>

          <div className="portfolio-charts-row">
            <div className="portfolio-chart-card">
              <h3>Asset Allocation</h3>
              <AssetAllocationChart
                slices={allocationSlices}
                totalBalance={totalBalance}
                colors={ALLOCATION_COLORS}
              />
            </div>

            <div className="portfolio-chart-card">
              <h3>P&amp;L by Asset</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pnlByAsset}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={pnlYAxis.domain}
                    ticks={pnlYAxis.ticks}
                    tickFormatter={formatPnlAxisTick}
                    allowDataOverflow
                  />
                  <Tooltip formatter={(v) => formatBalanceUsd(v)} />
                  <Bar dataKey="pnl" fill="#3b82f6" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
