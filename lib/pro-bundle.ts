// The Pro year + NFC card bundle, in one place.
//
// R999 buys twelve months of Pro and one NFC card in either design, printed
// and shipped within South Africa. From the second year it renews as an
// ordinary yearly subscription at the yearly price, with no new card (Andre,
// 2026-11-12: "Renews at R970 a year", "Either design, same R999").
//
// Safe for the browser: no secrets, no server imports. The server half, which
// talks to Paystack and writes the subscription, is lib/pro-bundle-server.

import { NFC_SHIPPING_RAND, NFC_TIERS, type NfcTier } from './nfc-pricing'
import { SEAT_PRICE_RAND } from './org-billing'

/** What the customer pays today, in rand. */
export const BUNDLE_PRICE_RAND = 999

/** What the package is called, the same wherever it is named: emails, the
 *  admin list, the customer's billing page. */
export const BUNDLE_NAME = 'Pro for a year + NFC card'

/** Marks a Paystack transaction as a bundle purchase, in its metadata. */
export const BUNDLE_ACTION = 'pro_nfc_bundle'

/** The yearly Pro price the bundle renews at from year two. A function rather
 *  than a module constant: see the note in components/marketing/ProPlanPrice
 *  about imported bindings not being ready at module scope during SSR. */
export function bundleRenewalRand(): number {
  return SEAT_PRICE_RAND * 10
}

/** The same things bought separately: a Pro year, the card and its delivery. */
export function bundleSeparateRand(tier: NfcTier = 'standard'): number {
  return bundleRenewalRand() + NFC_TIERS[tier].price + NFC_SHIPPING_RAND
}

/**
 * What the R999 covers, part by part, with what each costs on its own. For
 * showing plainly that the card and its delivery are included, not extra.
 * The card is the standard design's price, marked "from": the custom design
 * costs more on its own and is included for the same R999.
 */
export function bundleParts(): { key: 'pro' | 'card' | 'delivery'; label: string; rand: number; from: boolean }[] {
  return [
    { key: 'pro', label: '12 months of Pro, every feature', rand: bundleRenewalRand(), from: false },
    { key: 'card', label: 'Your NFC card, standard or custom design', rand: NFC_TIERS.standard.price, from: true },
    { key: 'delivery', label: 'Printing and delivery anywhere in South Africa', rand: NFC_SHIPPING_RAND, from: false },
  ]
}

/** What the bundle saves against buying the standard card separately. The
 *  smallest true saving, so the figure advertised is never overstated. */
export function bundleSavingRand(): number {
  return bundleSeparateRand('standard') - BUNDLE_PRICE_RAND
}

export const BUNDLE_COLOURS = ['black', 'white'] as const
export type BundleColour = (typeof BUNDLE_COLOURS)[number]

export const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
] as const

/**
 * When the renewal is first charged: the same day a year after the payment.
 * A purchase on 29 February renews on 28 February, never 1 March, so the
 * customer is not charged a day after the year they paid for has ended and
 * never loses a day either.
 */
export function bundleRenewalDate(paidAt: Date): Date {
  const y = paidAt.getUTCFullYear() + 1
  const m = paidAt.getUTCMonth()
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(paidAt.getUTCDate(), lastDay),
    paidAt.getUTCHours(), paidAt.getUTCMinutes(), paidAt.getUTCSeconds()))
}

export interface BundleOrder {
  tier: NfcTier
  colour: BundleColour
  nameOnCard: string
  titleOnCard: string | null
  address: string
  city: string
  province: string
  postalCode: string
}

const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/**
 * The card and delivery details, checked the same way in the browser and on
 * the server. Everything that decides the price comes from the server: the
 * browser sends which design was chosen and never a figure.
 */
export function parseBundleOrder(raw: any): { ok: true; order: BundleOrder } | { ok: false; error: string } {
  const tier = raw?.tier === 'custom' ? 'custom' : raw?.tier === 'standard' ? 'standard' : null
  if (!tier) return { ok: false, error: 'Choose a card design.' }
  const colour = (BUNDLE_COLOURS as readonly string[]).includes(raw?.colour) ? raw.colour as BundleColour : null
  if (!colour) return { ok: false, error: 'Choose a card colour.' }

  const nameOnCard = text(raw?.nameOnCard, 60)
  if (!nameOnCard) return { ok: false, error: 'Add the name to print on the card.' }
  const titleOnCard = text(raw?.titleOnCard, 80) || null

  const address = text(raw?.address, 200)
  const city = text(raw?.city, 80)
  const province = text(raw?.province, 40)
  const postalCode = text(raw?.postalCode, 10).replace(/\s/g, '')
  if (!address || !city) return { ok: false, error: 'Add the street address and city to deliver to.' }
  if (!(SA_PROVINCES as readonly string[]).includes(province)) return { ok: false, error: 'Choose a province.' }
  if (!/^\d{4}$/.test(postalCode)) return { ok: false, error: 'A South African postal code has 4 digits.' }

  return { ok: true, order: { tier, colour, nameOnCard, titleOnCard, address, city, province, postalCode } }
}
