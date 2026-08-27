import crypto from 'crypto'

// Issuing and checking API keys.
//
// Pure functions of their inputs, so the format, the hashing and the
// permission rules can be compiled and tested on their own. The database work
// is in lib/api-auth.
//
// The key itself is never stored. Only its SHA-256 hash and a short preview
// are, so a copy of the database is not a set of working credentials, and
// "what was my key again" has exactly one honest answer: issue a new one.

/** ck for Cardtly key. The prefix makes a leaked key recognisable on sight. */
const PREFIX = 'ck_'

export type Permission = 'leads:read' | 'cards:read' | 'departments:read'
export const ALL_PERMISSIONS: Permission[] = ['leads:read', 'cards:read', 'departments:read']

export function generateApiKey(): { key: string; hash: string; preview: string } {
  const key = PREFIX + crypto.randomBytes(24).toString('base64url')
  return { key, hash: hashApiKey(key), preview: previewOf(key) }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * What the owner sees in the list afterwards.
 *
 * Enough to tell two keys apart when revoking one, never enough to use. The
 * tail is shown rather than more of the head because the head is a fixed
 * prefix and carries no information.
 */
export function previewOf(key: string): string {
  return `${PREFIX}…${key.slice(-4)}`
}

export function looksLikeApiKey(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX) && value.length >= 20
}

/**
 * Compare two hashes without leaking how much of them matched.
 *
 * A plain === returns as soon as a byte differs, and the time it took is a
 * measurement of how many bytes were right. Over enough requests that is
 * enough to reconstruct a hash a character at a time.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // signal, so unequal lengths are compared against a fixed-length copy.
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba)
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

/** Pull the key out of an Authorization header. */
export function keyFromHeader(header: string | null | undefined): string | null {
  if (!header) return null
  const m = String(header).match(/^Bearer\s+(\S+)$/i)
  const value = m ? m[1] : String(header).trim()
  return looksLikeApiKey(value) ? value : null
}

export function hasPermission(granted: unknown, needed: Permission): boolean {
  if (!Array.isArray(granted)) return false
  return granted.includes(needed)
}

export function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  return Number.isFinite(t) && t <= now.getTime()
}

/**
 * Paging that does not drift.
 *
 * Offset paging over a table that is still being written to skips rows: a lead
 * captured between page one and page two shifts everything down by one, and
 * whoever is syncing silently never sees the row that moved across the
 * boundary. Callers page by time instead, oldest first, passing the last
 * created_at they saw.
 */
export function clampLimit(raw: unknown, fallback = 100, max = 500): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}
