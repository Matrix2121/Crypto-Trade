import type { CapacitorConfig } from "@capacitor/cli";

// Web client — backend verifies ID tokens against this audience.
const WEB_CLIENT_ID =
  "569243080322-gcbva79oge5qrbqog892f3uc3554o9qk.apps.googleusercontent.com";
// Android client — package com.noqtrade.app + debug/release SHA-1 in Google Cloud.
const ANDROID_CLIENT_ID =
  "569243080322-5v3ov5g4cv8grl26tcrmqajvdhqal7pm.apps.googleusercontent.com";

const config: CapacitorConfig = {
  appId: "com.noqtrade.app",
  appName: "NoqTrade",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      androidClientId: ANDROID_CLIENT_ID,
      serverClientId: WEB_CLIENT_ID,
      forceCodeForRefreshToken: false,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a1628",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a1628",
    },
  },
};

export default config;
