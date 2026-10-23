'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { GA_MEASUREMENT_ID, CONSENT_REGIONS, isAnalyticsPath } from '@/lib/analytics'
import { IOS_APP_UA_TAG } from '@/lib/app-platform'

// The Google tag, on the marketing pages only. See lib/analytics for the
// rules and why. Rendered by the root layout only when GA_ENABLED.
//
// Page views are sent by hand rather than by the tag's own history listener,
// so that a click from the home page to a card or the dashboard can never be
// reported before this component has seen where it went. That needs one
// setting in GA itself: Admin, Data streams, the web stream, Enhanced
// measurement, and "Page changes based on browser history events" OFF.
//
// The address sent is the path alone, never the query string, so nothing a
// link carries in ?... reaches Google.

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default function GoogleAnalytics() {
  const pathname = usePathname() || '/'
  const tracked = isAnalyticsPath(pathname)
  const [load, setLoad] = useState(false)

  // Decided in the browser, once: never inside the Cardtly apps, and not at
  // all for a visit that starts on a page we do not measure.
  useEffect(() => {
    if (load || !tracked) return
    let native = false
    try { native = Capacitor.isNativePlatform() } catch { /* web */ }
    if (native || navigator.userAgent.includes(IOS_APP_UA_TAG)) return

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      // The tag reads the arguments object itself, not an array copy of it.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    // No advertising, anywhere: the privacy policy says we do not use
    // advertising cookies. Analytics cookies are allowed, except where the
    // law asks for consent first, and there GA counts visits without them.
    window.gtag('consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      analytics_storage: 'granted',
    })
    window.gtag('consent', 'default', { analytics_storage: 'denied', region: CONSENT_REGIONS })
    window.gtag('set', 'ads_data_redaction', true)
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    setLoad(true)
  }, [tracked, load])

  // Every page change: switch GA off away from the marketing pages (its own
  // documented opt-out), and send the page view by hand on them.
  useEffect(() => {
    if (!load) return
    ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = !tracked
    if (!tracked || !window.gtag) return
    const page_location = window.location.origin + pathname
    window.gtag('set', { page_location, page_path: pathname })
    window.gtag('event', 'page_view', { page_location, page_path: pathname, page_title: document.title })
  }, [pathname, tracked, load])

  if (!load) return null
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  )
}
