import type { CapacitorConfig } from "@capacitor/cli";

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
      serverClientId:
        "569243080322-gcbva79oge5qrbqog892f3uc3554o9qk.apps.googleusercontent.com",
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
