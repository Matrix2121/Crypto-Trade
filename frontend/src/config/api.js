import { Capacitor } from "@capacitor/core";

const PROD_API_BASE = "https://noqtrade.com";
const configuredBase = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export function getApiBaseUrl() {
  if (configuredBase) {
    return configuredBase;
  }
  if (Capacitor.isNativePlatform()) {
    return PROD_API_BASE;
  }
  return "";
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function wsBaseUrl() {
  const origin = getApiBaseUrl() || window.location.origin;
  return origin.replace(/^http/, "ws");
}
