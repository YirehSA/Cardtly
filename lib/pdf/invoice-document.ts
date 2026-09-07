import { doc, page, view, text, image, el, type PdfNode, type Style } from './nodes'
import { formatMoney, documentTitle, paymentReference, type DocKind } from '../billing-docs'

// The printable document: invoice, quote or credit note, from one layout.
//
// Laid out from Cardtly's own letterhead rather than invented. The header
// carries the address, phone, email and website the way the Word template
// does; the footer carries the legal name and registration number, which is
// where the letterhead puts them.
//
// EVERYTHING RENDERED HERE COMES OFF THE DOCUMENT ROW. Nothing is looked up.
// An invoice issued today must still render identically in five years, after
// the bank details change and the address moves, so the snapshots taken at
// issue are the only source. Code that reaches for current settings rewrites
// history.
//
// Built with the node helpers in ./nodes rather than JSX. See the comment at
// the top of that file for why.

export interface DocView {
  kind: DocKind
  number: string | null
  issuedAt: string | null
  dueAt: string | null
  validUntil?: string | null
  currency: string
  subtotalCents: number
  vatRateBp: number
  vatCents: number
  totalCents: number
  paidCents?: number
  notes?: string | null
  lines: Array<{ description: string; qty: number; unitPriceCents: number; lineTotalCents: number }>
  from: {
    legalName: string; tradingName?: string | null; regNumber?: string | null
    vatNumber?: string | null; email?: string | null; phone?: string | null
    address?: string | null; website?: string | null; logoUrl?: string | null
  }
  to: {
    name: string; contactPerson?: string | null; email?: string | null
    phone?: string | null; address?: string | null; vatNumber?: string | null
  }
  bank?: {
    bankName?: string | null; accountName?: string | null; accountNumber?: string | null
    branchCode?: string | null; accountType?: string | null; swift?: string | null
  } | null
  terms?: string | null

  /**
   * The stationery, as opposed to the document.
   *
   * Deliberately separate from `from`. Everything in `from` is snapshotted onto
   * the row at issue and must never change afterwards; these are the printed
   * decoration of whatever letterhead is current, and reprinting an old invoice
   * on today's stationery is normal rather than a falsification. Filled in by
   * lib/pdf/render, which is the only module allowed to know about assets.
   */
  stationery?: {
    qr?: string | null
    swoosh?: string | null
  }
}

// Taken off the letterhead itself rather than picked: these are the exact
// values in word/header1.xml and word/footer1.xml of Cardtly Letter Head.docx.
const INK = '#0B1220'     // the letterhead's near-black navy
const MUTED = '#6B7280'   // the colour its footer line is set in
const RULE = '#DDDDDD'

// The letterhead's signature divider, sampled across the gradient bar it uses
// three times in its header (word/media/image3.png). Drawn rather than
// embedded so it scales to any width without shipping an asset.
const GRADIENT = [
  '#1fbbfb', '#20a1f5', '#2587ef', '#4569eb', '#6a4be6',
  '#8e39da', '#b42fc9', '#d427ae', '#f12186',
]

// A4 width less the page's horizontal padding on both sides.
const CONTENT_W = 595.28 - 44 * 2

/** The gradient rule. An Svg with a real linear gradient, so it stays smooth
 *  rather than banding into visible steps the way stacked Views would. */
function gradientRule(height = 3): PdfNode {
  return el('SVG', { width: CONTENT_W, height, viewBox: `0 0 ${CONTENT_W} ${height}`, style: { marginVertical: 14 } },
    el('DEFS', null,
      el('LINEAR_GRADIENT', { id: 'cardtlyRule', x1: '0', y1: '0', x2: '1', y2: '0' },
        ...GRADIENT.map((c, i) =>
          el('STOP', { offset: `${(i / (GRADIENT.length - 1)).toFixed(4)}`, stopColor: c })),
      ),
    ),
    el('RECT', { x: 0, y: 0, width: CONTENT_W, height, fill: 'url(#cardtlyRule)' }),
  )
}

// Helvetica, Helvetica-Bold and Helvetica-Oblique are the three faces pdfkit
// carries internally. Anything else has to be registered from a font file,
// which means shipping the file and reading it at runtime on Vercel. Not worth
// it for a document whose job is to be read by an accounts department.
const s: Record<string, Style> = {
  page: { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 44, fontSize: 9, color: INK, fontFamily: 'Helvetica' },
  row: { flexDirection: 'row' },
  // flex-start, not the default stretch: the meta column on the right is the
  // taller of the two, and a stretched left column centres the brand name
  // against it, dropping it 16pt below the title it should sit level with.
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: -0.4 },
  tagline: { fontSize: 7, color: MUTED, letterSpacing: 1.1, marginTop: 3 },
  logo: { width: 46, height: 46, marginRight: 10 },

  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: -0.6, textAlign: 'right' },
  meta: { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 3 },


  label: { fontSize: 7, color: MUTED, letterSpacing: 1, marginBottom: 4 },
  labelFlush: { fontSize: 7, color: MUTED, letterSpacing: 1 },
  block: { flexGrow: 1, flexBasis: 0, paddingRight: 16 },
  line: { fontSize: 9, lineHeight: 1.5 },
  strong: { fontFamily: 'Helvetica-Bold' },
  mutedText: { color: MUTED },

  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5, marginTop: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 7 },
  cDesc: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
  cQty: { width: 46, textAlign: 'right' },
  cUnit: { width: 78, textAlign: 'right' },
  cTotal: { width: 84, textAlign: 'right' },

  totals: { marginTop: 14, marginLeft: 'auto', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: INK, marginTop: 4 },
  grandText: { fontSize: 12, fontFamily: 'Helvetica-Bold' },

  panel: { marginTop: 22, borderWidth: 1, borderColor: RULE, borderRadius: 4, padding: 12 },
  // Terms get a page of their own, so there is room to set them at a size a
  // person can actually read rather than the 7.5pt they were squeezed into
  // when they had to fit under the banking panel.
  termsBox: { marginTop: 0 },
  termsTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3, marginBottom: 2 },
  termsIntro: { fontSize: 8, color: MUTED, marginBottom: 14 },
  termsText: { fontSize: 8.5, color: INK, lineHeight: 1.6 },

  // Inset on both sides to clear the QR on the left and the corner graphic on
  // the right, so the rule runs BETWEEN them rather than under them. 96 and 110
  // leave the text box very nearly centred on the page (290.6 against 297.6),
  // which is close enough to read as centred and far enough to never collide.
  footer: {
    position: 'absolute', bottom: 26, left: 96, right: 110,
    borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8,
    fontSize: 7, color: MUTED, textAlign: 'center',
  },

  // Bottom-left, opposite the corner graphic. Sized to sit inside the band the
  // page's 64pt bottom padding already reserves, so it can never land on top of
  // a line item.
  qr: { position: 'absolute', left: 44, bottom: 24, width: 40, height: 40 },
  // bottom 7, not 15. The caption wraps to two lines, and at 15 its first line
  // ran 2pt into the bottom of the code. A QR with text over its quiet zone is
  // a QR that scanners refuse.
  qrCaption: {
    position: 'absolute', left: 36, bottom: 7, width: 56,
    fontSize: 5, color: MUTED, textAlign: 'center',
  },

  // Anchored to the page edge, not the content margin: on the letterhead it
  // bleeds into the corner, and insetting it would read as a mistake.
  swoosh: { position: 'absolute', right: 0, bottom: 0, width: 100, height: 71 },
}

const dateOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : ''

/** One label-over-value line, or nothing when there is no value. Keeps the
 *  address blocks from printing "Reg. No." above an empty space. */
const optional = (value: string | null | undefined, style: Style | Style[] = s.line, prefix = '') =>
  value ? text({ style }, `${prefix}${value}`) : null

export function invoiceDocument(d: DocView): PdfNode {
  const title = documentTitle(d.kind, d.from.vatNumber)
  const money = (c: number) => formatMoney(c, d.currency)
  const showVat = d.vatRateBp > 0
  const outstanding = d.totalCents - (d.paidCents || 0)

  const footerText = [
    d.from.legalName,
    d.from.regNumber ? `Registration No. ${d.from.regNumber}` : null,
    d.from.address,
  ].filter(Boolean).join('   ·   ')

  return doc(
    { title: `${title} ${d.number || ''}`.trim(), author: d.from.legalName },
    page({ size: 'A4', style: s.page },

      // ── Letterhead ──────────────────────────────────────────────────────
      view({ style: s.between },
        view({ style: [s.row, { alignItems: 'center' }] },
          d.from.logoUrl ? image({ style: s.logo, src: d.from.logoUrl }) : null,
          view(null,
            text({ style: s.brandName }, d.from.tradingName || d.from.legalName),
            text({ style: s.tagline }, 'YOUR ESSENCE. ONE CONNECTION'),
          ),
        ),
        view(null,
          text({ style: s.title }, title),
          // A draft says so. A preview or an unapproved recurring invoice that
          // looks numbered is one somebody eventually emails to a client.
          text({ style: s.meta }, d.number || 'DRAFT'),
          optional(d.issuedAt ? dateOf(d.issuedAt) : null, s.meta, 'Issued '),
          d.kind === 'quote'
            ? optional(d.validUntil ? dateOf(d.validUntil) : null, s.meta, 'Valid until ')
            : optional(d.dueAt ? dateOf(d.dueAt) : null, s.meta, 'Due '),
        ),
      ),

      gradientRule(),

      // ── Who, and to whom ────────────────────────────────────────────────
      view({ style: s.row },
        view({ style: s.block },
          text({ style: s.label }, 'FROM'),
          text({ style: [s.line, s.strong] }, d.from.legalName),
          optional(d.from.regNumber, s.line, 'Reg. No. '),
          // Printed only when there is one. A business that is not registered
          // must not show a VAT line at all.
          optional(d.from.vatNumber, s.line, 'VAT No. '),
          optional(d.from.address),
          optional(d.from.phone),
          optional(d.from.email),
          optional(d.from.website),
        ),
        view({ style: s.block },
          text({ style: s.label }, d.kind === 'quote' ? 'QUOTE FOR' : 'BILL TO'),
          text({ style: [s.line, s.strong] }, d.to.name),
          optional(d.to.contactPerson),
          optional(d.to.address),
          optional(d.to.phone),
          optional(d.to.email),
          optional(d.to.vatNumber, s.line, 'VAT No. '),
        ),
      ),

      // ── Lines ───────────────────────────────────────────────────────────
      view({ style: s.th },
        text({ style: [s.cDesc, s.labelFlush] }, 'DESCRIPTION'),
        text({ style: [s.cQty, s.labelFlush] }, 'QTY'),
        text({ style: [s.cUnit, s.labelFlush] }, 'UNIT'),
        text({ style: [s.cTotal, s.labelFlush] }, 'AMOUNT'),
      ),
      d.lines.map(l => view({ style: s.tr, wrap: false },
        text({ style: s.cDesc }, l.description),
        // Trailing zeros trimmed: "1" not "1.000", and "1.5" survives.
        text({ style: s.cQty }, String(Number(l.qty))),
        text({ style: s.cUnit }, money(l.unitPriceCents)),
        text({ style: s.cTotal }, money(l.lineTotalCents)),
      )),

      // ── Money ───────────────────────────────────────────────────────────
      view({ style: s.totals },
        view({ style: s.totalRow },
          text({ style: s.mutedText }, 'Subtotal'),
          text(null, money(d.subtotalCents)),
        ),
        showVat ? view({ style: s.totalRow },
          text({ style: s.mutedText }, `VAT @ ${(d.vatRateBp / 100).toFixed(2)}%`),
          text(null, money(d.vatCents)),
        ) : null,
        view({ style: s.grand },
          text({ style: s.grandText }, 'Total'),
          text({ style: s.grandText }, money(d.totalCents)),
        ),
        d.paidCents ? view({ style: s.totalRow },
          text({ style: s.mutedText }, 'Paid'),
          text(null, money(d.paidCents)),
        ) : null,
        d.paidCents ? view({ style: s.totalRow },
          text({ style: s.strong }, 'Outstanding'),
          text({ style: s.strong }, money(outstanding)),
        ) : null,
      ),

      d.notes ? view({ style: { marginTop: 18 } },
        text({ style: s.label }, 'NOTES'),
        text({ style: s.line }, d.notes),
      ) : null,

      // ── Banking ─────────────────────────────────────────────────────────
      // On a quote as well as an invoice, so the client can see who they will
      // be paying before they accept.
      d.bank && d.bank.accountNumber ? view({ style: s.panel },
        text({ style: s.label }, 'BANKING DETAILS'),
        view({ style: s.row },
          view({ style: s.block },
            optional(d.bank.bankName),
            optional(d.bank.accountName),
            optional(d.bank.accountType),
          ),
          view({ style: s.block },
            optional(d.bank.accountNumber, s.line, 'Account: '),
            optional(d.bank.branchCode, s.line, 'Branch code: '),
            optional(d.bank.swift, s.line, 'SWIFT: '),
          ),
        ),
        // The one thing that reconciles a bank line to a document without
        // anybody guessing. Not on a quote: there is nothing to pay yet, and
        // a quote number used as a payment reference is a payment nothing can
        // be matched to.
        d.number && d.kind !== 'quote'
          ? text({ style: [s.line, s.strong, { marginTop: 6 }] },
              `Please use ${paymentReference(d.number)} as your payment reference.`)
          : null,
      ) : null,

      // `break` starts a fresh page. Terms belong on one of their own: on a
      // quote they are what the client is being asked to agree to, and squeezed
      // under the banking panel in 7.5pt grey they read as small print nobody
      // is expected to have looked at.
      d.terms ? view({ style: s.termsBox, break: true },
        text({ style: s.termsTitle }, 'Terms and conditions'),
        text({ style: s.termsIntro },
          `These terms form part of ${d.kind === 'quote' ? 'this quotation' : `${title.toLowerCase()} ${d.number || ''}`.trim()}.`),
        text({ style: s.termsText }, d.terms),
      ) : null,

      // The stationery, drawn last so it sits over the page rather than under
      // it, and `fixed` so a two-page quote is not a branded first page
      // followed by a bare second one.
      d.stationery?.swoosh
        ? image({ style: s.swoosh, src: d.stationery.swoosh, fixed: true })
        : null,
      d.stationery?.qr
        ? image({ style: s.qr, src: d.stationery.qr, fixed: true })
        : null,
      // Says what the code is for. Without it a QR on an invoice reads as
      // "scan to pay", and this one goes to a business card.
      d.stationery?.qr
        ? text({ style: s.qrCaption, fixed: true }, 'SCAN TO SAVE OUR DETAILS')
        : null,

      text({ style: s.footer, fixed: true }, footerText),
    ),
  )
}
