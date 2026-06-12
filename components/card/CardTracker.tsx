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

// Wraps the public card and fires a view event on mount
export default function CardTracker({ cardId, teamCardId, children }: Props) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    if (!cardId && !teamCardId) return
    tracked.current = true
    track({ cardId, teamCardId, eventType: 'view' })
  }, [cardId, teamCardId])

  return <>{children}</>
}

// Exported for use in contact buttons and links
export { track }
