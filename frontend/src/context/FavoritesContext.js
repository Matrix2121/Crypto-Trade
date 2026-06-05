import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "./AppContext";

export function normalizeCryptoCode(code) {
  if (!code) return "";
  return String(code).replace("/", "-").toUpperCase();
}

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user, resetDone } = useContext(AppContext);
  const userId = user?.id ?? null;

  const [favorites, setFavorites] = useState([]);
  const [openedCryptos, setOpenedCryptos] = useState([]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setOpenedCryptos([]);
      return undefined;
    }

    const token = localStorage.getItem("jwt");
    if (!token) return undefined;

    let cancelled = false;

    fetch(`${process.env.REACT_APP_API_URL}/api/favorites/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Favorites fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const symbols = Array.isArray(data?.symbols) ? data.symbols : [];
        setFavorites(symbols.map(normalizeCryptoCode).filter(Boolean));
      })
      .catch((err) => {
        console.error("Failed to load favorites:", err);
        if (!cancelled) setFavorites([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, resetDone]);

  const toggleFavorite = useCallback(
    async (cryptoCode) => {
      if (!userId) return;
      const normalized = normalizeCryptoCode(cryptoCode);
      if (!normalized) return;

      const token = localStorage.getItem("jwt");
      if (!token) return;

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/favorites/${userId}/toggle`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ symbol: normalized }),
          }
        );
        if (!response.ok) {
          throw new Error(`Favorite toggle failed (${response.status})`);
        }
        const data = await response.json();
        const symbols = Array.isArray(data?.symbols) ? data.symbols : [];
        setFavorites(symbols.map(normalizeCryptoCode).filter(Boolean));
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    },
    [userId]
  );

  const registerOpened = useCallback((cryptoCode) => {
    const normalized = normalizeCryptoCode(cryptoCode);
    if (!normalized) return;

    setOpenedCryptos((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
  }, []);

  const unregisterOpened = useCallback((cryptoCode) => {
    const normalized = normalizeCryptoCode(cryptoCode);
    if (!normalized) return;

    setOpenedCryptos((prev) => prev.filter((code) => code !== normalized));
  }, []);

  const isFavorite = useCallback(
    (cryptoCode) => favorites.includes(normalizeCryptoCode(cryptoCode)),
    [favorites]
  );

  const sidebarCryptos = useMemo(() => {
    const seen = new Set();
    const items = [];

    for (const code of favorites) {
      if (seen.has(code)) continue;
      seen.add(code);
      items.push({ code, isFavorite: true });
    }

    for (const code of openedCryptos) {
      if (seen.has(code)) continue;
      seen.add(code);
      items.push({ code, isFavorite: false });
    }

    return items;
  }, [favorites, openedCryptos]);

  const value = useMemo(
    () => ({
      favorites,
      openedCryptos,
      sidebarCryptos,
      toggleFavorite,
      registerOpened,
      unregisterOpened,
      isFavorite,
    }),
    [
      favorites,
      openedCryptos,
      sidebarCryptos,
      toggleFavorite,
      registerOpened,
      unregisterOpened,
      isFavorite,
    ]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}
