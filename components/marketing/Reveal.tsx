'use client'

import { useEffect, useRef, useState } from 'react'

// Scroll-reveal wrapper. Starts as .reveal (hidden + shifted), then adds
// .is-visible the first time it scrolls into view, letting the CSS
// transition play. The transform lives here on the wrapper so it never
// clashes with a child card's own hover transform.
//
// `delay` staggers siblings (e.g. cards in a grid). Respects
// prefers-reduced-motion: those users get the content shown immediately.
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Reduced-motion or no IntersectionObserver: just show it.
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
