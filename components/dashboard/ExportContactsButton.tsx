'use client'

import { Download } from 'lucide-react'
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
}

// Wraps a CSV field: quote it and double any internal quotes so
// commas, quotes, and newlines survive Excel / Google Sheets.
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

const SOURCE_LABEL: Record<string, string> = {
  card_form: 'Contact form',
  booking: 'Meeting request',
  scanned: 'Scanned card',
  questionnaire: 'Questionnaire',
}

export default function ExportContactsButton({ contacts, filename = 'cardtly-contacts' }: { contacts: Contact[]; filename?: string }) {
  function exportCsv() {
    if (!contacts.length) { toast.error('No contacts to export'); return }

    const headers = ['Name', 'Email', 'Phone', 'Company', 'Title', 'Website', 'Address', 'Source', 'Notes', 'Responses', 'Date']
    const rows = contacts.map(c => {
      const responses = Array.isArray(c.answers)
        ? c.answers.map(a => `${a.label}: ${a.value}`).join(' | ')
        : ''
      const date = c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : ''
      return [
        c.name, c.email, c.phone, c.company, c.title, c.website, c.address,
        c.source ? (SOURCE_LABEL[c.source] || c.source) : '',
        c.message, responses, date,
      ].map(cell).join(',')
    })

    // UTF-8 BOM (accents render in Excel) + a "sep=," directive so
    // Excel splits on commas even in locales - like South Africa -
    // that default their list separator to a semicolon. Without this,
    // the whole row lands in column A.
    const csv = '﻿' + 'sep=,\r\n' + [headers.map(cell).join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`Exported ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`)
  }

  return (
    <button onClick={exportCsv}
      className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-border hover:bg-muted transition">
      <Download className="w-4 h-4" />Export CSV
    </button>
  )
}
