// The arithmetic and the wording behind quotes, invoices and credit notes.
//
// Pure, and imports nothing, so it can be compiled and tested on its own the
// way lib/department-tree and lib/brand-theme are. Money is the last place to
// find out a rounding rule was wrong from a customer's email.
//
// MONEY IS INTEGER CENTS, EVERYWHERE. Never a float. 0.1 + 0.2 is 0.30000000000000004
// in binary floating point, and an invoice a cent out is an invoice that gets
// queried. Rands only exist at the moment something is displayed.
//
// Relative imports only - see lib/team-locks for why.

export type DocKind = 'quote' | 'invoice' | 'credit_note'

export interface DocLine {
  description: string
  /** Allows half days and part months. The money stays integer. */
  qty: number
  unitPriceCents: number
}

export interface DocTotals {
  subtotalCents: number
  vatRateBp: number
  vatCents: number
  totalCents: number
}

/** VAT as basis points so the rate is an integer too: 15% is 1500. A float
 *  rate reintroduces the problem cents were chosen to avoid. */
export const VAT_RATE_BP_ZA = 1500

/**
 * One line's money.
 *
 * Rounded at the line, not at the end. A customer checks an invoice by reading
 * the lines and adding them up, so the lines have to be the truth: if the total
 * is rounded independently it can disagree with its own lines by a cent, and
 * that cent costs more in emails than it will ever be worth.
 */
export function lineTotalCents(line: DocLine): number {
  return Math.round(line.qty * line.unitPriceCents)
}

/**
 * The document's money.
 *
 * VAT is calculated once on the rounded subtotal rather than per line and
 * summed. Both are defensible and they differ by a cent or two on long
 * documents; this way the VAT figure always reconciles against the subtotal
 * printed directly above it, which is the number anybody checking will use.
 *
 * vatRateBp of 0 is not a special case, it is the normal case until Cardtly's
 * registration comes through: zero rate, zero VAT, and a document that says
 * INVOICE rather than TAX INVOICE.
 */
export function documentTotals(lines: DocLine[], vatRateBp: number): DocTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotalCents(l), 0)
  const rate = Number.isFinite(vatRateBp) && vatRateBp > 0 ? Math.round(vatRateBp) : 0
  const vatCents = rate > 0 ? Math.round((subtotalCents * rate) / 10000) : 0
  return { subtotalCents, vatRateBp: rate, vatCents, totalCents: subtotalCents + vatCents }
}

/**
 * What the document is called.
 *
 * A business that is not VAT registered may NOT issue a document headed "Tax
 * Invoice" - it states a VAT claim it is not entitled to make, and it is the
 * customer who gets caught trying to claim the input. So the heading follows
 * the VAT number, and because the number is snapshotted onto each document,
 * registering later relabels new documents and leaves history alone.
 */
export function documentTitle(kind: DocKind, vatNumber: string | null | undefined): string {
  const registered = !!(vatNumber && vatNumber.trim())
  if (kind === 'quote') return 'QUOTATION'
  if (kind === 'credit_note') return registered ? 'TAX CREDIT NOTE' : 'CREDIT NOTE'
  return registered ? 'TAX INVOICE' : 'INVOICE'
}

/** Cents to a readable amount, always two decimals.
 *
 *  The thousands separator is a NON-BREAKING space (U+00A0), not a plain one.
 *  South African convention is a space rather than a comma, and a plain space
 *  lets "R1 234 567" break across two lines in a PDF or an email, which looks
 *  like two numbers. Worth knowing when comparing these strings or parsing
 *  them back: they will not equal a version typed with an ordinary space. */
export function formatMoney(cents: number, currency = 'ZAR'): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const symbol = currency === 'ZAR' ? 'R' : `${currency} `
  return `${sign}${symbol}${whole}.${(abs % 100).toString().padStart(2, '0')}`
}

/** How long a quote stands. */
export const QUOTE_VALID_DAYS = 14

/**
 * What a charge IS, which is what decides when it falls due.
 *
 * 'subscription' bills on the anniversary of signup and is paid in ADVANCE:
 * nothing activates until the first payment lands, and each month after falls
 * due on the same day of the month. 'once_off' is an NFC card order, setup
 * work, or anything else that is not a recurring seat, and is due immediately
 * because it is paid before it is fulfilled.
 */
export type ChargeKind = 'subscription' | 'once_off'

/**
 * The anniversary day, clamped to a month that has one.
 *
 * A team that signed up on the 31st has no anniversary in February. Clamping
 * to the last day bills them on the 28th, 29th, 30th or 31st depending on the
 * month, which keeps exactly one charge per month and never skips February.
 * Moving them to the 1st instead would shift which month they are paying for,
 * which on a prepaid cycle is a month of free service or a month of double
 * billing depending on which way it slipped.
 */
export function anniversaryOn(year: number, monthIndex: number, anniversaryDay: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const day = Math.min(Math.max(1, Math.round(anniversaryDay)), lastDay)
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
}

/** The next anniversary strictly after `from`. */
export function nextAnniversary(from: Date, anniversaryDay: number): string {
  const y = from.getUTCFullYear()
  const m = from.getUTCMonth()
  const thisMonth = anniversaryOn(y, m, anniversaryDay)
  return thisMonth > from.toISOString().slice(0, 10)
    ? thisMonth
    : anniversaryOn(y, m + 1, anniversaryDay)
}

/**
 * When a document falls due.
 *
 * A subscription is prepaid, so the due date is the anniversary the invoice
 * COVERS rather than a period after issue: the draft is generated with lead
 * time, approved, sent, and paid by the day the next month starts. A once-off
 * is due the day it is issued.
 */
export function dueDateFor(
  kind: ChargeKind,
  issuedAt: Date,
  opts: { anniversaryDay?: number } = {},
): string {
  const issued = issuedAt.toISOString().slice(0, 10)
  if (kind === 'once_off' || !opts.anniversaryDay) return issued
  return nextAnniversary(issuedAt, opts.anniversaryDay)
}

/**
 * The charge for a change part way through a paid month.
 *
 * Counted in whole days and rounded once, at the end. Clamped to the period:
 * a change dated before the period started is somebody correcting a record,
 * not a client owing thirteen months.
 */
export function proRataCents(
  fullPeriodCents: number,
  changeOn: string,
  periodStart: string,
  periodEnd: string,
): number {
  const DAY = 86400000
  const start = Date.parse(periodStart + 'T00:00:00Z')
  const end = Date.parse(periodEnd + 'T00:00:00Z')
  const change = Date.parse(changeOn + 'T00:00:00Z')
  const totalDays = Math.round((end - start) / DAY)
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0
  const remaining = Math.min(totalDays, Math.max(0, Math.round((end - change) / DAY)))
  return Math.round((fullPeriodCents * remaining) / totalDays)
}

/**
 * What a seat change does to the money.
 *
 * Increases are charged pro rata straight away, because the seats go live
 * straight away and the model is prepaid. Decreases are not refunded: the
 * month is paid for and the seats stay usable until the anniversary, which is
 * the ordinary convention and avoids a credit note every time somebody loses a
 * person.
 *
 * Either direction, the recurring amount from the next anniversary follows the
 * new count. That is the part that must never depend on somebody remembering
 * to edit a template, which is why the schedule stores a seat count rather
 * than a fixed line.
 */
export function seatChange(opts: {
  fromSeats: number
  toSeats: number
  seatPriceCents: number
  changeOn: string
  periodStart: string
  periodEnd: string
}): {
  direction: 'increase' | 'decrease' | 'none'
  chargeNowCents: number
  nextPeriodCents: number
  description: string
} {
  const delta = opts.toSeats - opts.fromSeats
  const nextPeriodCents = Math.max(0, opts.toSeats) * opts.seatPriceCents
  if (delta === 0) return { direction: 'none', chargeNowCents: 0, nextPeriodCents, description: 'No change' }
  if (delta < 0) {
    return {
      direction: 'decrease',
      chargeNowCents: 0,
      nextPeriodCents,
      description: `Reduced from ${opts.fromSeats} to ${opts.toSeats} seats, effective ${opts.periodEnd}`,
    }
  }
  return {
    direction: 'increase',
    chargeNowCents: proRataCents(delta * opts.seatPriceCents, opts.changeOn, opts.periodStart, opts.periodEnd),
    nextPeriodCents,
    description: `${delta} additional seat${delta === 1 ? '' : 's'} pro rata to ${opts.periodEnd}`,
  }
}

/** Due date from the issue date and the agreed terms. Returned as YYYY-MM-DD
 *  because that is what a date column wants and it has no timezone to get
 *  wrong. */
export function dueDateFrom(issuedAt: Date, termsDays: number): string {
  const d = new Date(issuedAt.getTime())
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.round(termsDays)))
  return d.toISOString().slice(0, 10)
}

/**
 * What an invoice's status becomes once a payment lands.
 *
 * Overpayment resolves to paid rather than to an error: the money is in the
 * bank whatever the arithmetic says, and refusing to record it helps nobody.
 * The difference shows on the statement as a credit.
 */
export function statusAfterPayment(
  totalCents: number,
  paidCents: number,
  dueOn: string | null,
  today = new Date(),
): 'paid' | 'part_paid' | 'overdue' | 'sent' {
  if (paidCents >= totalCents && totalCents > 0) return 'paid'
  if (paidCents > 0) return 'part_paid'
  if (dueOn && dueOn < today.toISOString().slice(0, 10)) return 'overdue'
  return 'sent'
}

/**
 * A statement is derived, never stored.
 *
 * Anything stored has to be kept in sync with the invoices and payments it
 * summarises, and the day it drifts is the day somebody is chasing a customer
 * who already paid.
 */
export interface StatementRow {
  date: string
  kind: 'invoice' | 'payment' | 'credit_note'
  reference: string
  debitCents: number
  creditCents: number
  balanceCents: number
}

export function buildStatement(
  openingCents: number,
  entries: Array<{ date: string; kind: StatementRow['kind']; reference: string; amountCents: number }>,
): { rows: StatementRow[]; closingCents: number } {
  let balance = openingCents
  const rows = [...entries]
    // Stable within a date: an invoice raised and paid the same day should read
    // in that order rather than showing a negative balance in between.
    .sort((a, b) => a.date === b.date ? (a.kind === 'invoice' ? -1 : 1) : (a.date < b.date ? -1 : 1))
    .map(e => {
      const debit = e.kind === 'invoice' ? e.amountCents : 0
      const credit = e.kind === 'invoice' ? 0 : e.amountCents
      balance += debit - credit
      return { date: e.date, kind: e.kind, reference: e.reference, debitCents: debit, creditCents: credit, balanceCents: balance }
    })
  return { rows, closingCents: balance }
}

/**
 * The frozen copies written onto a document when it is issued.
 *
 * Kept here rather than inline at the call site so a quote, an invoice and a
 * credit note cannot each snapshot a slightly different set of fields, which
 * is how one document type ends up missing the branch code.
 */
export interface BillingSettingsLike {
  legal_name?: string | null
  trading_name?: string | null
  reg_number?: string | null
  vat_number?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  logo_url?: string | null
  bank_name?: string | null
  bank_account_name?: string | null
  bank_account_no?: string | null
  bank_branch_code?: string | null
  bank_swift?: string | null
}

export interface ClientLike {
  name?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  vat_number?: string | null
}

export function fromSnapshot(s: BillingSettingsLike) {
  return {
    legalName: s.legal_name || 'Cardtly',
    tradingName: s.trading_name || null,
    regNumber: s.reg_number || null,
    vatNumber: s.vat_number || null,
    email: s.email || null,
    phone: s.phone || null,
    address: s.address || null,
    logoUrl: s.logo_url || null,
  }
}

export function toSnapshot(c: ClientLike) {
  return {
    name: c.name || '',
    contactPerson: c.contact_person || null,
    email: c.email || null,
    phone: c.phone || null,
    address: c.address || null,
    vatNumber: c.vat_number || null,
  }
}

/** Banking details belong on every invoice, and on a quote so the client can
 *  see who they will be paying before they accept. */
export function bankSnapshot(s: BillingSettingsLike) {
  return {
    bankName: s.bank_name || null,
    accountName: s.bank_account_name || null,
    accountNumber: s.bank_account_no || null,
    branchCode: s.bank_branch_code || null,
    swift: s.bank_swift || null,
  }
}

/** The reference a client should use when paying. The document number is the
 *  only thing that reconciles a bank line to an invoice without guessing. */
export function paymentReference(documentNumber: string): string {
  return documentNumber
}
