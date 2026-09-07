'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, FileText, Send, Trash2, Lock } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, toCents, toRands, StatusPill, Empty, fmtDate } from './shared'

// Invoices: draft, edit, issue.
//
// The distinction the whole screen turns on: a DRAFT has no number and can be
// changed freely; an ISSUED invoice is frozen and the only correction is a
// credit note. Issuing is presented as the one-way door it is.

type Invoice = {
  id: string; number: string | null; status: string; client_id: string
  client_name: string; issued_at: string | null; due_at: string | null
  total_cents: number; paid_cents: number; outstanding_cents: number
}
type Line = { description: string; qty: string; unit_price_cents: string }

const BLANK_LINE: Line = { description: '', qty: '1', unit_price_cents: '' }

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'draft', label: 'Drafts' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'Everything' },
]

export default function InvoicesTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [filter, setFilter] = useState('open')
  const [editing, setEditing] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [iRes, cRes] = await Promise.all([
      fetch(`/api/admin/billing/invoices?status=${filter}`),
      fetch('/api/admin/billing/clients'),
    ])
    const iData = await iRes.json().catch(() => ({}))
    const cData = await cRes.json().catch(() => ({}))
    setLoading(false)
    if (!iRes.ok) { setUnavailable(iData?.error || 'Could not load invoices'); return }
    setUnavailable(null)
    setInvoices(iData.invoices || [])
    setClients(cData.clients || [])
  }
  useEffect(() => { load() }, [filter])

  function startNew() {
    setEditing({ id: null, client_id: clients[0]?.id || '', notes: '', lines: [{ ...BLANK_LINE }] })
  }

  async function openDraft(inv: Invoice) {
    const res = await fetch(`/api/admin/billing/invoices?id=${inv.id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data?.error || 'Could not open it'); return }
    setEditing({
      id: data.invoice.id,
      client_id: data.invoice.client_id,
      notes: data.invoice.notes || '',
      status: data.invoice.status,
      number: data.invoice.number,
      lines: (data.lines || []).map((l: any) => ({
        description: l.description, qty: String(Number(l.qty)), unit_price_cents: toRands(l.unit_price_cents),
      })),
    })
  }

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return (editing.lines || []).reduce(
      (n: number, l: Line) => n + Math.round(Number(l.qty || 0) * toCents(l.unit_price_cents || 0)), 0)
  }, [editing])

  async function save(): Promise<string | null> {
    setBusy(true)
    const payload = {
      id: editing.id || undefined,
      client_id: editing.client_id,
      notes: editing.notes,
      lines: (editing.lines || [])
        .filter((l: Line) => l.description.trim())
        .map((l: Line) => ({
          description: l.description,
          qty: Number(l.qty || 0),
          unit_price_cents: toCents(l.unit_price_cents || 0),
        })),
    }
    const res = await fetch('/api/admin/billing/invoices', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return null }
    return data.invoice?.id || editing.id
  }

  async function saveAndClose() {
    const id = await save()
    if (id) { toast.success('Draft saved'); setEditing(null); load() }
  }

  async function issue() {
    // Saved first, always. Issuing what is on screen rather than what was last
    // saved is the only behaviour that cannot surprise anybody.
    const id = await save()
    if (!id) return
    if (!confirm('Issue this invoice? It gets a number and can never be edited again. A mistake after this needs a credit note.')) return
    setBusy(true)
    const res = await fetch('/api/admin/billing/invoices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'issue' }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not issue'); return }
    toast.success(`Issued as ${data.invoice.number}, due ${data.invoice.due_at}`)
    setEditing(null); load()
  }

  async function cancel(inv: Invoice) {
    if (!confirm(`Cancel ${inv.number || 'this draft'}?`)) return
    const res = await fetch('/api/admin/billing/invoices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inv.id, action: 'cancel' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not cancel'); return }
    toast.success('Cancelled'); load()
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <Loader2 className="w-4 h-4 animate-spin" />Loading invoices
  </div>
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  const owing = invoices.reduce((n, i) => n + i.outstanding_cents, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={filter === f.id
              ? { background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.55)', border: '1px solid transparent' }}>
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={startNew} disabled={clients.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: grad, color: '#fff' }}
          title={clients.length === 0 ? 'Add a client first' : undefined}>
          <Plus className="w-4 h-4" />New invoice
        </button>
      </div>

      {owing > 0 && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{money(owing)} outstanding in this view.</p>
      )}

      {editing && (
        <Section
          title={editing.id ? (editing.number ? `Invoice ${editing.number}` : 'Edit draft') : 'New invoice'}
          sub={editing.status && editing.status !== 'draft'
            ? 'Issued. Frozen, and shown here read only.'
            : 'A draft has no number and is not visible to anyone outside.'}
          right={<button onClick={() => setEditing(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>

          {editing.status && editing.status !== 'draft' ? (
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs mb-4"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)', color: 'rgba(255,255,255,0.75)' }}>
              <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#a855f7' }} />
              <div>This invoice has been issued, so it cannot be changed. Correcting it means raising a credit note,
                which leaves both documents on the books and is what an auditor expects to see.</div>
            </div>
          ) : null}

          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Client</span>
            <select className={`${inputClass} mt-1.5`} style={inputStyle} value={editing.client_id}
              disabled={!!editing.status && editing.status !== 'draft'}
              onChange={e => setEditing({ ...editing, client_id: e.target.value })}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <div className="space-y-2">
            {(editing.lines || []).map((l: Line, i: number) => (
              <div key={i} className="flex gap-2 items-start flex-wrap">
                <input className={inputClass} style={{ ...inputStyle, flex: '1 1 180px', minWidth: 180 }} placeholder="Description"
                  value={l.description} disabled={!!editing.status && editing.status !== 'draft'}
                  onChange={e => {
                    const lines = [...editing.lines]; lines[i] = { ...l, description: e.target.value }
                    setEditing({ ...editing, lines })
                  }} />
                <input className={inputClass} style={{ ...inputStyle, width: 76, flex: 'none' }} placeholder="Qty" inputMode="decimal"
                  value={l.qty} disabled={!!editing.status && editing.status !== 'draft'}
                  onChange={e => {
                    const lines = [...editing.lines]; lines[i] = { ...l, qty: e.target.value }
                    setEditing({ ...editing, lines })
                  }} />
                <input className={inputClass} style={{ ...inputStyle, width: 110, flex: 'none' }} placeholder="Unit (R)" inputMode="decimal"
                  value={l.unit_price_cents} disabled={!!editing.status && editing.status !== 'draft'}
                  onChange={e => {
                    const lines = [...editing.lines]; lines[i] = { ...l, unit_price_cents: e.target.value }
                    setEditing({ ...editing, lines })
                  }} />
                <div className="w-28 text-right text-sm py-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {money(Math.round(Number(l.qty || 0) * toCents(l.unit_price_cents || 0)))}
                </div>
                {(!editing.status || editing.status === 'draft') && (
                  <button onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_: any, n: number) => n !== i) })}
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {(!editing.status || editing.status === 'draft') && (
            <button onClick={() => setEditing({ ...editing, lines: [...editing.lines, { ...BLANK_LINE }] })}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
              <Plus className="w-3.5 h-3.5" />Add line
            </button>
          )}

          <div className="flex justify-end mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Total</p>
              <p className="text-xl font-bold text-white">{money(draftTotal)}</p>
            </div>
          </div>

          <label className="block mt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Notes</span>
            <input className={`${inputClass} mt-1.5`} style={inputStyle} value={editing.notes ?? ''}
              disabled={!!editing.status && editing.status !== 'draft'}
              onChange={e => setEditing({ ...editing, notes: e.target.value })} />
          </label>

          <div className="flex justify-end gap-2 mt-4 flex-wrap">
            {editing.id && (
              <a href={`/api/admin/billing/invoices/pdf?id=${editing.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <FileText className="w-4 h-4" />PDF
              </a>
            )}
            {(!editing.status || editing.status === 'draft') && (
              <>
                <button onClick={saveAndClose} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save draft
                </button>
                <button onClick={issue} disabled={busy || draftTotal <= 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: grad, color: '#fff' }}>
                  <Send className="w-4 h-4" />Issue
                </button>
              </>
            )}
          </div>
        </Section>
      )}

      {invoices.length === 0 ? (
        <Empty>{filter === 'open' ? 'Nothing outstanding.' : 'No invoices here.'}</Empty>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {invoices.map((inv, i) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-28">
                <p className="font-mono text-xs text-white">{inv.number || 'Draft'}</p>
                <StatusPill status={inv.status} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm text-white">{inv.client_name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {inv.issued_at ? `Issued ${fmtDate(inv.issued_at)}` : 'Not issued'}
                  {inv.due_at ? ` · due ${fmtDate(inv.due_at)}` : ''}
                </p>
              </div>
              <div className="text-right w-32">
                <p className="text-sm font-bold text-white">{money(inv.total_cents)}</p>
                {inv.paid_cents > 0 && inv.outstanding_cents > 0 && (
                  <p className="text-[11px]" style={{ color: '#f59e0b' }}>{money(inv.outstanding_cents)} still owing</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <a href={`/api/admin/billing/invoices/pdf?id=${inv.id}`} target="_blank" rel="noreferrer"
                  title="PDF" className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <FileText className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </a>
                <button onClick={() => openDraft(inv)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
                  {inv.status === 'draft' ? 'Edit' : 'View'}
                </button>
                {inv.status === 'draft' && (
                  <button onClick={() => cancel(inv)} title="Cancel"
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
