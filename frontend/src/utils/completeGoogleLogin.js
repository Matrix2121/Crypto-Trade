import { apiUrl } from "../config/api";

const AUTH_TIMEOUT_MS = 30_000;

export async function completeGoogleLogin(idToken) {
  const url = apiUrl("/api/auth/google");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: idToken }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Auth failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }

    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Auth timed out contacting ${url}`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Network error contacting ${url}: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function persistUserSession(data, setUser) {
  localStorage.setItem("userId", data.id);
  localStorage.setItem("jwt", data.jwt);
  localStorage.setItem("username", data.username);
  localStorage.setItem("isAdmin", String(Boolean(data.isAdmin)));
  if (data.pictureUrl) {
    localStorage.setItem("pictureUrl", data.pictureUrl);
  } else {
    localStorage.removeItem("pictureUrl");
  }

  setUser({
    id: data.id,
    username: data.username,
    pictureUrl: data.pictureUrl ?? null,
    balance: data.balance,
    isAdmin: Boolean(data.isAdmin),
  });
}
