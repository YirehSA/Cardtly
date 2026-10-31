'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { XLSX_BRAND as BRAND, exportStamp } from '@/lib/xlsx-brand'
import type { TeamReport } from '@/lib/team-analytics'

// The team owner's two tools on Team analytics: a monthly report to download,
// and starting the numbers again after setup.
//
// The report is built here from /api/team/analytics, in the same workbook
// style as the contacts and card analytics exports (lib/xlsx-brand), so a
// company receives one consistent set of files from Cardtly.

const DOT = String.fromCharCode(183)

async function downloadReport(month: string) {
  const res = await fetch(`/api/team/analytics?month=${encodeURIComponent(month)}`)
  const report: TeamReport & { error?: string } = await res.json().catch(() => ({} as any))
  if (!res.ok || report.error) throw new Error(report.error || 'Could not build the report')

  // Loaded on click, as the other exports do, to keep it out of the page bundle.
  // @ts-expect-error - the dist bundle has no bundled types
  const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cardtly'
  wb.created = new Date()
  const stamp = exportStamp(new Date())

  const banner = (ws: any, title: string, subtitle: string, span: number) => {
    ws.mergeCells(1, 1, 1, span)
    const t = ws.getCell(1, 1)
    t.value = title
    t.font = { bold: true, size: 16, color: { argb: BRAND.white } }
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.bannerBg } }
    t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(1).height = 30
    ws.mergeCells(2, 1, 2, span)
    const s = ws.getCell(2, 1)
    s.value = subtitle
    s.font = { size: 10, color: { argb: BRAND.subText } }
    s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.subBg } }
    s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(2).height = 20
  }
  const headerRow = (ws: any, rowIdx: number, headers: string[]) => {
    const r = ws.getRow(rowIdx)
    headers.forEach((h, i) => {
      const c = r.getCell(i + 1)
      c.value = h
      c.font = { bold: true, size: 10, color: { argb: BRAND.white } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.headerBg } }
      c.border = { bottom: { style: 'medium', color: { argb: BRAND.headerLine } } }
      c.alignment = { vertical: 'middle', indent: 1, wrapText: true }
    })
    r.height = 30
  }
  const cell = (ws: any, row: number, col: number, value: any, zebra: boolean, numeric = false) => {
    const c = ws.getRow(row).getCell(col)
    c.value = value
    c.font = { size: 10, color: { argb: BRAND.text } }
    if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } }
    c.border = {
      bottom: { style: 'thin', color: { argb: BRAND.gridline } },
      right: { style: 'thin', color: { argb: BRAND.gridline } },
    }
    c.alignment = { vertical: 'middle', indent: 1 }
    if (numeric) c.numFmt = '#,##0'
    return c
  }
  const subtitle = `${report.orgName}  ${DOT}  ${report.monthLabel}  ${DOT}  Exported ${stamp}`

  // ---- Summary ---------------------------------------------------------------
  const sum = wb.addWorksheet('Summary')
  sum.columns = [{ width: 36 }, { width: 16 }]
  banner(sum, `${report.orgName} team report`, subtitle, 2)
  headerRow(sum, 4, ['Measure', report.monthLabel])
  const t = report.totals
  const measures: Array<[string, number | string]> = [
    ['Cards opened at least once', `${t.activeCards} of ${report.rows.length}`],
    ['Card opens', t.opens],
    ['People reached', t.people],
    ['Links tapped', t.taps],
    ['Contacts saved to phones', t.saves],
    ['Cards shared', t.shares],
    ['New leads captured', t.leads],
  ]
  measures.forEach(([label, v], i) => {
    cell(sum, 5 + i, 1, label, i % 2 === 1)
    cell(sum, 5 + i, 2, v, i % 2 === 1, typeof v === 'number')
  })
  const arrivedAt = 5 + measures.length + 1
  headerRow(sum, arrivedAt, ['How people arrived', 'Count'])
  report.sourceLabels.forEach((label, i) => {
    const n = report.rows.reduce((s, r) => s + (r.sources[label] || 0), 0)
    cell(sum, arrivedAt + 1 + i, 1, label, i % 2 === 1)
    cell(sum, arrivedAt + 1 + i, 2, n, i % 2 === 1, true)
  })

  // ---- By person --------------------------------------------------------------
  const people = wb.addWorksheet('By person', { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] })
  const fixed = ['Name', 'Job title', 'Department', 'Opens', 'People reached', 'Links tapped', 'Contacts saved', 'Shares', 'New leads']
  const headers = [...fixed, ...report.sourceLabels]
  people.columns = headers.map((h, i) => ({ width: i === 0 ? 26 : i < 3 ? 22 : 14 }))
  banner(people, 'Activity by person', subtitle, headers.length)
  headerRow(people, 4, headers)
  if (report.rows.length === 0) {
    cell(people, 5, 1, 'No cards in this team yet', false)
  }
  report.rows.forEach((r, i) => {
    const row = 5 + i
    const z = i % 2 === 1
    const values: any[] = [r.name, r.title || '', r.department || '', r.opens, r.people, r.taps, r.saves, r.shares, r.leads,
      ...report.sourceLabels.map(l => r.sources[l] || 0)]
    values.forEach((v, c) => cell(people, row, c + 1, v, z, c >= 3))
    // Nobody opened it: a seat being paid for and not used, worth seeing.
    if (r.opens === 0) people.getRow(row).getCell(4).font = { size: 10, bold: true, color: { argb: BRAND.negative } }
  })
  if (report.rows.length) people.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + report.rows.length, column: headers.length } }

  // ---- By day -----------------------------------------------------------------
  const daily = wb.addWorksheet('By day', { views: [{ state: 'frozen', ySplit: 4 }] })
  daily.columns = [{ width: 14 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 }]
  banner(daily, 'Activity by day', subtitle, 5)
  headerRow(daily, 4, ['Date', 'Opens', 'Links tapped', 'Contacts saved', 'New leads'])
  report.byDay.forEach((d, i) => {
    const z = i % 2 === 1
    // A real date, so Excel can sort and chart it.
    cell(daily, 5 + i, 1, new Date(d.date + 'T00:00:00'), z).numFmt = 'yyyy-mm-dd'
    cell(daily, 5 + i, 2, d.opens, z, true)
    cell(daily, 5 + i, 3, d.taps, z, true)
    cell(daily, 5 + i, 4, d.saves, z, true)
    cell(daily, 5 + i, 5, d.leads, z, true)
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const safe = (report.orgName || 'team').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cardtly-team-report-${safe}-${report.month}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function reset(cardId: string | null): Promise<{ cards: number; eventsDeleted: number }> {
  const res = await fetch('/api/team/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset', card_id: cardId }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || !out.success) throw new Error(out.error || 'Could not reset the analytics')
  return out
}

export default function TeamAnalyticsActions({ months, orgName, cardCount }: {
  months: { value: string; label: string }[]
  orgName: string
  cardCount: number
}) {
  const router = useRouter()
  // Last full month by default: that is what "the monthly report" means.
  const [month, setMonth] = useState(months[1]?.value || months[0]?.value || '')
  const [busy, setBusy] = useState<'report' | 'reset' | null>(null)

  async function onDownload() {
    setBusy('report')
    try {
      await downloadReport(month)
      toast.success('Team report downloaded')
    } catch (e: any) {
      toast.error(e?.message || 'Could not build the report')
    } finally {
      setBusy(null)
    }
  }

  async function onResetAll() {
    if (!window.confirm(
      `Reset the analytics for all ${cardCount} card${cardCount === 1 ? '' : 's'} in ${orgName}?\n\n` +
      'Every open, tap and scan recorded so far is deleted, and the counts start again from zero. ' +
      'Use it after setting the cards up and testing them, so only real activity is counted.\n\n' +
      'Contacts people left are kept. This cannot be undone.')) return
    setBusy('reset')
    try {
      const r = await reset(null)
      toast.success(`Analytics reset: ${r.eventsDeleted.toLocaleString()} recorded event${r.eventsDeleted === 1 ? '' : 's'} cleared across ${r.cards} card${r.cards === 1 ? '' : 's'}.`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Could not reset the analytics')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="panel p-4 sm:p-5 flex flex-wrap items-end gap-3 justify-between">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-xs font-semibold text-muted-foreground mb-1">Monthly report</span>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm min-h-[40px]">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <button onClick={onDownload} disabled={busy !== null || !month}
          className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'hsl(var(--accent))' }}>
          {busy === 'report' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {busy === 'report' ? 'Building' : 'Download report'}
        </button>
      </div>
      <button onClick={onResetAll} disabled={busy !== null || cardCount === 0}
        title="Clear every open, tap and scan so far and start counting from zero"
        className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50">
        {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        Reset analytics
      </button>
    </div>
  )
}

/** Start one card's numbers again, after testing it. */
export function TeamCardResetButton({ cardId, name }: { cardId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function onReset() {
    if (!window.confirm(`Reset the analytics for ${name}'s card?\n\nEvery open, tap and scan recorded on it so far is deleted and its counts start from zero. Contacts are kept. This cannot be undone.`)) return
    setBusy(true)
    try {
      await reset(cardId)
      toast.success(`${name}'s analytics reset`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Could not reset the analytics')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button onClick={onReset} disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
      Reset
    </button>
  )
}
