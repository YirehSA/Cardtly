import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { auditLog } from '@/lib/admin-audit'
import { findUserByEmail } from '@/lib/department-perms'
import { sendResellerWelcome, sendResellerApproved } from '@/lib/reseller-invite'
import { listResellerClients, poolClients } from '@/lib/reseller'
import { draftResellerMonth, rebuildResellerMonth, estimateResellerMonth, resellerPrices } from '@/lib/reseller-billing'
import { sastMonth, previousMonth, monthLabel, seatsSold, RESELLER_DEFAULTS } from '@/lib/reseller-pricing'
import { syncResellerFreeCard, FREE_CARD_TEXT } from '@/lib/reseller-comp'
import { requireResellerProgramme, managerMay, adminOnly } from '@/lib/reseller-programme'
import { resellerDeleteBlocker, neverIssued, LIVE_NFC_STATUSES, type ResellerDeleteFacts } from '@/lib/reseller-delete'

// Admin: the resellers, their pools and prices, their clients, and what they
// are being billed. See migration 094 and lib/reseller-billing.

export const runtime = 'nodejs'

const NFC_STATUSES = ['awaiting_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled'] as const

function cents(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Math.round(Number(raw))
  return Number.isFinite(n) && n >= 0 && n <= 100_000_00 ? n : null
}

/** The yearly seat price: blank means "twelve times the monthly", stored as
 *  null; anything else must be an amount. undefined when it is not valid. */
function yearCents(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Math.round(Number(raw))
  return Number.isFinite(n) && n >= 0 && n <= 100_000_00 ? n : undefined
}

function wholeSeats(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : null
}

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s)

/** A login for this reseller: an existing account, or a new one with a
 *  set-your-password email. */
async function linkLogin(db: any, reseller: any, email: string, origin: string, fromApplication = false): Promise<{ ok: true; note: string } | { error: string }> {
  const existing = await findUserByEmail(db, email)
  let userId: string
  let created = false
  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { created_by: 'admin_reseller_setup', reseller_id: reseller.id },
    })
    if (error || !data?.user) return { error: `Could not create a login for ${email}: ${error?.message || 'unknown error'}` }
    userId = data.user.id
    created = true
  }

  const { data: already } = await db.from('reseller_members').select('reseller_id').eq('user_id', userId).maybeSingle()
  if (already && already.reseller_id !== reseller.id) {
    return { error: `${email} already runs another reseller account. One login runs one reseller.` }
  }
  if (!already) {
    const { error } = await db.from('reseller_members').insert({ reseller_id: reseller.id, user_id: userId })
    if (error) return { error: error.message || 'Could not link the login' }
  }

  if (!created) {
    // An applicant who already had a login gets no password email, so tell
    // them they were approved and where to look.
    if (fromApplication) {
      const sent = await sendResellerApproved(email, reseller.name, origin)
      return { ok: true, note: sent.ok
        ? `${email} already had a Cardtly login, and has been emailed that they are approved.`
        : `${email} already had a Cardtly login, but the approval email did not send. Let them know they can sign in.` }
    }
    return { ok: true, note: `${email} already had a Cardtly login, so they sign in as usual and will find Reseller in their dashboard.` }
  }
  const sent = await sendResellerWelcome(email, reseller.name, Number(reseller.seat_pool) || 0, origin)
  return {
    ok: true,
    note: sent.ok
      ? `A login was made for ${email} and they have been emailed a link to choose a password.`
      : `A login was made for ${email}, but the email did not send (${sent.error || sent.reason}). Send them a password reset from Users.`,
  }
}

// Read by admins and by the rep who runs the reseller programme
// (lib/reseller-programme): he sees every reseller, its clients and invoices.
export async function GET() {
  const gate = await requireResellerProgramme()
  if ('error' in gate) return gate.error
  const db = adminDb()

  const { data: resellers, error } = await db.from('resellers').select('*').order('created_at', { ascending: true })
  if (error) {
    return NextResponse.json({ error: 'Resellers are not set up on this database yet. Run migration 094.' }, { status: 503 })
  }

  const now = new Date()
  const thisMonth = sastMonth(now)
  const lastMonth = previousMonth(thisMonth)
  const ids = (resellers || []).map((r: any) => r.id)

  const [members, usage, claims, orders, billingClients] = await Promise.all([
    ids.length ? db.from('reseller_members').select('*').in('reseller_id', ids) : { data: [] },
    ids.length ? db.from('reseller_seat_months').select('*').in('reseller_id', ids).in('month', [thisMonth, lastMonth]) : { data: [] },
    ids.length ? db.from('reseller_invoices').select('*').in('reseller_id', ids).order('month', { ascending: false }) : { data: [] },
    ids.length ? db.from('reseller_nfc_orders').select('*').in('reseller_id', ids).order('created_at', { ascending: false }).limit(200) : { data: [] },
    ids.length ? db.from('billing_clients').select('id, name, email, address, vat_number').in('id', (resellers || []).map((r: any) => r.billing_client_id).filter(Boolean)) : { data: [] },
  ])

  const invoiceIds = [
    ...((claims.data || []).map((c: any) => c.invoice_id)),
    ...((orders.data || []).map((o: any) => o.invoice_id)),
  ].filter(Boolean)
  const { data: invoices } = invoiceIds.length
    ? await db.from('invoices').select('id, number, status, total_cents, paid_cents, issued_at').in('id', invoiceIds)
    : { data: [] }
  const invoiceById = Object.fromEntries((invoices || []).map((i: any) => [i.id, i]))

  const emailOf = async (userId: string) => {
    try { return (await db.auth.admin.getUserById(userId)).data?.user?.email || null } catch { return null }
  }

  const out = await Promise.all((resellers || []).map(async (r: any) => {
    const clients = await listResellerClients(db, r.id)
    const logins = await Promise.all((members.data || []).filter((m: any) => m.reseller_id === r.id)
      .map(async (m: any) => ({ user_id: m.user_id, email: await emailOf(m.user_id) })))
    const seatsIn = (month: string) => (usage.data || [])
      .filter((u: any) => u.reseller_id === r.id && u.month === month)
      .reduce((n: number, u: any) => n + (Number(u.peak_seats) || 0), 0)
    // Read only: the GET reports, the writes below make it so.
    let freeCard: any = null
    try { freeCard = await syncResellerFreeCard(db, r, { dryRun: true }) } catch { /* shown as unknown */ }
    // Worked out as the invoice will be, yearly clients included.
    const estimate = await estimateResellerMonth(db, r, thisMonth)
    return {
      ...r,
      yearlyCents: resellerPrices(r).yearlyCents,
      freeCard: freeCard ? { ...freeCard, text: FREE_CARD_TEXT[freeCard.state as keyof typeof FREE_CARD_TEXT] } : null,
      logins,
      clients,
      sold: seatsSold(poolClients(clients)),
      billingClient: (billingClients.data || []).find((c: any) => c.id === r.billing_client_id) || null,
      thisMonth: { month: thisMonth, label: monthLabel(thisMonth), seats: estimate.seats, cents: estimate.cents },
      lastMonth: { month: lastMonth, label: monthLabel(lastMonth), seats: seatsIn(lastMonth) },
      months: (claims.data || []).filter((c: any) => c.reseller_id === r.id).map((c: any) => ({
        month: c.month, label: monthLabel(c.month), invoice: c.invoice_id ? invoiceById[c.invoice_id] || null : null,
      })),
      nfcOrders: (orders.data || []).filter((o: any) => o.reseller_id === r.id).map((o: any) => ({
        ...o, invoice: o.invoice_id ? invoiceById[o.invoice_id] || null : null,
      })),
    }
  }))

  return NextResponse.json({ resellers: out, thisMonth, lastMonth, defaults: RESELLER_DEFAULTS })
}

/** A new reseller: its billing client, its record, and its first login. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const body = await request.json().catch(() => ({}))

  const name = String(body.name ?? '').trim().slice(0, 120)
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!name) return NextResponse.json({ error: 'The reseller needs a company name.' }, { status: 400 })
  if (!isEmail(email)) return NextResponse.json({ error: `"${email}" does not look like an email address.` }, { status: 400 })

  const pool = wholeSeats(body.seat_pool, 0)
  const seat = cents(body.seat_price_cents, RESELLER_DEFAULTS.seatPriceCents)
  const blank = cents(body.nfc_blank_cents, RESELLER_DEFAULTS.nfcBlankCents)
  const printed = cents(body.nfc_printed_cents, RESELLER_DEFAULTS.nfcPrintedCents)
  const shipping = cents(body.nfc_shipping_cents, RESELLER_DEFAULTS.nfcShippingCents)
  const yearly = yearCents(body.seat_price_year_cents)
  if (pool === null) return NextResponse.json({ error: 'The seat pool is a whole number.' }, { status: 400 })
  if (seat === null || blank === null || printed === null || shipping === null || yearly === undefined) {
    return NextResponse.json({ error: 'Prices must be amounts of R0 or more.' }, { status: 400 })
  }

  // Approving an application from cardtly.com/resellers: the final approval,
  // so an admin only (requireAdmin above). Usually after the reseller
  // programme's manager has recommended it; an admin may also approve one still
  // pending, so nothing waits when he is away (Andre's choice). Only one that is
  // still undecided, so two admins clicking Approve cannot make two resellers.
  let application: any = null
  if (body.application_id) {
    const { data } = await db.from('reseller_applications').select('*').eq('id', String(body.application_id)).maybeSingle()
    if (!data) return NextResponse.json({ error: 'That application no longer exists.' }, { status: 404 })
    if (data.status !== 'pending' && data.status !== 'recommended') return NextResponse.json({ error: `That application is already ${data.status}.` }, { status: 409 })
    // Claimed before anything is created: the update only matches while it is
    // still in the status it was read in, so a second Approve at the same
    // moment finds nothing.
    const at = new Date().toISOString()
    const { data: claimed } = await db.from('reseller_applications')
      .update({ status: 'approved', decided_by: gate.user.id, decided_at: at, updated_at: at })
      .eq('id', data.id).eq('status', data.status).select('id')
    if (!claimed?.length) return NextResponse.json({ error: 'That application was just decided by someone else.' }, { status: 409 })
    application = data
  }
  // If creating the reseller fails after the claim, the application goes back
  // to where it was rather than reading as approved with no reseller behind it.
  const release = async () => {
    if (application) await db.from('reseller_applications').update({ status: application.status, decided_by: null, decided_at: null }).eq('id', application.id)
  }

  const str = (v: unknown, n = 300) => String(v ?? '').trim().slice(0, n) || null
  const { data: client, error: cErr } = await db.from('billing_clients').insert({
    name: str(body.legal_name, 160) || name,
    contact_person: str(body.contact_name, 120),
    email,
    phone: str(body.phone, 40),
    address: str(body.address, 400),
    vat_number: str(body.vat_number, 40),
    notes: 'Reseller. Invoiced monthly for seats sold and for NFC orders.',
  }).select('id').maybeSingle()
  if (cErr || !client) {
    await release()
    return NextResponse.json({ error: `Could not create the billing client: ${cErr?.message || 'unknown'}` }, { status: 500 })
  }

  const { data: reseller, error: rErr } = await db.from('resellers').insert({
    name,
    contact_name: str(body.contact_name, 120),
    email,
    phone: str(body.phone, 40),
    billing_client_id: client.id,
    seat_pool: pool,
    seat_price_cents: seat,
    // Only written when one is agreed, so a reseller can still be made before
    // migration 097 added the column.
    ...(yearly !== null ? { seat_price_year_cents: yearly } : {}),
    nfc_blank_cents: blank,
    nfc_printed_cents: printed,
    nfc_shipping_cents: shipping,
    notes: str(body.notes, 1000),
  }).select('*').maybeSingle()
  if (rErr || !reseller) {
    await db.from('billing_clients').delete().eq('id', client.id)
    await release()
    const missing = /resellers/.test(rErr?.message || '')
    return NextResponse.json({
      error: missing ? 'Resellers are not set up on this database yet. Run migration 094.' : `Could not create the reseller: ${rErr?.message || 'unknown'}`,
    }, { status: missing ? 503 : 500 })
  }

  if (application) {
    await db.from('reseller_applications').update({ reseller_id: reseller.id }).eq('id', application.id)
  }

  const linked = await linkLogin(db, reseller, email, new URL(request.url).origin, !!application)
  // Their own card is free while they are a reseller (lib/reseller-comp).
  const free = await syncResellerFreeCard(db, reseller).catch(() => null)
  const freeNote = free ? ` ${FREE_CARD_TEXT[free.state]}` : ''
  await auditLog(db, {
    actorUserId: gate.user.id, actorEmail: gate.user.email,
    action: application ? 'approve_reseller_application' : 'create_reseller', targetEmail: email,
    detail: { reseller_id: reseller.id, name, seat_pool: pool, seat_price_cents: seat, application_id: application?.id || null },
  })
  if ('error' in linked) {
    return NextResponse.json({ reseller, warning: `Reseller saved, but the login was not linked: ${linked.error}` })
  }
  return NextResponse.json({ reseller, warning: linked.note + freeNote })
}

export async function PATCH(request: Request) {
  // An admin, or the reseller programme's manager for the actions that are his
  // (MANAGER_RESELLER_ACTIONS): prices, seat pool, details, on hold, NFC
  // orders. Checked below once the action is known.
  const gate = await requireResellerProgramme()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const body = await request.json().catch(() => ({}))
  if (gate.role === 'manager' && !managerMay(body.action)) {
    return adminOnly(({
      add_login: "add or remove a reseller's logins", remove_login: "add or remove a reseller's logins",
      end: 'end or restart a reseller', restart: 'end or restart a reseller', delete: 'delete a reseller',
      draft_month: 'draft reseller invoices', sync_free_card: "change a reseller's free card",
    } as Record<string, string>)[String(body.action)] || 'do that')
  }

  const { data: reseller } = await db.from('resellers').select('*').eq('id', body.id).maybeSingle()
  if (!reseller) return NextResponse.json({ error: 'No such reseller.' }, { status: 404 })
  const origin = new URL(request.url).origin
  const audit = (action: string, detail: Record<string, any>) => auditLog(db, {
    actorUserId: gate.user.id, actorEmail: gate.user.email, action, detail: { reseller_id: reseller.id, ...detail },
  })

  if (body.action === 'update') {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    const str = (v: unknown, n = 300) => String(v ?? '').trim().slice(0, n) || null
    if ('name' in body) {
      const name = String(body.name ?? '').trim().slice(0, 120)
      if (!name) return NextResponse.json({ error: 'The reseller needs a company name.' }, { status: 400 })
      patch.name = name
    }
    if ('contact_name' in body) patch.contact_name = str(body.contact_name, 120)
    if ('phone' in body) patch.phone = str(body.phone, 40)
    if ('notes' in body) patch.notes = str(body.notes, 1000)
    if ('email' in body) {
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!isEmail(email)) return NextResponse.json({ error: `"${email}" does not look like an email address.` }, { status: 400 })
      patch.email = email
    }
    if ('status' in body) {
      if (body.status !== 'active' && body.status !== 'suspended') return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
      // An ended reseller comes back only through restart, which also gives
      // their own card back; otherwise a manager could restart one here.
      if (reseller.status === 'ended' && body.status !== reseller.status) {
        return NextResponse.json({ error: `${reseller.name} has ended. Restart them as a reseller first.` }, { status: 409 })
      }
      patch.status = body.status
    }
    for (const [key, fallback] of [
      ['seat_price_cents', reseller.seat_price_cents], ['nfc_blank_cents', reseller.nfc_blank_cents],
      ['nfc_printed_cents', reseller.nfc_printed_cents], ['nfc_shipping_cents', reseller.nfc_shipping_cents],
    ] as const) {
      if (!(key in body)) continue
      const v = cents(body[key], fallback)
      if (v === null) return NextResponse.json({ error: 'Prices must be amounts of R0 or more.' }, { status: 400 })
      patch[key] = v
    }
    if ('seat_price_year_cents' in body) {
      const v = yearCents(body.seat_price_year_cents)
      if (v === undefined) return NextResponse.json({ error: 'Prices must be amounts of R0 or more.' }, { status: 400 })
      // Unchanged and blank: leave the column alone, so saving other details
      // still works before migration 097.
      if (!(v === null && (reseller.seat_price_year_cents ?? null) === null)) patch.seat_price_year_cents = v
    }
    if ('seat_pool' in body) {
      const pool = wholeSeats(body.seat_pool, reseller.seat_pool)
      if (pool === null) return NextResponse.json({ error: 'The seat pool is a whole number.' }, { status: 400 })
      // Never below what is already sold: nothing takes seats off a client to
      // make the pool fit, so the reseller would just sit over it.
      const sold = seatsSold(poolClients(await listResellerClients(db, reseller.id)))
      if (pool < sold) {
        return NextResponse.json({ error: `${reseller.name} has already given ${sold} seats to clients, so the pool cannot drop to ${pool}.` }, { status: 400 })
      }
      patch.seat_pool = pool
    }
    const { error } = await db.from('resellers').update(patch).eq('id', reseller.id)
    if (error) {
      if (/seat_price_year_cents/.test(error.message || '')) {
        return NextResponse.json({ error: 'A yearly price needs migration 097. Run it in Supabase, then save again.' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message || 'Could not save.' }, { status: 500 })
    }
    // The billing client follows the name, contact and phone, so the next
    // invoice is addressed correctly. Issued ones keep their frozen copy.
    if (reseller.billing_client_id) {
      const c: Record<string, any> = { updated_at: new Date().toISOString() }
      if (patch.contact_name !== undefined) c.contact_person = patch.contact_name
      if (patch.phone !== undefined) c.phone = patch.phone
      if (patch.email !== undefined) c.email = patch.email
      if ('address' in body) c.address = str(body.address, 400)
      if ('vat_number' in body) c.vat_number = str(body.vat_number, 40)
      if ('legal_name' in body && str(body.legal_name, 160)) c.name = str(body.legal_name, 160)
      await db.from('billing_clients').update(c).eq('id', reseller.billing_client_id)
    }
    // What it was as well as what it is now, and who: the programme's manager
    // changes prices and pools without an admin's OK (Andre's choice), so the
    // Activity log is where an admin sees each change.
    const before = Object.fromEntries(Object.keys(patch).filter(k => k !== 'updated_at').map(k => [k, reseller[k] ?? null]))
    await audit('update_reseller', { ...patch, before, by_role: gate.role })
    const free = await syncResellerFreeCard(db, { ...reseller, ...patch }).catch(() => null)
    return NextResponse.json({ ok: true, ...(free && free.state === 'paying' ? { warning: FREE_CARD_TEXT.paying } : {}) })
  }

  if (body.action === 'add_login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!isEmail(email)) return NextResponse.json({ error: `"${email}" does not look like an email address.` }, { status: 400 })
    const linked = await linkLogin(db, reseller, email, origin)
    if ('error' in linked) return NextResponse.json({ error: linked.error }, { status: 400 })
    await audit('reseller_add_login', { email })
    await syncResellerFreeCard(db, reseller).catch(() => null)
    return NextResponse.json({ ok: true, warning: linked.note })
  }

  if (body.action === 'remove_login') {
    await db.from('reseller_members').delete().eq('reseller_id', reseller.id).eq('user_id', String(body.user_id || ''))
    await audit('reseller_remove_login', { user_id: body.user_id })
    // Removing the main login ends its free card.
    await syncResellerFreeCard(db, reseller).catch(() => null)
    return NextResponse.json({ ok: true })
  }

  // Ending a reseller: they stop being one. Not a delete, which would take
  // their invoices and seat history with it. Refused while clients are still on
  // their bill, because those teams would carry on being billed to a reseller
  // that no longer exists. Cancel them on the reseller's page, or move them to
  // another billing mode under Teams, first.
  if (body.action === 'end') {
    const onBill = (await listResellerClients(db, reseller.id)).filter(c => !c.offBill && c.state !== 'cancelled')
    if (onBill.length) {
      return NextResponse.json({
        error: `${reseller.name} still has ${onBill.length} client${onBill.length === 1 ? '' : 's'} on their bill (${onBill.slice(0, 3).map(c => c.name).join(', ')}${onBill.length > 3 ? '...' : ''}). Cancel them, or move them to another billing mode under Teams, first.`,
      }, { status: 409 })
    }
    const at = new Date().toISOString()
    const { error } = await db.from('resellers').update({ status: 'ended', ended_at: at, updated_at: at }).eq('id', reseller.id)
    if (error) {
      const missing = /resellers_status_check|ended_at/.test(error.message || '')
      return NextResponse.json({ error: missing ? 'Ending a reseller needs migration 096. Run it in Supabase, then try again.' : (error.message || 'Could not save.') }, { status: missing ? 503 : 500 })
    }
    const free = await syncResellerFreeCard(db, { ...reseller, status: 'ended' }).catch(() => null)
    await audit('end_reseller', { free_card: free?.state || null })
    return NextResponse.json({ ok: true, warning: 'Their page is now read-only, their own card is no longer free, and any month they still had seats live in is invoiced on the 1st as usual.' })
  }

  // Delete a reseller that never had any books (lib/reseller-delete). Every
  // check fails closed: if one cannot be read, nothing is deleted. Admin only:
  // not on MANAGER_RESELLER_ACTIONS.
  if (body.action === 'delete') {
    const read = async (what: string, q: any): Promise<{ rows: any[]; n: number }> => {
      const { data, error, count } = await q
      if (error) throw new Error(`Could not check ${what}: ${error.message}`)
      return { rows: data || [], n: count || 0 }
    }
    const howMany = (what: string, table: string, column: string, value: string | string[]) => {
      const q = db.from(table).select('*', { count: 'exact', head: true })
      return read(what, Array.isArray(value) ? q.in(column, value) : q.eq(column, value)).then(r => r.n)
    }
    let teams: any[] = []
    let invoices: any[] = []
    let facts: ResellerDeleteFacts
    try {
      teams = (await read('its client teams', db.from('organizations').select('id, name, billing_period, admin_user_id').eq('reseller_id', reseller.id))).rows
      let teamsWithCards = 0
      let teamsWithSchedules = 0
      for (const t of teams.filter(t => t.billing_period === 'reseller')) {
        if (await howMany('team cards', 'team_cards', 'organization_id', t.id)) teamsWithCards++
        if (await howMany('recurring schedules', 'recurring_schedules', 'organization_id', t.id)) teamsWithSchedules++
      }
      const nfc = (await read('NFC orders', db.from('reseller_nfc_orders').select('status, invoice_id').eq('reseller_id', reseller.id))).rows
      const months = (await read('monthly invoices', db.from('reseller_invoices').select('invoice_id').eq('reseller_id', reseller.id))).rows
      const byId = new Map<string, any>()
      const linked = [...nfc, ...months].map(x => x.invoice_id).filter(Boolean)
      if (linked.length) {
        for (const i of (await read('invoices', db.from('invoices').select('id, number, status').in('id', linked))).rows) byId.set(i.id, i)
      }
      if (reseller.billing_client_id) {
        for (const i of (await read('invoices', db.from('invoices').select('id, number, status').eq('client_id', reseller.billing_client_id))).rows) byId.set(i.id, i)
      }
      invoices = [...byId.values()]
      const ids = invoices.map(i => i.id)
      let moneyRecords = 0
      if (ids.length) {
        moneyRecords += await howMany('payments', 'billing_payments', 'invoice_id', ids)
        moneyRecords += await howMany('credit notes', 'credit_notes', 'invoice_id', ids)
      }
      if (reseller.billing_client_id) {
        for (const [what, table] of [['quotes', 'quotes'], ['receipts', 'billing_receipts'], ['purchase orders', 'purchase_orders'], ['recurring schedules', 'recurring_schedules']]) {
          moneyRecords += await howMany(what, table, 'client_id', reseller.billing_client_id)
        }
      }
      facts = {
        teamsWithCards, teamsWithSchedules, moneyRecords,
        issuedInvoices: invoices.filter(i => !neverIssued(i)).length,
        liveNfcOrders: nfc.filter(o => (LIVE_NFC_STATUSES as readonly string[]).includes(o.status)).length,
      }
    } catch (e: any) {
      return NextResponse.json({ error: `${e?.message || 'Could not check the reseller'}. Nothing was deleted.` }, { status: 500 })
    }
    const blocked = resellerDeleteBlocker(facts)
    if (blocked) return NextResponse.json({ error: `${reseller.name} cannot be deleted. ${blocked}` }, { status: 409 })

    // The free card first, while its logins still exist, and checked: once the
    // reseller is gone nothing would ever withdraw a comp left behind.
    try {
      await syncResellerFreeCard(db, { ...reseller, status: 'ended' }, { actorUserId: gate.user.id })
    } catch { /* checked just below */ }
    const { data: leftOver, error: compErr } = await db.from('whop_subscriptions').select('id')
      .eq('status', 'active').eq('metadata->>reason', 'reseller').eq('metadata->>reseller_id', reseller.id)
    if (compErr || leftOver?.length) {
      return NextResponse.json({ error: `${reseller.name}'s free card could not be withdrawn, so nothing was deleted. Try again.` }, { status: 500 })
    }

    // Its empty client teams. Teams Cardtly bills itself stay, unlinked by the
    // foreign key when the reseller goes.
    const emptyTeams = teams.filter(t => t.billing_period === 'reseller')
    for (const t of emptyTeams) {
      for (const table of ['api_keys', 'webhooks']) {
        const { error } = await db.from(table).delete().eq('org_id', t.id)
        if (error) return NextResponse.json({ error: `Could not remove ${t.name}'s ${table.replace('_', ' ')}: ${error.message}. ${reseller.name} was not deleted; its free card is already withdrawn.` }, { status: 500 })
      }
      const { error } = await db.from('organizations').delete().eq('id', t.id)
      if (error) return NextResponse.json({ error: `Could not delete the client team ${t.name}: ${error.message}. ${reseller.name} was not deleted; its free card is already withdrawn.` }, { status: 500 })
    }

    // The reseller. Logins, seat counts, monthly claims, NFC orders and paid
    // years cascade with it; applications keep their history.
    const { error: delErr } = await db.from('resellers').delete().eq('id', reseller.id)
    if (delErr) return NextResponse.json({ error: `Could not delete ${reseller.name}: ${delErr.message}` }, { status: 500 })

    // Then the paperwork nobody ever saw: invoices that never got a number,
    // and the billing client once nothing else points at it.
    const notes: string[] = []
    if (invoices.length) {
      const { error } = await db.from('invoices').delete().in('id', invoices.map(i => i.id))
      if (error) notes.push(`Its ${invoices.length} unissued invoice${invoices.length === 1 ? '' : 's'} could not be removed (${error.message}); they stay under Invoices as cancelled.`)
    }
    if (reseller.billing_client_id) {
      const { data: others } = await db.from('resellers').select('id').eq('billing_client_id', reseller.billing_client_id)
      if (!others?.length) {
        const { error } = await db.from('billing_clients').delete().eq('id', reseller.billing_client_id)
        if (error) notes.push(`Its billing client stays under Clients (${error.message}).`)
      }
    }
    const kept = teams.length - emptyTeams.length
    if (kept) notes.push(`${kept} client team${kept === 1 ? '' : 's'} Cardtly bills itself stay${kept === 1 ? 's' : ''}, no longer linked to them.`)

    await audit('delete_reseller', {
      name: reseller.name, email: reseller.email, client_teams_deleted: emptyTeams.length, client_teams_kept: kept,
      invoices_removed: invoices.length, billing_client_id: reseller.billing_client_id || null,
    })
    return NextResponse.json({
      ok: true,
      warning: `Their logins keep their Cardtly accounts, and their own card is no longer free.${emptyTeams.length ? ` ${emptyTeams.length} empty client team${emptyTeams.length === 1 ? '' : 's'} deleted.` : ''}${notes.length ? ` ${notes.join(' ')}` : ''}`,
    })
  }

  if (body.action === 'restart') {
    if (reseller.status !== 'ended') return NextResponse.json({ error: 'Only an ended reseller can be restarted.' }, { status: 409 })
    const at = new Date().toISOString()
    const { error } = await db.from('resellers').update({ status: 'active', ended_at: null, updated_at: at }).eq('id', reseller.id)
    if (error) return NextResponse.json({ error: error.message || 'Could not save.' }, { status: 500 })
    const free = await syncResellerFreeCard(db, { ...reseller, status: 'active' }).catch(() => null)
    await audit('restart_reseller', { free_card: free?.state || null })
    return NextResponse.json({ ok: true, ...(free ? { warning: FREE_CARD_TEXT[free.state] } : {}) })
  }

  if (body.action === 'sync_free_card') {
    const free = await syncResellerFreeCard(db, reseller)
    await audit('reseller_sync_free_card', { state: free.state })
    return NextResponse.json({ ok: true, state: free.state, warning: FREE_CARD_TEXT[free.state] })
  }

  if (body.action === 'draft_month') {
    const month = /^\d{4}-\d{2}-01$/.test(String(body.month)) ? String(body.month) : previousMonth(sastMonth(new Date()))
    const res = body.rebuild ? await rebuildResellerMonth(db, reseller, month) : await draftResellerMonth(db, reseller, month, gate.user.id)
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 })
    await audit(body.rebuild ? 'reseller_rebuild_month' : 'reseller_draft_month', { month, invoice_id: res.invoiceId || null })
    return NextResponse.json({ ok: true, invoiceId: res.invoiceId || null, skipped: res.skipped || null })
  }

  if (body.action === 'nfc_status') {
    const status = String(body.status || '')
    if (!(NFC_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
    const { error } = await db.from('reseller_nfc_orders').update({
      status,
      tracking_number: String(body.tracking_number ?? '').trim().slice(0, 80) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', String(body.order_id || '')).eq('reseller_id', reseller.id)
    if (error) return NextResponse.json({ error: error.message || 'Could not save.' }, { status: 500 })
    await audit('reseller_nfc_status', { order_id: body.order_id, status })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
