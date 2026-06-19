const DEFAULT_START_BALANCE = 10000;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function formatChartAxisTick(tradeTimestamp) {
  const date = new Date(tradeTimestamp);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatChartLabel(tradeTimestamp) {
  return formatChartAxisTick(tradeTimestamp);
}

function toTimestampMs(tradeTimestamp) {
  const ms = new Date(tradeTimestamp).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

/** Keep every trade on its own x-position even when timestamps collide. */
function dedupeTimestamps(points) {
  const used = new Set();

  return points.map((point) => {
    let timestamp = point.timestamp;
    while (used.has(timestamp)) {
      timestamp += 1;
    }
    used.add(timestamp);
    return timestamp === point.timestamp ? point : { ...point, timestamp };
  });
}

/**
 * Builds chart points from transactions by walking backward from the current balance.
 * Returns { startBalance, points } where each point has balance after that event.
 */
export function buildBalanceChartData(transactions, currentBalance) {
  const sorted = [...(transactions || [])].sort(
    (a, b) => new Date(a.tradeTimestamp) - new Date(b.tradeTimestamp)
  );

  const hasCurrentBalance = currentBalance?.balance != null;
  const current = hasCurrentBalance
    ? toNumber(currentBalance.balance, DEFAULT_START_BALANCE)
    : DEFAULT_START_BALANCE;

  if (sorted.length === 0) {
    return {
      startBalance: current,
      points: [
        {
          id: "start",
          label: "Start",
          balance: current,
          isTransaction: false,
          isStart: true,
        },
      ],
    };
  }

  if (hasCurrentBalance) {
    let running = current;
    const txPoints = [];

    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const tx = sorted[i];
      const amount = toNumber(tx.localCurrencyAmount);

      txPoints.unshift({
        id: tx.id,
        label: formatChartLabel(tx.tradeTimestamp),
        balance: running,
        isTransaction: true,
        transaction: tx,
        timestamp: toTimestampMs(tx.tradeTimestamp),
      });

      running = tx.isPurchase ? running + amount : running - amount;
    }

    const startBalance = running;
    const firstTs = toTimestampMs(sorted[0].tradeTimestamp);

    return {
      startBalance,
      points: dedupeTimestamps([
        {
          id: "start",
          label: "Start",
          balance: startBalance,
          isTransaction: false,
          isStart: true,
          timestamp: firstTs - 1,
        },
        ...txPoints,
      ]),
    };
  }

  // Balance not loaded yet — walk forward from the default starting balance.
  let running = DEFAULT_START_BALANCE;
  const txPoints = sorted.map((tx) => {
    const amount = toNumber(tx.localCurrencyAmount);
    running = tx.isPurchase ? running - amount : running + amount;
    return {
      id: tx.id,
      label: formatChartLabel(tx.tradeTimestamp),
      balance: running,
      isTransaction: true,
      transaction: tx,
      timestamp: toTimestampMs(tx.tradeTimestamp),
    };
  });

  const firstTs = toTimestampMs(sorted[0].tradeTimestamp);

  return {
    startBalance: DEFAULT_START_BALANCE,
    points: dedupeTimestamps([
      {
        id: "start",
        label: "Start",
        balance: DEFAULT_START_BALANCE,
        isTransaction: false,
        isStart: true,
        timestamp: firstTs - 1,
      },
      ...txPoints,
    ]),
  };
}
