import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'

// Returns whether to show a USD estimate for this visitor and the live
// ZAR->USD rate to compute it. Billing is always in ZAR via Paystack;
// this is purely a "here's roughly what that is in dollars" courtesy
// for visitors who don't think in rand.
//
// Country comes from Vercel's geo header (free, no third-party geo
// call). Visitors in the Common Monetary Area - South Africa, Namibia,
// Lesotho, Eswatini - use the rand (or a 1:1 rand-pegged currency), so
// they see ZAR only. Everyone else gets the USD estimate.

export const dynamic = 'force-dynamic' // per-request geo, never cache the response

// Common Monetary Area: rand is legal tender or pegged 1:1.
const RAND_COUNTRIES = new Set(['ZA', 'NA', 'LS', 'SZ'])

// Fallback if every FX source is unreachable. Refreshed 2026-09-23, when the
// live rate was 0.0617 (about R16.20 to the dollar); it was 0.054 (R18.50),
// which would have shown an outage as a dollar price 12% too low.
const FALLBACK_ZAR_TO_USD = 0.06

// Live ZAR->USD with a two-source fallback chain, each cached an hour
// (so at most one upstream call per source per hour across all
// visitors). Returns the hardcoded floor only if both fail. A sane
// guard (0.02-0.2) rejects garbage responses.
async function liveRate(): Promise<number> {
  const sane = (n: unknown): n is number => typeof n === 'number' && n > 0.02 && n < 0.2

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/ZAR', { next: { revalidate: 3600 } })
    const data = await res.json()
    if (sane(data?.rates?.USD)) return data.rates.USD
  } catch { /* try next */ }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=ZAR&to=USD', { next: { revalidate: 3600 } })
    const data = await res.json()
    if (sane(data?.rates?.USD)) return data.rates.USD
  } catch { /* fall through */ }

  return FALLBACK_ZAR_TO_USD
}

export async function GET() {
  const h = await headers()
  // Local development has no Vercel geo header, so nothing international can
  // be looked at. An fx_country cookie stands in for it there, and only there.
  const devCountry = process.env.NODE_ENV !== 'production'
    ? (await cookies()).get('fx_country')?.value
    : undefined
  const country = (devCountry || h.get('x-vercel-ip-country') || '').toUpperCase()
  // No country (local dev, unknown) -> don't show USD; rand is the
  // honest default for an SA-first product.
  const showUsd = country.length === 2 && !RAND_COUNTRIES.has(country)

  let zarToUsd = FALLBACK_ZAR_TO_USD
  if (showUsd) {
    zarToUsd = await liveRate()
  }

  return NextResponse.json({ country, showUsd, zarToUsd })
}
