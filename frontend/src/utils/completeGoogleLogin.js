import { apiUrl } from "../config/api";

export async function completeGoogleLogin(idToken) {
  const response = await fetch(apiUrl("/api/auth/google"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: idToken }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed with status ${response.status}`);
  }

  return response.json();
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
