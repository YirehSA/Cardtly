'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/track'

interface Props {
  cardId: string
  children: React.ReactNode
}

// Wraps the public card and fires a view event on mount
export default function CardTracker({ cardId, children }: Props) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    track({ cardId, eventType: 'view' })
  }, [cardId])

  return <>{children}</>
}

// Exported for use in contact buttons and links
export { track }
