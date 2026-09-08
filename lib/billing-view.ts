import {
  fromSnapshot, toSnapshot, bankSnapshot, effectiveVatRateBp,
  type BillingSettingsLike,
} from './billing-docs'
import type { DocView } from './pdf/invoice-document'

// A database row turned into something printable.
//
// One place, because the invoice PDF route, the email attachment and any
// future reprint all have to produce the SAME document. Two call sites each
// assembling this by hand is how one of them ends up without the terms.
//
// THE SNAPSHOT WINS. An issued document carries its own copy of who sent it,
// who it went to and the banking details; those are used verbatim and current
// settings are never consulted. Settings are only a fallback for a DRAFT,
// which has no snapshot yet because it is not a document, it is a preview.

type Row = Record<string, any>

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function linesOf(rows: Row[]): DocView['lines'] {
  return (rows || []).map(l => ({
    description: String(l.description ?? ''),
    qty: toNum(l.qty),
    unitPriceCents: toNum(l.unit_price_cents),
    lineTotalCents: toNum(l.line_total_cents),
  }))
}

/** Is a quote past the date it said it stood until?
 *
 *  Worked out on read rather than written into the row, so it is right without
 *  a cron job keeping it right. A quote nobody looked at for a month is expired
 *  the moment somebody looks, not the moment a scheduled task next runs. */
export function isQuoteExpired(quote: Row, today = new Date()): boolean {
  if (!quote.valid_until) return false
  if (['accepted', 'declined', 'cancelled', 'draft'].includes(quote.status)) return false
  return String(quote.valid_until).slice(0, 10) < today.toISOString().slice(0, 10)
}

/** What a quote's status should READ as, which is not always what is stored. */
export function quoteDisplayStatus(quote: Row, today = new Date()): string {
  return isQuoteExpired(quote, today) ? 'expired' : quote.status
}

export function docViewFromQuote(
  quote: Row,
  lines: Row[],
  fallback?: {
    settings?: (BillingSettingsLike & { vat_rate_bp?: number | null }) | null
    client?: Row | null
  },
): DocView {
  const invoiceShaped = docViewFromInvoice(
    { ...quote, due_at: null, paid_cents: 0 }, lines, fallback)
  return {
    ...invoiceShaped,
    kind: 'quote',
    dueAt: null,
    // A quote lapses rather than falling due. Printing a due date on one would
    // be asking for payment against a document nobody has agreed to.
    validUntil: quote.valid_until || null,
    paidCents: 0,
  }
}

export function docViewFromInvoice(
  invoice: Row,
  lines: Row[],
  fallback?: {
    settings?: (BillingSettingsLike & { vat_rate_bp?: number | null }) | null
    /** The raw billing_clients row, for a draft that has not snapshotted one. */
    client?: Row | null
  },
): DocView {
  const fallbackSettings = fallback?.settings || null

  // A snapshot is already in DocView shape - fromSnapshot wrote it at issue -
  // so it is used verbatim. The fallbacks go through the same helpers, which is
  // the only way a draft preview and the real document can agree.
  const from = invoice.from_snapshot
    ? { ...invoice.from_snapshot }
    : fromSnapshot(fallbackSettings || {})

  const to = invoice.to_snapshot
    ? { ...invoice.to_snapshot }
    : fallback?.client
      ? toSnapshot(fallback.client)
      : { name: 'No client' }

  const bank = invoice.bank_snapshot
    ? { ...invoice.bank_snapshot }
    : (fallbackSettings ? bankSnapshot(fallbackSettings) : null)

  // A draft has no snapshotted rate, so the same rule that governs a real
  // document governs its preview: no VAT number, no VAT.
  const vatRateBp = invoice.number
    ? toNum(invoice.vat_rate_bp)
    : effectiveVatRateBp(from.vatNumber, invoice.vat_rate_bp ?? fallbackSettings?.vat_rate_bp)

  return {
    kind: 'invoice',
    number: invoice.number || null,
    issuedAt: invoice.issued_at || null,
    dueAt: invoice.due_at || null,
    currency: invoice.currency || 'ZAR',
    subtotalCents: toNum(invoice.subtotal_cents),
    vatRateBp,
    vatCents: toNum(invoice.vat_cents),
    totalCents: toNum(invoice.total_cents),
    paidCents: toNum(invoice.paid_cents),
    notes: invoice.notes || null,
    lines: linesOf(lines),
    from: from as DocView['from'],
    to: to as DocView['to'],
    bank,
    terms: invoice.terms_snapshot || null,
  }
}

/**
 * A credit note as a printable document.
 *
 * credit_notes has no lines table, so the reason IS the line. That is the
 * right shape: a credit note says what is being credited and why, and inventing
 * line items for it would imply a level of detail the record does not hold.
 *
 * The snapshots come off the credit note itself once issued, and from the
 * INVOICE it corrects before that - so a draft preview already shows the party
 * the original went to rather than whoever that client is called today.
 */
export function docViewFromCreditNote(
  note: Row,
  invoice: Row,
  fallback?: {
    settings?: (BillingSettingsLike & { vat_rate_bp?: number | null }) | null
  },
): DocView {
  const from = note.from_snapshot
    ? { ...note.from_snapshot }
    : invoice.from_snapshot
      ? { ...invoice.from_snapshot }
      : fromSnapshot(fallback?.settings || {})

  const to = note.to_snapshot
    ? { ...note.to_snapshot }
    : invoice.to_snapshot
      ? { ...invoice.to_snapshot }
      : { name: 'No client' }

  const reason = String(note.reason || '').trim()
  return {
    kind: 'credit_note',
    number: note.number || null,
    issuedAt: note.issued_at || null,
    dueAt: null,
    currency: invoice.currency || 'ZAR',
    subtotalCents: toNum(note.subtotal_cents),
    vatRateBp: toNum(note.vat_rate_bp),
    vatCents: toNum(note.vat_cents),
    totalCents: toNum(note.total_cents),
    // Says which invoice this undoes. A credit note that does not name its
    // invoice is a credit note nobody can reconcile.
    notes: `Credit against invoice ${invoice.number || '(draft)'}.`,
    lines: [{
      description: reason || `Credit against invoice ${invoice.number || ''}`.trim(),
      qty: 1,
      unitPriceCents: toNum(note.subtotal_cents),
      lineTotalCents: toNum(note.subtotal_cents),
    }],
    from: from as DocView['from'],
    to: to as DocView['to'],
    // No banking block: nobody pays a credit note.
    bank: null,
    terms: null,
  }
}
