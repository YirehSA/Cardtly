import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { SITE_URL } from '@/lib/seo-schema'
import { EMAIL_KINDS, isEmailKind, type EmailKind } from '@/lib/email-kinds'

// Unsubscribing from the emails Cardtly sends on its own schedule.
//
// WHY. POPIA section 69: an electronic message that promotes a product must
// give the person a way to opt out, in every message, at no cost. The weekly
// summary called itself a re-engagement nudge and the trial emails ask people
// to upgrade, and neither had any way out; the privacy policy also promised
// one the weekly summary did not have (found 2026-11-03).
//
// WHAT IS COVERED. The two scheduled kinds in lib/email-kinds, and only those. Mail a
// person asked for or must have stays: sign-in links, lead and meeting
// alerts, invoices, payment failures. Opting out of those would mean missing
// a lead or a bill, which no one is asking for.
//
// HOW A LINK WORKS. Each email carries a link signed for that person and that
// kind, so it needs no sign-in and cannot be turned into somebody else's.
// Opening it shows a page with a button; only pressing the button (a POST)
// opts out. Email security scanners such as Mimecast open every link in a
// message before the person does, and a link that unsubscribed on opening
// would unsubscribe whole companies. The List-Unsubscribe header points at the
// POST route directly, which is what Gmail's and Outlook's own unsubscribe
// button calls (RFC 8058), so that one-click path still works.
//
// Preferences live in email_opt_outs (migration 103), one row per person and
// kind, removed with the account. scripts/check-email-unsubscribe holds this.

export { EMAIL_KINDS, isEmailKind, type EmailKind }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A dedicated secret if one is set, otherwise derived from the service key
// under its own label, the same arrangement as lib/wa-bridge. Without either,
// no link can be made or checked, and the emails go without one rather than
// with a link that cannot work.
function key(): Buffer | null {
  const secret = process.env.EMAIL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!secret) return null
  return createHash('sha256').update(`cardtly-email-optout-v1\n${secret}`).digest()
}

export function optOutToken(userId: string, kind: EmailKind): string | null {
  const k = key()
  if (!k || !UUID.test(userId)) return null
  return createHmac('sha256', k).update(`${userId}.${kind}`).digest('base64url').slice(0, 32)
}

export function verifyOptOutToken(userId: unknown, kind: unknown, token: unknown): boolean {
  if (typeof userId !== 'string' || typeof token !== 'string' || !isEmailKind(kind)) return false
  const want = optOutToken(userId, kind)
  if (!want || token.length !== want.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(want))
}

function query(userId: string, kind: EmailKind, token: string) {
  return `u=${encodeURIComponent(userId)}&k=${kind}&t=${encodeURIComponent(token)}`
}

/** The page a person lands on from the link in the email. Opening it changes nothing. */
export function unsubscribePageUrl(userId: string, kind: EmailKind): string | null {
  const t = optOutToken(userId, kind)
  return t ? `${SITE_URL}/unsubscribe?${query(userId, kind, t)}` : null
}

/** The headers that give Gmail and Outlook their own unsubscribe button. */
export function listUnsubscribeHeaders(userId: string, kind: EmailKind): Record<string, string> {
  const t = optOutToken(userId, kind)
  if (!t) return {}
  return {
    'List-Unsubscribe': `<${SITE_URL}/api/email/unsubscribe?${query(userId, kind, t)}>, <mailto:hello@cardtly.com?subject=Unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/** The line at the bottom of every email of this kind. */
export function unsubscribeFooterHtml(userId: string, kind: EmailKind): string {
  const url = unsubscribePageUrl(userId, kind)
  const how = url
    ? `<a href="${url}" style="color:#888;text-decoration:underline">Unsubscribe from ${EMAIL_KINDS[kind].label}</a>, or switch it off in Settings.`
    : 'You can switch these off in Settings.'
  return `<p style="color:#aaa;font-size:12px;margin:10px 0 0">${how}</p>`
}

/**
 * Everyone who has opted out of this kind. A read that fails returns null and
 * the caller sends NOTHING of this kind: emailing someone who said stop is the
 * one outcome worse than a missed summary.
 *
 * Except when the table is not there yet (migration 103 unapplied): then
 * nobody can have opted out, because the unsubscribe route could not have
 * saved it, and an empty set is the truth rather than a guess.
 */
export async function optedOut(admin: any, kind: EmailKind): Promise<Set<string> | null> {
  const { data, error } = await admin.from('email_opt_outs').select('user_id').eq('kind', kind)
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return new Set()
  if (error) {
    console.error(`email_opt_outs read failed (${kind})`, error.code, error.message)
    return null
  }
  return new Set((data || []).map((r: any) => r.user_id))
}

export async function isOptedOut(admin: any, userId: string, kind: EmailKind): Promise<boolean | null> {
  const { data, error } = await admin.from('email_opt_outs').select('user_id').eq('user_id', userId).eq('kind', kind).maybeSingle()
  if (error) return null
  return !!data
}

/** off = true opts out; off = false opts back in. */
export async function setOptOut(admin: any, userId: string, kind: EmailKind, off: boolean): Promise<{ error?: string }> {
  const { error } = off
    ? await admin.from('email_opt_outs').upsert({ user_id: userId, kind }, { onConflict: 'user_id,kind', ignoreDuplicates: true })
    : await admin.from('email_opt_outs').delete().eq('user_id', userId).eq('kind', kind)
  return error ? { error: `${error.code || ''} ${error.message || ''}`.trim() } : {}
}
