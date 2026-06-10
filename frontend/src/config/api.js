const configuredBase = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export function getApiBaseUrl() {
  return configuredBase;
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return configuredBase ? `${configuredBase}${normalizedPath}` : normalizedPath;
}

export function wsBaseUrl() {
  const origin = configuredBase || window.location.origin;
  return origin.replace(/^http/, "ws");
}
