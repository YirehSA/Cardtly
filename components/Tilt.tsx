'use client'

import { useRef, ReactNode } from 'react'

interface Props {
  children: ReactNode
  // Max degree of tilt at the corners. 6-10 feels subtle; 15+ feels heavy.
  max?: number
  // Add a shine layer that follows the cursor. Looks great on dark cards.
  shine?: boolean
  className?: string
}

// 3D parallax tilt wrapper. Tracks mouse position over the element and
// rotates the inner content along X / Y axes so it feels like a tiny
// playing card you can tip in your hand. Disables on touch devices
// (where there's no hover) and on reduced-motion preferences.

export default function Tilt({ children, max = 8, shine = true, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const wrap = ref.current
    const inner = innerRef.current
    if (!wrap || !inner) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = wrap.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const xPct = (x / rect.width) - 0.5
    const yPct = (y / rect.height) - 0.5

    const rotateY = xPct * max * 2
    const rotateX = -yPct * max * 2

    inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`

    if (shine && shineRef.current) {
      const shineX = ((x / rect.width) * 100).toFixed(1)
      const shineY = ((y / rect.height) * 100).toFixed(1)
      shineRef.current.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.18) 0%, transparent 50%)`
    }
  }

  function handleMouseLeave() {
    const inner = innerRef.current
    if (inner) inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)'
    if (shineRef.current) shineRef.current.style.background = ''
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
      style={{ transformStyle: 'preserve-3d' }}>
      <div
        ref={innerRef}
        className="transition-transform duration-200 ease-out"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
        {children}
        {shine && (
          <div
            ref={shineRef}
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ mixBlendMode: 'plus-lighter' }} />
        )}
      </div>
    </div>
  )
}
