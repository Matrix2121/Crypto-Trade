import { useContext, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import useBalance from "../../hooks/useBalance";
import "./Sidebar.css";

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, setUser, balance } = useContext(AppContext);
  const [isExpanded, setIsExpanded] = useState(true);

  useBalance();

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  const navItems = [
    { to: "/market", label: "Market", icon: "📈" },
    { to: "/portfolio", label: "Portfolio", icon: "💼" },
    { to: "/transactions", label: "Transactions", icon: "🧾" },
  ];

  return (
    <aside className={`sidebar${isExpanded ? " expanded" : " collapsed"}`}>
      <div className="sidebar-top">
        <div className="sidebar-header">
          <div className="sidebar-brand">{isExpanded ? "CryptoTrade" : ""}</div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "«" : "»"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              title={!isExpanded ? item.label : undefined}
            >
              <span className="sidebar-icon" aria-hidden="true">
                {item.icon}
              </span>
              {isExpanded && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-profile">

          <div className="sidebar-profile-row">
            <span className="sidebar-profile-username">Hello, {user?.username ?? "—"}</span>
          </div>

          <div className="sidebar-profile-row">
            <span className="sidebar-profile-label">Balance:</span>
            <span className="sidebar-profile-balance-value">
              {balance ? `${Number(balance.balance).toFixed(2)}$` : "Loading..."}
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

