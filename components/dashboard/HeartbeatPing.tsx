'use client'

import { useEffect } from 'react'

// Pings POST /api/heartbeat every 3 minutes while the dashboard is in
// the foreground. Server timestamps the user's last_active_at on the
// profiles row. That timestamp powers the "Online now" status on the
// user's public card.
//
// We skip pings when the tab is hidden to avoid burning requests for
// users who left the dashboard open in a background tab.

const INTERVAL_MS = 3 * 60 * 1000

export default function HeartbeatPing() {
  useEffect(() => {
    let cancelled = false

    function ping() {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
    }

    // Fire one immediately on mount, then on an interval
    ping()
    const id = setInterval(ping, INTERVAL_MS)
    // Also ping whenever the tab becomes visible again
    function onVisibility() { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
