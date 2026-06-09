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
  const [users, setUsers] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usersError, setUsersError] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [isRunningHourlyPredict, setIsRunningHourlyPredict] = useState(false);
  const [isRunningDailyPredict, setIsRunningDailyPredict] = useState(false);
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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load users (${response.status})`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setUsersError("Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      loadTrackedCryptos();
      loadUsers();
    }
  }, [user, loadTrackedCryptos, loadUsers]);

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

  const handleRunHourlyPredictions = async () => {
    setIsRunningHourlyPredict(true);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/predictions/hourly`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.status === 409) {
        setActionMessage("Hourly prediction run is already in progress.");
        return;
      }
      if (!response.ok) {
        throw new Error(`Hourly prediction failed (${response.status})`);
      }
      setActionMessage(
        "Hourly 1h ML predictions started (timestamp aligned to next UTC :00)."
      );
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to start hourly predictions.");
    } finally {
      setIsRunningHourlyPredict(false);
    }
  };

  const handleRunDailyPredictions = async () => {
    setIsRunningDailyPredict(true);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/predictions/daily`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.status === 409) {
        setActionMessage("Daily context-aware prediction run is already in progress.");
        return;
      }
      if (!response.ok) {
        throw new Error(`Daily prediction failed (${response.status})`);
      }
      setActionMessage(
        "Daily context-aware predictions started (timestamp aligned to next UTC 00:00)."
      );
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to start daily context-aware predictions.");
    } finally {
      setIsRunningDailyPredict(false);
    }
  };

  const handleSetAdmin = async (targetUser, grantAdmin) => {
    const action = grantAdmin ? "grant admin to" : "revoke admin from";
    if (
      !window.confirm(
        `${grantAdmin ? "Grant" : "Revoke"} admin access for ${targetUser.email}?`,
      )
    ) {
      return;
    }

    setUpdatingUserId(targetUser.id);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/users/${targetUser.id}/admin`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isAdmin: grantAdmin }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to ${action} user (${response.status})`);
      }
      const updated = await response.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setActionMessage(
        grantAdmin
          ? `${updated.email} is now an admin. They must log out and back in for access to apply.`
          : `${updated.email} is no longer an admin.`,
      );
    } catch (err) {
      console.error(err);
      setActionMessage(err.message || `Failed to ${action} user.`);
    } finally {
      setUpdatingUserId(null);
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
        <p className="admin-subtitle">
          Manage tracked cryptocurrencies, market data sync, and on-demand ML predictions.
        </p>
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
        <h3 className="admin-section-title">Predictions</h3>
        <p className="admin-hint admin-hint-block">
          Run ML batches for all configured assets. Hourly forecasts use the next UTC hour
          boundary; context-aware daily forecasts use the next UTC midnight.
        </p>
        <div className="admin-sync-row">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleRunHourlyPredictions}
            disabled={isRunningHourlyPredict}
          >
            {isRunningHourlyPredict ? "Running…" : "Run hourly predictions"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={handleRunDailyPredictions}
            disabled={isRunningDailyPredict}
          >
            {isRunningDailyPredict ? "Running…" : "Run context-aware daily"}
          </button>
        </div>
      </section>

      <section className="admin-section">
        <h3 className="admin-section-title">Administrators</h3>
        <p className="admin-hint admin-hint-block">
          Grant or revoke admin access. New admins must sign out and back in to use the admin panel.
        </p>

        {usersLoading && <p className="admin-loading">Loading users…</p>}
        {usersError && <p className="admin-error">{usersError}</p>}

        {!usersLoading && !usersError && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = String(u.id) === String(user?.id);
                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.username}</td>
                      <td>
                        {u.isAdmin ? (
                          <span className="admin-badge">Admin</span>
                        ) : (
                          <span className="admin-badge admin-badge-user">User</span>
                        )}
                        {isSelf && <span className="admin-you-label"> (you)</span>}
                      </td>
                      <td>
                        {u.isAdmin ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            disabled={isSelf || updatingUserId === u.id}
                            title={isSelf ? "You cannot remove your own admin access" : undefined}
                            onClick={() => handleSetAdmin(u, false)}
                          >
                            {updatingUserId === u.id ? "Saving…" : "Revoke admin"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn-primary"
                            disabled={updatingUserId === u.id}
                            onClick={() => handleSetAdmin(u, true)}
                          >
                            {updatingUserId === u.id ? "Saving…" : "Make admin"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
