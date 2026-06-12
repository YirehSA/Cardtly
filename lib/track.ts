'use client'

import { useEffect, useRef } from 'react'

interface TrackOptions {
  // Exactly one of these should be set. cardId for a personal
  // card; teamCardId for a team card.
  cardId?: string
  teamCardId?: string
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
        team_card_id: opts.teamCardId,
        event_type: opts.eventType,
        link_title: opts.linkTitle,
      }),
    })
  } catch {
    // Silently fail. Never block the user experience for analytics.
  }
}

// Hook to track page view once on mount. Pass either cardId or
// teamCardId depending on which kind of card the page is rendering.
export function useTrackView(cardId?: string, teamCardId?: string) {
  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current) return
    if (!cardId && !teamCardId) return
    tracked.current = true
    track({ cardId, teamCardId, eventType: 'view' })
  }, [cardId, teamCardId])
}

// Standalone tracker for other events
export { track }
