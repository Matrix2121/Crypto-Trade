import type { CapacitorConfig } from "@capacitor/cli";

// Web client ID — used for requestIdToken() and backend verification.
// The Android OAuth client in Google Cloud (package + SHA-1) is separate; do NOT put it here.
const WEB_CLIENT_ID =
  "569243080322-gcbva79oge5qrbqog892f3uc3554o9qk.apps.googleusercontent.com";

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
