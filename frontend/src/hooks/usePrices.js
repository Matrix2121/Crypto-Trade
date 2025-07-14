import { useEffect, useState } from "react";

const usePrices = () => {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    fetch("http://localhost:8080/api/prices")
      .then(res => res.json())
      .then(data => {
        const priceMap = {};
        data.forEach(tick => {
          priceMap[tick.symbol] = tick;
        });
        setPrices(priceMap);
      })
      .catch(console.error);
  }, []);
  
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
      console.log("Connected to WebSocket");
    };

    socket.onmessage = (event) => {
      const tick = JSON.parse(event.data);
      setPrices(prev => ({
          ...prev,
          [tick.symbol]: tick
        }));
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

  
  return Object.values(prices);
};

export default usePrices;
