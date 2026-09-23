import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import {
  estimateCurrencyFor, ESTIMATE_CURRENCIES, FALLBACK_RATE, SANE_RATE, type EstimateCurrency,
} from '@/lib/price-currency'

// Which currency to show this visitor a price estimate in, and the live rate
// to compute it. Billing is always in ZAR via Paystack; this is purely a
// "here's roughly what that is in your money" courtesy: pounds in the UK,
// euros across Europe, dollars everywhere else, and nothing at all in the
// rand zone (South Africa, Namibia, Lesotho, Eswatini). The mapping lives in
// lib/price-currency so the build can test it.
//
// Country comes from Vercel's geo header (free, no third-party geo call).

export const dynamic = 'force-dynamic' // per-request geo, never cache the response

// All three rates from one call, with a two-source fallback chain, each
// cached an hour (so at most one upstream call per source per hour across all
// visitors). A source is used only if every rate it gives is plausible;
// otherwise the next is tried, and the fallback rates only if both fail.
async function liveRates(): Promise<Record<EstimateCurrency, number>> {
  const usable = (rates: any): Record<EstimateCurrency, number> | null => {
    const out = {} as Record<EstimateCurrency, number>
    for (const c of ESTIMATE_CURRENCIES) {
      const n = rates?.[c]
      const [lo, hi] = SANE_RATE[c]
      if (typeof n !== 'number' || !(n > lo && n < hi)) return null
      out[c] = n
    }
    return out
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/ZAR', { next: { revalidate: 3600 } })
    const got = usable((await res.json())?.rates)
    if (got) return got
  } catch { /* try next */ }

  try {
    // Frankfurter moved from api.frankfurter.app, which now only redirects.
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=ZAR&symbols=USD,EUR,GBP', { next: { revalidate: 3600 } })
    const got = usable((await res.json())?.rates)
    if (got) return got
  } catch { /* fall through */ }

  return FALLBACK_RATE
}

export async function GET() {
  const h = await headers()
  // Local development has no Vercel geo header, so nothing international can
  // be looked at. An fx_country cookie stands in for it there, and only there.
  const devCountry = process.env.NODE_ENV !== 'production'
    ? (await cookies()).get('fx_country')?.value
    : undefined
  const country = (devCountry || h.get('x-vercel-ip-country') || '').toUpperCase()

  const currency = estimateCurrencyFor(country)
  const rate = currency ? (await liveRates())[currency] : 0

  return NextResponse.json({ country, currency, rate })
}
