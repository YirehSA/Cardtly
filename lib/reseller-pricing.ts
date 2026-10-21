// Reseller money and months, with no imports, so scripts/check-resellers can
// compile this file alone and test every number a reseller is billed.
//
// THE RULES (Andre, 2026-10-21):
//   - A seat counts as sold once the reseller gives it to a client, whether or
//     not the client has made the card yet.
//   - Any seat live at any time in a month is billed for that whole month. No
//     part months, so dropping a client on the 30th does not dodge the month.
//   - Invoiced on the 1st for the month before, one line per client, at the
//     reseller's seat price (R70 unless agreed otherwise).
//   - NFC cards are invoiced straight away: blank (the reseller prints) or
//     printed by Cardtly, plus that reseller's shipping amount per order.

export const RESELLER_DEFAULTS = {
  seatPriceCents: 7000,
  nfcBlankCents: 5000,
  nfcPrintedCents: 12500,
  nfcShippingCents: 10000,
} as const

export type ResellerClientState = 'live' | 'paused' | 'cancelled'

export interface InvoiceLine { description: string; qty: number; unitPriceCents: number }

// ── Months, counted in SAST ─────────────────────────────────────────────────
// A South African reseller's "October" starts at midnight SAST, not UTC. At
// 01:00 on 1 November SAST it is still 31 October in UTC, and a seat added
// then belongs to November.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')

/** The month an instant falls in, in SAST, as YYYY-MM-01. */
export function sastMonth(at: Date): string {
  const d = new Date(at.getTime() + SAST_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`
}

function parseMonth(month: string): { y: number; m: number } | null {
  const hit = /^(\d{4})-(\d{2})(?:-01)?$/.exec(String(month || ''))
  if (!hit) return null
  const y = Number(hit[1]), m = Number(hit[2])
  return m >= 1 && m <= 12 ? { y, m } : null
}

/** The month before, as YYYY-MM-01. January goes back to December. */
export function previousMonth(month: string): string {
  const p = parseMonth(month)
  if (!p) return month
  return p.m === 1 ? `${p.y - 1}-12-01` : `${p.y}-${pad(p.m - 1)}-01`
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const p = parseMonth(month)
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : String(month)
}

// ── A client team's state ───────────────────────────────────────────────────
/** Cancelled when it is switched off, paused when suspended, otherwise live.
 *  Only a live client is billed; live and paused clients hold pool seats. */
export function clientState(org: { business_plan_active?: boolean | null; suspended_at?: string | null }): ResellerClientState {
  if (!org.business_plan_active) return 'cancelled'
  if (org.suspended_at) return 'paused'
  return 'live'
}

// ── The pool ────────────────────────────────────────────────────────────────
export interface PoolClient { id: string; seats: number; state: ResellerClientState }

/** Seats handed out: live and paused clients keep theirs, cancelled ones free them. */
export function seatsSold(clients: PoolClient[]): number {
  return clients.reduce((n, c) => n + (c.state === 'cancelled' ? 0 : Math.max(0, Math.floor(c.seats) || 0)), 0)
}

/** Whether giving one client `newSeats` (a new client when clientId is absent)
 *  still fits the pool, and how many seats would be left either way. */
export function fitsPool(pool: number, clients: PoolClient[], newSeats: number, clientId?: string): { ok: boolean; left: number } {
  const others = seatsSold(clients.filter(c => c.id !== clientId))
  const left = Math.max(0, Math.floor(pool) || 0) - others - Math.max(0, Math.floor(newSeats) || 0)
  return { ok: left >= 0, left }
}

// ── The monthly invoice ─────────────────────────────────────────────────────
export interface SeatMonthRow { clientName: string | null; seats: number }

/** One line per client with seats, sorted by name. A client with none is
 *  left off rather than printed as a R0.00 line. */
export function seatInvoiceLines(rows: SeatMonthRow[], seatPriceCents: number, month: string): InvoiceLine[] {
  const label = monthLabel(month)
  return rows
    .map(r => ({ name: (r.clientName || '').trim() || 'Client', seats: Math.max(0, Math.floor(Number(r.seats)) || 0) }))
    .filter(r => r.seats > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(r => ({
      description: `${r.name}: Cardtly Pro, ${r.seats} seat${r.seats === 1 ? '' : 's'}, ${label}`,
      qty: r.seats,
      unitPriceCents: Math.round(seatPriceCents),
    }))
}

// ── NFC orders ──────────────────────────────────────────────────────────────
export type ResellerNfcKind = 'blank' | 'printed'

export interface ResellerNfcPrices { nfcBlankCents: number; nfcPrintedCents: number; nfcShippingCents: number }

export const MAX_NFC_ORDER = 10000

export function nfcUnitCents(kind: ResellerNfcKind, prices: ResellerNfcPrices): number {
  return Math.round(kind === 'printed' ? prices.nfcPrintedCents : prices.nfcBlankCents)
}

/** The invoice lines for one order: the cards, then shipping when there is any. */
export function nfcOrderLines(kind: ResellerNfcKind, quantity: number, prices: ResellerNfcPrices, clientName?: string | null): InvoiceLine[] {
  const qty = Math.max(0, Math.floor(quantity) || 0)
  const lines: InvoiceLine[] = [{
    description: kind === 'printed'
      ? `NFC cards printed and programmed by Cardtly${clientName ? ` for ${clientName}` : ''}`
      : 'NFC cards, blank (printed and programmed by the reseller)',
    qty,
    unitPriceCents: nfcUnitCents(kind, prices),
  }]
  const shipping = Math.round(prices.nfcShippingCents)
  if (shipping > 0) lines.push({ description: 'Shipping', qty: 1, unitPriceCents: shipping })
  return lines
}

/** Before VAT. VAT is added by the invoice itself once Cardtly is registered. */
export function nfcOrderTotalCents(kind: ResellerNfcKind, quantity: number, prices: ResellerNfcPrices): number {
  return nfcOrderLines(kind, quantity, prices).reduce((n, l) => n + Math.round(l.qty * l.unitPriceCents), 0)
}

/** "R70" or "R1 234.50", for the reseller's own screens. Spaced the way the
 *  invoices are (formatMoney in lib/billing-docs), cents only when there are
 *  any, so a price list reads R70 rather than R70.00. */
export function randCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const part = abs % 100
  return `${sign}R${whole}${part ? `.${String(part).padStart(2, '0')}` : ''}`
}
