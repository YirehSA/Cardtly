import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/visitor-hash'

// Keeping the public lead forms from being flooded (2026-11-03).
//
// /api/contact, /api/bookings/request and /api/questionnaire/submit are open to
// anyone on the internet, write a contact, and email the card owner (and a
// booking emails the address typed in, too). With nothing in front of them a
// script could fill a customer's contacts with junk, bury their real leads,
// run up our email sending, or use a meeting request to mail a stranger
// through Cardtly. POPIA section 19 asks for reasonable safeguards against
// exactly that kind of interference.
//
// FOUR LAYERS, each cheap:
//
//   1. A hidden field (HONEYPOT_FIELD) that people never see and form-filling
//      bots fill in. A filled one gets a normal "thanks" and is dropped, so the
//      bot learns nothing.
//   2. Length caps on every field, so a single request cannot store or email a
//      novel.
//   3. Rate limits, counted in the database (migration 104, lead_rate_take):
//        per visitor (connection + browser)   LIMITS.visitor10m in 10 minutes,
//                                             LIMITS.visitorDay in a day
//        per network (connection only)        LIMITS.network10m in 10 minutes,
//                                             LIMITS.networkDay in a day
//        per card                             LIMITS.cardHour in an hour
//      The network limit is far looser than the visitor one on purpose: a
//      whole expo hall on the venue Wi-Fi, or a mobile network's shared
//      address, is one network and many honest people.
//   4. A booking emails its receipt to the typed address at most
//      RECEIPTS_PER_ADDRESS times a day (in the route itself).
//
// NO IP ADDRESS IS KEPT. The keys are keyed hashes that change every day, the
// same construction as lib/visitor-hash, and the rows are deleted after two
// days. Unlike the visitor hash they are not scoped to one card, because the
// whole point is to notice one source hitting many cards.
//
// FAILING OPEN, deliberately. If the limit cannot be checked (no key, the
// function missing before its migration, a database error) the lead goes
// through. A flood is an inconvenience; a real lead lost to our own fault is
// the thing this product exists to prevent.
//
// scripts/check-lead-guard holds all of this.

export const LIMITS = {
  visitor10m: 6,
  visitorDay: 40,
  network10m: 30,
  networkDay: 300,
  cardHour: 200,
} as const

export const RECEIPTS_PER_ADDRESS = 3

export const FIELD_MAX = {
  name: 200,
  email: 254,
  phone: 40,
  company: 200,
  message: 4000,
} as const

/** The hidden field's JSON key. The input itself is named to look like
 *  something no browser autofills (components/card/Honeypot). */
export const HONEYPOT_FIELD = 'hp'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const TOO_MANY_MESSAGE =
  'Too many messages from this connection in a short time. Please wait a few minutes and try again.'

function secret(): string {
  return process.env.ANALYTICS_VISITOR_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function hmac(parts: string[]): string {
  return crypto.createHmac('sha256', secret()).update(parts.join('\n')).digest('hex').slice(0, 32)
}

/** The two keys for this request, or null when there is no key to hash with. */
export function leadKeys(headers: Headers, now: Date = new Date()): { visitor: string; network: string } | null {
  if (!secret()) return null
  const day = now.toISOString().slice(0, 10)
  const ip = clientIp(headers) || ''
  const ua = (headers.get('user-agent') || '').slice(0, 400)
  return {
    visitor: hmac([day, 'lead-visitor', ip, ua]),
    network: hmac([day, 'lead-network', ip]),
  }
}

/** True when the hidden field came back filled in: a bot, not a person. */
export function isBotSubmission(body: unknown): boolean {
  const v = (body as Record<string, unknown> | null)?.[HONEYPOT_FIELD]
  return typeof v === 'string' && v.trim() !== ''
}

/** What a bot is told: the same as a person, so it learns nothing. */
export function botResponse(): NextResponse {
  return NextResponse.json({ success: true })
}

/**
 * The first field over its cap, as a message the visitor can act on, or null.
 * Keys are FIELD_MAX names; values are whatever the form sent.
 */
export function overLong(fields: Partial<Record<keyof typeof FIELD_MAX, unknown>>): string | null {
  for (const [k, v] of Object.entries(fields) as [keyof typeof FIELD_MAX, unknown][]) {
    if (typeof v === 'string' && v.trim().length > FIELD_MAX[k]) {
      return k === 'message'
        ? `Please keep the message under ${FIELD_MAX.message} characters.`
        : `That ${k} is too long. Please check it.`
    }
  }
  return null
}

/**
 * Takes one slot for this submission, or answers 429. cardKey is the card id
 * the form named, as sent: a script trying made-up ids still spends its own
 * visitor and network allowance.
 */
export async function takeLeadSlot(admin: any, request: Request, cardKey: string): Promise<NextResponse | null> {
  const keys = leadKeys(request.headers)
  if (!keys) return null
  try {
    const { data, error } = await admin.rpc('lead_rate_take', {
      p_visitor: keys.visitor,
      p_network: keys.network,
      p_card: String(cardKey).slice(0, 64),
    })
    if (error) {
      console.error('lead rate check failed (allowing):', error.code, error.message)
      return null
    }
    if (!data) return null
    return NextResponse.json({ error: TOO_MANY_MESSAGE }, { status: 429, headers: { 'Retry-After': '600' } })
  } catch (e) {
    console.error('lead rate check threw (allowing):', e)
    return null
  }
}
