import { usePricesContext } from "../context/PricesContext";

export function getTickMidPrice(tick) {
  if (!tick) return null;
  const bid = Number(tick.bid);
  const ask = Number(tick.ask);
  if (!Number.isNaN(bid) && !Number.isNaN(ask)) {
    return (bid + ask) / 2;
  }
  if (!Number.isNaN(ask)) return ask;
  if (!Number.isNaN(bid)) return bid;
  return null;
}

const usePrices = () => {
  const { pricesList } = usePricesContext();
  return pricesList;
};

export default usePrices;
