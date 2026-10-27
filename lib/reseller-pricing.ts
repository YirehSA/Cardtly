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
//
// MONTHLY OR YEARLY (Andre, 2026-10-27: "They must have the option to sell
// their cards as yearly or monthly. We need to know what those are so we can
// invoice correctly."). Each client is sold one way or the other:
//   - Monthly is the rule above.
//   - Yearly is twelve months paid upfront, at the reseller's yearly seat
//     price, on the invoice for the month the year starts. The months it
//     covers are never billed monthly as well.
//   - Seats added during a paid year are billed for the months that year has
//     left, so every seat renews on the same date. Seats taken away are not
//     refunded: the year was paid.
//   - A yearly client renews into a new year in the month after its year
//     ends. Switching it to monthly takes effect once the paid year is over.

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

/** `n` months on (or back, when negative), as YYYY-MM-01. */
export function addMonths(month: string, n: number): string {
  const p = parseMonth(month)
  if (!p) return month
  const i = p.y * 12 + (p.m - 1) + Math.trunc(n)
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}-01`
}

/** How many months from `from` to `to`, counting both. 0 when `to` is earlier. */
export function monthsInclusive(from: string, to: string): number {
  const a = parseMonth(from), b = parseMonth(to)
  if (!a || !b) return 0
  return Math.max(0, (b.y * 12 + b.m) - (a.y * 12 + a.m) + 1)
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

// ── Monthly or yearly ───────────────────────────────────────────────────────
export type ResellerTerm = 'monthly' | 'yearly'
export const YEAR_MONTHS = 12

export const TERM_LABEL: Record<ResellerTerm, string> = { monthly: 'Monthly', yearly: 'Yearly' }

export function cleanTerm(raw: unknown): ResellerTerm | null {
  return raw === 'monthly' || raw === 'yearly' ? raw : null
}

/** Cardtly's price to the reseller for one seat for a year: the reseller's own
 *  yearly price once one is set, otherwise twelve times the monthly price, so
 *  a reseller nobody has agreed a yearly price with pays the same either way. */
export function yearlySeatCents(monthlyCents: number, yearlyCents?: number | null): number {
  const set = yearlyCents === null || yearlyCents === undefined ? NaN : Number(yearlyCents)
  return Number.isFinite(set) && set >= 0 ? Math.round(set) : Math.round((Number(monthlyCents) || 0) * YEAR_MONTHS)
}

/** One client's seats in the month being billed, and how it was sold then. */
export interface MonthClientRow { orgId: string; clientName: string | null; seats: number; term: ResellerTerm }

/** A year a client has already been billed for, from an earlier month. */
export interface PaidYear {
  orgId: string
  startMonth: string
  /** The last month the year covers. */
  endMonth: string
  /** Seats billed when the year began, plus every extra billed since. */
  coveredSeats: number
}

export interface MonthBill {
  lines: InvoiceLine[]
  /** Years this month's invoice begins. */
  newYears: Array<{ orgId: string; clientName: string | null; startMonth: string; endMonth: string; seats: number; unitCents: number }>
  /** Seats added to a year that was already paid, billed for the months it has left. */
  extras: Array<{ orgId: string; yearStart: string; month: string; seats: number; months: number; unitCents: number }>
}

const seatWord = (n: number) => `${n} seat${n === 1 ? '' : 's'}`

/** Everything one month's invoice carries, client by client, sorted by name.
 *
 *  `years` are the years billed by EARLIER months. A client inside one of them
 *  is not billed for the month; only seats above what that year already
 *  covers are, for the months it has left. A yearly client with no year
 *  covering the month starts one here. Everyone else is billed the month. */
export function resellerMonthBill(
  month: string,
  rows: MonthClientRow[],
  years: PaidYear[],
  prices: { monthlyCents: number; yearlyCents: number },
): MonthBill {
  const out: MonthBill = { lines: [], newYears: [], extras: [] }
  const label = monthLabel(month)
  const clients = rows
    .map(r => ({ ...r, name: (r.clientName || '').trim() || 'Client', seats: Math.max(0, Math.floor(Number(r.seats)) || 0) }))
    .filter(r => r.seats > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const c of clients) {
    const year = years.find(y => y.orgId === c.orgId && y.startMonth <= month && month <= y.endMonth)
    if (year) {
      const more = c.seats - Math.max(0, Math.floor(year.coveredSeats) || 0)
      if (more <= 0) continue
      const months = monthsInclusive(month, year.endMonth)
      const unitCents = Math.round(prices.yearlyCents * months / YEAR_MONTHS)
      out.lines.push({
        description: `${c.name}: ${seatWord(more)} added to the yearly plan, ${label} to ${monthLabel(year.endMonth)} (${months} of ${YEAR_MONTHS} months)`,
        qty: more, unitPriceCents: unitCents,
      })
      out.extras.push({ orgId: c.orgId, yearStart: year.startMonth, month, seats: more, months, unitCents })
      continue
    }
    if (c.term === 'yearly') {
      const endMonth = addMonths(month, YEAR_MONTHS - 1)
      const unitCents = Math.round(prices.yearlyCents)
      out.lines.push({
        description: `${c.name}: Cardtly Pro yearly, ${seatWord(c.seats)}, ${label} to ${monthLabel(endMonth)}`,
        qty: c.seats, unitPriceCents: unitCents,
      })
      out.newYears.push({ orgId: c.orgId, clientName: c.clientName, startMonth: month, endMonth, seats: c.seats, unitCents })
      continue
    }
    out.lines.push({
      description: `${c.name}: Cardtly Pro, ${seatWord(c.seats)}, ${label}`,
      qty: c.seats, unitPriceCents: Math.round(prices.monthlyCents),
    })
  }
  return out
}

/** The year that covers `month` for a client, or the latest one still to come. */
export function currentYear<T extends { startMonth: string; endMonth: string }>(years: T[], month: string): T | null {
  return years
    .filter(y => y.endMonth >= month)
    .sort((a, b) => a.startMonth.localeCompare(b.startMonth))[0] || null
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
