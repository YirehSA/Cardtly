// A reseller's own card is free, for as long as they are a reseller.
// (Andre, 2026-10-21: "the main email will get their card for free, as long
// as they are a reseller".)
//
// WHO. The reseller's main login: the account whose email is the reseller's
// own email (resellers.email). Extra staff logins added later are not covered.
//
// HOW. The same way an admin comps anybody (activate_pro in app/api/admin): a
// whop_subscriptions row, plan 'pro_admin', tier pro, active, comped. It is the
// newest row, and the newest row is what latestSubscriptionFor reads, so the
// dashboard and the public card page both serve it without either of them
// knowing resellers exist. Ours carry metadata.reason 'reseller' and the
// reseller's id, which is how this file finds them again and never touches a
// comp somebody gave by hand.
//
// FOR AS LONG AS THEY ARE A RESELLER. Active or on hold, the card is free (on
// hold is a pause, not an ending). When the reseller is ended, or its main
// email moves to someone else, our row is cancelled and that account falls
// back to whatever else covers it: a team, a trial, or nothing.
//
// NEVER ON TOP OF A PAYSTACK SUBSCRIPTION. Someone Paystack is still billing,
// or still retrying (past_due), is left alone and reported as 'paying': a free
// card while the charge keeps going out is the one outcome worse than not
// giving it. Cancel the subscription under Users and the next sync makes the
// card free. The daily cron runs the sync for every reseller.

import { logSubscriptionChange } from './subscription-audit'

export type FreeCardState = 'free' | 'pending' | 'already_free' | 'paying' | 'no_login' | 'off'

export interface FreeCard { state: FreeCardState; email: string; userId: string | null }

const isOurs = (s: any, resellerId: string) =>
  s?.status === 'active' && s?.metadata?.reason === 'reseller' && s?.metadata?.reseller_id === resellerId

const newestFirst = (rows: any[]) =>
  [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

/** The reseller's main login: a member whose email is the reseller's email. */
async function mainLogin(db: any, reseller: any): Promise<{ id: string; email: string } | null> {
  const want = String(reseller.email || '').trim().toLowerCase()
  if (!want) return null
  const { data: members } = await db.from('reseller_members').select('user_id').eq('reseller_id', reseller.id)
  for (const m of members || []) {
    try {
      const { data } = await db.auth.admin.getUserById(m.user_id)
      const email = String(data?.user?.email || '').toLowerCase()
      if (email === want) return { id: m.user_id, email }
    } catch { /* skip an unreadable login */ }
  }
  return null
}

/**
 * Make the reseller's free card match whether they are a reseller.
 * With dryRun it only reports, which is what the admin screen shows.
 */
export async function syncResellerFreeCard(db: any, reseller: any, opts: { dryRun?: boolean; actorUserId?: string | null } = {}): Promise<FreeCard> {
  // Every grant and every withdrawal is written down, like any other change
  // to who is entitled (lib/subscription-audit).
  const log = (change: 'granted' | 'cancelled', userId: string, reason: string, email?: string | null) =>
    logSubscriptionChange(db, { change, userId, email: email ?? null, actorUserId: opts.actorUserId ?? null, source: 'reseller', reason })

  const email = String(reseller?.email || '').trim().toLowerCase()
  const wanted = !!reseller?.id && reseller.status !== 'ended'
  const main = wanted ? await mainLogin(db, reseller) : null

  // Our comps that should not be there: the reseller ended, or they belong to
  // a login that is no longer its main one.
  const { data: ours } = await db.from('whop_subscriptions').select('id, user_id, email')
    .eq('status', 'active').eq('metadata->>reason', 'reseller').eq('metadata->>reseller_id', reseller.id)
  const stale = (ours || []).filter((r: any) => !wanted || r.user_id !== main?.id)
  if (stale.length && !opts.dryRun) {
    await db.from('whop_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', stale.map((r: any) => r.id))
    for (const r of stale) {
      await log('cancelled', r.user_id, wanted ? `no longer ${reseller.name}'s main login` : `${reseller.name} ended as a reseller`, r.email)
    }
  }

  if (!wanted) return { state: 'off', email, userId: null }
  if (!main) return { state: 'no_login', email, userId: null }

  const { data: subs } = await db.from('whop_subscriptions')
    .select('id, plan_id, status, metadata, created_at').eq('user_id', main.id)
  const rows = newestFirst(subs || [])
  const latest = rows[0]

  if (latest && isOurs(latest, reseller.id)) return { state: 'free', email, userId: main.id }

  const paying = rows.find(s => !s.metadata?.comped && String(s.plan_id || '').startsWith('paystack')
    && (s.status === 'active' || s.status === 'past_due'))
  if (paying) return { state: 'paying', email, userId: main.id }

  if (latest && latest.status === 'active' && latest.metadata?.comped) return { state: 'already_free', email, userId: main.id }

  if (opts.dryRun) return { state: 'pending', email, userId: main.id }

  // An older row of ours that is no longer the newest serves nothing, so it
  // is retired and a fresh one written on top.
  const buried = rows.filter(s => isOurs(s, reseller.id)).map(s => s.id)
  if (buried.length) {
    await db.from('whop_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).in('id', buried)
  }
  const { error } = await db.from('whop_subscriptions').insert({
    user_id: main.id,
    email: main.email,
    plan_id: 'pro_admin',
    subscription_tier: 'pro',
    status: 'active',
    billing_cycle: 'monthly',
    seats: 1,
    metadata: { comped: true, reason: 'reseller', reseller_id: reseller.id },
  })
  if (error) return { state: 'no_login', email, userId: main.id }
  await log('granted', main.id, `free card while a reseller (${reseller.name})`, main.email)
  return { state: 'free', email, userId: main.id }
}

/** The daily pass. Never throws: a reseller it cannot read is skipped. */
export async function syncAllResellerFreeCards(db: any): Promise<{ synced: number; paying: string[]; problems: string[] }> {
  const out = { synced: 0, paying: [] as string[], problems: [] as string[] }
  const { data: resellers, error } = await db.from('resellers').select('*')
  if (error) { out.problems.push('Resellers need migration 094.'); return out }
  for (const r of resellers || []) {
    try {
      const res = await syncResellerFreeCard(db, r)
      out.synced++
      if (res.state === 'paying') out.paying.push(r.name)
    } catch (e: any) {
      out.problems.push(`${r.name}: ${e?.message || 'could not sync the free card'}`)
    }
  }
  return out
}

/** What the admin screen says about a reseller's free card. */
export const FREE_CARD_TEXT: Record<FreeCardState, string> = {
  free: 'Their own card is free while they are a reseller.',
  pending: 'Their own card becomes free at the next save or daily run.',
  already_free: 'Their own card is already free (comped by hand), so nothing more was needed.',
  paying: 'Paystack still bills or retries their own subscription, so their card was not made free. Under Users, use "Cancel failed Paystack subscription" (or "Cancel subscription" if they are still paying), then Check again.',
  no_login: 'No login is linked to the reseller\'s main email yet, so there is no card to make free.',
  off: 'The reseller has ended, so their card is no longer free.',
}
