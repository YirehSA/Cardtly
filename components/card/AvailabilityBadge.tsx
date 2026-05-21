'use client'

import { useEffect, useState } from 'react'

interface Props {
  lastActiveAt: string | null | undefined
  textColor?: string
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

// Live-status pill shown on a public card when the card owner has
// recently been active. "Online now" if seen within 5 minutes;
// "Active 12m ago" / "Active 3h ago" otherwise. Hidden entirely if
// the owner has never been seen.
//
// Re-evaluates every 30 seconds so the label stays fresh while a
// visitor lingers on the card.

export default function AvailabilityBadge({ lastActiveAt, textColor }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!lastActiveAt) return null

  const ageMin = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60_000)
  const online = ageMin < 5
  // Suppress the "Active X ago" label after 14 days - feels stale
  if (!online && ageMin > 14 * 24 * 60) return null

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
      style={{
        background: online ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
        color: textColor || (online ? '#22c55e' : 'rgba(255,255,255,0.6)'),
      }}
      // tick is read to suppress lint warning about unused state
      data-tick={tick}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${online ? 'status-online' : ''}`}
        style={{ background: online ? '#22c55e' : 'rgba(255,255,255,0.4)' }}
      />
      {online ? 'Online now' : `Active ${relativeTime(lastActiveAt)}`}
    </div>
  )
}
