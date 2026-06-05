import { useEffect, useMemo, useState } from "react";

function normalizeTick(tick, overrides = {}) {
  return {
    ...tick,
    timestamp: tick.timestamp ? new Date(tick.timestamp) : new Date(),
    previousBid: tick.previousBid ?? null,
    previousAsk: tick.previousAsk ?? null,
    ...overrides,
  };
}

function samePrice(a, b) {
  if (a == null || b == null) return a === b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return String(a) === String(b);
}

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

function nextPreviousPrice(incoming, existing, side) {
  if (!existing) {
    return incoming[`previous${side}`] ?? null;
  }
  const currentKey = side.toLowerCase();
  const previousKey = `previous${side}`;
  if (samePrice(incoming[currentKey], existing[currentKey])) {
    return existing[previousKey] ?? incoming[previousKey] ?? null;
  }
  return existing[currentKey] ?? incoming[previousKey] ?? null;
}

const usePrices = () => {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/prices`)
      .then((res) => res.json())
      .then((data) => {
        const priceMap = {};
        data.forEach((tick) => {
          priceMap[tick.symbol] = normalizeTick(tick);
        });
        setPrices(priceMap);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const wsBaseUrl = process.env.REACT_APP_API_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBaseUrl}/ws`);

    socket.onopen = () => {
      console.log("Connected to WebSocket");
    };

    socket.onmessage = (event) => {
      const tick = JSON.parse(event.data);
      setPrices((prev) => {
        const oldTick = prev[tick.symbol];
        return {
          ...prev,
          [tick.symbol]: normalizeTick(tick, {
            previousBid: nextPreviousPrice(tick, oldTick, "Bid"),
            previousAsk: nextPreviousPrice(tick, oldTick, "Ask"),
          }),
        };
      });
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      socket.close();
    };
  }, []);

  return useMemo(() => Object.values(prices), [prices]);
};

export default usePrices;
