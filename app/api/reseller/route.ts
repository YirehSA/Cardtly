import { NextResponse } from 'next/server'
import {
  requireReseller, listResellerClients, poolClients, createResellerClient,
  setClientSeats, setClientState, setClientTerm, resendClientWelcome, placeResellerNfcOrder,
} from '@/lib/reseller'
import { invoiceOutstanding } from '@/lib/billing-docs'
import { sastMonth, monthLabel, seatsSold } from '@/lib/reseller-pricing'
import { estimateResellerMonth, resellerPrices } from '@/lib/reseller-billing'
import { syncResellerFreeCard } from '@/lib/reseller-comp'

// The reseller's own page: their pool, their clients, their NFC orders and
// their invoices. Every query is scoped to the reseller this login runs, which
// requireReseller resolves on the server; nothing the browser sends can widen it.

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireReseller()
  if ('error' in gate) return gate.error
  const { reseller, db, user } = gate

  // Only the main login's card is free, so only they are told it is. Read
  // only: the admin side and the daily run make it so.
  let ownCardFree = false
  try {
    const free = await syncResellerFreeCard(db, reseller, { dryRun: true })
    ownCardFree = free.userId === user.id && (free.state === 'free' || free.state === 'already_free')
  } catch { /* not shown */ }

  const month = sastMonth(new Date())
  const [clients, estimate, orders, invoices] = await Promise.all([
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
      nfcBlankCents: reseller.nfc_blank_cents,
      nfcPrintedCents: reseller.nfc_printed_cents,
      nfcShippingCents: reseller.nfc_shipping_cents,
      invoicesReady: !!reseller.billing_client_id,
    },
    sold,
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
    case 'nfc_order':
      return reply(await placeResellerNfcOrder(db, reseller, {
        kind: body.kind, quantity: body.quantity, organizationId: body.org_id,
        cardIds: body.card_ids, notes: body.notes, shipTo: body.ship_to,
      }, user.id))
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
