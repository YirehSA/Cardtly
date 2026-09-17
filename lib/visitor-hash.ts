import crypto from 'crypto'

/**
 * A per-card, per-day identifier for an anonymous card visitor.
 *
 * WHAT IT IS FOR. Card events carry no notion of who arrived, which is why a
 * duplicate view could only ever be guessed at. The attempt to clean the
 * historical ones showed how weak the guess is: device+browser+os was the only
 * fingerprint available, "desktop / Chrome / Windows" matches thousands of
 * people, and on a card getting bursty email traffic two strangers arriving
 * three seconds apart are indistinguishable from one browser loading twice.
 * Measured against its own background rate, that method could not tell 142
 * candidate duplicates from about 20 real ones. This makes the question
 * answerable instead of arguable.
 *
 * WHAT IT IS DELIBERATELY NOT. It is not a user id and it cannot become one:
 *
 *   HMAC, not a plain hash.  The IPv4 space is 2^32 and a user agent string is
 *   guessable, so a bare sha256 of them is reversible by anybody holding the
 *   table - you simply hash every candidate until one matches. Keying it with
 *   a secret that never leaves the server makes that impossible without the
 *   secret.
 *
 *   Rotates daily.  The date is part of the input, so the same visitor is a
 *   different value tomorrow. Today's duplicates and today's unique visitors
 *   are answerable; following somebody across weeks is not.
 *
 *   Scoped to one card.  The card id is part of the input, so the same person
 *   viewing two cards produces two unrelated values. Nothing here can build a
 *   picture of one person's browsing across the platform, which is a
 *   capability this product has no reason to have. Deduplication only ever
 *   compares within a single card, so the scoping costs nothing.
 *
 * The raw IP is never stored, and no value derived from it survives the day.
 */

/** 128 bits, hex. Long enough that collisions are not a practical concern and
 *  short enough to index comfortably. */
const LENGTH = 32

/**
 * The key. A dedicated secret is preferred, but falling back to the service
 * role key means this works the moment it deploys rather than silently
 * producing nothing until somebody remembers to set an env var on Vercel -
 * and a visitor hash that is quietly always null is worse than useless,
 * because it looks like data. Both are server-only and neither reaches the
 * browser. Setting ANALYTICS_VISITOR_SALT and rotating it invalidates every
 * previous hash, which is a feature rather than a problem.
 */
function secret(): string {
  return process.env.ANALYTICS_VISITOR_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

/** The client address, as far forward as the proxy chain can be trusted. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // The left-most entry is the original client; everything after it is
    // proxies. Vercel appends rather than replaces, so this is the visitor.
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || null
}

export function visitorHash(opts: {
  ip: string | null
  userAgent: string | null
  /** The card this event belongs to. Scoping, not decoration. */
  scope: string
  /** Injectable so the rotation can be tested rather than waited for. */
  now?: Date
}): string | null {
  const key = secret()
  // No key means no hash. Storing an unkeyed digest of an IP would be the one
  // outcome worse than storing nothing.
  if (!key) return null
  // Nothing to identify with. A null column says "unknown", which is honest;
  // a hash of two empty strings would collide every such visitor into one.
  if (!opts.ip && !opts.userAgent) return null
  if (!opts.scope) return null

  const day = (opts.now ?? new Date()).toISOString().slice(0, 10)
  return crypto
    .createHmac('sha256', key)
    // Newline separated so that a value ending where the next begins cannot
    // be rearranged into the same input by a different visitor.
    .update([day, opts.scope, opts.ip ?? '', opts.userAgent ?? ''].join('\n'))
    .digest('hex')
    .slice(0, LENGTH)
}
