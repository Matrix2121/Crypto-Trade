import { useEffect, useMemo, useRef, useState } from "react";
import "./FlashPrice.css";

function formatDelta(delta) {
  if (delta == null) return "—";
  if (delta === 0 || Math.abs(delta) < 1e-10) return "0.000000";
  const sign = delta > 0 ? "+" : "-";
  const abs = Math.abs(delta);
  let body;
  if (abs >= 1000) {
    body = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (abs >= 1) {
    body = abs.toFixed(4);
  } else {
    body = abs.toFixed(6);
  }
  return `${sign}${body}`;
}

function deltaDirection(delta) {
  if (delta == null || delta === 0 || Math.abs(delta) < 1e-10) return "neutral";
  return delta > 0 ? "up" : "down";
}

function isEffectivelyZero(value) {
  return value === 0 || (value != null && Math.abs(value) < 1e-10);
}

/**
 * Renders a numeric price, flashes green/red on change, optionally shows tick delta.
 * Pass previousValue (from backend previousBid/previousAsk) for instant delta on load.
 */
const FlashPrice = ({
  value,
  previousValue,
  delta: deltaProp,
  className = "",
  children,
  showChange = false,
  changeLayout = "inline",
}) => {
  const prevRef = useRef(undefined);
  const [flash, setFlash] = useState(null);

  const serverDelta = useMemo(() => {
    if (deltaProp != null) {
      return isEffectivelyZero(deltaProp) ? null : deltaProp;
    }
    if (value == null || previousValue == null) return null;
    const num = Number(value);
    const prev = Number(previousValue);
    if (Number.isNaN(num) || Number.isNaN(prev)) return null;
    const diff = num - prev;
    return isEffectivelyZero(diff) ? null : diff;
  }, [value, previousValue, deltaProp]);

  const [delta, setDelta] = useState(serverDelta);

  useEffect(() => {
    setDelta(serverDelta);
  }, [serverDelta]);

  useEffect(() => {
    if (value == null || value === "—" || value === "---") {
      prevRef.current = undefined;
      setFlash(null);
      return;
    }

    const num = Number(value);
    if (Number.isNaN(num)) return;

    const prev = prevRef.current;
    if (prev !== undefined && num !== prev) {
      const nextDelta = num - prev;
      setDelta(isEffectivelyZero(nextDelta) ? null : nextDelta);
      setFlash({ dir: num > prev ? "up" : "down", key: Date.now() });
    }
    prevRef.current = num;
  }, [value]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(timer);
  }, [flash]);

  const display = children ?? value;
  const deltaText = showChange ? formatDelta(delta) : null;
  const deltaClass = showChange ? deltaDirection(delta) : "neutral";

  return (
    <span
      className={[
        "price-flash-wrap",
        `price-flash-wrap--${changeLayout}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        key={flash?.key ?? "idle"}
        className={[
          "price-flash",
          flash ? `price-flash-${flash.dir}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {display}
      </span>
      {showChange && (
        <span className={`price-delta price-delta-${deltaClass}`}>
          {deltaText}
        </span>
      )}
    </span>
  );
};

export default FlashPrice;
