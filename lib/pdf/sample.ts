import {
  documentTotals, fromSnapshot, bankSnapshot, defaultDueDate, quoteValidUntil,
  effectiveVatRateBp,
  type DocKind, type DueRule, type BillingSettingsLike,
} from '../billing-docs'
import type { DocView } from './invoice-document'

// A worked example, for seeing the layout before a real document exists.
//
// It goes through documentTotals and the snapshot helpers rather than carrying
// hand-typed totals, so the preview is wrong in exactly the ways a real
// document would be wrong. A sample with made-up arithmetic proves the fonts
// line up and nothing else.

const SAMPLE_LINES = [
  { description: 'Cardtly Pro, team seats (monthly)', qty: 12, unitPriceCents: 9700 },
  { description: 'NFC cards, printed and encoded', qty: 12, unitPriceCents: 18500 },
  { description: 'Branding setup, logo and colour theme applied across the team', qty: 1, unitPriceCents: 150000 },
]

export function sampleDocument(
  settings: (BillingSettingsLike & {
    vat_rate_bp?: number | null
    payment_terms_days?: number | null
    quote_valid_days?: number | null
    invoice_due_rule?: string | null
  }) | null,
  kind: DocKind = 'invoice',
  termsBody?: string | null,
): DocView {
  const s = settings || {}
  const issued = new Date()
  // Not s.vat_rate_bp. Until there is a VAT number the rate is zero, whatever
  // settings says, or the sample shows 15% on a document headed INVOICE.
  const vatRateBp = effectiveVatRateBp(s.vat_number, s.vat_rate_bp)
  const rule = (s.invoice_due_rule as DueRule) || 'end_of_month'
  const termsDays = Number(s.payment_terms_days ?? 14)

  const totals = documentTotals(SAMPLE_LINES, vatRateBp)

  return {
    kind,
    // Deliberately marked. A preview that looks like a real numbered document
    // is a preview somebody will eventually email to a client.
    number: kind === 'quote' ? 'Q-SAMPLE' : 'INV-SAMPLE',
    issuedAt: issued.toISOString(),
    dueAt: defaultDueDate(rule, issued, termsDays),
    validUntil: quoteValidUntil(issued, Number(s.quote_valid_days ?? 14)),
    currency: 'ZAR',
    subtotalCents: totals.subtotalCents,
    vatRateBp: totals.vatRateBp,
    vatCents: totals.vatCents,
    totalCents: totals.totalCents,
    notes: 'This is a sample. It is generated from your current billing settings so you can see how a real document will read.',
    lines: SAMPLE_LINES.map(l => ({ ...l, lineTotalCents: Math.round(l.qty * l.unitPriceCents) })),
    from: fromSnapshot(s),
    to: {
      name: 'Sample Client (Pty) Ltd',
      contactPerson: 'Accounts Payable',
      email: 'accounts@example.co.za',
      phone: '011 000 0000',
      address: '1 Example Street, Sandton, 2196, Gauteng, South Africa',
      vatNumber: null,
    },
    bank: bankSnapshot(s),
    terms: termsBody || null,
  }
}
