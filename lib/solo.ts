// Cardtly Solo (Andre, 2026-11-20): a single-person card for less than Pro.
//
// WHAT IT IS. R49 a month or R450 a year. Resellers pay R35 a month or R350 a
// year for each one. One person, one card: never a team or a department.
//
// WHAT IT GETS. Everything a normal card has, with these limits:
//   - 5 templates: Classic, Modern, Wave, Split and Neon
//   - at most 4 links and 2 gallery images
//   - no lead capture (questionnaire, contact form, Context) and no "book a
//     meeting". The simple "share your details back" prompt after Save
//     Contact stays: it is what fills the Contacts page, which Solo includes.
// In the dashboard, beside the card itself: the QR Code page and Contacts.
// NFC card ordering stays (Andre left the recommendation unchanged). Everything
// else (analytics, email signature, virtual backgrounds, scan card, the
// Network, the Lead capture page, team cards) is Pro.
//
// A plan that drops to Solo keeps everything it had: what is over the limits
// is hidden on the live card, never deleted, and comes back with Pro.
//
// Client-safe. The single place these rules live; scripts/check-solo holds them.

import type { UserPlan } from '../types/database'
import { IMAGE_SLOTS, parseDesign, serializeDesign, type CardDesign } from '../types/design'

export const SOLO_NAME = 'Solo'
export const SOLO_FULL_NAME = 'Cardtly Solo'

// The prices live in lib/plan-prices (no imports, so the emails can use them).
import { PRO_PRICE_RAND, SOLO_PRICE_RAND } from './plan-prices'
export { PRO_PRICE_RAND, SOLO_PRICE_RAND, SOLO_RESELLER_RAND } from './plan-prices'

export const SOLO_TEMPLATES = ['classic', 'modern', 'wave', 'split', 'neon'] as const
export const SOLO_MAX_LINKS = 4
export const SOLO_MAX_IMAGES = 2

export type PaidTier = 'pro' | 'solo'
export type BillingCycle = 'monthly' | 'yearly'

/** Any live card plan: Pro or Solo, paid, trialling or covered by a team. */
export function hasCard(plan: Pick<UserPlan, 'tier' | 'isActive'>): boolean {
  return plan.isActive && (plan.tier === 'pro' || plan.tier === 'solo')
}

export function isSolo(plan: Pick<UserPlan, 'tier' | 'isActive'>): boolean {
  return plan.isActive && plan.tier === 'solo'
}

/** Whether a template may be shown for this tier. Pro: all of them. */
export function templateAllowed(tier: string | null | undefined, templateId: string | null | undefined): boolean {
  if (tier !== 'solo') return true
  return (SOLO_TEMPLATES as readonly string[]).includes(String(templateId || 'classic'))
}

/** The template a Solo card is shown in: its own if allowed, else Classic. */
export function soloTemplate(templateId: string | null | undefined): string {
  return templateAllowed('solo', templateId) ? String(templateId || 'classic') : 'classic'
}

/** How many links and gallery images a tier shows. Null: no limit here. */
export function linkLimit(tier: string | null | undefined): number | null {
  return tier === 'solo' ? SOLO_MAX_LINKS : null
}
export function imageLimit(tier: string | null | undefined): number | null {
  return tier === 'solo' ? SOLO_MAX_IMAGES : null
}

/**
 * A card as a Solo plan shows it, for the public card and its previews. The
 * stored card is never changed: this is a copy, so going back to Pro shows
 * everything again.
 *   - links 5 and up, and gallery images 3 and up, are left out (by slot, so
 *     the editor's first four link boxes are exactly what shows)
 *   - a template outside the five becomes Classic, and booking is off
 *   - the questionnaire and Context are off, and the Cardtly
 *     badge shows (switching it off is Pro)
 * The "share your details" form is switched off by the renderer's leadCapture
 * flag, since it is not an add-on.
 */
export function soloCardView<T extends Record<string, any>>(card: T): T {
  const out: Record<string, any> = { ...card }
  // To 20: extractLinks reads further than the editor offers, and nothing past
  // four may show.
  for (let i = SOLO_MAX_LINKS + 1; i <= 20; i++) {
    out[`link_${i}_title`] = null
    out[`link_${i}_url`] = null
    out[`link_${i}_image_url`] = null
  }
  for (const i of IMAGE_SLOTS) {
    if (i <= SOLO_MAX_IMAGES) continue
    out[`image_${i}_url`] = null
    out[`image_${i}_link`] = null
    out[`image_${i}_title`] = null
  }
  const design = parseDesign(card.color_theme ?? null)
  out.color_theme = serializeDesign({ ...design, templateId: soloTemplate(design.templateId) as CardDesign['templateId'], showBooking: false })
  // The simple "share your details back" prompt after Save Contact STAYS: it
  // is the only thing that fills Solo's Contacts page, which Andre included.
  // The questionnaire, Context and the share-your-details form are the lead
  // capture Solo does not have.
  const addons = card.addons && typeof card.addons === 'object' ? { ...card.addons } : {}
  addons.questionnaireEnabled = false
  delete addons.context
  delete addons.cardtlyBadge
  out.addons = addons
  return out as T
}

/** The dashboard pages a Solo account is shown in its menus. Everything else
 *  is Pro, and is simply not in a Solo menu (Andre: "only QR code and
 *  Contacts"). Both navs filter through soloShows, so they cannot disagree. */
export const SOLO_DASHBOARD_PAGES = [
  '/dashboard', '/dashboard/card', '/dashboard/qr', '/dashboard/contacts',
  '/dashboard/nfc', '/dashboard/how-to', '/dashboard/settings',
] as const

export function soloShows(href: string): boolean {
  return (SOLO_DASHBOARD_PAGES as readonly string[]).includes(href)
}

/** The saving on a year against twelve months. */
export function yearlySavingRand(tier: PaidTier): number {
  const p = tier === 'solo' ? SOLO_PRICE_RAND : PRO_PRICE_RAND
  return p.monthly * 12 - p.yearly
}
