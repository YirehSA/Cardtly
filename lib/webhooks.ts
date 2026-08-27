import crypto from 'crypto'

// Sending a captured lead to whatever system the customer runs.
//
// Everything here is a pure function of its inputs, so the payload shape, the
// signature and the retry schedule can be compiled and tested on their own.
// The database work lives in lib/webhook-dispatch.
//
// The rule the whole design serves: capturing a lead must never depend on
// somebody else's server being up. The lead is saved first and always;
// delivery is queued afterwards and retried on its own time. A CRM outage
// costs the customer a delay, never a lead.

export const LEAD_CREATED = 'lead.created'

/** Events a webhook can subscribe to. One for now, named so more can follow. */
export const WEBHOOK_EVENTS = [LEAD_CREATED] as const

export type LeadPayload = {
  event: string
  /** ISO, when the delivery was built. */
  sent_at: string
  lead: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    work_phone: string | null
    company: string | null
    title: string | null
    website: string | null
    address: string | null
    message: string | null
    source: string | null
    answers: unknown
    captured_at: string | null
  }
  card: {
    id: string | null
    name: string | null
    slug: string | null
    url: string | null
    type: 'team' | 'personal'
  }
  organization: { id: string | null; name: string | null }
}

/**
 * The JSON a receiving system gets.
 *
 * Flat, fully spelled out, and stable. A CRM mapping is configured once by
 * somebody who is not going to revisit it, so renaming a field later breaks
 * an integration silently: the field simply stops arriving and the CRM records
 * a blank. Add fields, never rename them.
 */
export function buildLeadPayload(opts: {
  contact: Record<string, any>
  card: { id: string | null; name: string | null; slug: string | null; isTeam: boolean } | null
  org: { id: string | null; name: string | null } | null
  appUrl: string
  sentAt: string
}): LeadPayload {
  const { contact, card, org, appUrl, sentAt } = opts
  return {
    event: LEAD_CREATED,
    sent_at: sentAt,
    lead: {
      id: contact.id,
      name: contact.name ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      work_phone: contact.work_phone ?? null,
      company: contact.company ?? null,
      title: contact.title ?? null,
      website: contact.website ?? null,
      address: contact.address ?? null,
      message: contact.message ?? null,
      source: contact.source ?? null,
      answers: contact.answers ?? null,
      captured_at: contact.created_at ?? null,
    },
    card: {
      id: card?.id ?? null,
      name: card?.name ?? null,
      slug: card?.slug ?? null,
      url: card?.slug ? `${appUrl}/card/${card.slug}` : null,
      type: card?.isTeam ? 'team' : 'personal',
    },
    organization: { id: org?.id ?? null, name: org?.name ?? null },
  }
}

/**
 * Signature for a delivery.
 *
 * The timestamp is signed with the body rather than sent beside it, so a
 * captured request cannot be replayed later with a fresh timestamp. Receivers
 * should reject anything older than a few minutes.
 */
export function signBody(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

/** Header set every delivery carries. */
export function deliveryHeaders(opts: {
  secret: string | null
  timestamp: string
  body: string
  event: string
  deliveryId: string
  extra?: Record<string, string> | null
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Cardtly-Webhook/1',
    'X-Cardtly-Event': opts.event,
    'X-Cardtly-Delivery': opts.deliveryId,
    'X-Cardtly-Timestamp': opts.timestamp,
    ...(opts.extra || {}),
  }
  if (opts.secret) {
    headers['X-Cardtly-Signature'] = `sha256=${signBody(opts.secret, opts.timestamp, opts.body)}`
  }
  return headers
}

/**
 * Is this failure worth trying again?
 *
 * A 4xx means the receiver understood and refused, and will refuse the same
 * body every time - retrying it just sends four copies of a rejection. The
 * exceptions are 408 and 429, which explicitly mean "later".
 *
 * status 0 stands for never got a response: DNS, refused connection, timeout.
 * Those are exactly what retrying is for.
 */
export function shouldRetry(status: number, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false
  if (status === 0) return true
  if (status === 408 || status === 429) return true
  return status >= 500
}

/**
 * Backoff, in minutes, before attempt N is tried again.
 *
 * Spread wide on purpose. A CRM that is down is usually down for longer than
 * a minute, and hammering it for the whole window helps nobody: the last try
 * lands over half an hour later, by which time a short outage has ended.
 */
export function retryDelayMinutes(attempt: number): number {
  const schedule = [1, 5, 30, 120]
  return schedule[Math.min(attempt, schedule.length) - 1] ?? 120
}

export function nextRetryAt(attempt: number, now: Date): Date {
  return new Date(now.getTime() + retryDelayMinutes(attempt) * 60_000)
}

/** A URL a customer may point a webhook at. */
export function validateWebhookUrl(raw: string): { url: string } | { error: string } {
  let parsed: URL
  try {
    parsed = new URL(String(raw || '').trim())
  } catch {
    return { error: 'That is not a valid web address.' }
  }
  // https only. A webhook carries a person's name, email and phone number, and
  // http would put all three on the wire in clear text.
  if (parsed.protocol !== 'https:') {
    return { error: 'The address must start with https, because the lead includes contact details.' }
  }
  const host = parsed.hostname.toLowerCase()
  // Refuse anything that resolves inside our own network. A URL pointing at
  // localhost or a private range turns this into a way to make Cardtly's
  // servers fetch Cardtly's own internal endpoints on request.
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  if (blocked) return { error: 'That address points inside a private network, so nothing could reach it.' }
  return { url: parsed.toString() }
}

export function newWebhookSecret(): string {
  return crypto.randomBytes(24).toString('base64url')
}
