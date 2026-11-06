import ExcelJS from 'exceljs'
import { XLSX_BRAND as BRAND, exportStamp } from '@/lib/xlsx-brand'
import { renderPdfTree } from '@/lib/pdf/render'
import { prospectsDocument } from '@/lib/pdf/prospects-document'
import { CARDTLY_LOGO_DATA_URI } from '@/lib/pdf/logo'
import {
  greetingFor, lastNameOf, PROSPECT_STATUSES, priorityLabel, statusInfo, summarise,
  type MergeResult, type Prospect,
} from '@/lib/prospects'

// The list as files: Excel (the whole record), PDF (to read or forward) and a
// mail-merge sheet with exactly the columns Word and Outlook ask for.
//
// The Excel headings are read back by lib/prospects-import, so the file can be
// edited offline and imported again. scripts/check-prospects holds that.

const COLUMNS: { header: string; width: number; value: (p: Prospect, rep: string) => string | number | Date | null }[] = [
  { header: 'Company', width: 30, value: p => p.company },
  { header: 'Contact Name', width: 24, value: p => p.contact_name },
  { header: 'First Name', width: 14, value: p => p.first_name },
  { header: 'Role', width: 26, value: p => p.role },
  { header: 'Email', width: 34, value: p => p.email },
  { header: 'Email Type', width: 22, value: p => p.email_type },
  { header: 'Phone', width: 16, value: p => p.phone },
  { header: 'Phone Type', width: 18, value: p => p.phone_type },
  { header: 'Sector', width: 24, value: p => p.sector },
  { header: 'Region', width: 16, value: p => p.region },
  { header: 'Priority', width: 10, value: p => priorityLabel(p.priority) },
  { header: 'Record Type', width: 12, value: p => (p.is_alternate ? 'Alternate' : 'Primary') },
  { header: 'Lists', width: 26, value: p => (p.lists || []).join(', ') },
  { header: 'Status', width: 18, value: p => statusInfo(p.status).label },
  { header: 'Date Sent', width: 12, value: p => p.emailed_on },
  { header: 'Last Contact', width: 12, value: p => p.last_contact_on },
  { header: 'Next Follow-up', width: 13, value: p => p.follow_up_on },
  { header: 'Follow-up Note', width: 24, value: p => p.follow_up_note },
  { header: 'Rep Notes', width: 44, value: p => p.notes },
  { header: 'Why Cardtly Fits', width: 44, value: p => p.fit },
  { header: 'Research Notes', width: 40, value: p => p.research_notes },
  { header: 'Source URL', width: 36, value: p => p.source_url },
  { header: 'Second Source URL', width: 36, value: p => p.source_url_2 },
  { header: 'Source Confidence', width: 24, value: p => p.source_confidence },
  { header: 'Rep', width: 18, value: (_p, rep) => rep },
]

function banner(ws: ExcelJS.Worksheet, title: string, sub: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols)
  const t = ws.getCell(1, 1)
  t.value = title
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BRAND.white } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.bannerBg } }
  t.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 30
  ws.mergeCells(2, 1, 2, cols)
  const s = ws.getCell(2, 1)
  s.value = sub
  s.font = { name: 'Calibri', size: 10, color: { argb: BRAND.subText } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.subBg } }
  s.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 20
}

function headerRow(ws: ExcelJS.Worksheet, at: number, headers: string[]) {
  const row = ws.getRow(at)
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1)
    c.value = h
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.white } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.headerBg } }
    c.alignment = { vertical: 'middle' }
    c.border = { bottom: { style: 'medium', color: { argb: BRAND.headerLine } } }
  })
  row.height = 22
}

function zebra(ws: ExcelJS.Worksheet, from: number, to: number, cols: number) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getCell(r, c)
      cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.text } }
      cell.alignment = { vertical: 'top' }
      cell.border = { bottom: { style: 'thin', color: { argb: BRAND.gridline } } }
      if ((r - from) % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } }
    }
  }
}

export async function prospectsWorkbook(rows: Prospect[], opts: { scope: string; today: string; repName: (p: Prospect) => string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cardtly'
  const stamp = exportStamp(new Date())

  const ws = wb.addWorksheet('Prospects', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] })
  COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width })
  banner(ws, 'Cardtly reseller prospects', `${opts.scope}  •  Exported ${stamp}  •  ${rows.length} contact${rows.length === 1 ? '' : 's'}`, COLUMNS.length)
  headerRow(ws, 3, COLUMNS.map(c => c.header))
  rows.forEach((p, i) => {
    const row = ws.getRow(i + 4)
    COLUMNS.forEach((c, col) => { row.getCell(col + 1).value = c.value(p, opts.repName(p)) as any })
  })
  zebra(ws, 4, rows.length + 3, COLUMNS.length)
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, rows.length + 3), column: COLUMNS.length } }

  // The same dropdown as the app, so an edited export imports cleanly.
  const statusCol = COLUMNS.findIndex(c => c.header === 'Status') + 1
  const list = `"${PROSPECT_STATUSES.map(s => s.label.replace(/,/g, '')).join(',')}"`
  for (let r = 4; r <= rows.length + 3; r++) {
    ws.getCell(r, statusCol).dataValidation = { type: 'list', allowBlank: true, formulae: [list] }
  }

  const sum = summarise(rows, opts.today)
  const over = wb.addWorksheet('Summary')
  over.getColumn(1).width = 30
  over.getColumn(2).width = 12
  banner(over, 'Summary', `${opts.scope}  •  ${stamp}`, 2)
  headerRow(over, 3, ['Measure', 'Count'])
  const lines: [string, number][] = [
    ['Contacts', sum.total], ['Not contacted', sum.notContacted], ['Emailed', sum.emailed],
    ['Called, no answer', sum.called], ['Replied or interested', sum.replied], ['Meetings booked', sum.meetings],
    ['Signed resellers', sum.signed], ['Follow-ups due', sum.followUpsDue], ['Not interested', sum.notInterested],
    ['Bounced', sum.bounced], ['Do not contact', sum.doNotContact],
  ]
  lines.forEach(([label, n], i) => {
    over.getCell(i + 4, 1).value = label
    over.getCell(i + 4, 2).value = n
  })
  zebra(over, 4, lines.length + 3, 2)

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Exactly the columns his "Mail Merge" tab had, with the greeting worked out.
 *  Headings on row 1, because that is where Word looks for them. */
export async function mailMergeWorkbook(merge: MergeResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cardtly'
  const ws = wb.addWorksheet('Mail Merge', { views: [{ state: 'frozen', ySplit: 1 }] })
  const headers = ['Email', 'First Name', 'Last Name', 'Company', 'Contact Name', 'Greeting']
  ;[34, 16, 18, 32, 26, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  headerRow(ws, 1, headers)
  merge.send.forEach((p, i) => {
    const row = ws.getRow(i + 2)
    row.getCell(1).value = p.email
    row.getCell(2).value = p.first_name
    row.getCell(3).value = lastNameOf(p)
    row.getCell(4).value = p.company
    row.getCell(5).value = p.contact_name
    row.getCell(6).value = greetingFor(p)
  })
  zebra(ws, 2, merge.send.length + 1, headers.length)

  // What was held back and why, on its own tab, so nothing just disappears.
  const left = wb.addWorksheet('Left out')
  ;[30, 24, 34, 46].forEach((w, i) => { left.getColumn(i + 1).width = w })
  headerRow(left, 1, ['Company', 'Contact Name', 'Email', 'Why it was left out'])
  merge.leftOut.forEach(({ prospect: p, reason }, i) => {
    const row = left.getRow(i + 2)
    row.getCell(1).value = p.company
    row.getCell(2).value = p.contact_name
    row.getCell(3).value = p.email
    row.getCell(4).value = reason
  })
  zebra(left, 2, merge.leftOut.length + 1, 4)

  return Buffer.from(await wb.xlsx.writeBuffer())
}

export async function prospectsPdf(rows: Prospect[], opts: { scope: string; today: string }): Promise<Buffer> {
  return renderPdfTree(prospectsDocument({
    rows,
    summary: summarise(rows, opts.today),
    title: 'Reseller prospects',
    scope: opts.scope,
    generatedOn: exportStamp(new Date()),
    logo: CARDTLY_LOGO_DATA_URI,
  }))
}

export const exportFilename = (kind: 'list' | 'merge', ext: 'xlsx' | 'pdf', today: string) =>
  `Cardtly-${kind === 'merge' ? 'mail-merge' : 'prospects'}-${today}.${ext}`
