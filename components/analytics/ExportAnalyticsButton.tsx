'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { XLSX_BRAND as BRAND, exportStamp } from '@/lib/xlsx-brand'

// Download what is on the analytics screen as a workbook.
//
// The numbers are already computed for the page; this takes the same object
// rather than recalculating, so the spreadsheet can never disagree with the
// screen it was downloaded from. That is the whole point - a report that says
// something different from the dashboard is worse than no report.
//
// Scoped to the period the user is looking at, and the period is named in the
// file so a downloaded copy is still meaningful a month later.

export type AnalyticsExportData = {
  views: number; prevViews: number
  shares: number; prevShares: number
  clicks: number; prevClicks: number
  saves: number; prevSaves: number
  leads: number; prevLeads: number
  byDay: { date: string; count: number }[]
  topLinks: { key: string; count: number }[]
  byDevice: { key: string; count: number }[]
  byBrowser: { key: string; count: number }[]
  bySource: { key: string; count: number }[]
  byChannel: { key: string; count: number }[]
}

export default function ExportAnalyticsButton({
  data, cardName, cardSlug, period, totalViews, orgName,
}: {
  data: AnalyticsExportData
  cardName: string
  cardSlug: string
  period: number
  /** Lifetime views, which is not the same as views in the period. */
  totalViews: number
  orgName?: string
}) {
  const [busy, setBusy] = useState(false)

  async function exportXlsx() {
    setBusy(true)
    try {
      // Loaded on click so the prebuilt bundle stays out of the dashboard's
      // initial download. Same approach as the contacts export.
      // @ts-expect-error - the dist bundle has no bundled types
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Cardtly'
      wb.created = new Date()

      const periodLabel = `Last ${period} days`
      const stamp = exportStamp(new Date())

      // ---- helpers -------------------------------------------------------
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
          c.alignment = { vertical: 'middle', indent: 1 }
        })
        r.height = 20
      }

      const bodyCell = (ws: any, rowIdx: number, colIdx: number, value: any, zebra: boolean) => {
        const c = ws.getRow(rowIdx).getCell(colIdx)
        c.value = value
        c.font = { size: 10, color: { argb: BRAND.text } }
        if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } }
        c.border = {
          bottom: { style: 'thin', color: { argb: BRAND.gridline } },
          right: { style: 'thin', color: { argb: BRAND.gridline } },
        }
        c.alignment = { vertical: 'middle', indent: 1 }
        return c
      }

      // A simple two-column table, used for every breakdown.
      const listSheet = (name: string, label: string, rows: { key: string; count: number }[]) => {
        const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }] })
        ws.columns = [{ width: 40 }, { width: 14 }]
        banner(ws, label, `${cardName}  ${String.fromCharCode(183)}  ${periodLabel}  ${String.fromCharCode(183)}  ${stamp}`, 2)
        headerRow(ws, 4, [label, 'Count'])
        if (rows.length === 0) {
          const c = bodyCell(ws, 5, 1, 'Nothing recorded in this period', false)
          c.font = { size: 10, italic: true, color: { argb: BRAND.text } }
          bodyCell(ws, 5, 2, '', false)
        } else {
          rows.forEach((r, i) => {
            const z = i % 2 === 1
            bodyCell(ws, 5 + i, 1, r.key || 'Unknown', z)
            bodyCell(ws, 5 + i, 2, r.count, z).numFmt = '#,##0'
          })
        }
        return ws
      }

      // ---- Summary -------------------------------------------------------
      const sum = wb.addWorksheet('Summary')
      sum.columns = [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 14 }]
      banner(sum, `${cardName} - card analytics`,
        `${orgName ? orgName + '  ' + String.fromCharCode(183) + '  ' : ''}cardtly.com/card/${cardSlug}  ${String.fromCharCode(183)}  ${periodLabel}  ${String.fromCharCode(183)}  Exported ${stamp}`, 4)
      headerRow(sum, 4, ['Measure', periodLabel, 'Previous period', 'Change'])

      const metrics: Array<[string, number, number]> = [
        ['Card views', data.views, data.prevViews],
        ['Links tapped', data.clicks, data.prevClicks],
        ['Contact saves', data.saves, data.prevSaves],
        ['Shares', data.shares, data.prevShares],
        ['Leads captured', data.leads, data.prevLeads],
      ]
      metrics.forEach(([label, now, prev], i) => {
        const row = 5 + i
        const z = i % 2 === 1
        bodyCell(sum, row, 1, label, z)
        bodyCell(sum, row, 2, now, z).numFmt = '#,##0'
        bodyCell(sum, row, 3, prev, z).numFmt = '#,##0'
        const delta = now - prev
        const c = bodyCell(sum, row, 4, delta, z)
        // Signed, so a fall is unmistakable at a glance. A percentage would
        // read as infinite whenever the previous period was zero, which for a
        // new card is most of them.
        c.numFmt = '+#,##0;-#,##0;0'
        c.font = {
          size: 10, bold: delta !== 0,
          color: { argb: delta > 0 ? BRAND.positive : delta < 0 ? BRAND.negative : BRAND.text },
        }
      })

      const lifetimeRow = 5 + metrics.length + 1
      const lc = bodyCell(sum, lifetimeRow, 1, 'Views since the card was created', false)
      lc.font = { size: 10, bold: true, color: { argb: BRAND.text } }
      bodyCell(sum, lifetimeRow, 2, totalViews, false).numFmt = '#,##0'

      // ---- Daily views ---------------------------------------------------
      const daily = wb.addWorksheet('Daily views', { views: [{ state: 'frozen', ySplit: 4 }] })
      daily.columns = [{ width: 16 }, { width: 14 }]
      banner(daily, 'Views per day', `${cardName}  ${String.fromCharCode(183)}  ${periodLabel}`, 2)
      headerRow(daily, 4, ['Date', 'Views'])
      data.byDay.forEach((d, i) => {
        const z = i % 2 === 1
        // A real date, not the text of one, so Excel can sort and chart it.
        const cell = bodyCell(daily, 5 + i, 1, new Date(d.date + 'T00:00:00'), z)
        cell.numFmt = 'yyyy-mm-dd'
        bodyCell(daily, 5 + i, 2, d.count, z).numFmt = '#,##0'
      })

      // ---- Breakdowns ----------------------------------------------------
      listSheet('Top links', 'Link', data.topLinks)
      listSheet('How they arrived', 'Channel', data.byChannel)
      listSheet('Devices', 'Device', data.byDevice)
      listSheet('Browsers', 'Browser', data.byBrowser)
      listSheet('Traffic sources', 'Source', data.bySource)

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const safe = (cardSlug || cardName || 'card').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cardtly-analytics-${safe}-${period}d.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Analytics downloaded')
    } catch (e: any) {
      toast.error(e?.message ? `Could not build the file: ${e.message}` : 'Could not build the file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={exportXlsx}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {busy ? 'Building' : 'Export'}
    </button>
  )
}
