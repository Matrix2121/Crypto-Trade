export function getCryptoIconPath(symbol, size = 32) {
  const base = symbol?.split?.("/")?.[0]?.toLowerCase?.();
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/${size}/icon/${base}.png`;
}
