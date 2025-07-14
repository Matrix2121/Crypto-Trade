// utils/getCryptoIconPath.ts
export function getCryptoIconPath(symbol, size = 32) {
  try {
    const base = symbol?.split("/")?.[0]?.toLowerCase();
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/${size}/icon/${base}.png`;
  } catch {
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/${size}/icon/generic.png`;
  }
}
