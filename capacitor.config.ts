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
    url: 'https://cardtly.com',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // NFC, Contacts, Share plugins added in the next task
  },
}

export default config
