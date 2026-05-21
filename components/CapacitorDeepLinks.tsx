'use client'

import { useEffect } from 'react'
import { isNativeApp } from '@/lib/capacitor'

// Routes incoming cardtly.com deep links to the right page inside the
// WebView. Without this listener, Capacitor's remote URL mode always
// loads the configured server.url (the homepage), so a friend tapping
// a cardtly.com/card/[slug] link while the app is installed would land
// on the homepage rather than the card they wanted to see.
//
// We listen via @capacitor/app's appUrlOpen event, which fires for
// every Android Intent that starts the app with a URL (App Links,
// shared links, NFC tag taps, etc.). When the incoming URL is on a
// cardtly.com host, we strip the host and navigate the WebView to the
// same path so the deep link works as expected.

export default function CapacitorDeepLinks() {
  useEffect(() => {
    if (!isNativeApp()) return
    let cancelled = false
    let removeListener: (() => void) | null = null

    import('@capacitor/app').then(({ App }) => {
      if (cancelled) return
      const handle = App.addListener('appUrlOpen', (event: { url: string }) => {
        try {
          const incoming = new URL(event.url)
          // Only follow cardtly.com URLs. Refuse to navigate the WebView
          // to anything pointing at a different origin (security guard).
          if (
            incoming.hostname !== 'cardtly.com' &&
            incoming.hostname !== 'www.cardtly.com'
          ) {
            return
          }
          const target = incoming.pathname + incoming.search + incoming.hash
          // Only navigate if we're not already on this exact path. Comparing
          // against window.location avoids reloading the page when Android
          // delivers the appUrlOpen event for the initial cold-start URL
          // that the WebView already loaded.
          const currentPath = window.location.pathname + window.location.search + window.location.hash
          if (target && target !== currentPath) {
            window.location.assign(target)
          }
        } catch {
          // Bad URL, ignore
        }
      })
      removeListener = () => {
        Promise.resolve(handle).then((h) => h.remove?.()).catch(() => {})
      }
    }).catch(() => {})

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [])

  return null
}
