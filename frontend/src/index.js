import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppProvider from "./context/AppContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { PricesProvider } from "./context/PricesContext";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { initNativeApp } from "./utils/initNativeApp";

const root = ReactDOM.createRoot(document.getElementById('root'));
const REACT_APP_GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

initNativeApp().finally(() => {
  root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={REACT_APP_GOOGLE_CLIENT_ID}>
      <AppProvider>
        <FavoritesProvider>
          <PricesProvider>
            <RouterProvider router={router} />
          </PricesProvider>
        </FavoritesProvider>
      </AppProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
  );
});
