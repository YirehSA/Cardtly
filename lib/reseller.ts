import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { FROM_EMAIL } from '@/lib/email'
import { findUserByEmail } from '@/lib/department-perms'
import { orgSlugPrefix } from '@/lib/card-slug'
import { sendTeamOwnerWelcome } from '@/lib/team-owner-invite'
import { settleOwnerCard } from '@/lib/owner-team-card'
import { createDraftInvoice, recordClientSeats, resellerYears } from '@/lib/reseller-billing'
import {
  clientState, fitsPool, nfcOrderLines, nfcOrderTotalCents, nfcUnitCents, randCents, cleanTerm, currentYear,
  sastMonth, monthLabel, addMonths,
  MAX_NFC_ORDER, type PoolClient, type ResellerClientState, type ResellerNfcKind, type ResellerTerm,
} from '@/lib/reseller-pricing'

// A reseller and the client teams it sells. Everything here runs with the
// service role, behind requireReseller or requireAdmin: the tables are closed
// to the browser (migration 094).
//
// A client team is an ordinary Cardtly team with two differences:
// organizations.reseller_id says who sold it, and billing_period 'reseller'
// puts its seats on that reseller's monthly invoice instead of Paystack. The
// client's own admin runs the team (Andre's choice): the reseller creates it,
// sizes it, pauses or cancels it, and never goes inside.

export const NFC_ORDER_EMAIL = 'info@yireh.co.za'
const MAX_CLIENT_SEATS = 1000

export interface Reseller {
  id: string
  name: string
  contact_name: string | null
  email: string
  phone: string | null
  billing_client_id: string | null
  seat_pool: number
  seat_price_cents: number
  /** Null until a yearly price is agreed: twelve times seat_price_cents. */
  seat_price_year_cents?: number | null
  nfc_blank_cents: number
  nfc_printed_cents: number
  nfc_shipping_cents: number
  status: 'active' | 'suspended' | 'ended'
  notes: string | null
  created_at: string
}

export interface ResellerClient {
  id: string
  name: string
  seats: number
  state: ResellerClientState
  cardsMade: number
  ownerEmail: string | null
  createdAt: string | null
  /** True when the team is no longer on this reseller's bill, because an
   *  admin moved it to another billing mode. Shown, never counted. */
  offBill: boolean
  /** How the reseller sells it. */
  term: ResellerTerm
  /** The paid year that covers this month, or the next one already billed:
   *  YYYY-MM-01 for its first and last months. Null when none is. */
  paidFrom: string | null
  paidTo: string | null
}

type Fail = { error: string; status: number }
const fail = (error: string, status = 400): Fail => ({ error, status })

export function serviceDb() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

/** The reseller this login runs, or null. Tolerant on purpose: the dashboard
 *  layout asks on every page, and before migration 094 there is no table. */
export async function getResellerForUser(db: any, userId: string): Promise<Reseller | null> {
  if (!userId) return null
  try {
    const { data: m, error } = await db
      .from('reseller_members').select('reseller_id').eq('user_id', userId).maybeSingle()
    if (error || !m) return null
    const { data: r } = await db.from('resellers').select('*').eq('id', m.reseller_id).maybeSingle()
    return (r as Reseller) || null
  } catch {
    return null
  }
}

/** The gate for /api/reseller. Signed in, and a member of a reseller. */
export async function requireReseller(): Promise<{ user: { id: string; email?: string | null }; reseller: Reseller; db: any } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  const db = serviceDb()
  const reseller = await getResellerForUser(db, user.id)
  if (!reseller) return { error: NextResponse.json({ error: 'This login does not run a reseller account' }, { status: 403 }) }
  return { user: { id: user.id, email: user.email }, reseller, db }
}

/** Writes are refused while Cardtly has suspended the reseller. Reading stays
 *  open, so they can still see what they owe. */
export function writable(reseller: Reseller): Fail | null {
  if (reseller.status === 'active') return null
  return reseller.status === 'ended'
    ? fail('Your reseller account has ended, so nothing can be changed. Your invoices are still here.', 403)
    : fail('Your reseller account is on hold, so nothing can be changed right now. Contact Cardtly at hello@cardtly.com.', 403)
}

export async function listResellerClients(db: any, resellerId: string): Promise<ResellerClient[]> {
  const { data: orgs } = await db
    .from('organizations').select('*').eq('reseller_id', resellerId).order('created_at', { ascending: true })
  const list = orgs || []
  if (!list.length) return []

  const { data: cards } = await db
    .from('team_cards').select('organization_id').in('organization_id', list.map((o: any) => o.id))
  const made: Record<string, number> = {}
  for (const c of cards || []) made[c.organization_id] = (made[c.organization_id] || 0) + 1

  const emails = await Promise.all(list.map(async (o: any) => {
    if (!o.admin_user_id) return null
    try {
      const { data } = await db.auth.admin.getUserById(o.admin_user_id)
      return data?.user?.email || null
    } catch { return null }
  }))

  // How far each yearly client is paid. A failure here only hides the dates.
  const paid = await resellerYears(db, resellerId).catch(() => ({ years: [], extras: [] }))
  const years = 'error' in paid ? [] : paid.years
  const month = sastMonth(new Date())

  return list.map((o: any, i: number) => {
    const year = currentYear(
      years.filter((y: any) => y.organization_id === o.id).map((y: any) => ({ startMonth: y.start_month, endMonth: y.end_month })),
      month,
    )
    return {
      id: o.id,
      name: o.name || 'Client',
      seats: Math.max(0, Number(o.max_seats) || 0),
      state: clientState(o),
      cardsMade: made[o.id] || 0,
      ownerEmail: emails[i],
      createdAt: o.created_at || null,
      offBill: o.billing_period !== 'reseller',
      term: cleanTerm(o.reseller_term) || 'monthly',
      paidFrom: year?.startMonth || null,
      paidTo: year?.endMonth || null,
    }
  })
}

/** What counts against the pool: clients still on this reseller's bill. */
export function poolClients(clients: ResellerClient[]): PoolClient[] {
  return clients.filter(c => !c.offBill).map(c => ({ id: c.id, seats: c.seats, state: c.state }))
}

function cleanSeats(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= MAX_CLIENT_SEATS ? n : null
}

function poolMessage(left: number, wanted: number): string {
  const free = Math.max(0, left + wanted)
  return `That needs ${wanted} seat${wanted === 1 ? '' : 's'}, and your pool has ${free} left. Ask Cardtly for more seats.`
}

async function ownedClient(db: any, reseller: Reseller, orgId: string): Promise<any | null> {
  if (!orgId) return null
  const { data } = await db.from('organizations').select('*').eq('id', orgId).eq('reseller_id', reseller.id).maybeSingle()
  return data || null
}

/** A new client team, live straight away, with its admin's login. */
export async function createResellerClient(db: any, reseller: Reseller, input: {
  company?: unknown; ownerEmail?: unknown; seats?: unknown; term?: unknown
}, origin: string): Promise<{ ok: true; orgId: string; notes: string[] } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked

  const company = String(input.company ?? '').trim().slice(0, 120)
  const email = String(input.ownerEmail ?? '').trim().toLowerCase()
  const seats = cleanSeats(input.seats)
  // Monthly unless the reseller says otherwise, as every client was before.
  const term = input.term === undefined || input.term === null || input.term === '' ? 'monthly' : cleanTerm(input.term)
  if (!company) return fail('Type the client\'s company name.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return fail(`"${email}" does not look like an email address.`)
  if (!seats) return fail(`Seats are a whole number from 1 to ${MAX_CLIENT_SEATS}.`)
  if (!term) return fail('Choose monthly or yearly.')

  const clients = await listResellerClients(db, reseller.id)
  const fit = fitsPool(reseller.seat_pool, poolClients(clients), seats)
  if (!fit.ok) return fail(poolMessage(fit.left, seats))

  // The client's admin. Somebody who already runs a Cardtly team cannot run a
  // second one: the dashboard opens "the" team for a login, so they would
  // lose sight of one of them.
  let ownerId: string
  let createdAccount = false
  const existing = await findUserByEmail(db, email)
  if (existing) {
    const { data: theirs } = await db.from('organizations').select('id, name').eq('admin_user_id', existing.id).limit(1)
    if (theirs?.length) {
      return fail(`${email} already runs a Cardtly team (${theirs[0].name || 'unnamed'}). Use a different email address for this client's admin.`)
    }
    ownerId = existing.id
  } else {
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { created_by: 'reseller', reseller_id: reseller.id },
    })
    if (error || !created?.user) return fail(`Could not create a login for ${email}: ${error?.message || 'unknown error'}`, 500)
    ownerId = created.user.id
    createdAccount = true
  }

  const { data: org, error: orgErr } = await db.from('organizations').insert({
    admin_user_id: ownerId,
    name: company,
    max_seats: seats,
    used_seats: 0,
    billing_period: 'reseller',
    business_plan_active: true,
    reseller_id: reseller.id,
    card_slug_prefix: orgSlugPrefix(company),
    // Only written when yearly, so a monthly client can still be made before
    // migration 097 added the column.
    ...(term === 'yearly' ? { reseller_term: 'yearly' } : {}),
  }).select('*').maybeSingle()
  if (orgErr || !org) {
    if (/reseller_term/.test(orgErr?.message || '')) {
      return fail('Selling a client yearly is not switched on yet. Choose monthly for now, or ask Cardtly.', 503)
    }
    return fail(`Could not create the team: ${orgErr?.message || 'unknown error'}.`
      + (createdAccount ? ` The login for ${email} was made and will be reused if you try again.` : ''), 500)
  }

  await recordClientSeats(db, org)

  const notes: string[] = []
  if (createdAccount) {
    const sent = await sendTeamOwnerWelcome(email, company, seats, origin)
    notes.push(sent.ok
      ? `${email} has been emailed a link to choose a password.`
      : `The team is live, but the email to ${email} did not send. Use "Send setup email" to try again.`)
  } else {
    notes.push(`${email} already had a Cardtly login, so they sign in as usual and will find the team under Team Cards.`)
    // Their own card belongs in the team as one of its seats, as when Cardtly
    // sets a team up (lib/owner-team-card).
    try { await settleOwnerCard(db, org.id) } catch { /* their card stays where it was */ }
  }
  return { ok: true, orgId: org.id, notes }
}

/** A client's seat count. Never below the cards it has, never past the pool. */
export async function setClientSeats(db: any, reseller: Reseller, orgId: string, raw: unknown): Promise<{ ok: true } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  const seats = cleanSeats(raw)
  if (!seats) return fail(`Seats are a whole number from 1 to ${MAX_CLIENT_SEATS}.`)
  const org = await ownedClient(db, reseller, orgId)
  if (!org) return fail('That client is not one of yours.', 404)
  if (org.billing_period !== 'reseller') return fail('Cardtly now bills this team directly, so its seats are changed by Cardtly.')
  if (clientState(org) === 'cancelled') return fail('Switch the client back on first.')

  const { count } = await db.from('team_cards').select('id', { count: 'exact', head: true }).eq('organization_id', org.id)
  if ((count || 0) > seats) {
    const over = (count || 0) - seats
    return fail(`${org.name} already has ${count} cards, so it cannot go down to ${seats} seats. Their admin has to remove ${over} card${over === 1 ? '' : 's'} first.`)
  }
  const clients = await listResellerClients(db, reseller.id)
  const fit = fitsPool(reseller.seat_pool, poolClients(clients), seats, org.id)
  if (!fit.ok) return fail(poolMessage(fit.left, seats - Math.max(0, Number(org.max_seats) || 0)))

  const { data: saved, error } = await db.from('organizations')
    .update({ max_seats: seats, updated_at: new Date().toISOString() }).eq('id', org.id).select('*').maybeSingle()
  if (error || !saved) return fail(error?.message || 'Could not save the seats.', 500)
  await recordClientSeats(db, saved)
  return { ok: true }
}

/** Sell a client monthly or yearly from now on. See lib/reseller-pricing for
 *  what each means on the invoice; the note returned says it for this client. */
export async function setClientTerm(db: any, reseller: Reseller, orgId: string, raw: unknown): Promise<{ ok: true; note: string } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  const term = cleanTerm(raw)
  if (!term) return fail('Choose monthly or yearly.')
  const org = await ownedClient(db, reseller, orgId)
  if (!org) return fail('That client is not one of yours.', 404)
  if (org.billing_period !== 'reseller') return fail('Cardtly now bills this team directly, so it is managed by Cardtly.')

  const name = org.name || 'This client'
  const month = sastMonth(new Date())
  const paid = await resellerYears(db, reseller.id)
  const years = 'error' in paid ? [] : paid.years.filter(y => y.organization_id === org.id)
  const year = currentYear(years.map(y => ({ startMonth: y.start_month, endMonth: y.end_month })), month)

  if ((cleanTerm(org.reseller_term) || 'monthly') === term) return { ok: true, note: `${name} is already ${term}.` }

  const { data: saved, error } = await db.from('organizations')
    .update({ reseller_term: term, updated_at: new Date().toISOString() }).eq('id', org.id).select('*').maybeSingle()
  if (error || !saved) {
    if (/reseller_term/.test(error?.message || '')) return fail('Selling a client yearly is not switched on yet. Ask Cardtly.', 503)
    return fail(error?.message || 'Could not save.', 500)
  }
  // The month is recorded with its new term straight away, so the invoice
  // drafted on the 1st bills it the way it is now sold.
  await recordClientSeats(db, saved)

  let note: string
  if (term === 'yearly') {
    note = year
      ? `${name} is paid up to ${monthLabel(year.endMonth)}, and renews yearly from ${monthLabel(addMonths(year.endMonth, 1))}.`
      : clientState(saved) !== 'live'
      ? `${name} is now yearly. Its first year starts in the month you switch it back on.`
      : `${name} is now yearly: ${monthLabel(month)} to ${monthLabel(addMonths(month, 11))} is billed on your next Cardtly invoice, in place of this month.`
  } else {
    note = year
      ? `${name} stays paid up to ${monthLabel(year.endMonth)}, and is billed monthly from ${monthLabel(addMonths(year.endMonth, 1))}.`
      : `${name} is now monthly, from ${monthLabel(month)}.`
  }
  return { ok: true, note }
}

/** Pause (cards show a notice and the team loses Pro), switch back on, or
 *  cancel (cards stop working and the seats go back to the pool). */
export async function setClientState(db: any, reseller: Reseller, orgId: string, to: unknown, message?: unknown): Promise<{ ok: true } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  const org = await ownedClient(db, reseller, orgId)
  if (!org) return fail('That client is not one of yours.', 404)
  if (org.billing_period !== 'reseller') return fail('Cardtly now bills this team directly, so it is managed by Cardtly.')
  const now = clientState(org)
  const at = new Date().toISOString()
  let patch: Record<string, any>

  if (to === 'paused') {
    if (now !== 'live') return fail('Only a live client can be paused.')
    const note = String(message ?? '').trim().slice(0, 300)
    patch = { suspended_at: at, suspension_message: note || null }
  } else if (to === 'live') {
    if (now === 'live') return { ok: true }
    if (now === 'cancelled') {
      const clients = await listResellerClients(db, reseller.id)
      const seats = Math.max(0, Number(org.max_seats) || 0)
      const fit = fitsPool(reseller.seat_pool, poolClients(clients).filter(c => c.id !== org.id), seats)
      if (!fit.ok) return fail(poolMessage(fit.left, seats))
    }
    patch = { business_plan_active: true, suspended_at: null, suspension_message: null }
  } else if (to === 'cancelled') {
    if (now === 'cancelled') return { ok: true }
    patch = { business_plan_active: false, suspended_at: null, suspension_message: null }
  } else {
    return fail('Unknown change.')
  }

  const { data: saved, error } = await db.from('organizations')
    .update({ ...patch, updated_at: at }).eq('id', org.id).select('*').maybeSingle()
  if (error || !saved) return fail(error?.message || 'Could not save.', 500)
  await recordClientSeats(db, saved)
  return { ok: true }
}

/** The set-your-password email again, for a client admin who lost the first. */
export async function resendClientWelcome(db: any, reseller: Reseller, orgId: string, origin: string): Promise<{ ok: true; email: string } | Fail> {
  const org = await ownedClient(db, reseller, orgId)
  if (!org?.admin_user_id) return fail('That client is not one of yours.', 404)
  const { data } = await db.auth.admin.getUserById(org.admin_user_id)
  const email = data?.user?.email
  if (!email) return fail('That client has no admin email on record.')
  const sent = await sendTeamOwnerWelcome(email, org.name || 'Your team', Number(org.max_seats) || 1, origin)
  return sent.ok ? { ok: true, email } : fail(`The email did not send (${sent.error || sent.reason}).`, 502)
}

// ── NFC orders ──────────────────────────────────────────────────────────────

export interface ShipTo { name: string; phone: string; address: string; city: string; province: string; postalCode: string }

function cleanShipTo(raw: any): ShipTo | null {
  const s = (v: unknown, n = 160) => String(v ?? '').trim().slice(0, n)
  const ship = {
    name: s(raw?.name, 120), phone: s(raw?.phone, 40), address: s(raw?.address, 240),
    city: s(raw?.city, 80), province: s(raw?.province, 80), postalCode: s(raw?.postalCode, 12),
  }
  return ship.name && ship.address && ship.city && ship.postalCode ? ship : null
}

const escHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** An order and its invoice, drafted straight away. Cards are made once the
 *  invoice is paid, as with every NFC order. */
export async function placeResellerNfcOrder(db: any, reseller: Reseller, input: {
  kind?: unknown; quantity?: unknown; organizationId?: unknown; cardIds?: unknown; notes?: unknown; shipTo?: unknown
}, actor: string): Promise<{ ok: true; orderId: string; totalCents: number } | Fail> {
  const blocked = writable(reseller)
  if (blocked) return blocked
  if (!reseller.billing_client_id) return fail('Your account is not set up for invoices yet. Contact Cardtly at hello@cardtly.com.')

  const kind: ResellerNfcKind | null = input.kind === 'blank' || input.kind === 'printed' ? input.kind : null
  if (!kind) return fail('Choose blank cards or cards printed by Cardtly.')
  const shipTo = cleanShipTo(input.shipTo)
  if (!shipTo) return fail('Fill in who the cards go to: name, address, city and postal code.')
  const notes = String(input.notes ?? '').trim().slice(0, 1000) || null

  let quantity = Math.floor(Number(input.quantity))
  let clientName: string | null = null
  let organizationId: string | null = null
  let cards: Array<{ id: string; name: string; title: string | null; slug: string | null }> | null = null

  if (kind === 'printed') {
    const org = await ownedClient(db, reseller, String(input.organizationId ?? ''))
    if (!org) return fail('Choose which client the printed cards are for.')
    organizationId = org.id
    clientName = org.name || null
    const ids = Array.isArray(input.cardIds) ? input.cardIds.map(String).slice(0, MAX_NFC_ORDER) : []
    if (ids.length) {
      const { data: rows } = await db
        .from('team_cards').select('id, name, title, slug').eq('organization_id', org.id).in('id', ids)
      cards = (rows || []).map((c: any) => ({ id: c.id, name: c.name || '', title: c.title || null, slug: c.slug || null }))
      if (!cards || !cards.length) return fail('None of those cards belong to that client.')
      // One printed card per person picked, each programmed with their link.
      quantity = cards.length
    }
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_NFC_ORDER) {
    return fail(`Order between 1 and ${MAX_NFC_ORDER} cards.`)
  }

  const prices = {
    nfcBlankCents: Number(reseller.nfc_blank_cents) || 0,
    nfcPrintedCents: Number(reseller.nfc_printed_cents) || 0,
    nfcShippingCents: Number(reseller.nfc_shipping_cents) || 0,
  }
  const lines = nfcOrderLines(kind, quantity, prices, clientName)

  const { data: order, error: oErr } = await db.from('reseller_nfc_orders').insert({
    reseller_id: reseller.id,
    kind, quantity,
    unit_cents: nfcUnitCents(kind, prices),
    shipping_cents: prices.nfcShippingCents,
    total_cents: nfcOrderTotalCents(kind, quantity, prices),
    organization_id: organizationId,
    client_name: clientName,
    cards,
    notes,
    ship_to: shipTo,
    created_by: actor,
  }).select('*').maybeSingle()
  if (oErr || !order) return fail(oErr?.message || 'Could not place the order.', 500)

  const ref = String(order.id).slice(0, 8).toUpperCase()
  const made = await createDraftInvoice(db, {
    clientId: reseller.billing_client_id,
    lines,
    notes: `NFC order ${ref} for ${reseller.name}. The cards are made once this invoice is paid.`,
    event: 'drafted_reseller_nfc_order',
    meta: { reseller_id: reseller.id, order_id: order.id, kind, quantity },
    actor,
  })
  if ('error' in made) {
    // An order nobody will ever invoice is worse than no order.
    await db.from('reseller_nfc_orders').delete().eq('id', order.id)
    return fail(`Could not raise the invoice for that order: ${made.error}`, 500)
  }
  await db.from('reseller_nfc_orders').update({ invoice_id: made.id }).eq('id', order.id)

  // Tell Cardtly. Best-effort: the order and its draft invoice already exist.
  if (process.env.RESEND_API_KEY) {
    try {
      const cardRows = (cards || []).map(c => `<li>${escHtml(c.name)}${c.title ? `, ${escHtml(c.title)}` : ''}${c.slug ? ` (cardtly.com/card/${escHtml(c.slug)})` : ''}</li>`).join('')
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: FROM_EMAIL,
        to: NFC_ORDER_EMAIL,
        replyTo: reseller.email,
        subject: `Reseller NFC order ${ref}: ${reseller.name}, ${quantity} ${kind} card${quantity === 1 ? '' : 's'}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin:0 0 12px;font-size:20px">Reseller NFC order ${ref}</h2>
            <p style="margin:0 0 6px"><strong>Reseller:</strong> ${escHtml(reseller.name)} (${escHtml(reseller.email)})</p>
            <p style="margin:0 0 6px"><strong>Cards:</strong> ${quantity} &times; ${kind === 'printed' ? 'printed by Cardtly' : 'blank'} at ${randCents(nfcUnitCents(kind, prices))}</p>
            ${clientName ? `<p style="margin:0 0 6px"><strong>For client:</strong> ${escHtml(clientName)}</p>` : ''}
            ${cardRows ? `<ul style="margin:6px 0 12px">${cardRows}</ul>` : ''}
            ${notes ? `<p style="margin:0 0 6px;white-space:pre-wrap"><strong>Notes:</strong> ${escHtml(notes)}</p>` : ''}
            <p style="margin:12px 0 6px"><strong>Ship to:</strong> ${escHtml(shipTo.name)}, ${escHtml(shipTo.phone)}<br>${escHtml(shipTo.address)}, ${escHtml(shipTo.city)}, ${escHtml(shipTo.province)} ${escHtml(shipTo.postalCode)}</p>
            <p style="margin:16px 0 0;padding:12px;background:#fff3cd;border-radius:8px">
              A draft invoice for <strong>${randCents(made.totalCents)}</strong> is waiting under Admin, Resellers. Approve and send it; make the cards once it is paid.
            </p>
          </div>`,
      })
    } catch { /* the order is saved and visible in admin */ }
  }

  return { ok: true, orderId: order.id, totalCents: made.totalCents }
}

/** For a client team's own screens: who to talk to about seats and billing. */
export async function managedByFor(db: any, org: any): Promise<{ name: string; email: string | null } | null> {
  if (!org?.reseller_id || org.billing_period !== 'reseller') return null
  try {
    const { data } = await db.from('resellers').select('name, email').eq('id', org.reseller_id).maybeSingle()
    return data ? { name: data.name, email: data.email || null } : { name: 'your reseller', email: null }
  } catch {
    return { name: 'your reseller', email: null }
  }
}
