import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PricesContext = createContext(null);

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

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

function isPriceTickMessage(data) {
  return data && typeof data.symbol === "string" && data.symbol.length > 0;
}

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState({});
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const mountedRef = useRef(true);

  const applyTick = useCallback((tick) => {
    if (!isPriceTickMessage(tick)) return;

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
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current) return;

    const wsBaseUrl = process.env.REACT_APP_API_URL.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsBaseUrl}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      backoffRef.current = INITIAL_BACKOFF_MS;
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "connection") return;
        applyTick(payload);
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    socket.onerror = () => {
      // onclose handles reconnect
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (!mountedRef.current) return;

      const delay = backoffRef.current;
      backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);
      reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
    };
  }, [applyTick]);

  useEffect(() => {
    mountedRef.current = true;

    fetch(`${process.env.REACT_APP_API_URL}/api/prices`)
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current) return;
        const priceMap = {};
        data.forEach((tick) => {
          priceMap[tick.symbol] = normalizeTick(tick);
        });
        setPrices(priceMap);
      })
      .catch(console.error);

    connectWebSocket();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const pricesList = useMemo(() => Object.values(prices), [prices]);

  const value = useMemo(
    () => ({ prices, pricesList }),
    [prices, pricesList]
  );

  return (
    <PricesContext.Provider value={value}>
      {children}
    </PricesContext.Provider>
  );
}

export function usePricesContext() {
  const context = useContext(PricesContext);
  if (!context) {
    throw new Error("usePricesContext must be used within PricesProvider");
  }
  return context;
}
