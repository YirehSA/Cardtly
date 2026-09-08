'use client'

import { formatMoney } from '@/lib/billing-docs'

// Small pieces the three billing screens share, so a status colour or a money
// field cannot mean one thing on Invoices and another on Payments.

export const money = (cents: number | null | undefined) => formatMoney(Number(cents || 0))

/** Rands typed by a person, into integer cents.
 *
 *  Rounded, never truncated: "12.345" is a typo, and Math.round turns it into
 *  12.35 rather than silently losing a cent. Everything downstream is integer
 *  cents, so this is the only place a decimal is allowed to exist. */
export const toCents = (rands: string | number): number => {
  const n = Number(String(rands).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const toRands = (cents: number | null | undefined): string =>
  (Number(cents || 0) / 100).toFixed(2)

export const INVOICE_STATUS: Record<string, { label: string; colour: string; hint: string }> = {
  draft:      { label: 'Draft',      colour: '#6b7280', hint: 'No number yet. Freely editable, and nobody outside can see it.' },
  issued:     { label: 'Issued',     colour: '#a855f7', hint: 'Numbered and frozen. Not emailed yet.' },
  sent:       { label: 'Sent',       colour: '#0ea5e9', hint: 'With the client, awaiting payment.' },
  part_paid:  { label: 'Part paid',  colour: '#f59e0b', hint: 'Some money allocated against it.' },
  paid:       { label: 'Paid',       colour: '#22c55e', hint: 'Settled in full.' },
  overdue:    { label: 'Overdue',    colour: '#ef4444', hint: 'Past its due date and still owing.' },
  cancelled:  { label: 'Cancelled',  colour: '#6b7280', hint: 'Voided before any money moved.' },
  written_off:{ label: 'Written off',colour: '#6b7280', hint: 'Given up on. Still on the books.' },
  credited:   { label: 'Credited',   colour: '#0ea5e9', hint: 'Credit notes cover the balance. No money was received, so this is not paid.' },
}

export function StatusPill({ status }: { status: string }) {
  const m = INVOICE_STATUS[status] || { label: status, colour: '#6b7280', hint: '' }
  return (
    <span title={m.hint}
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: `${m.colour}1f`, color: m.colour, border: `1px solid ${m.colour}55` }}>
      {m.label}
    </span>
  )
}

export const METHODS = [
  { id: 'eft', label: 'EFT' },
  { id: 'paystack', label: 'Paystack' },
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Other' },
]

export const fmtDate = (d: string | null | undefined) => d ? String(d).slice(0, 10) : ''

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm"
      style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' }}>
      {children}
    </div>
  )
}
