'use client'

import { useEffect, useRef } from 'react'
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
// A QR scan and an NFC tap both just open the card URL in a browser, so they
// are indistinguishable from someone typing the link. The QR we generate and
// the NFC tags we write therefore carry a ?s= marker, which is read here. It
// is a hint, not a guarantee: a marked link that gets copied and forwarded
// counts as a scan, and any code printed or tag written before this shipped
// has no marker at all and still counts as a plain view.
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
      const source = new URLSearchParams(window.location.search).get('s')
      if (source === 'qr') track({ cardId, teamCardId, eventType: 'qr_scan' })
      else if (source === 'nfc') track({ cardId, teamCardId, eventType: 'nfc_tap' })
    } catch {
      // A malformed query string is never a reason to fail a card view.
    }
  }, [cardId, teamCardId])

  return <>{children}</>
}

// Exported for use in contact buttons and links
export { track }
