export const BALANCE_DECIMALS = 5;

export function formatBalance(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) {
    return (0).toFixed(BALANCE_DECIMALS);
  }
  return Number(value).toFixed(BALANCE_DECIMALS);
}

export function formatBalanceUsd(value) {
  return `$${formatBalance(value)}`;
}
