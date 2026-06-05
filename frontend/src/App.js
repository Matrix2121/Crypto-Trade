import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppContext } from "./context/AppContext";
import Sidebar from "./components/header/Sidebar";
import "./App.css";

export const AuthedLayout = () => {
  const { user } = useContext(AppContext);

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
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
