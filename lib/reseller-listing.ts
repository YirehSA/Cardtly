// The public reseller listing on cardtly.com (Andre, 2026-11-16: a listing is
// a level reward, see lib/reseller-levels).
//
// WHO IS LISTED. A reseller that switched its listing on, from Bronze (100
// cards sold) upwards, while it is active (not on hold or ended), and that
// Cardtly has not taken down. Nobody is listed without choosing it: what they
// type here is shown to anyone on cardtly.com.
//
// WHAT IS SHOWN. Only what the reseller typed into its listing, plus its
// business name and level. Never the seat pool, prices, clients or how many
// cards it has sold.
//
// ORDER. Platinum first, then Gold, Silver and Bronze, which is what the level
// ladder promises; alphabetical within a level.
//
// Pure and client-safe. Relative imports, so scripts/check-reseller-listing can
// compile it on its own.

import { SA_PROVINCES } from './pro-bundle'
import { levelFor, levelRank, type LevelKey } from './reseller-levels'

export const LISTING_PATH = '/find-a-reseller'
/** The first level that is listed. */
export const LISTING_FROM: LevelKey = 'bronze'
export const BLURB_MAX = 240

export interface Listing {
  blurb: string
  city: string
  provinces: string[]
  phone: string
  email: string
  website: string
}

export const EMPTY_LISTING: Listing = { blurb: '', city: '', provinces: [], phone: '', email: '', website: '' }

/** One reseller as the public page shows it. Nothing else leaves the server. */
export interface PublicReseller extends Listing {
  name: string
  level: LevelKey
}

const text = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** A website as typed ("acme.co.za", "https://acme.co.za/team") made safe to
 *  link: http or https only, a real host name, no login details. Null if not. */
export function cleanWebsite(raw: unknown): string | null {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  if (s.length > 200) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.username || u.password) return null
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null
    return u.toString()
  } catch {
    return null
  }
}

/** A phone number as people write them: digits, spaces, +, brackets, dashes. */
export function cleanPhone(raw: unknown): string | null {
  const s = text(raw, 30)
  if (!s) return ''
  if (!/^[0-9+()\s-]+$/.test(s)) return null
  const digits = s.replace(/\D/g, '').length
  return digits >= 9 && digits <= 15 ? s : null
}

/** What a reseller typed, checked. Errors are written for the reseller. */
export function cleanListing(raw: any): { ok: true; listing: Listing } | { ok: false; error: string } {
  const blurbRaw = String(raw?.blurb ?? '').replace(/\s+/g, ' ').trim()
  if (blurbRaw.length > BLURB_MAX) return { ok: false, error: `Keep the description to ${BLURB_MAX} characters.` }
  const asked: string[] = Array.isArray(raw?.provinces) ? raw.provinces.map(String) : []
  const provinces = [...new Set(asked)].filter(p => (SA_PROVINCES as readonly string[]).includes(p))
  if (!provinces.length) return { ok: false, error: 'Choose at least one province you work in.' }
  const phone = cleanPhone(raw?.phone)
  if (phone === null) return { ok: false, error: 'That phone number does not look right.' }
  const email = text(raw?.email, 120).toLowerCase()
  if (email && !EMAIL.test(email)) return { ok: false, error: 'That email address does not look right.' }
  if (!phone && !email) return { ok: false, error: 'Give a phone number or an email address, so people can reach you.' }
  const website = cleanWebsite(raw?.website)
  if (website === null) return { ok: false, error: 'That website address does not look right.' }
  return {
    ok: true,
    listing: {
      blurb: blurbRaw,
      city: text(raw?.city, 60),
      // In the order the provinces are always listed, not the order clicked.
      provinces: (SA_PROVINCES as readonly string[]).filter(p => provinces.includes(p)),
      phone, email, website,
    },
  }
}

/** A stored listing, read tolerantly: whatever is there, never an error. */
export function listingFromRow(raw: unknown): Listing {
  const r: any = raw && typeof raw === 'object' ? raw : {}
  const checked = cleanListing(r)
  if (checked.ok) return checked.listing
  return {
    blurb: text(r.blurb, BLURB_MAX),
    city: text(r.city, 60),
    provinces: (SA_PROVINCES as readonly string[]).filter(p => Array.isArray(r.provinces) && r.provinces.includes(p)),
    phone: cleanPhone(r.phone) || '',
    email: EMAIL.test(text(r.email, 120)) ? text(r.email, 120).toLowerCase() : '',
    website: cleanWebsite(r.website) || '',
  }
}

export type ListingState = 'live' | 'waiting_level' | 'incomplete' | 'inactive' | 'off' | 'blocked'

export function listingState(r: {
  listed: unknown; blocked: unknown; status: unknown; cardsSold: unknown; listing: Listing
}): ListingState {
  if (r.blocked === true) return 'blocked'
  if (r.listed !== true) return 'off'
  if (r.status !== 'active') return 'inactive'
  if (!r.listing.provinces.length || (!r.listing.phone && !r.listing.email)) return 'incomplete'
  if (levelRank(levelFor(r.cardsSold).key) < levelRank(LISTING_FROM)) return 'waiting_level'
  return 'live'
}

/** What the reseller is told about its own listing. */
export const LISTING_STATE_TEXT: Record<ListingState, string> = {
  live: 'Your listing is live on cardtly.com.',
  waiting_level: 'Saved. It goes live on cardtly.com by itself when you reach Bronze (100 cards sold).',
  incomplete: 'Add at least one province, and a phone number or email address, for your listing to show.',
  inactive: 'Your reseller account is not active, so your listing is not shown.',
  off: 'Your listing is switched off, so nothing about you is shown on cardtly.com.',
  blocked: 'Cardtly has taken your listing down. Contact hello@cardtly.com about it.',
}

/** What Cardtly's staff are told about a reseller's listing. */
export const LISTING_STATE_ADMIN: Record<ListingState, string> = {
  live: 'Live on cardtly.com',
  waiting_level: 'Filled in, goes live at Bronze',
  incomplete: 'Switched on but incomplete, not shown',
  inactive: 'Switched on, not shown while not active',
  off: 'Not listed (their choice)',
  blocked: 'Taken down by Cardtly',
}

/** Platinum first, then by level down to Bronze; alphabetical within one. */
export function sortListings<T extends { name: string; level: LevelKey }>(list: T[]): T[] {
  return [...list].sort((a, b) => levelRank(b.level) - levelRank(a.level) || a.name.localeCompare(b.name))
}

/** tel: link for a South African number as people write it. */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `tel:${digits}`
  if (digits.startsWith('0')) return `tel:+27${digits.slice(1)}`
  return `tel:${digits}`
}

/** "acme.co.za" for "https://www.acme.co.za/". */
export function websiteLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** Where a listed reseller works, in one line. */
export function placeLine(l: Pick<Listing, 'city' | 'provinces'>): string {
  const provinces = l.provinces.length === SA_PROVINCES.length ? 'All of South Africa' : l.provinces.join(', ')
  return [l.city, provinces].filter(Boolean).join(' · ')
}
