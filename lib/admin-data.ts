import { FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'
import { isBillablePaystackSub, listActivePaystackSubs } from '@/lib/paystack'
import { orgMonthlyRand, BILLING_MODE_META, isOrgBillingMode, orgTrialDaysLeft, orgNeedsCollecting, type OrgBillingMode } from '@/lib/org-billing'
import { computeRep, type RepRow, type RepStats } from '@/lib/reps'

// Everything the admin page needs, assembled in one place so the page stays a
// thin shell and this stays testable.
//
// What changed from the old inline version:
//  - listUsers was capped at perPage:1000 with no pagination, so user #1001
//    silently vanished and the page was WRONG rather than slow. It now pages.
//  - contacts were fetched in full and used only for .length. Now a count.
//  - card_events were fetched unbounded and tallied in JS. Supabase caps a
//    response at 1000 rows, so the 30-day numbers were already silently
//    truncated. Now paged, with an explicit flag when the cap is hit, so a
//    wrong number is never shown as if it were right.
//  - trial_ends_at was never fetched at all, which is why the admin could not
//    see the one thing that now decides whether a card is online.

const DAY = 24 * 60 * 60 * 1000
export const SEAT_PRICE_RAND = 97
export const MAX_SELF_SERVE_SEATS = 20

export type UserStatus = 'paying' | 'comped' | 'member' | 'expired' | 'expiring' | 'trial' | 'none'

export interface AdminUserRow {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  country: string | null
  countryCode: string | null
  city: string | null
  isAdmin: boolean
  status: UserStatus
  planId: string | null
  billingCycle: string | null
  trialEndsAt: string | null
  trialDaysLeft: number | null
  org: { id: string; name: string; maxSeats: number; cardsCreated: number; cardsClaimed: number } | null
  memberOfOrg: string | null
  card: { id: string; name: string | null; slug: string | null; views: number } | null
  views: number
  remindersSent: string[]
  repId: string | null
}

export interface DeptRow {
  id: string
  name: string
  hasBrand: boolean
  cardCount: number
  managers: { userId: string; email: string | null }[]
}

export interface AdminOrgRow {
  id: string
  name: string
  adminUserId: string
  adminEmail: string | null
  maxSeats: number
  cardsCreated: number
  cardsClaimed: number
  monthlyRand: number
  isEnterprise: boolean
  billingMode: OrgBillingMode
  billingNotes: string | null
  isRevenue: boolean
  repId: string | null
  trialEndsAt: string | null
  trialDaysLeft: number | null
  lastCollectedOn: string | null
  needsCollecting: boolean
  suspendedAt: string | null
  suspensionMessage: string | null
  departments: DeptRow[]
  createdAt: string
}

// Page through the auth list rather than trusting one 1000-row call.
async function listAllUsers(admin: any): Promise<any[]> {
  const out: any[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const batch = data?.users || []
    out.push(...batch)
    if (batch.length < 200) break
  }
  return out
}

// Page through a table the same way, with an honest truncation flag.
async function pageRows(admin: any, table: string, columns: string, filter: (q: any) => any, cap = 20000) {
  const out: any[] = []
  const size = 1000
  for (let from = 0; from < cap; from += size) {
    let q = admin.from(table).select(columns).range(from, from + size - 1)
    q = filter(q)
    const { data, error } = await q
    if (error) return { rows: out, truncated: false, error }
    out.push(...(data || []))
    if ((data || []).length < size) return { rows: out, truncated: false }
  }
  return { rows: out, truncated: true }
}

export async function loadAdminData(admin: any) {
  const since = new Date(Date.now() - 30 * DAY).toISOString()

  const [
    users,
    { data: subscriptions },
    { data: cards },
    { data: teamCards },
    { data: orgs },
    { data: nfcOrders },
    { count: contactsCount },
    { data: profiles },
    { data: trialEmails },
    { data: auditRows },
    cardViews,
    { data: repRows },
    { data: payoutRows },
    { data: deptRows },
    { data: deptManagerRows },
  ] = await Promise.all([
    listAllUsers(admin),
    admin.from('whop_subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('cards').select('id, name, slug, user_id, view_count, created_at'),
    admin.from('team_cards').select('id, name, slug, user_id, organization_id, department_id, view_count, claimed_at, created_at'),
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('nfc_orders').select('*').order('created_at', { ascending: false }),
    // Was: fetch every contact row to call .length on it.
    admin.from('contacts').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('user_id, signup_country, signup_country_code, signup_city, is_admin, trial_ends_at, rep_id'),
    admin.from('trial_emails').select('user_id, kind'),
    admin.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    pageRows(admin, 'card_events', 'card_id', (q: any) => q.eq('event_type', 'view').gte('created_at', since)),
    admin.from('reps').select('*').order('created_at', { ascending: true }),
    admin.from('rep_payouts').select('*').order('period_start', { ascending: false }),
    // These two MUST stay last, aligned with deptRows/deptManagerRows in the
    // destructuring above. A Promise.all binds by position, so inserting them
    // mid-array silently rebinds every result after them: departments landed
    // in repRows, reps in deptRows, and the whole tab went quietly wrong.
    admin.from('departments').select('id, organization_id, name, brand').order('created_at', { ascending: true }),
    admin.from('department_managers').select('department_id, user_id'),
  ])

  // Real subscription amounts, from Paystack. Never derived from our own
  // price constant: a subscription locks in the plan price at creation, so
  // the live ones still bill R65 from when the plan was R65.
  const paystack = await listActivePaystackSubs()

  const { data: activeAnnouncement } = await admin
    .from('app_announcements')
    .select('id, message, link_url, link_text, variant, display_style, created_at')
    .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()

  const profileBy = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]))
  const orgByAdmin = Object.fromEntries((orgs || []).map((o: any) => [o.admin_user_id, o]))
  const orgById = Object.fromEntries((orgs || []).map((o: any) => [o.id, o]))
  const emailById = Object.fromEntries(users.map((u: any) => [u.id, u.email]))

  // Active subscription per user. Most recent wins, matching getUserPlan.
  const subBy: Record<string, any> = {}
  for (const s of subscriptions || []) {
    if (s.status !== 'active') continue
    if (!subBy[s.user_id]) subBy[s.user_id] = s
  }

  const cardBy: Record<string, any> = {}
  for (const c of cards || []) if (c.user_id && !cardBy[c.user_id]) cardBy[c.user_id] = c

  const memberOrgBy: Record<string, any> = {}
  for (const tc of teamCards || []) {
    if (tc.user_id && !memberOrgBy[tc.user_id]) memberOrgBy[tc.user_id] = orgById[tc.organization_id] || null
  }

  const remindersBy: Record<string, string[]> = {}
  for (const r of trialEmails || []) {
    (remindersBy[r.user_id] ||= []).push(r.kind)
  }

  // Seat utilisation: how many cards the org actually has, and how many have
  // been claimed by a person. `organizations.used_seats` exists but nothing
  // maintains it, so it is ignored rather than believed.
  const cardsByOrg: Record<string, { created: number; claimed: number }> = {}
  for (const tc of teamCards || []) {
    if (!tc.organization_id) continue
    const b = (cardsByOrg[tc.organization_id] ||= { created: 0, claimed: 0 })
    b.created++
    if (tc.user_id) b.claimed++
  }

  const now = Date.now()

  const rows: AdminUserRow[] = users.map((u: any) => {
    const p = profileBy[u.id] || {}
    const sub = subBy[u.id] || null
    const org = orgByAdmin[u.id] || null
    const memberOrg = memberOrgBy[u.id] || null
    const trialEndsAt = p.trial_ends_at || null
    const msLeft = trialEndsAt ? new Date(trialEndsAt).getTime() - now : null
    const daysLeft = msLeft === null || !Number.isFinite(msLeft) ? null : Math.ceil(msLeft / DAY)

    // Precedence mirrors what actually decides access:
    // an active sub wins, then a claimed team card (served by the org and
    // never gated on a personal trial), then the trial.
    let status: UserStatus
    if (sub) status = isBillablePaystackSub(sub) ? 'paying' : 'comped'
    else if (memberOrg) status = 'member'
    else if (daysLeft === null) status = 'trial'      // no date: fails open, still live
    else if (daysLeft <= 0) status = 'expired'
    else if (daysLeft <= 7) status = 'expiring'
    else status = 'trial'

    const card = cardBy[u.id] || null
    const orgSeats = org ? cardsByOrg[org.id] || { created: 0, claimed: 0 } : null

    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed: !!u.email_confirmed_at,
      country: p.signup_country || null,
      countryCode: p.signup_country_code || null,
      city: p.signup_city || null,
      isAdmin: !!p.is_admin || u.id === FOUNDER_ADMIN_USER_ID,
      status,
      planId: sub?.plan_id || null,
      billingCycle: sub?.billing_cycle || null,
      trialEndsAt,
      trialDaysLeft: daysLeft,
      org: org ? { id: org.id, name: org.name, maxSeats: org.max_seats ?? 0, cardsCreated: orgSeats!.created, cardsClaimed: orgSeats!.claimed } : null,
      memberOfOrg: memberOrg?.name || null,
      card: card ? { id: card.id, name: card.name, slug: card.slug, views: card.view_count || 0 } : null,
      views: card?.view_count || 0,
      remindersSent: remindersBy[u.id] || [],
      repId: p.rep_id || null,
    }
  })

  // Departments per org, with their managers (by email) and how many cards
  // sit in each. Loaded here so the admin can set the structure up; managers
  // manage the look themselves in the dashboard.
  const cardsInDept: Record<string, number> = {}
  for (const tc of teamCards || []) {
    if (tc.department_id) cardsInDept[tc.department_id] = (cardsInDept[tc.department_id] || 0) + 1
  }
  const managersByDept: Record<string, { userId: string; email: string | null }[]> = {}
  for (const m of deptManagerRows || []) {
    (managersByDept[m.department_id] ||= []).push({ userId: m.user_id, email: emailById[m.user_id] || null })
  }
  const deptsByOrg: Record<string, DeptRow[]> = {}
  for (const d of deptRows || []) {
    (deptsByOrg[d.organization_id] ||= []).push({
      id: d.id,
      name: d.name,
      // Whether the department sets any brand of its own, so the UI can show
      // "custom look" vs "inherits org".
      hasBrand: !!d.brand && Object.keys(d.brand).length > 0,
      cardCount: cardsInDept[d.id] || 0,
      managers: managersByDept[d.id] || [],
    })
  }

  const orgRows: AdminOrgRow[] = (orgs || []).map((o: any) => {
    const b = cardsByOrg[o.id] || { created: 0, claimed: 0 }
    // Narrow once: anything unrecognised is treated as 'monthly', matching
    // the DB default and the CHECK added in migration 029.
    const mode: OrgBillingMode = isOrgBillingMode(o.billing_period) ? o.billing_period : 'monthly'
    return {
      id: o.id,
      name: o.name,
      adminUserId: o.admin_user_id,
      adminEmail: emailById[o.admin_user_id] || null,
      maxSeats: o.max_seats ?? 0,
      cardsCreated: b.created,
      cardsClaimed: b.claimed,
      // Worth 0 unless something is actually billing them. A seat count is
      // not revenue.
      monthlyRand: orgMonthlyRand(o.max_seats ?? 0, mode),
      isEnterprise: mode === 'debit_order' || (o.max_seats ?? 0) > MAX_SELF_SERVE_SEATS,
      billingMode: mode,
      billingNotes: o.billing_notes || null,
      isRevenue: BILLING_MODE_META[mode].isRevenue,
      repId: o.rep_id || null,
      trialEndsAt: o.trial_ends_at || null,
      trialDaysLeft: orgTrialDaysLeft(mode, o.trial_ends_at || null),
      lastCollectedOn: o.last_collected_on || null,
      needsCollecting: orgNeedsCollecting(mode, o.last_collected_on || null),
      suspendedAt: o.suspended_at || null,
      suspensionMessage: o.suspension_message || null,
      departments: deptsByOrg[o.id] || [],
      createdAt: o.created_at,
    }
  }).sort((a: AdminOrgRow, b: AdminOrgRow) => b.maxSeats - a.maxSeats)

  const views30dByCard: Record<string, number> = {}
  for (const e of cardViews.rows) if (e?.card_id) views30dByCard[e.card_id] = (views30dByCard[e.card_id] || 0) + 1

  // Reps. Each one is scored only on the clients attributed to them: their
  // paying cards vs their target, with trials shown separately as pipeline
  // rather than counted as money.
  const reps: RepStats[] = ((repRows || []) as RepRow[]).map((rep) => computeRep(
    rep,
    rows.filter(r => r.repId === rep.id).map(r => ({
      userId: r.id,
      email: r.email,
      name: r.card?.name ?? null,
      // computeRep decides paying vs comped from the subscription itself, so
      // hand it the raw row rather than our derived status.
      sub: subBy[r.id] || null,
      trialEndsAt: r.trialEndsAt,
      hasCard: !!r.card,
    })),
    orgRows.filter(o => o.repId === rep.id).map(o => ({
      id: o.id, name: o.name, maxSeats: o.maxSeats,
      billingPeriod: o.billingMode,
    })),
    (payoutRows || []).filter((p: any) => p.rep_id === rep.id),
  ))

  const byStatus = (s: UserStatus) => rows.filter(r => r.status === s).length
  // Only a real Paystack subscription is revenue. A comp is not, and neither
  // is a team's seat count: nothing bills orgs through a subscription (no
  // whop_subscriptions row carries an organization_id), so counting seats as
  // MRR would invent money that is not being collected.
  const payingRows = rows.filter(r => r.status === 'paying')
  const mrrRand = paystack.ok
    ? Math.round(paystack.subs.reduce((n, s) => n + (s.amount || 0), 0) / 100)
    : null

  const stats = {
    totalUsers: rows.length,
    paying: payingRows.length,
    comped: byStatus('comped'),
    members: byStatus('member'),
    trialing: byStatus('trial'),
    expiring: byStatus('expiring'),
    expired: byStatus('expired'),
    totalCards: (cards || []).length,
    totalTeamCards: (teamCards || []).length,
    totalOrgs: (orgs || []).length,
    openNfcOrders: (nfcOrders || []).filter((o: any) => !['delivered', 'cancelled'].includes(o.status)).length,
    // Team trials that lapsed or are about to, and debit orders nobody has
    // collected. Nothing enforces either, so this is what does the noticing.
    teamTrialsLapsed: orgRows.filter((o: AdminOrgRow) => o.trialDaysLeft !== null && o.trialDaysLeft <= 0).length,
    teamTrialsEnding: orgRows.filter((o: AdminOrgRow) => o.trialDaysLeft !== null && o.trialDaysLeft > 0 && o.trialDaysLeft <= 7).length,
    debitOrdersToCollect: orgRows.filter((o: AdminOrgRow) => o.needsCollecting).length,
    debitOrderRandDue: orgRows.filter((o: AdminOrgRow) => o.needsCollecting).reduce((n: number, o: AdminOrgRow) => n + o.monthlyRand, 0),
    suspendedTeams: orgRows.filter((o: AdminOrgRow) => o.suspendedAt).length,
    totalContacts: contactsCount ?? 0,
    views30d: cardViews.rows.length,
    views30dTruncated: cardViews.truncated,
    // null when Paystack could not be reached: the UI must say "unknown"
    // rather than quietly show R0 as though that were a fact.
    mrrRand,
    mrrError: paystack.ok ? null : (paystack.error || 'Could not reach Paystack'),
    paystackSubs: paystack.subs,
  }

  return {
    users: rows,
    orgs: orgRows,
    reps,
    cards: (cards || []).map((c: any) => ({ ...c, views_30d: views30dByCard[c.id] || 0 }))
      .sort((a: any, b: any) => (b.views_30d - a.views_30d) || ((b.view_count || 0) - (a.view_count || 0))),
    teamCards: (teamCards || []).map((tc: any) => ({ ...tc, org_name: orgById[tc.organization_id]?.name || null }))
      .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)),
    nfcOrders: nfcOrders || [],
    audit: auditRows || [],
    stats,
    announcement: activeAnnouncement || null,
  }
}
