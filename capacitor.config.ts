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
  android: {
    allowMixedContent: false,
    captureInput: true,
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
