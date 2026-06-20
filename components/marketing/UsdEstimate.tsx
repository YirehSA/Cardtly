'use client'

import { useEffect, useState } from 'react'

// Shows "≈ $X" next to a rand price for visitors outside the rand zone.
// Renders nothing for South Africa / Namibia / Lesotho / Eswatini, and
// nothing until the rate is known (so there's no flash of a wrong
// number). Billing is always ZAR - this is an estimate, hence the ≈.

interface Fx { showUsd: boolean; rate: number }

// Module-level cache so multiple <UsdEstimate> on one page share a
// single network request instead of each firing its own.
let cached: Fx | null = null
let inflight: Promise<Fx> | null = null

function getFx(): Promise<Fx> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetch('/api/pricing/fx')
      .then(r => r.json())
      .then(d => {
        cached = { showUsd: !!d.showUsd, rate: Number(d.zarToUsd) || 0 }
        return cached
      })
      .catch(() => {
        cached = { showUsd: false, rate: 0 }
        return cached
      })
  }
  return inflight
}

function formatUsd(usd: number): string {
  // Small amounts to the nearest half-dollar (R65 -> $3.50), larger to
  // the nearest dollar (R600 -> $32) - precise decimals read oddly on
  // an approximation.
  if (usd < 10) return (Math.round(usd * 2) / 2).toFixed(2).replace(/\.00$/, '')
  return String(Math.round(usd))
}

interface Props {
  zar: number
  suffix?: string        // e.g. '/mo', '/yr', ''
  className?: string
}

export default function UsdEstimate({ zar, suffix = '', className }: Props) {
  const [fx, setFx] = useState<Fx | null>(cached)

  useEffect(() => {
    let alive = true
    getFx().then(f => { if (alive) setFx(f) })
    return () => { alive = false }
  }, [])

  if (!fx || !fx.showUsd || !fx.rate) return null

  return (
    <span className={className}>≈ ${formatUsd(zar * fx.rate)}{suffix}</span>
  )
}
