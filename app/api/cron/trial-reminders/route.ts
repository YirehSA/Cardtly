import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderTrialEmail, type TrialEmailKind } from '@/lib/trial-email-templates'
import { denyIfNotCron } from '@/lib/cron-auth'

// Trial reminder emails. Triggered daily by Vercel Cron (see vercel.json).
//
// On day 61 a personal card stops serving (app/card/[slug]/page.tsx). Nobody
// should discover that by handing someone a dead link, so this warns twice
// before it happens and once after:
//
//   trial_7d       7 days out  - "here is what you would lose"
//   trial_1d       1 day out   - last call
//   trial_expired  after       - the card is down, here is how to get it back
//
// Idempotency lives in the DB, not here: trial_emails has a unique
// (user_id, kind), so a user who sits in the "within 7 days" window for a
// week still only gets one 7-day email. See migration 026.
//
// Secured with CRON_SECRET (see lib/cron-auth), required in production.

export const maxDuration = 60

const FROM_EMAIL = 'Cardtly <noreply@cardtly.com>'
const DAY_MS = 24 * 60 * 60 * 1000

type Kind = TrialEmailKind

export async function GET(request: Request) {
  const denied = denyIfNotCron(request)
  if (denied) return denied

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  // ?dry=1 reports exactly who would be emailed, and sends nothing. Safe to
  // run against production before letting the real thing loose.
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'

  const admin = createAdminClient(url, serviceKey) as any

  const [{ data: profiles, error: profErr }, { data: subs }, { data: teamCards }, { data: cards }, { data: alreadySent }] =
    await Promise.all([
      admin.from('profiles').select('user_id, name, trial_ends_at').not('trial_ends_at', 'is', null),
      admin.from('whop_subscriptions').select('user_id').eq('status', 'active'),
      admin.from('team_cards').select('user_id').not('user_id', 'is', null),
      admin.from('cards').select('user_id, name, slug'),
      admin.from('trial_emails').select('user_id, kind'),
    ])

  // If trial_ends_at does not exist yet (migration 024 unapplied), this
  // errors and profiles is null. Do nothing rather than guess.
  if (profErr) {
    return NextResponse.json({ error: 'profiles read failed', detail: profErr.message }, { status: 500 })
  }

  const paid = new Set((subs || []).map((s: any) => s.user_id).filter(Boolean))
  // A claimed team member's card is served by their org and is never gated on
  // their personal trial, so "your card is about to go offline" would be a
  // lie. Excluded outright.
  const teamMembers = new Set((teamCards || []).map((t: any) => t.user_id).filter(Boolean))
  const sent = new Set((alreadySent || []).map((r: any) => `${r.user_id}:${r.kind}`))

  const cardByUser: Record<string, { name: string | null; slug: string | null }> = {}
  for (const c of (cards || []) as any[]) {
    if (c.user_id && !cardByUser[c.user_id]) cardByUser[c.user_id] = { name: c.name, slug: c.slug }
  }

  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailByUser: Record<string, string> = {}
  for (const u of authData?.users || []) if (u.id && u.email) emailByUser[u.id] = u.email

  const now = Date.now()
  const queue: Array<{ userId: string; to: string; kind: Kind; firstName: string; slug: string | null; daysLeft: number }> = []

  for (const p of (profiles || []) as any[]) {
    const userId = p.user_id
    if (!userId) continue
    if (paid.has(userId)) continue        // paying or comped: nothing is ending
    if (teamMembers.has(userId)) continue // covered by their organization

    // No personal card means nothing goes offline, so there is nothing to warn
    // about. Emailing here would be spam.
    const card = cardByUser[userId]
    if (!card) continue

    const to = emailByUser[userId]
    if (!to) continue

    const endsMs = new Date(p.trial_ends_at).getTime()
    if (!Number.isFinite(endsMs)) continue // fails open elsewhere; never email on a bad date

    const msLeft = endsMs - now

    // Thresholds are "at or under", not "on exactly day N". If a cron run is
    // missed, or Vercel fires late, someone can jump from 8 days to 6 without
    // ever landing on 7. Anchoring to the boundary rather than the day means
    // they still get the email, just later than ideal.
    let kind: Kind | null = null
    if (msLeft <= 0) kind = 'trial_expired'
    else if (msLeft <= 1 * DAY_MS) kind = 'trial_1d'
    else if (msLeft <= 7 * DAY_MS) kind = 'trial_7d'
    if (!kind) continue

    if (sent.has(`${userId}:${kind}`)) continue

    queue.push({
      userId,
      to,
      kind,
      firstName: (card.name || p.name || '').split(' ')[0] || 'there',
      slug: card.slug,
      daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    })
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: queue.length,
      breakdown: queue.reduce((a: Record<string, number>, q) => ({ ...a, [q.kind]: (a[q.kind] || 0) + 1 }), {}),
      recipients: queue.map(q => ({ to: q.to, kind: q.kind, daysLeft: q.daysLeft })),
    })
  }

  const resend = new Resend(resendKey)
  let delivered = 0
  const failed: string[] = []

  for (const q of queue) {
    // Claim first. If a second run is already in flight for this user, its
    // insert loses on unique(user_id, kind) and it skips, so only one email
    // goes out.
    const { error: claimErr } = await admin
      .from('trial_emails')
      .insert({ user_id: q.userId, kind: q.kind })
    if (claimErr) continue // already claimed by another run

    try {
      const { subject, html } = renderTrialEmail(q)
      await resend.emails.send({ from: FROM_EMAIL, to: q.to, subject, html })
      delivered++
    } catch (e) {
      // Release the claim so tomorrow's run tries again. Missing someone's
      // only warning is worse than a rare duplicate.
      await admin.from('trial_emails').delete().eq('user_id', q.userId).eq('kind', q.kind)
      failed.push(q.to)
    }
  }

  return NextResponse.json({ ok: true, delivered, failed: failed.length, considered: queue.length })
}
