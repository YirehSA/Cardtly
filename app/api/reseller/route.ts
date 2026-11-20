import { NextResponse } from 'next/server'
import {
  requireReseller, listResellerClients, poolClients, createResellerClient,
  setClientSeats, setClientState, setClientTerm, resendClientWelcome, placeResellerNfcOrder, writable, serviceDb,
} from '@/lib/reseller'
import { requireAdmin } from '@/lib/admin-api'
import { invoiceOutstanding } from '@/lib/billing-docs'
import { sastMonth, monthLabel, seatsSold } from '@/lib/reseller-pricing'
import { estimateResellerMonth, resellerPrices } from '@/lib/reseller-billing'
import { syncResellerFreeCard } from '@/lib/reseller-comp'
import { cardsEverSold } from '@/lib/reseller-levels-server'
import { ownListing, saveResellerListing } from '@/lib/reseller-listing-server'
import { createSoloClient, setSoloTerm, setSoloState, resendSoloWelcome } from '@/lib/reseller-solo'

// The reseller's own page: their pool, their clients, their NFC orders and
// their invoices. Every query is scoped to the reseller this login runs, which
// requireReseller resolves on the server; nothing the browser sends can widen it.

export const runtime = 'nodejs'

/**
 * Who the page is for. A reseller's own login sees its own reseller, as
 * always. An admin may pass ?as=<reseller id> to see any reseller's page
 * exactly as its main login does ("View as reseller", Andre 2026-11-16).
 * Only GET reads ?as=, so a preview can never write: POST stays scoped to the
 * reseller the login runs, and an admin runs none.
 */
async function viewer(request: Request): Promise<
  { reseller: any; db: any; userId: string | null; preview: boolean } | { error: NextResponse }
> {
  const as = new URL(request.url).searchParams.get('as')
  if (!as) {
    const gate = await requireReseller()
    if ('error' in gate) return gate
    return { reseller: gate.reseller, db: gate.db, userId: gate.user.id, preview: false }
  }
  const admin = await requireAdmin()
  if ('error' in admin) return admin
  const db = serviceDb()
  const { data: reseller } = await db.from('resellers').select('*').eq('id', as).maybeSingle()
  if (!reseller) return { error: NextResponse.json({ error: 'No such reseller.' }, { status: 404 }) }
  return { reseller, db, userId: null, preview: true }
}

export async function GET(request: Request) {
  const gate = await viewer(request)
  if ('error' in gate) return gate.error
  const { reseller, db, userId, preview } = gate

  // Only the main login's card is free, so only they are told it is. Read
  // only: the admin side and the daily run make it so. A preview shows the
  // main login's view.
  let ownCardFree = false
  try {
    const free = await syncResellerFreeCard(db, reseller, { dryRun: true })
    ownCardFree = (preview || free.userId === userId) && (free.state === 'free' || free.state === 'already_free')
  } catch { /* not shown */ }

  const month = sastMonth(new Date())
  const [clients, estimate, orders, invoices, everSold] = await Promise.all([
    listResellerClients(db, reseller.id),
    // What this month comes to so far, worked out as the invoice will be:
    // monthly clients for the month, yearly ones for their year if it starts now.
    estimateResellerMonth(db, reseller, month),
    db.from('reseller_nfc_orders').select('*').eq('reseller_id', reseller.id).order('created_at', { ascending: false }).limit(100),
    reseller.billing_client_id
      // Never drafts: until Cardtly approves one it is not an invoice.
      ? db.from('invoices').select('id, number, status, issued_at, due_at, total_cents, paid_cents')
          .eq('client_id', reseller.billing_client_id).not('status', 'in', '(draft,cancelled)')
          .order('issued_at', { ascending: false }).limit(100)
      : { data: [] },
    // Their level (lib/reseller-levels): every card ever sold.
    cardsEverSold(db, [reseller.id]),
  ])

  const sold = seatsSold(poolClients(clients))

  return NextResponse.json({
    ownCardFree,
    month,
    reseller: {
      name: reseller.name,
      status: reseller.status,
      seatPool: reseller.seat_pool,
      seatPriceCents: reseller.seat_price_cents,
      seatPriceYearCents: resellerPrices(reseller).yearlyCents,
      // Cardtly Solo, per card (migration 110; the defaults until then).
      soloPriceCents: resellerPrices(reseller).soloMonthlyCents,
      soloPriceYearCents: resellerPrices(reseller).soloYearlyCents,
      // Whether Solo can be sold yet: the table arrives with migration 110.
      soloReady: 'solo_price_cents' in reseller,
      nfcBlankCents: reseller.nfc_blank_cents,
      nfcPrintedCents: reseller.nfc_printed_cents,
      nfcShippingCents: reseller.nfc_shipping_cents,
      invoicesReady: !!reseller.billing_client_id,
    },
    sold,
    // Null when it could not be read: the level card is then left out rather
    // than shown short.
    cardsEverSold: everSold ? everSold[reseller.id] ?? 0 : null,
    // Their listing on cardtly.com/find-a-reseller. Null before migration 108.
    listing: ownListing(reseller, everSold ? everSold[reseller.id] ?? 0 : null),
    left: Math.max(0, reseller.seat_pool - sold),
    clients,
    thisMonth: { label: monthLabel(month), seats: estimate.seats, cents: estimate.cents },
    nfcOrders: (orders.data || []).map((o: any) => ({
      id: o.id, kind: o.kind, quantity: o.quantity, total_cents: o.total_cents, client_name: o.client_name,
      status: o.status, tracking_number: o.tracking_number, created_at: o.created_at,
    })),
    invoices: (invoices.data || []).map((i: any) => ({
      ...i,
      // A credited or written-off invoice is settled without being paid.
      outstanding_cents: ['credited', 'written_off', 'paid'].includes(i.status)
        ? 0 : invoiceOutstanding(i.total_cents || 0, i.paid_cents || 0, 0),
    })),
  })
}

export async function POST(request: Request) {
  const gate = await requireReseller()
  if ('error' in gate) return gate.error
  const { reseller, db, user } = gate
  const body = await request.json().catch(() => ({}))
  const origin = new URL(request.url).origin

  const reply = (r: any) => 'error' in r
    ? NextResponse.json({ error: r.error }, { status: r.status || 400 })
    : NextResponse.json(r)

  switch (body.action) {
    case 'add_client':
      return reply(await createResellerClient(db, reseller, {
        company: body.company, ownerEmail: body.owner_email, seats: body.seats, term: body.term,
      }, origin))
    case 'set_seats':
      return reply(await setClientSeats(db, reseller, String(body.org_id || ''), body.seats))
    case 'set_term':
      return reply(await setClientTerm(db, reseller, String(body.org_id || ''), body.term))
    case 'set_state':
      return reply(await setClientState(db, reseller, String(body.org_id || ''), body.to, body.message))
    case 'resend_welcome':
      return reply(await resendClientWelcome(db, reseller, String(body.org_id || ''), origin))
    // Cardtly Solo, one person's card (lib/reseller-solo).
    case 'add_solo':
      return reply(await createSoloClient(db, reseller, { name: body.name, email: body.email, term: body.term }, origin, user.id))
    case 'solo_term':
      return reply(await setSoloTerm(db, reseller, String(body.solo_id || ''), body.term))
    case 'solo_state':
      return reply(await setSoloState(db, reseller, String(body.solo_id || ''), body.to, user.id))
    case 'solo_welcome':
      return reply(await resendSoloWelcome(db, reseller, String(body.solo_id || ''), origin))
    case 'nfc_order':
      return reply(await placeResellerNfcOrder(db, reseller, {
        kind: body.kind, quantity: body.quantity, organizationId: body.org_id,
        cardIds: body.card_ids, notes: body.notes, shipTo: body.ship_to,
      }, user.id))
    case 'save_listing': {
      // Their public listing (lib/reseller-listing). Refused on hold, like
      // every other change.
      const blocked = writable(reseller)
      if (blocked) return reply(blocked)
      return reply(await saveResellerListing(db, reseller, body))
    }
    case 'client_cards': {
      // The cards in one of their clients, so a printed order can name them.
      // Name, title and link only.
      const { data: org } = await db.from('organizations').select('id')
        .eq('id', String(body.org_id || '')).eq('reseller_id', reseller.id).maybeSingle()
      if (!org) return NextResponse.json({ error: 'That client is not one of yours.' }, { status: 404 })
      const { data: cards } = await db.from('team_cards').select('id, name, title, slug')
        .eq('organization_id', org.id).order('name')
      return NextResponse.json({ cards: cards || [] })
    }
    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
}
