'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNativeApp } from '@/lib/capacitor'

// Runs on the marketing homepage. In the native Cardtly app the
// WebView always cold-starts at https://cardtly.com (server.url in
// capacitor.config.ts) regardless of which URL actually launched
// the app, so without this guard a friend tapping a
// cardtly.com/card/<slug> link would see the marketing homepage
// for ~1 second before the deep-link handler navigated them to the
// card.
//
// On the very first paint we:
//   1. Check Capacitor's App.getLaunchUrl() - if the app was opened
//      from a specific cardtly.com path (a card link, dashboard,
//      promotions, etc.), go straight there.
//   2. Otherwise, fall back to /dashboard if signed in or /login if
//      not - the app was just opened cold from the launcher icon.
//
// The component also renders a full-screen black overlay until the
// destination is decided, so the homepage marketing content never
// flashes through. On web, the overlay never shows and the redirect
// never fires.
export default function NativeAppRedirect() {
  const router = useRouter()
  const [showOverlay, setShowOverlay] = useState<boolean>(() => {
    // Default to true ONLY if we're sure we're in the native app AND
    // this is the app's cold start. On a later homepage visit (the user
    // tapped a Cardtly logo) we want to SHOW the marketing home, not
    // cover it - so don't raise the overlay in that case.
    if (typeof window === 'undefined') return false
    try {
      if (!isNativeApp()) return false
      if (sessionStorage.getItem('cardtly:appLaunched') === '1') return false
      return true
    } catch { return false }
  })

  useEffect(() => {
    if (!isNativeApp()) {
      setShowOverlay(false)
      return
    }
    // Helper: remove the inline pre-paint hide style so the new
    // route is visible after a client-side router.replace().
    // A full-page window.location.replace already clears it via the
    // new HTML load, so we only need to call this before router.replace.
    function revealFlashBlock() {
      try { (window as any).__cardtlyRevealFlashBlock?.() } catch { /* noop */ }
    }

    // Only redirect on the app's cold start. Once we've routed once this
    // session, a homepage visit is intentional (the user tapped a Cardtly
    // logo), so reveal and show the marketing home instead of bouncing
    // straight back to login/dashboard.
    let alreadyLaunched = false
    try { alreadyLaunched = sessionStorage.getItem('cardtly:appLaunched') === '1' } catch { /* noop */ }
    if (alreadyLaunched) {
      revealFlashBlock()
      setShowOverlay(false)
      return
    }
    try { sessionStorage.setItem('cardtly:appLaunched', '1') } catch { /* noop */ }

    let cancelled = false

    ;(async () => {
      // Step 1: was the app launched from a cardtly.com deep link?
      // If so, jump straight to that path and skip the login/dashboard
      // fallback below.
      try {
        const { App } = await import('@capacitor/app')
        const launch = await App.getLaunchUrl()
        if (cancelled) return

        if (launch?.url) {
          const incoming = new URL(launch.url)
          const isCardtly =
            incoming.hostname === 'cardtly.com' ||
            incoming.hostname === 'www.cardtly.com'
          // pathname '/' (or empty) means the launcher icon was tapped
          // - fall through to the default flow. Any other path means a
          // real deep link.
          if (isCardtly && incoming.pathname && incoming.pathname !== '/') {
            const target = incoming.pathname + incoming.search + incoming.hash
            window.location.replace(target)
            return
          }
        }
      } catch {
        // App plugin not ready or no launch URL - fall through to
        // the standard login/dashboard routing.
      }

      // Step 2: standard fallback - signed in? dashboard. else login.
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        // The inline pre-paint script (in app/page.tsx) has the body
        // visibility:hidden so the marketing content doesn't flash.
        // Client-side router.replace keeps the same DOM, so the hide
        // style would persist on the new route and the user would see
        // a black screen. Reveal explicitly before navigating.
        revealFlashBlock()
        router.replace(user ? '/dashboard' : '/login')
      } catch {
        if (cancelled) return
        revealFlashBlock()
        router.replace('/login')
      }
    })()

    return () => { cancelled = true }
  }, [router])

  // Full-screen black cover. Renders ONLY while showOverlay is true
  // (i.e. in the native app, until the redirect fires). On web this
  // is permanently null.
  if (!showOverlay) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    />
  )
}
