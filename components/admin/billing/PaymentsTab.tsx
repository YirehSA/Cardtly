'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, Wand2, Trash2, Link2 } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, toCents, toRands, METHODS, Empty, fmtDate } from './shared'

// Money in, then money allocated.
//
// Recording a payment and deciding what it settles are two steps on purpose.
// A client who EFTs one amount covering three invoices, and a deposit nobody
// can identify yet, are both normal, and a screen that insists on a single
// invoice per payment cannot represent either.
//
// Unallocated cash is shown as a state, not an error.

type Allocation = { id: string; invoice_id: string; amount_cents: number; invoice_number: string }
type Receipt = {
  id: string; client_id: string | null; client_name: string | null
  amount_cents: number; received_on: string; method: string
  reference: string | null; notes: string | null
  allocations: Allocation[]; unallocated_cents: number
}

export default function PaymentsTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [adding, setAdding] = useState<any | null>(null)
  const [allocating, setAllocating] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      fetch('/api/admin/billing/payments'),
      fetch('/api/admin/billing/clients'),
    ])
    const rData = await rRes.json().catch(() => ({}))
    const cData = await cRes.json().catch(() => ({}))
    setLoading(false)
    if (!rRes.ok) { setUnavailable(rData?.error || 'Could not load payments'); return }
    setUnavailable(null)
    setReceipts(rData.receipts || [])
    setClients(cData.clients || [])
  }
  useEffect(() => { load() }, [])

  async function record() {
    setBusy(true)
    const res = await fetch('/api/admin/billing/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: adding.client_id || null,
        amount_cents: toCents(adding.amount),
        received_on: adding.received_on,
        method: adding.method,
        reference: adding.reference,
        notes: adding.notes,
        auto_allocate: adding.auto_allocate,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not record it'); return }
    toast.success(adding.auto_allocate ? 'Payment recorded and allocated' : 'Payment recorded')
    setAdding(null); load()
  }

  async function openAllocate(r: Receipt) {
    if (!r.client_id) { toast.error('Set a client on this payment before allocating it.'); return }
    const res = await fetch('/api/admin/billing/payments', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: r.client_id, amount_cents: r.amount_cents, exclude_receipt_id: r.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data?.error || 'Could not work out what this could settle'); return }

    // Start from what is already allocated, so opening this screen and saving
    // it again changes nothing. The proposal is offered, not applied.
    const current = r.allocations.map(a => ({
      invoice_id: a.invoice_id, amount: toRands(a.amount_cents), invoice_number: a.invoice_number,
    }))
    setAllocating({
      receipt: r,
      proposal: data.allocations || [],
      rows: current.length ? current : (data.allocations || []).map((a: any) => ({
        invoice_id: a.invoice_id, amount: toRands(a.amount_cents), invoice_number: a.invoice_number,
      })),
    })
  }

  async function saveAllocation() {
    setBusy(true)
    const res = await fetch('/api/admin/billing/payments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_id: allocating.receipt.id,
        allocations: allocating.rows
          .filter((r: any) => toCents(r.amount) > 0)
          .map((r: any) => ({ invoice_id: r.invoice_id, amount_cents: toCents(r.amount) })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not allocate'); return }
    toast.success(data.unallocated > 0
      ? `Allocated ${money(data.allocated)}. ${money(data.unallocated)} still unapplied.`
      : `Allocated ${money(data.allocated)} in full.`)
    setAllocating(null); load()
  }

  async function remove(r: Receipt) {
    if (!confirm(`Delete this ${money(r.amount_cents)} payment? Any invoices it settled go back to owing.`)) return
    const res = await fetch(`/api/admin/billing/payments?id=${r.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not delete'); return }
    toast.success('Payment deleted'); load()
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <Loader2 className="w-4 h-4 animate-spin" />Loading payments
  </div>
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  const unapplied = receipts.reduce((n, r) => n + r.unallocated_cents, 0)
  const allocSum = allocating
    ? allocating.rows.reduce((n: number, r: any) => n + toCents(r.amount || 0), 0) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs flex-1 min-w-[200px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          One row per bank line. Allocate it across whatever invoices it settles; anything left over
          stays on the account as unapplied cash.
        </p>
        <button onClick={() => setAdding({
          client_id: '', amount: '', received_on: new Date().toISOString().slice(0, 10),
          method: 'eft', reference: '', notes: '', auto_allocate: true,
        })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: grad, color: '#fff' }}>
          <Plus className="w-4 h-4" />Record a payment
        </button>
      </div>

      {unapplied > 0 && (
        <div className="rounded-lg p-3 text-xs"
          style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)', color: 'rgba(255,255,255,0.8)' }}>
          {money(unapplied)} received and not yet allocated to an invoice.
        </div>
      )}

      {adding && (
        <Section title="Record a payment" sub="What arrived in the bank. Allocation is the next step, and can wait."
          right={<button onClick={() => setAdding(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Client</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.client_id}
                onChange={e => setAdding({ ...adding, client_id: e.target.value })}>
                <option value="">Not identified yet</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Amount (R)</span>
              <input className={`${inputClass} mt-1.5`} style={inputStyle} inputMode="decimal" placeholder="0.00"
                value={adding.amount} onChange={e => setAdding({ ...adding, amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Received on</span>
              <input type="date" className={`${inputClass} mt-1.5`} style={inputStyle}
                value={adding.received_on} onChange={e => setAdding({ ...adding, received_on: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Method</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.method}
                onChange={e => setAdding({ ...adding, method: e.target.value })}>
                {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Reference</span>
              <input className={`${inputClass} mt-1.5`} style={inputStyle} placeholder="What appeared on the bank statement"
                value={adding.reference} onChange={e => setAdding({ ...adding, reference: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <input type="checkbox" checked={adding.auto_allocate}
              onChange={e => setAdding({ ...adding, auto_allocate: e.target.checked })} />
            Allocate it straight away, oldest invoice first
          </label>
          <div className="flex justify-end mt-4">
            <button onClick={record} disabled={busy || toCents(adding.amount) <= 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Record
            </button>
          </div>
        </Section>
      )}

      {allocating && (
        <Section
          title={`Allocate ${money(allocating.receipt.amount_cents)}`}
          sub={`${allocating.receipt.client_name || 'Unidentified'} · ${fmtDate(allocating.receipt.received_on)}${allocating.receipt.reference ? ` · ${allocating.receipt.reference}` : ''}`}
          right={<button onClick={() => setAllocating(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>

          {allocating.proposal.length > 0 && (
            <button onClick={() => setAllocating({
              ...allocating,
              rows: allocating.proposal.map((a: any) => ({
                invoice_id: a.invoice_id, amount: toRands(a.amount_cents), invoice_number: a.invoice_number,
              })),
            })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold mb-3"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
              <Wand2 className="w-3.5 h-3.5" />Suggest: oldest invoice first
            </button>
          )}

          {allocating.rows.length === 0 ? (
            <Empty>This client has no invoices outstanding, so there is nothing to allocate against yet.</Empty>
          ) : (
            <div className="space-y-2">
              {allocating.rows.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs w-32" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {r.invoice_number || 'Invoice'}
                  </span>
                  <input className={inputClass} style={{ ...inputStyle, width: 130, flex: 'none' }} inputMode="decimal" value={r.amount}
                    onChange={e => {
                      const rows = [...allocating.rows]; rows[i] = { ...r, amount: e.target.value }
                      setAllocating({ ...allocating, rows })
                    }} />
                  <button onClick={() => setAllocating({ ...allocating, rows: allocating.rows.filter((_: any, n: number) => n !== i) })}
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 flex-wrap gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: allocSum > allocating.receipt.amount_cents ? '#ef4444' : 'rgba(255,255,255,0.55)' }}>
              {allocSum > allocating.receipt.amount_cents
                ? `That is ${money(allocSum - allocating.receipt.amount_cents)} more than was received.`
                : `Allocating ${money(allocSum)} of ${money(allocating.receipt.amount_cents)}` +
                  (allocating.receipt.amount_cents - allocSum > 0
                    ? ` · ${money(allocating.receipt.amount_cents - allocSum)} stays unapplied`
                    : '')}
            </p>
            <button onClick={saveAllocation} disabled={busy || allocSum > allocating.receipt.amount_cents}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save allocation
            </button>
          </div>
        </Section>
      )}

      {receipts.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {receipts.map((r, i) => (
            <div key={r.id} className="px-4 py-3"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-24 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtDate(r.received_on)}</div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm text-white">{r.client_name || 'Not identified'}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {[METHODS.find(m => m.id === r.method)?.label, r.reference].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right w-32">
                  <p className="text-sm font-bold text-white">{money(r.amount_cents)}</p>
                  {r.unallocated_cents > 0 && (
                    <p className="text-[11px]" style={{ color: '#0ea5e9' }}>{money(r.unallocated_cents)} unapplied</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openAllocate(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
                    <Link2 className="w-3.5 h-3.5" />Allocate
                  </button>
                  <button onClick={() => remove(r)} title="Delete"
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>
              {r.allocations.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2 pl-24">
                  {r.allocations.map(a => (
                    <span key={a.id} className="px-2 py-0.5 rounded text-[11px] font-mono"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                      {a.invoice_number} {money(a.amount_cents)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
