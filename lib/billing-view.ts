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
