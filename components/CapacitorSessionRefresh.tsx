'use client'

import { useEffect } from 'react'
import { isNativeApp } from '@/lib/capacitor'
import { createClient } from '@/lib/supabase/client'

// Keeps the Supabase session warm in the native app.
//
// On Android, the WebView is suspended whenever the user backgrounds
// the app. If they stay backgrounded long enough that the access token
// expires (default 1 hour), the next request from the WebView would
// 401 and the user would land on /login.
//
// We listen for @capacitor/app's appStateChange event, which fires
// when the app moves between foreground and background. Every time
// the app is foregrounded, we call supabase.auth.refreshSession() so
// the access token is freshly minted from the still-valid refresh
// token. Combined with Supabase's persistent refresh tokens, this
// gives "stay signed in" behaviour up to the refresh token lifetime
// configured in the Supabase project (set this to 30 days or more in
// Supabase dashboard, Authentication, JWT expiry).

export default function CapacitorSessionRefresh() {
  useEffect(() => {
    if (!isNativeApp()) return
    let cancelled = false
    let removeListener: (() => void) | null = null

    import('@capacitor/app').then(({ App }) => {
      if (cancelled) return
      const supabase = createClient()
      const handle = App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        // Only refresh when coming to foreground.
        supabase.auth.refreshSession().catch(() => {
          // Silent failure - if the refresh token is itself expired,
          // the next navigation will redirect to login as usual.
        })
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
