'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  to: number
  duration?: number
  className?: string
  style?: React.CSSProperties
  format?: (n: number) => string
}

// Counts up from 0 to `to` over `duration` ms using requestAnimationFrame.
// Used for dashboard stat cards (Total Views, Contacts, This Month).
// Provides a small "wow" beat when the dashboard first loads without
// being annoying or slow.

export default function AnimatedCounter({
  to,
  duration = 900,
  className,
  style,
  format,
}: Props) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (to === 0) {
      setValue(0)
      return
    }
    // Skip animation if the user prefers reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to)
      return
    }

    startRef.current = null
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic for a snappy then gentle finish
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(to * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [to, duration])

  const display = format ? format(value) : value.toLocaleString('en-ZA')
  return <span className={className} style={style}>{display}</span>
}
