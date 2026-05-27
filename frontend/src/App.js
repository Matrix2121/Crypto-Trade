import { useContext } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppContext } from "./context/AppContext";

import LandingPage from "./pages/landing/LandingPage";
import Market from "./pages/market/Market";
import CryptoDetails from "./pages/cryptoDetails/CryptoDetails";
import Portfolio from "./pages/portfolio/Portfolio";
import Transactions from "./pages/transactions/Transactions";
import Sidebar from "./components/header/Sidebar";
import "./App.css";

const RequireAuth = () => {
  const { user } = useContext(AppContext);
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
};

const AuthenticatedAppShell = () => {
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AuthenticatedAppShell />}>
          <Route path="/market" element={<Market />} />
          <Route path="/market/:cryptoCode" element={<CryptoDetails />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/transactions" element={<Transactions />} />
        </Route>
      </Route>

      {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
}

export default App;
