'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, Wand2, Trash2, Link2, FileText, Check } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, toCents, toRands, METHODS, Empty, fmtDate } from './shared'
import { referenceMatches } from '@/lib/payment-flow'

// Money in, then money allocated.
//
// Recording a payment and deciding what it settles are two steps on purpose.
// A client who EFTs one amount covering three invoices, and a deposit nobody
// can identify yet, are both normal, and a screen that insists on a single
// invoice per payment cannot represent either.
//
// Unallocated cash is shown as a state, not an error.
//
// PICK THE INVOICE (Andre, 2026-10-21: "I still can't select the invoice that
// got paid and I have to go into the bank to check the amount"). Both forms
// list every invoice the client still owes on, with what each owes. Tick the
// ones that were paid: the amount fills in from them, and the money goes on
// exactly those, not on whichever is oldest. Typing the reference from the
// bank finds the invoice, and its client, by its number.

type Allocation = { id: string; invoice_id: string; amount_cents: number; invoice_number: string }
type Receipt = {
  id: string; client_id: string | null; client_name: string | null
  amount_cents: number; received_on: string; method: string
  reference: string | null; notes: string | null
  allocations: Allocation[]; unallocated_cents: number
}
type OpenInvoice = { id: string; number: string | null; client_id: string; due_at: string | null; outstanding_cents: number; status: string }
type Pick = { on: boolean; amount: string }

/** The money spread over the ticked invoices in the order shown, each up to what it owes. */
function spread(amountCents: number, invoices: Array<{ id: string; owing: number }>): Record<string, number> {
  let left = Math.max(0, amountCents)
  const out: Record<string, number> = {}
  for (const i of invoices) {
    const n = Math.min(left, i.owing)
    if (n > 0) out[i.id] = n
    left -= n
  }
  return out
}

export default function PaymentsTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([])
  const [adding, setAdding] = useState<any | null>(null)
  const [allocating, setAllocating] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [rRes, cRes, iRes] = await Promise.all([
      fetch('/api/admin/billing/payments'),
      fetch('/api/admin/billing/clients'),
      fetch('/api/admin/billing/invoices?status=open'),
    ])
    const rData = await rRes.json().catch(() => ({}))
    const cData = await cRes.json().catch(() => ({}))
    const iData = await iRes.json().catch(() => ({}))
    setLoading(false)
    if (!rRes.ok) { setUnavailable(rData?.error || 'Could not load payments'); return }
    setUnavailable(null)
    setReceipts(rData.receipts || [])
    setClients(cData.clients || [])
    setOpenInvoices((iData.invoices || [])
      .filter((i: any) => (i.outstanding_cents || 0) > 0)
      .map((i: any) => ({ id: i.id, number: i.number, client_id: i.client_id, due_at: i.due_at, outstanding_cents: i.outstanding_cents, status: i.status }))
      // Oldest due first, the order money is usually meant for.
      .sort((a: OpenInvoice, b: OpenInvoice) => String(a.due_at || '9').localeCompare(String(b.due_at || '9'))))
  }
  useEffect(() => { load() }, [])

  // ── Recording ────────────────────────────────────────────────────────────
  const addingInvoices = adding ? openInvoices.filter(i => i.client_id === adding.client_id) : []
  const tickedSum = (picks: Record<string, boolean>, list: OpenInvoice[]) =>
    list.filter(i => picks[i.id]).reduce((n, i) => n + i.outstanding_cents, 0)

  function setAddingTicks(picks: Record<string, boolean>, base = adding) {
    const list = openInvoices.filter(i => i.client_id === base.client_id)
    const before = tickedSum(base.picks || {}, list)
    const after = tickedSum(picks, list)
    // The amount follows the ticks until somebody types their own.
    const typed = toCents(base.amount || 0)
    const follow = !base.amount || typed === before
    setAdding({ ...base, picks, amount: follow ? (after ? toRands(after) : '') : base.amount })
  }

  // Looked up when the field is left, not on every key: halfway through
  // typing INV-2026-0012 the box reads INV-2026-001, which is a different
  // invoice, quite possibly another client's.
  function applyReference() {
    const hit = openInvoices.find(i => referenceMatches(adding.reference || '', i.number))
    if (hit && (!adding.client_id || adding.client_id === hit.client_id) && !adding.picks?.[hit.id]) {
      const base = { ...adding, client_id: hit.client_id }
      setAddingTicks({ ...(adding.client_id === hit.client_id ? adding.picks : {}), [hit.id]: true }, base)
    }
  }

  async function record() {
    const amount = toCents(adding.amount)
    const ticked = addingInvoices.filter(i => adding.picks?.[i.id])
    const split = spread(amount, ticked.map(i => ({ id: i.id, owing: i.outstanding_cents })))
    setBusy(true)
    const res = await fetch('/api/admin/billing/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: adding.client_id || null,
        amount_cents: amount,
        received_on: adding.received_on,
        method: adding.method,
        reference: adding.reference,
        notes: adding.notes,
        allocations: Object.entries(split).map(([invoice_id, amount_cents]) => ({ invoice_id, amount_cents })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) {
      toast.error(data?.error || 'Could not record it', { duration: 9000 })
      if (data?.receipt) { setAdding(null); load() }
      return
    }
    const placed = Object.values(split).reduce((n, c) => n + c, 0)
    toast.success(placed
      ? `Payment recorded and ${money(placed)} put on ${ticked.map(i => i.number).join(', ')}${amount > placed ? `. ${money(amount - placed)} stays unapplied.` : '.'}`
      : 'Payment recorded. Allocate it when you know what it paid.')
    setAdding(null); load()
  }

  // ── Allocating ───────────────────────────────────────────────────────────
  async function openAllocate(r: Receipt, clientId = r.client_id) {
    if (!clientId) {
      // Whose it is comes first; the invoices to choose from follow from it.
      setAllocating({ receipt: r, clientId: '', proposal: [], open: [], picks: {} })
      return
    }
    const res = await fetch('/api/admin/billing/payments', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, amount_cents: r.amount_cents, exclude_receipt_id: r.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data?.error || 'Could not work out what this could settle'); return }

    // Start from what is already allocated, so opening this screen and saving
    // it again changes nothing. The proposal is offered, not applied.
    const picks: Record<string, Pick> = {}
    const source = r.allocations.length
      ? r.allocations.map(a => ({ invoice_id: a.invoice_id, amount_cents: a.amount_cents }))
      : []
    for (const a of source) picks[a.invoice_id] = { on: true, amount: toRands(a.amount_cents) }
    setAllocating({
      receipt: r,
      clientId,
      proposal: data.allocations || [],
      open: data.open || [],
      picks,
    })
  }

  function tick(invoiceId: string, on: boolean) {
    const picks: Record<string, Pick> = { ...allocating.picks }
    if (!on) { picks[invoiceId] = { on: false, amount: picks[invoiceId]?.amount || '' }; setAllocating({ ...allocating, picks }); return }
    // Ticked: as much of what is left of the payment as this invoice owes.
    const inv = allocating.open.find((o: any) => o.invoice_id === invoiceId)
    const used = Object.entries(picks).filter(([id, p]) => id !== invoiceId && p.on).reduce((n, [, p]) => n + toCents(p.amount || 0), 0)
    const left = Math.max(0, allocating.receipt.amount_cents - used)
    picks[invoiceId] = { on: true, amount: toRands(Math.min(left, inv?.outstanding_cents || 0)) }
    setAllocating({ ...allocating, picks })
  }

  async function saveAllocation() {
    setBusy(true)
    const res = await fetch('/api/admin/billing/payments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_id: allocating.receipt.id,
        ...(allocating.receipt.client_id ? {} : { client_id: allocating.clientId }),
        allocations: Object.entries(allocating.picks as Record<string, Pick>)
          .filter(([, p]) => p.on && toCents(p.amount) > 0)
          .map(([invoice_id, p]) => ({ invoice_id, amount_cents: toCents(p.amount) })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not allocate', { duration: 9000 }); return }
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
    ? Object.values(allocating.picks as Record<string, Pick>).filter(p => p.on).reduce((n, p) => n + toCents(p.amount || 0), 0) : 0
  const addingTicked = adding ? addingInvoices.filter(i => adding.picks?.[i.id]) : []
  const addingPlaced = adding
    ? Object.values(spread(toCents(adding.amount || 0), addingTicked.map(i => ({ id: i.id, owing: i.outstanding_cents })))).reduce((n, c) => n + c, 0)
    : 0

  // An invoice the receipt pays that is not in the open list (it is paid now
  // by this very receipt, and the list leaves fully paid ones out only when
  // somebody else paid them) still has to be shown, or saving would drop it.
  const allocRows: Array<{ invoice_id: string; invoice_number: string | null; outstanding_cents: number; due_at: string | null }> = allocating
    ? [
        ...allocating.open,
        ...allocating.receipt.allocations
          .filter((a: Allocation) => !allocating.open.some((o: any) => o.invoice_id === a.invoice_id))
          .map((a: Allocation) => ({ invoice_id: a.invoice_id, invoice_number: a.invoice_number, outstanding_cents: a.amount_cents, due_at: null })),
      ]
    : []

  const tickRow = (on: boolean) => ({
    background: on ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${on ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs flex-1 min-w-[200px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          One row per bank line. Tick the invoices it paid; anything left over stays on the account as
          unapplied cash. For a new client, Payment received also sets up their team.
        </p>
        <button onClick={() => setAdding({
          client_id: '', amount: '', received_on: new Date().toISOString().slice(0, 10),
          method: 'eft', reference: '', notes: '', picks: {},
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
        <Section title="Record a payment" sub="What arrived in the bank, and which invoices it paid."
          right={<button onClick={() => setAdding(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Reference</span>
              <input className={`${inputClass} mt-1.5`} style={inputStyle} placeholder="As it shows on the bank statement. An invoice number finds the invoice."
                value={adding.reference} onChange={e => setAdding({ ...adding, reference: e.target.value })}
                onBlur={applyReference} onKeyDown={e => { if (e.key === 'Enter') applyReference() }} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Client</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.client_id}
                onChange={e => setAdding({ ...adding, client_id: e.target.value, picks: {}, amount: '' })}>
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
              <input type="date" className={`${inputClass} mt-1.5`} style={{ ...inputStyle, colorScheme: 'dark' }}
                value={adding.received_on} onChange={e => setAdding({ ...adding, received_on: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Method</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.method}
                onChange={e => setAdding({ ...adding, method: e.target.value })}>
                {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          </div>

          {adding.client_id && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Which invoices it paid
              </p>
              {addingInvoices.length === 0 ? (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  This client has no issued invoice still owing. The payment is recorded as unapplied; if it was for a
                  quote, use Payment received instead, which makes the invoice from the quote.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {addingInvoices.map(i => {
                    const on = !!adding.picks?.[i.id]
                    return (
                      <label key={i.id} className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer" style={tickRow(on)}>
                        <input type="checkbox" checked={on} onChange={e => setAddingTicks({ ...(adding.picks || {}), [i.id]: e.target.checked })} />
                        <span className="font-mono text-xs flex-1" style={{ color: '#fff' }}>{i.number}</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{i.due_at ? `due ${fmtDate(i.due_at)}` : ''}</span>
                        <span className="text-sm font-semibold text-white w-28 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(i.outstanding_cents)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {addingTicked.length > 0 && toCents(adding.amount || 0) > 0 && (
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {money(addingPlaced)} goes on {addingTicked.map(i => i.number).join(', ')}
                  {toCents(adding.amount) > addingPlaced ? ` · ${money(toCents(adding.amount) - addingPlaced)} stays unapplied` : ''}
                  {toCents(adding.amount) < tickedSum(adding.picks || {}, addingInvoices) ? ' · part payment' : ''}
                </p>
              )}
            </div>
          )}

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

          {!allocating.receipt.client_id && (
            <label className="block mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Whose payment is it?</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={allocating.clientId}
                onChange={e => openAllocate(allocating.receipt, e.target.value || null)}>
                <option value="">Choose the client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          {allocating.proposal.length > 0 && (
            <button onClick={() => {
              const picks: Record<string, Pick> = {}
              for (const a of allocating.proposal) picks[a.invoice_id] = { on: true, amount: toRands(a.amount_cents) }
              setAllocating({ ...allocating, picks })
            }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold mb-3"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
              <Wand2 className="w-3.5 h-3.5" />Suggest: oldest invoice first
            </button>
          )}

          {allocating.clientId && allocRows.length === 0 ? (
            <Empty>This client has no invoices outstanding, so there is nothing to allocate against yet.</Empty>
          ) : (
            <div className="space-y-1.5">
              {allocRows.map(o => {
                const p: Pick = allocating.picks[o.invoice_id] || { on: false, amount: '' }
                return (
                  <div key={o.invoice_id} className="flex items-center gap-3 flex-wrap rounded-lg px-3 py-2" style={tickRow(p.on)}>
                    <label className="flex items-center gap-3 flex-1 min-w-[180px] cursor-pointer">
                      <input type="checkbox" checked={p.on} onChange={e => tick(o.invoice_id, e.target.checked)} />
                      <span className="font-mono text-xs text-white">{o.invoice_number || 'Invoice'}</span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        owes {money(o.outstanding_cents)}{o.due_at ? ` · due ${fmtDate(o.due_at)}` : ''}
                      </span>
                    </label>
                    {p.on && (
                      <input className={inputClass} style={{ ...inputStyle, width: 130, flex: 'none' }} inputMode="decimal" value={p.amount}
                        aria-label={`Amount on ${o.invoice_number}`}
                        onChange={e => setAllocating({ ...allocating, picks: { ...allocating.picks, [o.invoice_id]: { on: true, amount: e.target.value } } })} />
                    )}
                    {p.on && toCents(p.amount || 0) === o.outstanding_cents && (
                      <Check className="w-4 h-4" style={{ color: '#22c55e' }} aria-label="Paid in full" />
                    )}
                  </div>
                )
              })}
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
            <button onClick={saveAllocation} disabled={busy || !allocating.clientId || allocSum > allocating.receipt.amount_cents}
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
                  {/* Each one opens the invoice it paid, so checking what a
                      payment settled is one click rather than a search on the
                      Invoices tab. The PDF shows it paid, with what is left. */}
                  {r.allocations.map(a => (
                    <a key={a.id} href={`/api/admin/billing/invoices/pdf?id=${a.invoice_id}`} target="_blank" rel="noreferrer"
                      title={`Open ${a.invoice_number}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition hover:opacity-80"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <FileText className="w-3 h-3" />{a.invoice_number} {money(a.amount_cents)}
                    </a>
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
