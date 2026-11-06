import { doc, page, view, text, image, type PdfNode } from './nodes'
import { priorityLabel, statusInfo, type Prospect, type ProspectSummary } from '../prospects'

// The prospect list as a PDF, for reading or forwarding: the figures first, as
// his Campaign Overview sheets had them, then one row per contact. Landscape,
// because a contact list is wide.
//
// Built with the node helpers rather than JSX. See lib/pdf/nodes.

const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'
const ACCENT = '#0369a1'

const s = {
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontSize: 8, color: INK, fontFamily: 'Helvetica' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logo: { width: 34, height: 34, marginRight: 10 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tile: { width: 88, paddingVertical: 6, paddingHorizontal: 8, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tileN: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ACCENT },
  tileL: { fontSize: 7, color: MUTED, marginTop: 1 },
  headRow: { flexDirection: 'row', backgroundColor: '#075985', paddingVertical: 4, paddingHorizontal: 4 },
  headCell: { fontSize: 7, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
  zebra: { backgroundColor: '#f8fafc' },
  cell: { fontSize: 7.5, paddingRight: 5 },
  strong: { fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED, fontSize: 7, marginTop: 1 },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
}

const COLUMNS = [
  { label: 'Company and contact', width: '23%' },
  { label: 'Email and phone', width: '23%' },
  { label: 'Pri', width: '6%' },
  { label: 'Status', width: '11%' },
  { label: 'Last contact', width: '8%' },
  { label: 'Follow up', width: '9%' },
  { label: 'Notes', width: '20%' },
]

const shortDate = (d: string | null) => {
  if (!d) return ''
  const t = new Date(`${d}T12:00:00Z`)
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }) : d
}

/** The core PDF fonts cover Western European text only, so anything beyond that
 *  (an emoji pasted into a note) would print as a wrong glyph. It is dropped. */
const safe = (v: string | null | undefined) => String(v ?? '').replace(/[^\u0009\u000a -ÿ–—‘’“”…]/g, '')

export function prospectsDocument(opts: {
  rows: Prospect[]
  summary: ProspectSummary
  title: string
  scope: string
  generatedOn: string
  logo?: string
}): PdfNode {
  const { rows, summary } = opts
  const tiles: [string, number][] = [
    ['Contacts', summary.total],
    ['Not contacted', summary.notContacted],
    ['Emailed', summary.emailed],
    ['Replied or interested', summary.replied],
    ['Meetings', summary.meetings],
    ['Signed', summary.signed],
    ['Follow-ups due', summary.followUpsDue],
    ['Not interested', summary.notInterested],
    ['Bounced', summary.bounced],
    ['Do not contact', summary.doNotContact],
  ]

  return doc(null,
    page({ size: 'A4', orientation: 'landscape', style: s.page },
      view({ style: s.head },
        opts.logo ? image({ src: opts.logo, style: s.logo }) : null,
        view({ style: { flex: 1 } },
          text({ style: s.title }, opts.title),
          text({ style: s.sub }, safe(`${opts.scope}  |  ${opts.generatedOn}`)),
        ),
      ),
      view({ style: s.tiles },
        tiles.map(([label, n]) => view({ style: s.tile, wrap: false },
          text({ style: s.tileN }, String(n)),
          text({ style: s.tileL }, label),
        )),
      ),
      view({ style: s.headRow, fixed: true },
        COLUMNS.map(c => view({ style: { width: c.width } }, text({ style: s.headCell }, c.label))),
      ),
      rows.map((p, i) => view({ style: i % 2 ? [s.row, s.zebra] : s.row, wrap: false },
        view({ style: { width: COLUMNS[0].width } },
          text({ style: [s.cell, s.strong] }, safe(p.company)),
          p.contact_name || p.role ? text({ style: [s.cell, s.muted] }, safe([p.contact_name, p.role].filter(Boolean).join(', '))) : null,
        ),
        view({ style: { width: COLUMNS[1].width } },
          p.email ? text({ style: s.cell }, safe(p.email)) : null,
          p.phone ? text({ style: [s.cell, s.muted] }, safe(p.phone)) : null,
        ),
        view({ style: { width: COLUMNS[2].width } }, text({ style: s.cell }, priorityLabel(p.priority))),
        view({ style: { width: COLUMNS[3].width } }, text({ style: s.cell }, statusInfo(p.status).label)),
        view({ style: { width: COLUMNS[4].width } }, text({ style: s.cell }, shortDate(p.last_contact_on))),
        view({ style: { width: COLUMNS[5].width } },
          p.follow_up_on ? text({ style: s.cell }, shortDate(p.follow_up_on)) : null,
          p.follow_up_note ? text({ style: [s.cell, s.muted] }, safe(p.follow_up_note).slice(0, 60)) : null,
        ),
        view({ style: { width: COLUMNS[6].width } },
          // Short on purpose. The Excel file is the full record; a PDF row that
          // runs to ten lines makes the whole list unreadable.
          p.notes ? text({ style: s.cell }, safe(p.notes).replace(/\s+/g, ' ').slice(0, 170)) : null,
        ),
      )),
      view({ style: s.footer, fixed: true },
        text(null, 'Cardtly (Pty) Ltd. Confidential: contains business contact details.'),
        text(null, `${rows.length} contact${rows.length === 1 ? '' : 's'}`),
      ),
    ),
  )
}
