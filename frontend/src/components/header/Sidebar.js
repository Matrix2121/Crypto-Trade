import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import { formatBalanceUsd } from "../../utils/formatBalance";
import { normalizeCryptoCode, useFavorites } from "../../context/FavoritesContext";
import useBalance from "../../hooks/useBalance";
import { getCryptoIconPath, handleCryptoIconError } from "../../utils/getCryptoIconPath";
import "./Sidebar.css";

const MAIN_NAV = { to: "/market", label: "Market", icon: "📈" };

const OTHER_NAV = [
  { to: "/portfolio", label: "Portfolio", icon: "💼" },
  { to: "/transactions", label: "Transactions", icon: "🧾" },
  { to: "/backtesting", label: "Backtesting", icon: "📊" },
];

function SidebarCryptoLink({ code, isFavorite, isActive, isExpanded, onNavigate }) {
  const label = code.replace("-", "/");

  return (
    <NavLink
      to={`/market/${code}`}
      className={`sidebar-crypto-link${isActive ? " active" : ""}${isFavorite ? " favorite" : ""}`}
      title={label}
      onClick={onNavigate}
    >
      <span className="sidebar-crypto-icon-wrap">
        <img
          className="sidebar-crypto-icon"
          src={getCryptoIconPath(code)}
          alt=""
          width={20}
          height={20}
          onError={handleCryptoIconError}
        />
        {isFavorite && (
          <span className="sidebar-crypto-star" aria-hidden="true">
            ★
          </span>
        )}
      </span>
      {isExpanded && <span className="sidebar-label">{label}</span>}
    </NavLink>
  );
}

const Sidebar = ({ mobileOpen = false, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, balance } = useContext(AppContext);
  const { sidebarCryptos } = useFavorites();
  const [isExpanded, setIsExpanded] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  useBalance();

  useEffect(() => {
    setAvatarError(false);
  }, [user?.pictureUrl]);

  const activeCryptoCode = useMemo(() => {
    const match = location.pathname.match(/^\/market\/([^/]+)/i);
    return match ? normalizeCryptoCode(match[1]) : null;
  }, [location.pathname]);

  const showLabels = isExpanded || mobileOpen;

  const handleNavigate = () => {
    onMobileClose?.();
  };

  const handleLogout = () => {
    onMobileClose?.();
    logout();
    navigate("/");
  };

  return (
    <aside
      className={`sidebar${isExpanded ? " expanded" : " collapsed"}${mobileOpen ? " mobile-open" : ""}`}
    >
      <div className="sidebar-top">
        <div className="sidebar-header">
          <div className="sidebar-brand">{showLabels ? "Noq Trade" : ""}</div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => (mobileOpen ? onMobileClose?.() : setIsExpanded((v) => !v))}
            aria-label={mobileOpen ? "Close menu" : isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            title={mobileOpen ? "Close" : isExpanded ? "Collapse" : "Expand"}
          >
            {mobileOpen ? "✕" : isExpanded ? "«" : "»"}
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to={MAIN_NAV.to}
            end
            className={({ isActive }) =>
              `sidebar-link${isActive && !activeCryptoCode ? " active" : ""}`
            }
            title={showLabels ? undefined : MAIN_NAV.label}
            onClick={handleNavigate}
          >
            <span className="sidebar-icon" aria-hidden="true">
              {MAIN_NAV.icon}
            </span>
            {showLabels && <span className="sidebar-label">{MAIN_NAV.label}</span>}
          </NavLink>

          {sidebarCryptos.length > 0 && (
            <div className="sidebar-crypto-list">
              {sidebarCryptos.map(({ code, isFavorite }) => (
                <SidebarCryptoLink
                  key={code}
                  code={code}
                  isFavorite={isFavorite}
                  isActive={activeCryptoCode === code}
                  isExpanded={showLabels}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {OTHER_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              title={showLabels ? undefined : item.label}
              onClick={handleNavigate}
            >
              <span className="sidebar-icon" aria-hidden="true">
                {item.icon}
              </span>
              {showLabels && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          ))}

          {user?.isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              title={showLabels ? undefined : "Admin"}
              onClick={handleNavigate}
            >
              <span className="sidebar-icon" aria-hidden="true">
                ⚙️
              </span>
              {showLabels && <span className="sidebar-label">Admin</span>}
            </NavLink>
          )}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <div className="sidebar-profile-row sidebar-profile-user">
            {user?.pictureUrl && !avatarError ? (
              <img
                className="sidebar-profile-avatar"
                src={user.pictureUrl}
                alt=""
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="sidebar-profile-avatar sidebar-profile-avatar-fallback" aria-hidden="true">
                {(user?.username?.[0] ?? "?").toUpperCase()}
              </span>
            )}
            <span className="sidebar-profile-username">{user?.username ?? "—"}</span>
          </div>

          <div className="sidebar-profile-row">
            <span className="sidebar-profile-label">Balance:</span>
            <span className="sidebar-profile-balance-value">
              {balance ? formatBalanceUsd(balance.balance) : "Loading..."}
            </span>
          </div>

          <button className="sidebar-logout" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
