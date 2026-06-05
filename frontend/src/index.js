import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppProvider from "./context/AppContext";
import { PricesProvider } from "./context/PricesContext";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

const root = ReactDOM.createRoot(document.getElementById('root'));
const REACT_APP_GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={REACT_APP_GOOGLE_CLIENT_ID}>
      <AppProvider>
        <PricesProvider>
          <RouterProvider router={router} />
        </PricesProvider>
      </AppProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
