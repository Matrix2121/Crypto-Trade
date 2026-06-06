export const BALANCE_DECIMALS = 5;
export const CRYPTO_DECIMALS = 8;

export function formatBalance(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) {
    return (0).toFixed(BALANCE_DECIMALS);
  }
  return Number(value).toFixed(BALANCE_DECIMALS);
}

export function formatCryptoAmount(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) {
    return (0).toFixed(CRYPTO_DECIMALS);
  }
  return Number(value).toFixed(CRYPTO_DECIMALS);
}

export function cryptoAmountFromFiat(fiatAmount, unitPrice) {
  const fiat = Number(fiatAmount);
  const price = Number(unitPrice);
  if (Number.isNaN(fiat) || Number.isNaN(price) || fiat <= 0 || price <= 0) {
    return null;
  }
  const factor = 10 ** CRYPTO_DECIMALS;
  return Math.round((fiat / price) * factor) / factor;
}

export function formatBalanceUsd(value) {
  return `$${formatBalance(value)}`;
}
