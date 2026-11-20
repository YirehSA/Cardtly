import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'
import { findUserByEmail } from '@/lib/department-perms'
import { ensureAccountReady } from '@/lib/account-setup'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { getUserPlan } from '@/lib/plan-server'
import { listResellerClients, poolClients, writable, type Reseller } from '@/lib/reseller'
import { recordSoloSeats, resellerYears } from '@/lib/reseller-billing'
import { fitsPool, cleanTerm, sastMonth, monthLabel, addMonths, currentYear } from '@/lib/reseller-pricing'

// Resellers sell Cardtly Solo (stage 4, Andre 2026-11-20: "For resellers: We
// will charge them R35 per month or R350 per year").
//
// A SOLO CLIENT IS A PERSON, not a team: Solo is "single only, never teams or
// departments". The reseller adds them by name and email. They get a login and
// their own card straight away, like a client team's admin does, and an email
// to choose a password. The reseller never goes inside, as with teams.
//
// HOW THE CARD IS SOLO. The same way an admin comps anybody (activate_solo in
// app/api/admin): a whop_subscriptions row, tier 'solo', active, comped, the
// newest row. Ours carry metadata.reason 'reseller_solo' and the client's id,
// which is how this file finds them again and never touches anybody else's.
// So the dashboard, the public card page, the Network and every email serve it
// as Solo without knowing resellers exist.
//
// BILLING is the team rules with one seat (lib/reseller-pricing): any day live
// in a month bills the month; yearly is twelve months upfront; one seat from
// the pool while live or paused; counted towards the reseller's level.
//
// LIVE, PAUSED, CANCELLED. Live: the card is on Solo. Paused: the card goes
// offline, the seat is kept, and a paused month is not billed. Cancelled: the
// card goes offline and the seat goes back to the pool. Nothing is deleted:
// the person keeps their login, their card and their contacts.
//
// NEVER ON TOP OF ANOTHER PLAN. Somebody who already pays Cardtly, already has
// it free, already has Pro through a team, or already has Solo through a
// reseller cannot be added: one of the two payers would be paying for nothing.

export const SOLO_CLIENT_REASON = 'reseller_solo'
const SOLO_PLAN_ID = 'solo_reseller'

type Fail = { error: string; status: number }
const fail = (error: string, status = 400): Fail => ({ error, status })

export interface SoloClientRow {
  id: string
  reseller_id: string
  user_id: string | null
  name: string
  email: string
  term: string
  state: 'live' | 'paused' | 'cancelled'
  created_at?: string
}

const newestFirst = (rows: any[]) =>
  [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

const isOurs = (s: any, clientId: string) =>
  s?.status === 'active' && s?.metadata?.reason === SOLO_CLIENT_REASON && s?.metadata?.solo_client_id === clientId

const isPaystackPayer = (s: any) => !s?.metadata?.comped && String(s?.plan_id || '').startsWith('paystack')
  && (s?.status === 'active' || s?.status === 'past_due')

const NOT_ON = 'Selling Cardtly Solo is not switched on yet (migration 110). Ask Cardtly.'

async function ownedSolo(db: any, reseller: Reseller, id: string): Promise<SoloClientRow | null> {
  if (!id) return null
  const { data } = await db.from('reseller_solo_clients').select('*').eq('id', id).eq('reseller_id', reseller.id).maybeSingle()
  return (data as SoloClientRow) || null
}

/** Why this login cannot be sold Solo by a reseller, or null when it can. */
export async function soloBlocker(db: any, userId: string, email: string): Promise<string | null> {
  const { data: member } = await db.from('reseller_members').select('reseller_id').eq('user_id', userId).maybeSingle()
  if (member) return `${email} runs a Cardtly reseller account, which comes with its own card.`

  const { data: other } = await db.from('reseller_solo_clients').select('id')
    .eq('user_id', userId).neq('state', 'cancelled').limit(1)
  if (other?.length) return `${email} already has a Cardtly Solo card through a reseller.`

  const { data: subs } = await db.from('whop_subscriptions')
    .select('plan_id, status, metadata, created_at').eq('user_id', userId)
  const rows = newestFirst(subs || [])
  if (rows.some(isPaystackPayer)) {
    return `${email} already pays Cardtly for their card. They would have to cancel that first, or they would pay twice.`
  }
  const latest = rows[0]
  if (latest?.status === 'active' && latest?.metadata?.comped) {
    return `${email} already has Cardtly at no charge, so a Solo card would add nothing.`
  }

  const plan = await getUserPlan(userId)
  if (plan.viaTeam) return `${email} already has Cardtly Pro through their company's team, so a Solo card would add nothing.`
  return null
}

export type SoloCardState = 'on' | 'off' | 'paying' | 'covered'

/** Make one Solo client's card match its state: on Solo while live, off
 *  otherwise. Never grants over a Paystack subscription or somebody else's
 *  comp ('paying' / 'covered'), which the reseller page reports. */
export async function syncSoloCard(db: any, row: SoloClientRow, reseller: { name?: string; status?: string } | null, opts: { actorUserId?: string | null } = {}): Promise<SoloCardState> {
  const log = (change: 'granted' | 'cancelled', userId: string, reason: string, email?: string | null) =>
    logSubscriptionChange(db, { change, userId, email: email ?? null, actorUserId: opts.actorUserId ?? null, source: 'reseller', reason })

  const wanted = row.state === 'live' && !!row.user_id && reseller?.status !== 'ended'
  const by = reseller?.name || 'their reseller'

  const { data: ours } = await db.from('whop_subscriptions').select('id, user_id, email')
    .eq('status', 'active').eq('metadata->>reason', SOLO_CLIENT_REASON).eq('metadata->>solo_client_id', row.id)
  const stale = (ours || []).filter((r: any) => !wanted || r.user_id !== row.user_id)
  if (stale.length) {
    await db.from('whop_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', stale.map((r: any) => r.id))
    for (const r of stale) await log('cancelled', r.user_id, `Cardtly Solo through ${by}: ${row.state}`, r.email)
  }
  if (!wanted || !row.user_id) return 'off'

  const { data: subs } = await db.from('whop_subscriptions')
    .select('id, plan_id, status, metadata, created_at').eq('user_id', row.user_id)
  const rows = newestFirst(subs || [])
  const latest = rows[0]
  if (latest && isOurs(latest, row.id)) return 'on'
  if (rows.some(isPaystackPayer)) return 'paying'
  if (latest?.status === 'active' && latest?.metadata?.comped) return 'covered'

  // An older row of ours that is no longer the newest serves nothing.
  const buried = rows.filter(s => isOurs(s, row.id)).map(s => s.id)
  if (buried.length) {
    await db.from('whop_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).in('id', buried)
  }
  const { error } = await db.from('whop_subscriptions').insert({
    user_id: row.user_id,
    email: row.email,
    plan_id: SOLO_PLAN_ID,
    subscription_tier: 'solo',
    status: 'active',
    billing_cycle: 'monthly',
    seats: 1,
    metadata: { comped: true, reason: SOLO_CLIENT_REASON, reseller_id: row.reseller_id, solo_client_id: row.id },
  })
  if (error) return 'off'
  await log('granted', row.user_id, `Cardtly Solo through ${by}`, row.email)
  return 'on'
}

/** The daily pass, for every reseller's Solo clients. Never throws. */
export async function syncAllSoloCards(db: any): Promise<{ synced: number; problems: string[] }> {
  const out = { synced: 0, problems: [] as string[] }
  const { data: rows, error } = await db.from('reseller_solo_clients').select('*')
  if (error) return out // before migration 110: nobody to sync
  const { data: resellers } = await db.from('resellers').select('id, name, status')
  const byId = new Map<string, any>((resellers || []).map((r: any) => [r.id, r]))
  for (const row of rows || []) {
    try {
      const state = await syncSoloCard(db, row, byId.get(row.reseller_id) || null)
      out.synced++
      if (state === 'paying' || state === 'covered') {
        out.problems.push(`${row.name} (Solo through ${byId.get(row.reseller_id)?.name || 'a reseller'}): ${state === 'paying' ? 'also pays Cardtly directly' : 'already has a comped plan'}, so the reseller's Solo was not applied`)
      }
    } catch (e: any) {
      out.problems.push(`${row.name}: ${e?.message || 'could not sync the Solo card'}`)
    }
  }
  return out
}

/** A new Solo client: their login (made when they have none), their card on
 *  Solo straight away, and the email that lets them in. */
export async function createSoloClient(db: any, reseller: Reseller, input: {
  name?: unknown; email?: unknown; term?: unknown
}, origin: string, actor: string): Promise<{ ok: true; id: string; notes: string[] } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked

  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  const email = String(input.email ?? '').trim().toLowerCase()
  const term = input.term === undefined || input.term === null || input.term === '' ? 'monthly' : cleanTerm(input.term)
  if (!name) return fail('Type the person\'s name.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return fail(`"${email}" does not look like an email address.`)
  if (!term) return fail('Choose monthly or yearly.')

  const probe = await db.from('reseller_solo_clients').select('id').limit(1)
  if (probe.error) return fail(NOT_ON, 503)

  const clients = await listResellerClients(db, reseller.id)
  const fit = fitsPool(reseller.seat_pool, poolClients(clients), 1)
  if (!fit.ok) return fail('A Solo card needs 1 seat, and your pool has none left. Ask Cardtly for more seats.')

  let userId: string
  let createdAccount = false
  const existing = await findUserByEmail(db, email)
  if (existing) {
    const why = await soloBlocker(db, existing.id, email)
    if (why) return fail(why)
    userId = existing.id
  } else {
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name, created_by: 'reseller_solo', reseller_id: reseller.id },
    })
    if (error || !created?.user) return fail(`Could not create a login for ${email}: ${error?.message || 'unknown error'}`, 500)
    userId = created.user.id
    createdAccount = true
  }

  const { data: row, error: rowErr } = await db.from('reseller_solo_clients').insert({
    reseller_id: reseller.id, user_id: userId, name, email,
    term, state: 'live', created_by: actor,
  }).select('*').maybeSingle()
  if (rowErr || !row) {
    if (rowErr?.code === '23505') return fail(`${email} already has a Cardtly Solo card through a reseller.`)
    return fail(`Could not add ${name}: ${rowErr?.message || 'unknown error'}.`
      + (createdAccount ? ` The login for ${email} was made and will be reused if you try again.` : ''), 500)
  }

  // Their profile and their card, named after them, the same rows a sign-up
  // makes. Somebody who already has a card keeps it.
  try { await ensureAccountReady({ id: userId, email, user_metadata: { full_name: name } }) } catch { /* made on first sign-in */ }

  await syncSoloCard(db, row, reseller, { actorUserId: actor })
  await recordSoloSeats(db, row)

  const notes: string[] = []
  const sent = await sendSoloWelcome(db, { email, name, resellerName: reseller.name, origin, newAccount: createdAccount })
  notes.push(sent.ok
    ? createdAccount
      ? `${email} has been emailed a link to choose a password.`
      : `${email} already had a Cardtly login, so they sign in as usual. We emailed them to say their card is now on Solo through you.`
    : `${name}'s card is on Solo, but the email to ${email} did not send. Use "Sign-in email" to try again.`)
  return { ok: true, id: row.id, notes }
}

/** Sell a Solo client monthly or yearly from now on. Same rules as a team. */
export async function setSoloTerm(db: any, reseller: Reseller, id: string, raw: unknown): Promise<{ ok: true; note: string } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  const term = cleanTerm(raw)
  if (!term) return fail('Choose monthly or yearly.')
  const row = await ownedSolo(db, reseller, id)
  if (!row) return fail('That client is not one of yours.', 404)
  const name = row.name || 'This client'
  if ((cleanTerm(row.term) || 'monthly') === term) return { ok: true, note: `${name} is already ${term}.` }

  const month = sastMonth(new Date())
  const paid = await resellerYears(db, reseller.id)
  const years = 'error' in paid ? [] : paid.years.filter(y => y.organization_id === row.id)
  const year = currentYear(years.map(y => ({ startMonth: y.start_month, endMonth: y.end_month })), month)

  const { data: saved, error } = await db.from('reseller_solo_clients')
    .update({ term, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').maybeSingle()
  if (error || !saved) return fail(error?.message || 'Could not save.', 500)
  await recordSoloSeats(db, saved)

  if (term === 'yearly') {
    return { ok: true, note: year
      ? `${name} is paid up to ${monthLabel(year.endMonth)}, and renews yearly from ${monthLabel(addMonths(year.endMonth, 1))}.`
      : saved.state !== 'live'
      ? `${name} is now yearly. Their first year starts in the month you switch them back on.`
      : `${name} is now yearly: ${monthLabel(month)} to ${monthLabel(addMonths(month, 11))} is billed on your next Cardtly invoice, in place of this month.` }
  }
  return { ok: true, note: year
    ? `${name} stays paid up to ${monthLabel(year.endMonth)}, and is billed monthly from ${monthLabel(addMonths(year.endMonth, 1))}.`
    : `${name} is now monthly, from ${monthLabel(month)}.` }
}

/** Pause (card offline, seat kept), switch back on, or cancel (card offline,
 *  seat back to the pool). Nothing of the person's is deleted. */
export async function setSoloState(db: any, reseller: Reseller, id: string, to: unknown, actor: string): Promise<{ ok: true } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  const row = await ownedSolo(db, reseller, id)
  if (!row) return fail('That client is not one of yours.', 404)
  if (to !== 'live' && to !== 'paused' && to !== 'cancelled') return fail('Unknown change.')
  if (row.state === to) return { ok: true }
  if (to === 'paused' && row.state !== 'live') return fail('Only a live client can be paused.')

  if (to === 'live') {
    if (!row.user_id) return fail(`${row.name} deleted their Cardtly account, so there is no card to switch on. Add them again if they come back.`)
    if (row.state === 'cancelled') {
      const clients = await listResellerClients(db, reseller.id)
      const fit = fitsPool(reseller.seat_pool, poolClients(clients).filter(c => c.id !== row.id), 1)
      if (!fit.ok) return fail('Switching them back on needs 1 seat, and your pool has none left. Ask Cardtly for more seats.')
      // Their account may have changed while they were cancelled.
      const why = await soloBlocker(db, row.user_id, row.email)
      if (why) return fail(why)
    }
  }

  const { data: saved, error } = await db.from('reseller_solo_clients')
    .update({ state: to, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').maybeSingle()
  if (error || !saved) {
    if (error?.code === '23505') return fail(`${row.email} has a Cardtly Solo card through a reseller again, so this one cannot be switched on.`)
    return fail(error?.message || 'Could not save.', 500)
  }
  await syncSoloCard(db, saved, reseller, { actorUserId: actor })
  await recordSoloSeats(db, saved)
  return { ok: true }
}

/** The sign-in email again: a link to choose a password, for somebody who
 *  lost the first one or never set one. */
export async function resendSoloWelcome(db: any, reseller: Reseller, id: string, origin: string): Promise<{ ok: true; email: string } | Fail> {
  const row = await ownedSolo(db, reseller, id)
  if (!row) return fail('That client is not one of yours.', 404)
  if (!row.user_id) return fail(`${row.name} deleted their Cardtly account.`)
  const { data } = await db.auth.admin.getUserById(row.user_id)
  const email = data?.user?.email
  if (!email) return fail('That client has no email on record.')
  const sent = await sendSoloWelcome(db, { email, name: row.name, resellerName: reseller.name, origin, newAccount: true })
  return sent.ok ? { ok: true, email } : fail(`The email did not send (${sent.error}).`, 502)
}

/** The email that lets a Solo client in. No price in it: what they pay is
 *  between them and their reseller. */
async function sendSoloWelcome(db: any, opts: {
  email: string; name: string; resellerName: string; origin: string; newAccount: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { ok: false, error: 'email is not configured' }

  let link = `${opts.origin}/login`
  if (opts.newAccount) {
    // Our own /reset-password link, as the team owner welcome does
    // (lib/team-owner-invite): it works in any browser.
    const { data, error } = await db.auth.admin.generateLink({
      type: 'recovery', email: opts.email, options: { redirectTo: `${opts.origin}/reset-password` },
    })
    if (error || !data?.properties?.hashed_token) return { ok: false, error: error?.message || 'could not make the sign-in link' }
    link = `${opts.origin}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token as string)}&type=recovery`
  }

  const first = esc(opts.name.split(' ')[0] || opts.name)
  const by = esc(opts.resellerName)
  const subject = opts.newAccount
    ? `${opts.resellerName} has set up your Cardtly card`
    : `${opts.resellerName} now looks after your Cardtly card`
  const intro = opts.newAccount
    ? `${by} has set up a <strong>Cardtly Solo</strong> card for you: your own digital business card, with your QR code, your contacts and NFC. Choose a password to open it and add your details.`
    : `${by} now looks after your Cardtly card on <strong>Cardtly Solo</strong>. Sign in as usual to update it. Speak to ${by} about your plan.`
  const button = opts.newAccount ? 'Choose your password' : 'Sign in'

  try {
    const { error } = await new Resend(resendKey).emails.send({
      from: FROM_EMAIL,
      to: opts.email,
      subject,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;background:#ffffff">
          <h1 style="font-size:22px;margin:0 0 8px">Hi ${first}, your card is ready</h1>
          <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px">${intro}</p>
          <a href="${link}"
            style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">
            ${button}
          </a>
          ${opts.newAccount ? `<p style="color:#999;font-size:13px;line-height:1.6;margin:24px 0 0">
            This link is valid for one hour and can be used once. If it expires, use "Forgot password" on the sign-in page with this address and you will get a fresh one.
          </p>
          <p style="color:#bbb;font-size:12px;margin:20px 0 0;word-break:break-all">Or paste this into your browser:<br>${link}</p>` : ''}
        </div>`,
    })
    return error ? { ok: false, error: 'could not send the email' } : { ok: true }
  } catch {
    return { ok: false, error: 'could not send the email' }
  }
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
