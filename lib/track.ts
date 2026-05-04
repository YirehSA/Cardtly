'use client'

import { useEffect, useRef } from 'react'

interface TrackOptions {
  cardId: string
  eventType: 'view' | 'link_click' | 'contact_save' | 'qr_scan' | 'share'
  linkTitle?: string
}

async function track(opts: TrackOptions) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: opts.cardId,
        event_type: opts.eventType,
        link_title: opts.linkTitle,
      }),
    })
  } catch {
    // Silently fail — never block the user experience for analytics
  }
}

// Hook to track page view once on mount
export function useTrackView(cardId: string) {
  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    track({ cardId, eventType: 'view' })
  }, [cardId])
}

// Standalone tracker for other events
export { track }
