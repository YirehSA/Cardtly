'use client'

import { useEffect } from 'react'
import { syncCardToWidget } from '@/lib/card-widget'

interface Props {
  slug: string | null
  name: string | null
}

// Invisible bridge: whenever the dashboard renders with a card, push
// the card URL + name to the Android home-screen widget so it always
// shows the user's current QR. No-op on web and old app builds.
export default function WidgetSync({ slug, name }: Props) {
  useEffect(() => {
    if (!slug) return
    syncCardToWidget(`https://cardtly.com/card/${slug}`, name || '')
  }, [slug, name])

  return null
}
