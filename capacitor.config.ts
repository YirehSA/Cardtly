import type { CapacitorConfig } from '@capacitor/cli'

// Cardtly Android app config
//
// We use Capacitor in remote-URL mode: the native WebView loads
// https://cardtly.com directly so the existing Next.js + Supabase stack
// stays as one codebase. Native plugins (NFC, Contacts, Share) sit on
// top for tap-to-share and save-to-contacts.
//
// The `webDir` field is required by Capacitor even when using a remote
// server; we point it at `public` since the Next.js public folder is
// the closest thing to a static web root in this repo.

const config: CapacitorConfig = {
  appId: 'com.cardtly.app',
  appName: 'Cardtly',
  webDir: 'public',
  server: {
    // Use the canonical URL Vercel serves so we avoid the cardtly.com to
    // www.cardtly.com redirect entirely. Capacitor's bridge survives the
    // initial load cleaner this way.
    url: 'https://www.cardtly.com',
    cleartext: false,
    // androidScheme intentionally omitted — only needed for local-bundle
    // builds. With server.url set, leaving this default avoids confusing
    // Capacitor about whether to load local content at https://localhost
    // versus the remote URL.
    allowNavigation: [
      'cardtly.com',
      'www.cardtly.com',
      '*.cardtly.com',
      '*.supabase.co',
      '*.paystack.com',
      'checkout.paystack.com',
    ],
  },
  ios: {
    // Tags the WebView's user agent so the server can tell an iOS app request
    // from a Safari one, and leave the purchase surfaces OUT of the response
    // rather than have the page hide them afterwards. See lib/app-platform.
    //
    // App Review rejected 1.0 (7) under 3.1.1 for reaching a Paystack card form
    // inside the app, and again for the trial code box. Neither may exist here.
    // Anything hidden in the browser is still in the page source and still
    // flashes before hydration - not good enough for a reviewer who looks.
    appendUserAgent: 'CardtlyiOS',
  },
  android: {
    allowMixedContent: false,
    // captureInput intentionally omitted (default false). When true, the
    // native Activity consumes touch events instead of forwarding them
    // to the WebView, which makes the entire app unresponsive to taps.
    // Enable Chrome remote DevTools against the WebView for debugging.
    // Safe to leave on for early releases; flip to false before final
    // Play Store production builds.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    // NFC, Contacts, Share plugins added in the next task
  },
}

export default config
