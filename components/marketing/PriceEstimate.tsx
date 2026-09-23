'use client'

import { useEffect, useState } from 'react'
import { formatEstimate, type EstimateCurrency } from '@/lib/price-currency'

// Shows "≈ £4.50", "≈ €5" or "≈ $6" next to a rand price, in the visitor's
// own currency as /api/pricing/fx decides it: pounds in the UK, euros across
// Europe, dollars everywhere else. Renders nothing in South Africa, Namibia,
// Lesotho and Eswatini, and nothing until the rate is known (so there's no
// flash of a wrong number). Billing is always ZAR - this is an estimate,
// hence the ≈.

interface Fx { currency: EstimateCurrency | null; rate: number }

// Module-level cache so multiple estimates on one page share a single network
// request instead of each firing its own.
let cached: Fx | null = null
let inflight: Promise<Fx> | null = null

function getFx(): Promise<Fx> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetch('/api/pricing/fx')
      .then(r => r.json())
      .then(d => {
        const currency = d?.currency === 'USD' || d?.currency === 'EUR' || d?.currency === 'GBP' ? d.currency : null
        cached = { currency, rate: Number(d?.rate) || 0 }
        return cached
      })
      .catch(() => {
        cached = { currency: null, rate: 0 }
        return cached
      })
  }
  return inflight
}

function useFx(): Fx | null {
  const [fx, setFx] = useState<Fx | null>(cached)

  useEffect(() => {
    let alive = true
    getFx().then(f => { if (alive) setFx(f) })
    return () => { alive = false }
  }, [])

  return fx
}

interface Props {
  zar: number
  suffix?: string        // e.g. '/mo', '/yr', ''
  className?: string
}

export default function PriceEstimate({ zar, suffix = '', className }: Props) {
  const fx = useFx()
  if (!fx || !fx.currency || !fx.rate) return null

  return (
    <span className={className}>≈ {formatEstimate(zar * fx.rate, fx.currency)}{suffix}</span>
  )
}

/**
 * What the estimate is NOT: the charge. Shown to the same visitors who see an
 * estimate, wherever a price leads to paying.
 *
 * Paystack cannot charge a South African business's customers in anything but
 * rand (USD is Kenya and Nigeria only, and there is no EUR or GBP), so a
 * foreign card's own bank does the conversion, at its rate, sometimes with a
 * fee. A "£4.50" with nothing next to it reads as the price, and the statement
 * then shows something else. Visa's rules also want the transaction currency
 * stated before a card is stored for recurring charges.
 */
export function RandChargeNote({ className, currencyStated = false }: {
  className?: string
  /** The surrounding text already says "charged in South African rand (ZAR)",
   *  as the checkouts' terms do: say only what the bank does. */
  currencyStated?: boolean
}) {
  const fx = useFx()
  if (!fx || !fx.currency) return null

  return (
    <span className={className}>
      {currencyStated
        ? 'If your card is from outside South Africa, your bank converts the rand amount at its own rate and may add a foreign-card fee.'
        : 'Charged in South African rand (ZAR). Your bank converts it at its own rate and may add a foreign-card fee.'}
    </span>
  )
}
