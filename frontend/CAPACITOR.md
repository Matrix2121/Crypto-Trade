# NoqTrade Native App (Capacitor)

The React frontend can be packaged as a native iOS/Android app using [Capacitor](https://capacitorjs.com/). The app bundles static UI assets locally and talks to your hosted API on the VPS.

## Architecture

- **On device:** Capacitor WebView + React build (`frontend/build`)
- **On VPS:** Nginx → Spring Boot → Postgres + ml-service (unchanged)
- **Not offline:** the backend must remain deployed at `noqtrade.com`

## Prerequisites

- Node 18+
- **Android:** Android Studio + JDK 17
- **iOS:** macOS + Xcode + CocoaPods (Windows cannot build iOS locally)
- Google Cloud OAuth client IDs configured for Web + Android (+ iOS if publishing to App Store)

## Environment for native builds

Create `frontend/.env.production.local` (or pass vars inline) before building:

```env
REACT_APP_API_URL=https://noqtrade.com
REACT_APP_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Local web dev continues to use `frontend/.env.local` with `http://localhost:8080` or empty (proxy).

## Build and sync

From the **repo root** or from `frontend/`:

```bash
# repo root (recommended)
npm run cap:sync

# or explicitly
cd frontend
npm run build          # uses .env.production.local when present
npx cap sync           # copies build/ into android/ and ios/
```

Shortcut from `frontend/`:

```bash
cd frontend
npm run cap:sync
```

## Open native projects

```bash
npm run cap:android    # opens Android Studio
npm run cap:ios        # opens Xcode (macOS only)
```

## Google Sign-In (native)

Web uses `@react-oauth/google`. Native uses `@codetrix-studio/capacitor-google-auth` with a dedicated button on the landing page.

Configure in [capacitor.config.ts](capacitor.config.ts):

- `plugins.GoogleAuth.serverClientId` — **Web client ID** (same as `REACT_APP_GOOGLE_CLIENT_ID`)

### Android

1. In [Google Cloud Console](https://console.cloud.google.com/), create an **Android** OAuth client for package `com.noqtrade.app`.
2. Add your debug/release SHA-1 fingerprint from Android Studio or:
   ```bash
   cd android && ./gradlew signingReport
   ```
3. Rebuild the app after updating OAuth clients.

### iOS

1. Create an **iOS** OAuth client with bundle ID `com.noqtrade.app`.
2. Add the reversed client ID to `ios/App/App/Info.plist` URL schemes (Capacitor Google Auth docs).
3. Run `pod install` inside `ios/App` on macOS.

## Icons and splash

Source assets live in `frontend/assets/` (`icon.png`, `splash.png`).

Regenerate platform assets after logo changes:

```bash
npx @capacitor/assets generate --iconBackgroundColor "#0a1628" --splashBackgroundColor "#0a1628" --logoSplashScale 0.4 --android --ios
npx cap sync
```

## CORS

Native WebView origins are allowed in [SecurityConfig.java](../backend/src/main/java/com/matrix2121/cryptotrade/security/SecurityConfig.java):

- `capacitor://localhost`
- `https://localhost`
- `http://localhost`

Redeploy the backend after CORS changes.

## Store submission checklist

- [ ] Production API URL baked into build (`https://noqtrade.com`)
- [ ] Privacy policy URL
- [ ] App Store / Play Console accounts
- [ ] Screenshots from mobile layout
- [ ] Release signing (Android keystore, iOS distribution cert)
