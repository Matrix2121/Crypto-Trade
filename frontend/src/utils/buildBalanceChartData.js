const DEFAULT_START_BALANCE = 10000;

function formatChartLabel(tradeTimestamp) {
  return new Date(tradeTimestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
    ? Number(currentBalance.balance)
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
      const amount = Number(tx.localCurrencyAmount);

      txPoints.unshift({
        id: tx.id,
        label: formatChartLabel(tx.tradeTimestamp),
        balance: running,
        isTransaction: true,
        transaction: tx,
        timestamp: new Date(tx.tradeTimestamp).getTime(),
      });

      running = tx.isPurchase ? running + amount : running - amount;
    }

    const startBalance = running;
    const firstTs = new Date(sorted[0].tradeTimestamp).getTime();

    return {
      startBalance,
      points: [
        {
          id: "start",
          label: "Start",
          balance: startBalance,
          isTransaction: false,
          isStart: true,
          timestamp: firstTs - 1,
        },
        ...txPoints,
      ],
    };
  }

  // Balance not loaded yet — walk forward from the default starting balance.
  let running = DEFAULT_START_BALANCE;
  const txPoints = sorted.map((tx) => {
    const amount = Number(tx.localCurrencyAmount);
    running = tx.isPurchase ? running - amount : running + amount;
    return {
      id: tx.id,
      label: formatChartLabel(tx.tradeTimestamp),
      balance: running,
      isTransaction: true,
      transaction: tx,
      timestamp: new Date(tx.tradeTimestamp).getTime(),
    };
  });

  const firstTs = new Date(sorted[0].tradeTimestamp).getTime();

  return {
    startBalance: DEFAULT_START_BALANCE,
    points: [
      {
        id: "start",
        label: "Start",
        balance: DEFAULT_START_BALANCE,
        isTransaction: false,
        isStart: true,
        timestamp: firstTs - 1,
      },
      ...txPoints,
    ],
  };
}
