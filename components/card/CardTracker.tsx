'use client'

import { useEffect, useRef } from 'react'
import { sourceById } from '@/lib/card-sources'
import { track } from '@/lib/track'

interface Props {
  // Pass exactly one. Personal cards pass cardId; team cards
  // pass teamCardId. /api/analytics routes the view event to
  // the right counter (cards.view_count vs team_cards.view_count).
  cardId?: string
  teamCardId?: string
  children: React.ReactNode
}

// Wraps the public card and fires a view event on mount, plus a second event
// recording how the visitor arrived when we can tell.
//
// A QR scan, an NFC tap and a pasted link all just open the card URL in a
// browser, so nothing in the request tells them apart. Every link Cardtly
// generates therefore carries a ?s= marker, read here and mapped to its own
// event type through lib/card-sources.ts.
//
// It is a hint, not a guarantee: a marked link that gets copied and forwarded
// carries its marker along, and any code printed or tag written before its
// marker existed still arrives unmarked and counts as a plain view. An
// unmarked arrival is what the analytics page reports as a shared link, which
// is a residual rather than something we can positively detect.
//
// The view event is always sent as well, so view counts stay comparable and
// the card_events view_count trigger keeps working untouched.
export default function CardTracker({ cardId, teamCardId, children }: Props) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    if (!cardId && !teamCardId) return
    tracked.current = true
    track({ cardId, teamCardId, eventType: 'view' })

    // Read from location rather than useSearchParams: this runs on mount in
    // the browser, and it avoids forcing a Suspense boundary on the card page.
    try {
      const source = sourceById(new URLSearchParams(window.location.search).get('s'))
      // Looked up rather than compared: an unknown or hand-edited ?s= resolves
      // to null and is ignored, so nothing can invent an event type in the table.
      if (source) track({ cardId, teamCardId, eventType: source.eventType })
    } catch {
      // A malformed query string is never a reason to fail a card view.
    }
  }, [cardId, teamCardId])

  return <>{children}</>
}

// Exported for use in contact buttons and links
export { track }
