import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iOS wrapper. Manifest is a PWA first — this exists so the same build can
 * be submitted to the App Store, not so it can become a different app.
 *
 * `server.url` is deliberately NOT set: pointing the shell at a hosted URL is
 * the fast way to ship and the fast way to be rejected under App Store
 * guideline 4.2, which treats a wrapped website as not an app. The static
 * export is bundled instead, so the app opens with no network at all — which
 * is also what Manifest claims about itself.
 *
 * Build: `npm run build:native` then `npx cap sync ios && npx cap open ios`.
 */
const config: CapacitorConfig = {
  appId: "trip.manifest.app",
  appName: "Manifest",
  webDir: "out",

  ios: {
    // The app draws its own safe-area padding; letting the webview inset too
    // would double it under the notch.
    contentInset: "never",
    backgroundColor: "#0b1116",
    // Links to Maps, merchants and the legal pages open in the system browser
    // rather than trapping the user inside the webview.
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: "#0b1116",
    // Manifest stores everything locally; a cleared webview is a lost trip.
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      // The app paints its own branded splash in the first frame, so the
      // native one only needs to cover the handoff.
      launchShowDuration: 300,
      backgroundColor: "#0b1116",
      showSpinner: false,
    },
  },
};

export default config;

/*
 * Excluded from tsconfig: @capacitor/cli is only installed when a native build
 * is actually being made, and the Capacitor CLI compiles this file itself.
 */
