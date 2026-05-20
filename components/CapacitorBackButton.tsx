'use client'

import { useEffect } from 'react'
import { isNativeApp } from '@/lib/capacitor'

// Wires the Android hardware back button (and edge swipe) to behave like
// a browser back button.
//
// In a Capacitor 6 WebView, the default back action just minimises the
// app. By registering a backButton listener via @capacitor/app, we get
// to handle it ourselves: if the WebView has history, go back one step;
// otherwise minimise the app (matching the previous default for the
// at-root case).
//
// Mounted once in the root layout so it runs for every screen. No-op on
// the web build because isNativeApp() returns false outside the Cardtly
// Android app.

export default function CapacitorBackButton() {
  useEffect(() => {
    if (!isNativeApp()) return

    let cancelled = false
    let removeListener: (() => void) | null = null

    // Dynamic import so the @capacitor/app dependency isn't pulled into
    // the web bundle unless we're actually running inside the app.
    import('@capacitor/app').then(({ App }) => {
      if (cancelled) return
      const handle = App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })
      removeListener = () => {
        // addListener returns a Promise<PluginListenerHandle> on some
        // versions and a sync handle on others. Both expose .remove().
        Promise.resolve(handle).then((h) => h.remove?.()).catch(() => {})
      }
    }).catch(() => {
      // App plugin not available (unlikely in the native build).
    })

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [])

  return null
}
