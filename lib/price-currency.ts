// Which currency a visitor's price ESTIMATE is shown in, and how it is written.
//
// Every Cardtly charge is in rand: a South African Paystack account cannot
// charge in anything else. This only decides the courtesy figure shown next to
// the rand price, so a visitor reads it in the currency they think in: pounds
// in the UK, euros across Europe, dollars everywhere else. Pure, so the build
// runs it (scripts/check-charge-currency.mjs).

export type EstimateCurrency = 'USD' | 'EUR' | 'GBP'
export const ESTIMATE_CURRENCIES: EstimateCurrency[] = ['USD', 'EUR', 'GBP']

// Common Monetary Area: the rand is legal tender, or pegged to it 1:1. These
// visitors already read R97 in their own money, so they get no estimate.
export const RAND_COUNTRIES = new Set(['ZA', 'NA', 'LS', 'SZ'])

// The UK, the Crown Dependencies, and Gibraltar, whose pound is pegged 1:1.
const GBP_COUNTRIES = new Set(['GB', 'IM', 'JE', 'GG', 'GI'])

// Europe. The eurozone (Bulgaria joined on 1 January 2026) and the places that
// use the euro without being members, then the rest of the continent: for a
// Swede or a Pole a euro figure is still far closer to home than a dollar one,
// and their bank converts from rand either way.
const EUR_COUNTRIES = new Set([
  // Eurozone
  'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
  // Euro without membership
  'AD', 'MC', 'SM', 'VA', 'ME', 'XK', 'AX',
  // The rest of the EU, the EEA and Switzerland
  'CZ', 'DK', 'HU', 'PL', 'RO', 'SE', 'IS', 'LI', 'NO', 'CH',
  // Other European countries
  'AL', 'BA', 'MK', 'RS', 'MD', 'UA', 'FO',
])

/** The estimate currency for a two-letter country code, or null for none. */
export function estimateCurrencyFor(country: string | null | undefined): EstimateCurrency | null {
  const c = String(country || '').trim().toUpperCase()
  // Unknown (local development, a proxy): no estimate. Rand is the honest
  // default for a South African product.
  if (!/^[A-Z]{2}$/.test(c)) return null
  if (RAND_COUNTRIES.has(c)) return null
  if (GBP_COUNTRIES.has(c)) return 'GBP'
  if (EUR_COUNTRIES.has(c)) return 'EUR'
  return 'USD'
}

const SYMBOL: Record<EstimateCurrency, string> = { USD: '$', EUR: '€', GBP: '£' }

/** An approximate amount, rounded the way an approximation should read:
 *  small amounts to the nearest half (£4.37 is "£4.50"), larger ones to the
 *  nearest whole unit (€52.3 is "€52"). Precise decimals on an estimate
 *  promise an accuracy the bank's rate will not keep. */
export function formatEstimate(amount: number, currency: EstimateCurrency): string {
  const n = amount < 10
    ? (Math.round(amount * 2) / 2).toFixed(2).replace(/\.00$/, '')
    : String(Math.round(amount))
  return `${SYMBOL[currency]}${n}`
}

// Units of each currency per rand. Outside these bounds a rate source is
// returning garbage, and the fallback is used instead.
export const SANE_RATE: Record<EstimateCurrency, [number, number]> = {
  USD: [0.02, 0.2],
  EUR: [0.02, 0.2],
  GBP: [0.015, 0.15],
}

// Used only when every live source fails. Set 2026-09-23 from the live rates:
// R16.21 to the dollar, R18.56 to the euro, R21.63 to the pound.
export const FALLBACK_RATE: Record<EstimateCurrency, number> = {
  USD: 0.0617,
  EUR: 0.0539,
  GBP: 0.0462,
}
