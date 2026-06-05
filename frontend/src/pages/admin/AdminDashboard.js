import { useCallback, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import { getCryptoIconPath, handleCryptoIconError } from "../../utils/getCryptoIconPath";
import "./AdminDashboard.css";

const apiUrl = process.env.REACT_APP_API_URL;

function authHeaders() {
  const token = localStorage.getItem("jwt");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function formatMarketCap(value) {
  if (value == null) return "—";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

const AdminDashboard = () => {
  const { user } = useContext(AppContext);
  const [trackedCryptos, setTrackedCryptos] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const loadTrackedCryptos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/tracked-cryptos`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load tracked cryptos (${response.status})`);
      }
      const data = await response.json();
      setTrackedCryptos(data);
    } catch (err) {
      console.error(err);
      setError("Could not load tracked cryptocurrencies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      loadTrackedCryptos();
    }
  }, [user, loadTrackedCryptos]);

  if (!user?.isAdmin) {
    return <Navigate to="/market" replace />;
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    const symbol = newSymbol.trim();
    if (!symbol) return;

    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/tracked-cryptos`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ symbol }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Add failed (${response.status})`);
      }
      setNewSymbol("");
      setActionMessage(`${symbol.toUpperCase()} added to the market.`);
      await loadTrackedCryptos();
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to add cryptocurrency. Use BASE/USD format (e.g. DOT/USD).");
    }
  };

  const handleRemove = async (symbol) => {
    const code = symbol.replace("/", "-");
    if (!window.confirm(`Remove ${symbol} from tracked market?`)) return;

    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/tracked-cryptos/${code}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Remove failed (${response.status})`);
      }
      setActionMessage(`${symbol} removed.`);
      await loadTrackedCryptos();
    } catch (err) {
      console.error(err);
      setActionMessage(`Failed to remove ${symbol}.`);
    }
  };

  const handleSyncMarketData = async () => {
    setIsSyncingData(true);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/sync/market-data`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.status === 409) {
        setActionMessage("Market data sync is already running.");
        return;
      }
      if (!response.ok) {
        throw new Error(`Sync failed (${response.status})`);
      }
      setActionMessage("Market data sync started. This may take several minutes.");
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to start market data sync.");
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleSyncMarketStats = async () => {
    setIsSyncingStats(true);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/sync/market-stats`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.status === 409) {
        setActionMessage("Market stats sync is already running.");
        return;
      }
      if (!response.ok) {
        throw new Error(`Sync failed (${response.status})`);
      }
      setActionMessage("Market stats sync started.");
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to start market stats sync.");
    } finally {
      setIsSyncingStats(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h2>Admin Dashboard</h2>
        <p className="admin-subtitle">Manage tracked cryptocurrencies and market data sync.</p>
      </header>

      <section className="admin-section">
        <h3 className="admin-section-title">Sync</h3>
        <div className="admin-sync-row">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSyncMarketData}
            disabled={isSyncingData}
          >
            {isSyncingData ? "Syncing…" : "Sync market data"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={handleSyncMarketStats}
            disabled={isSyncingStats}
          >
            {isSyncingStats ? "Syncing…" : "Sync market stats"}
          </button>
        </div>
      </section>

      <section className="admin-section">
        <h3 className="admin-section-title">Add cryptocurrency</h3>
        <form className="admin-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            className="admin-input"
            placeholder="e.g. DOT/USD or DOT"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
          />
          <button type="submit" className="admin-btn admin-btn-primary">
            Add to market
          </button>
        </form>
        <p className="admin-hint">Symbols must be USD pairs available on Kraken (e.g. DOT/USD).</p>
      </section>

      {actionMessage && <p className="admin-message">{actionMessage}</p>}

      <section className="admin-section">
        <h3 className="admin-section-title">
          Tracked cryptocurrencies ({trackedCryptos.length})
        </h3>

        {loading && <p className="admin-loading">Loading…</p>}
        {error && <p className="admin-error">{error}</p>}

        {!loading && !error && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Rank</th>
                  <th>Market cap</th>
                  <th>24h change</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trackedCryptos.map((asset) => {
                  const code = asset.symbol.replace("/", "-").toLowerCase();
                  const change = asset.change24h;
                  return (
                    <tr key={asset.symbol}>
                      <td>
                        <span className="admin-symbol-cell">
                          <img
                            src={getCryptoIconPath(code)}
                            alt=""
                            width={22}
                            height={22}
                            onError={handleCryptoIconError}
                          />
                          {asset.symbol}
                        </span>
                      </td>
                      <td>{asset.marketRank ?? "—"}</td>
                      <td>{formatMarketCap(asset.marketCap)}</td>
                      <td
                        className={
                          change == null
                            ? ""
                            : change >= 0
                              ? "admin-change-positive"
                              : "admin-change-negative"
                        }
                      >
                        {change == null ? "—" : `${change.toFixed(2)}%`}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger"
                          onClick={() => handleRemove(asset.symbol)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
