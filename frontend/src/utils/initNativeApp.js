import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0a1628" });
  } catch (err) {
    console.warn("StatusBar init skipped:", err);
  }

  GoogleAuth.initialize({
    clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    scopes: ["profile", "email"],
    grantOfflineAccess: false,
  });
}
