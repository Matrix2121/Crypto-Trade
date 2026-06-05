import { createBrowserRouter, Navigate } from "react-router-dom";

import LandingPage from "./pages/landing/LandingPage";
import Market from "./pages/market/Market";
import CryptoDetails from "./pages/cryptoDetails/CryptoDetails";
import Portfolio from "./pages/portfolio/Portfolio";
import Transactions from "./pages/transactions/Transactions";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AuthedLayout, MarketLayout } from "./App";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <LandingPage />,
    },
    {
      element: <AuthedLayout />,
      children: [
        {
          path: "market",
          element: <MarketLayout />,
          children: [
            { index: true, element: <Market /> },
            { path: ":cryptoCode", element: <CryptoDetails /> },
          ],
        },
        { path: "portfolio", element: <Portfolio /> },
        { path: "transactions", element: <Transactions /> },
        { path: "admin", element: <AdminDashboard /> },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ],
  {
    future: {
      v7_startTransition: false,
    },
  }
);
