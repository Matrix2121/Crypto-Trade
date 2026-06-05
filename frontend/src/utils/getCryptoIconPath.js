export const CRYPTO_ICON_FALLBACK = "/fallback-coin.svg";

/**
 * Extracts the base asset from a trading pair (e.g. BTC/USD → btc, WBTC-USD → wbtc).
 */
export function getBaseAsset(symbol) {
  if (!symbol) return "";

  const normalized = String(symbol).trim().toUpperCase();
  if (normalized.includes("/")) {
    return normalized.split("/")[0].toLowerCase();
  }
  if (normalized.includes("-")) {
    return normalized.split("-")[0].toLowerCase();
  }
  return normalized.toLowerCase();
}

/**
 * CoinCap CDN icon URL for a symbol's base asset.
 */
export function getCryptoIconPath(symbol) {
  const baseAsset = getBaseAsset(symbol);
  if (!baseAsset) {
    return CRYPTO_ICON_FALLBACK;
  }
  return `https://assets.coincap.io/assets/icons/${baseAsset}@2x.png`;
}

export function handleCryptoIconError(e) {
  e.target.onerror = null;
  e.target.src = CRYPTO_ICON_FALLBACK;
}
