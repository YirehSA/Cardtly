import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderTrialEmail, type TrialEmailKind } from '@/lib/trial-email-templates'
import { denyIfNotCron } from '@/lib/cron-auth'
import { sendOpsDigest } from '@/lib/ops-digest'
import { FROM_EMAIL } from '@/lib/email'
import { sendPaymentFailedEmails } from '@/lib/payment-reminders'

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

const DAY_MS = 24 * 60 * 60 * 1000

// How long after making a card somebody still counts as new.
//
// It is a window rather than "since the last run" for the same reason the
// thresholds below are "at or under": if a run is missed, or Vercel fires late,
// nobody should silently lose their only welcome. Seven days of slack, and the
// dedupe in trial_emails means the slack can never turn into a second send.
//
// It also decides who is too late to welcome. Measured against production when
// this shipped, a 7-day window covered exactly one card - the signup from the
// night before - and left every older account alone, which is the point: a
// "welcome, your card is live" arriving three weeks late reads as a system
// that has lost track of you.
const WELCOME_WINDOW_DAYS = 7

function cardAgeDays(createdAt: string | null, now: number): number {
  if (!createdAt) return Infinity // unknown age: treat as old, never welcome
  const ms = new Date(createdAt).getTime()
  if (!Number.isFinite(ms)) return Infinity
  return (now - ms) / DAY_MS
}

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
      admin.from('cards').select('user_id, name, slug, created_at'),
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

  const cardByUser: Record<string, { name: string | null; slug: string | null; createdAt: string | null }> = {}
  for (const c of (cards || []) as any[]) {
    if (c.user_id && !cardByUser[c.user_id]) {
      cardByUser[c.user_id] = { name: c.name, slug: c.slug, createdAt: c.created_at ?? null }
    }
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

    // A signup now gets 7 days, which satisfies the 7-day threshold on the very
    // first run - so without this a brand new user would be greeted by "7 days
    // left on your trial" within hours of joining, alongside the welcome below.
    // Two emails at once, one of them a countdown, is a poor first day. For
    // their first week the welcome IS the notice, and it carries the same
    // number. A longer trial from a code still gets its 7-day warning later.
    if (kind === 'trial_7d' && cardAgeDays(card.createdAt, now) <= WELCOME_WINDOW_DAYS) continue

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

  // Welcome: your card is live.
  //
  // A separate pass rather than another branch in the loop above, because the
  // rules genuinely differ - that loop is about something ending, this is about
  // something starting - and because the loop above is the one that must not
  // break. It appends to the same queue, so the claim-send-release handling
  // below covers it unchanged.
  //
  // The trigger is the card, not the signup: an account with no card has no
  // link to be told about, and the whole point is to get the link in front of
  // somebody. Trial users only - "you have N days to try everything" is the
  // wrong thing to say to a customer who has already paid.
  for (const p of (profiles || []) as any[]) {
    const userId = p.user_id
    if (!userId) continue
    if (paid.has(userId)) continue
    if (teamMembers.has(userId)) continue

    const card = cardByUser[userId]
    if (!card) continue
    if (cardAgeDays(card.createdAt, now) > WELCOME_WINDOW_DAYS) continue

    // Never claim a card is live when it is not. Anyone whose trial has already
    // run out gets the expired email from the loop above instead.
    const msLeft = new Date(p.trial_ends_at).getTime() - now
    if (!Number.isFinite(msLeft) || msLeft <= 0) continue

    const to = emailByUser[userId]
    if (!to) continue
    if (sent.has(`${userId}:card_live`)) continue

    queue.push({
      userId,
      to,
      kind: 'card_live',
      firstName: (card.name || p.name || '').split(' ')[0] || 'there',
      slug: card.slug,
      daysLeft: Math.max(1, Math.ceil(msLeft / DAY_MS)),
    })
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: queue.length,
      breakdown: queue.reduce((a: Record<string, number>, q) => ({ ...a, [q.kind]: (a[q.kind] || 0) + 1 }), {}),
      recipients: queue.map(q => ({ to: q.to, kind: q.kind, daysLeft: q.daysLeft })),
      payments: await sendPaymentFailedEmails(admin, resendKey, true),
    })
  }

  const resend = new Resend(resendKey)
  let delivered = 0
  const failed: string[] = []
  const blocked: string[] = []

  for (const q of queue) {
    // Claim first. If a second run is already in flight for this user, its
    // insert loses on unique(user_id, kind) and it skips, so only one email
    // goes out.
    const { error: claimErr } = await admin
      .from('trial_emails')
      .insert({ user_id: q.userId, kind: q.kind })
    if (claimErr) {
      // 23505 is that unique violation, which is the expected race and not a
      // problem. Anything else is, and used to be swallowed by the same
      // `continue`: the first card_live run hit the kind check constraint
      // (23514) on all of them and still reported ok with delivered 0 and no
      // errors, which reads exactly like "there was nobody to email".
      if (claimErr.code !== '23505') blocked.push(`${q.kind}/${q.to}: ${claimErr.code} ${claimErr.message}`)
      continue
    }

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

  // Ride-along: teams whose trial lapsed, and debit orders nobody has
  // collected. Nothing enforces either, so without this they are only visible
  // to someone who happens to open the admin. Runs last and never affects the
  // reminders above; a failure here is reported, not thrown.
  const ops = await sendOpsDigest(admin, resendKey)

  // Same ride-along shape: a failed-payment warning for anyone inside the
  // grace window who has not been told yet. Runs after the trial reminders and
  // never affects them.
  const payments = await sendPaymentFailedEmails(admin, resendKey)

  // blocked is surfaced rather than counted, because the message is the whole
  // value: "delivered 0 of 1" says something went wrong, only the constraint
  // name says what.
  // Webhook deliveries ride along here.
  //
  // They want their own cron every few minutes, but Vercel's Hobby plan caps
  // an account at two cron jobs running no more than daily, and adding a third
  // rejects the entire deployment - which is exactly what happened, blocking
  // four commits with no symptom other than a feature that never appeared.
  //
  // Piggybacking means a queued lead can wait until the next daily run, which
  // is poor but honest, and it never sits forever. On Pro, give the webhook
  // cron its own entry in vercel.json at */5 and delete this.
  let webhooks: any = null
  try {
    const { deliverPending } = await import('@/lib/webhook-dispatch')
    webhooks = await deliverPending(admin, 100)
  } catch {
    webhooks = { error: 'delivery pass failed' }
  }

  return NextResponse.json({
    ok: blocked.length === 0,
    delivered,
    failed: failed.length,
    considered: queue.length,
    webhooks,
    ...(blocked.length ? { blocked } : {}),
    ops,
    payments,
  })
}
