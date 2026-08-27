'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Contact {
  name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  website?: string | null
  address?: string | null
  source?: string | null
  message?: string | null
  answers?: { label: string; value: string }[] | null
  created_at?: string | null
  owner?: string | null // whose card captured this contact (team exports)
}

const SOURCE_LABEL: Record<string, string> = {
  card_form: 'Contact form',
  booking: 'Meeting request',
  scanned: 'Scanned card',
  questionnaire: 'Questionnaire',
}

// Cardtly brand blue (#00d4ff cyan) worked into a readable, professional
// family - deep sky-blue bars for white text, the bright cyan as accent.
// Shared with the analytics export via lib/xlsx-brand.
import { XLSX_BRAND as BRAND } from '@/lib/xlsx-brand'

type ColType = 'email' | 'url' | 'date'
interface Col {
  key: keyof Contact | 'responses'
  header: string
  width: number
  wrap?: boolean
  type?: ColType
}

const BASE_COLUMNS: Col[] = [
  { key: 'name', header: 'Name', width: 24 },
  { key: 'email', header: 'Email', width: 30, type: 'email' },
  { key: 'phone', header: 'Phone', width: 18 },
  { key: 'company', header: 'Company', width: 24 },
  { key: 'title', header: 'Title', width: 22 },
  { key: 'website', header: 'Website', width: 28, type: 'url' },
  { key: 'address', header: 'Address', width: 32, wrap: true },
  { key: 'source', header: 'Source', width: 16 },
  { key: 'message', header: 'Notes', width: 42, wrap: true },
  { key: 'responses', header: 'Responses', width: 42, wrap: true },
  { key: 'created_at', header: 'Date', width: 14, type: 'date' },
]

// Pull the raw value for a column from a contact. Dates stay as Date so
// Excel treats them as real, sortable dates.
function rawValue(c: Contact, key: Col['key']): string | Date | null {
  switch (key) {
    case 'owner': return c.owner || ''
    case 'source': return c.source ? (SOURCE_LABEL[c.source] || c.source) : ''
    case 'responses':
      return Array.isArray(c.answers) ? c.answers.map(a => `${a.label}: ${a.value}`).join('\n') : ''
    case 'created_at': return c.created_at ? new Date(c.created_at) : null
    default: return (c[key as keyof Contact] as string) || ''
  }
}

export default function ExportContactsButton({
  contacts,
  filename = 'cardtly-contacts',
  orgName,
  ownerName,
  ownerLabel = 'Team Member',
}: {
  contacts: Contact[]
  filename?: string
  orgName?: string // team export: shown in the title banner
  ownerName?: string // personal export: whose contacts, shown in subtitle
  ownerLabel?: string // header for the owner column (team export)
}) {
  const [busy, setBusy] = useState(false)

  async function exportXlsx() {
    if (!contacts.length) {
      toast.error('No contacts to export')
      return
    }
    setBusy(true)
    try {
      // Load the prebuilt browser bundle only when the user clicks, so it
      // stays out of the initial dashboard bundle. The dist build ships
      // its own polyfills, so webpack needs no node shims.
      // @ts-expect-error - the dist bundle has no bundled types
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default

      // Show the owner column only when contacts actually carry an owner
      // (team exports). Personal exports skip it - it'd just repeat you.
      const hasOwner = contacts.some(c => c.owner)
      const columns: Col[] = hasOwner
        ? [{ key: 'owner', header: ownerLabel, width: 24 }, ...BASE_COLUMNS]
        : BASE_COLUMNS

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Cardtly'
      const ws = wb.addWorksheet('Contacts', {
        views: [{ state: 'frozen', ySplit: 3 }], // keep banner + header pinned while scrolling
      })

      const lastCol = columns.length
      columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width })

      // Row 1 - title banner spanning every column.
      ws.mergeCells(1, 1, 1, lastCol)
      const title = ws.getCell(1, 1)
      title.value = orgName ? `${orgName} - Contacts` : 'Cardtly Contacts Export'
      title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: BRAND.white } }
      title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.bannerBg } }
      ws.getRow(1).height = 36

      // Row 2 - subtitle: whose contacts (personal), export date + count.
      ws.mergeCells(2, 1, 2, lastCol)
      const sub = ws.getCell(2, 1)
      const dateStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
      const who = ownerName ? `${ownerName}  •  ` : ''
      sub.value = `${who}Exported ${dateStr}  •  ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`
      sub.font = { name: 'Calibri', size: 11, color: { argb: BRAND.subText } }
      sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.subBg } }
      ws.getRow(2).height = 22

      // Row 3 - column headers.
      const headerRow = ws.getRow(3)
      columns.forEach((c, i) => {
        const hc = headerRow.getCell(i + 1)
        hc.value = c.header
        hc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.white } }
        hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.headerBg } }
        hc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        hc.border = { bottom: { style: 'medium', color: { argb: BRAND.headerLine } } }
      })
      headerRow.height = 24

      // Data rows from row 4 down, with zebra striping + thin borders.
      const thin = { style: 'thin' as const, color: { argb: BRAND.gridline } }
      contacts.forEach((c, idx) => {
        const row = ws.getRow(4 + idx)
        columns.forEach((col, i) => {
          const cell = row.getCell(i + 1)
          const v = rawValue(c, col.key)

          if (col.type === 'date' && v instanceof Date) {
            cell.value = v
            cell.numFmt = 'yyyy-mm-dd'
          } else if (col.type === 'email' && v) {
            cell.value = { text: String(v), hyperlink: `mailto:${v}` }
          } else if (col.type === 'url' && v) {
            const href = /^https?:\/\//i.test(String(v)) ? String(v) : `https://${v}`
            cell.value = { text: String(v), hyperlink: href }
          } else {
            cell.value = (v as string) || ''
          }

          const isLink = (col.type === 'email' || col.type === 'url') && v
          cell.font = isLink
            ? { name: 'Calibri', size: 10, color: { argb: BRAND.linkText }, underline: true }
            : { name: 'Calibri', size: 10, color: { argb: BRAND.text } }
          cell.alignment = { vertical: 'top', horizontal: 'left', indent: 1, wrapText: !!col.wrap }
          cell.border = { top: thin, bottom: thin, left: thin, right: thin }
          if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.zebra } }
          }
        })
      })

      // Filter dropdowns on the header row (Excel extends them over the data).
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: lastCol } }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Exported ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`)
    } catch (err) {
      console.error('Export failed', err)
      toast.error('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={exportXlsx} disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-border hover:bg-muted transition disabled:opacity-60">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {busy ? 'Exporting...' : 'Export Excel'}
    </button>
  )
}
