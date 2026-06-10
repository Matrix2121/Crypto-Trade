import { useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppContext } from "./context/AppContext";
import Sidebar from "./components/header/Sidebar";
import "./App.css";

const BRAND_LOGO = `${process.env.PUBLIC_URL}/logo.png`;

export const AuthedLayout = () => {
  const { user } = useContext(AppContext);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main className="app-content">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
          <span className="mobile-topbar-brand">
            <img
              className="mobile-topbar-logo"
              src={BRAND_LOGO}
              alt=""
              width={28}
              height={28}
            />
            <span className="mobile-topbar-title">NoqTrade</span>
          </span>
        </div>
        <div className="app-routes">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export const MarketLayout = () => {
  const location = useLocation();

  return (
    <div className="app-routes">
      <Outlet key={location.pathname} />
    </div>
  );
};
