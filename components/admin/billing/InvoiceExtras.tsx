'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, PenLine, Hash, ClipboardCheck, FileText, Link2, X, Ban, CalendarClock } from 'lucide-react'
import { inputClass, inputStyle, grad } from '../shared'
import { recipientChanges } from '@/lib/billing-docs'
import SignaturePad from '@/components/billing/SignaturePad'

// Everything that may still happen to an invoice after it exists, without
// touching what it charges:
//
//   - correcting who it is addressed to, when the client's record was wrong
//     (the one change the database allows to an issued invoice, migration 092)
//   - signing it for Cardtly
//   - the purchase order number it is raised against
//   - raising that purchase order, and getting it signed by the client's
//     department manager
//
// The lines and the money stay frozen. These are the corrections and the
// paperwork a client's accounts department asks for before it will pay.

type Signatory = { id: string; name: string; title: string | null; sign_invoices: boolean }
type PO = {
  id: string; number: string; status: string; public_token: string
  approver_role: string; approver_name: string | null; buyer_reference: string | null
  signer_name: string | null; signer_title: string | null; signed_at: string | null; signed_via: string | null
  supplier_signed_by: string[]
}

const box = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
const muted = { color: 'rgba(255,255,255,0.5)' }
const head = 'text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5'
const btn = { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }

export default function InvoiceExtras({
  invoice, client, onChanged,
}: {
  invoice: {
    id: string; number: string | null; status: string
    to_snapshot: Record<string, any> | null; po_number: string | null
    signed_by: { name: string; title: string | null; signedAt: string | null }[]
    due_at?: string | null
  }
  client: Record<string, any> | null
  onChanged: () => void
}) {
  const issued = invoice.status !== 'draft'
  const cancelled = invoice.status === 'cancelled'
  const changes = issued ? recipientChanges(invoice.to_snapshot, client) : []

  const [signatories, setSignatories] = useState<Signatory[] | null>(null)
  const [signing, setSigning] = useState<string[]>([])
  const [poNumber, setPoNumber] = useState(invoice.po_number || '')
  const [orders, setOrders] = useState<PO[] | null>(null)
  const [newPo, setNewPo] = useState<null | { approver_role: string; approver_name: string; approver_email: string; buyer_reference: string }>(null)
  const [recording, setRecording] = useState<null | { id: string; number: string; signer_name: string; signer_title: string; png: string | null }>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // A new due date: how an overdue invoice comes back. Offered while there is
  // still something owing; a paid, credited or cancelled invoice has nothing
  // left to fall due.
  const owing = issued && !['cancelled', 'written_off', 'credited', 'paid'].includes(invoice.status)
  const daysFromToday = (n: number) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const endOfThisMonth = (() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  })()
  const [dueDate, setDueDate] = useState(invoice.status === 'overdue' ? endOfThisMonth : (invoice.due_at || ''))
  const daysLate = invoice.due_at
    ? Math.floor((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(String(invoice.due_at).slice(0, 10))) / 86400000)
    : 0

  async function saveDueDate() {
    const d = await patchInvoice({ action: 'set_due_date', due_at: dueDate }, 'due')
    if (!d) return
    toast.success(`${invoice.number} is now due ${d.due_at} and reads ${d.status === 'overdue' ? 'Overdue' : d.status === 'issued' ? 'Issued' : 'Sent'}. Send it again so they have the new date.`, { duration: 8000 })
    onChanged()
  }

  useEffect(() => {
    fetch('/api/admin/billing/signatories').then(r => r.json()).then(d => setSignatories(d.signatories || [])).catch(() => setSignatories([]))
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  // Who is ticked: whoever signed it, matched by name, since the invoice holds
  // copies rather than references.
  useEffect(() => {
    if (!signatories) return
    const names = new Set(invoice.signed_by.map(s => s.name))
    setSigning(signatories.filter(s => names.has(s.name)).map(s => s.id))
  }, [signatories, invoice.signed_by])

  async function loadOrders() {
    const r = await fetch(`/api/admin/billing/purchase-orders?invoice_id=${invoice.id}`)
    const d = await r.json().catch(() => ({}))
    setOrders(r.ok ? d.purchaseOrders || [] : [])
  }

  async function patchInvoice(payload: Record<string, any>, key: string) {
    setBusy(key)
    const res = await fetch('/api/admin/billing/invoices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoice.id, ...payload }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || d?.error) { toast.error(d?.error || 'That did not save'); return null }
    return d
  }

  async function refreshClient() {
    if (!confirm(`Update ${invoice.number} to ${client?.name}'s current details? The number, lines and amounts stay exactly as they are. The old details are kept in the invoice's history.`)) return
    const d = await patchInvoice({ action: 'refresh_client' }, 'refresh')
    if (!d) return
    toast.success(d.changed?.length
      ? `${invoice.number} now shows the current ${d.changed.join(', ')}. Open the PDF to check it, then send it again.`
      : d.message || 'Already up to date', { duration: 8000 })
    onChanged()
  }

  async function saveSignatures() {
    const d = await patchInvoice({ action: 'sign', signatory_ids: signing }, 'sign')
    if (!d) return
    toast.success(d.signatures?.length ? `Signed by ${d.signatures.map((s: any) => s.name).join(' and ')}` : 'Signatures removed')
    onChanged()
  }

  async function savePoNumber() {
    const d = await patchInvoice({ action: 'set_po_number', po_number: poNumber }, 'po')
    if (!d) return
    toast.success(d.po_number ? `Order number ${d.po_number} will print on ${invoice.number || 'the invoice'}` : 'Order number removed')
    onChanged()
  }

  async function createPo() {
    if (!newPo) return
    setBusy('newpo')
    const res = await fetch('/api/admin/billing/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoice.id, ...newPo }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not raise it'); return }
    toast.success(`${d.purchaseOrder.number} raised. Copy the signing link and send it to their ${newPo.approver_role.toLowerCase()}.`, { duration: 8000 })
    setNewPo(null)
    if (!poNumber) setPoNumber(d.purchaseOrder.number)
    loadOrders(); onChanged()
  }

  function copyLink(po: PO) {
    const url = `${window.location.origin}/po/${po.public_token}`
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Signing link copied. Send it to whoever approves the purchase.'),
      () => toast.error('Could not copy. The link is /po/' + po.public_token))
  }

  async function patchPo(payload: Record<string, any>, key: string) {
    setBusy(key)
    const res = await fetch('/api/admin/billing/purchase-orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || d?.error) { toast.error(d?.error || 'That did not save'); return null }
    return d
  }

  async function cancelPo(po: PO) {
    if (!confirm(`Cancel ${po.number}? Its signing link stops working.`)) return
    if (await patchPo({ id: po.id, action: 'cancel' }, 'cancel-' + po.id)) { toast.success('Cancelled'); loadOrders() }
  }

  async function recordSignature() {
    if (!recording) return
    const d = await patchPo({
      id: recording.id, action: 'record_signature',
      signer_name: recording.signer_name, signer_title: recording.signer_title, signature_png: recording.png,
    }, 'record')
    if (!d) return
    toast.success(`${recording.number} recorded as signed by ${recording.signer_name}`)
    setRecording(null); loadOrders()
  }

  const liveOrders = (orders || []).filter(o => o.status !== 'cancelled')

  return (
    <div className="space-y-3 mt-4">

      {/* ── Client details ─────────────────────────────────────────────── */}
      {issued && !cancelled && (
        changes.length ? (
          <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.4)' }}>
            <p className={head} style={{ color: '#f59e0b' }}><RefreshCw className="w-3.5 h-3.5" />Client details have changed</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {client?.name}&apos;s {changes.join(', ')} {changes.length === 1 ? 'is' : 'are'} different on the client record from what this
              invoice was issued with. Updating copies the current details onto it; the number, lines and amounts do not change.
            </p>
            <button onClick={refreshClient} disabled={busy === 'refresh'}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: '#f59e0b', color: '#111' }}>
              {busy === 'refresh' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Update invoice to current details
            </button>
          </div>
        ) : (
          <p className="text-[11px]" style={muted}>Addressed to {invoice.to_snapshot?.name || 'the client'} exactly as on the client record.</p>
        )
      )}

      {/* ── Due date ───────────────────────────────────────────────────── */}
      {owing && (
        <div className="rounded-lg p-3" style={invoice.status === 'overdue'
          ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)' }
          : box}>
          <p className={head} style={{ color: invoice.status === 'overdue' ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
            <CalendarClock className="w-3.5 h-3.5" />
            {invoice.status === 'overdue'
              ? `Overdue by ${daysLate} day${daysLate === 1 ? '' : 's'} (was due ${String(invoice.due_at).slice(0, 10)})`
              : `Due ${invoice.due_at ? String(invoice.due_at).slice(0, 10) : 'date not set'}`}
          </p>
          <p className="text-[11px] mt-1" style={muted}>
            {invoice.status === 'overdue'
              ? 'Give it a new due date to bring it back: it reads as current again, leaves the overdue list, and reminders start over from the new date. The amount and number do not change.'
              : 'Agreed more time? Move the due date. The amount and number do not change.'}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <input type="date" className={inputClass} style={{ ...inputStyle, width: 170, colorScheme: 'dark' }}
              min={daysFromToday(0)} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {[
              { label: 'End of month', value: endOfThisMonth },
              { label: '+7 days', value: daysFromToday(7) },
              { label: '+14 days', value: daysFromToday(14) },
              { label: '+30 days', value: daysFromToday(30) },
            ].map(o => (
              <button key={o.label} type="button" onClick={() => setDueDate(o.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: dueDate === o.value ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  color: dueDate === o.value ? '#60a5fa' : 'rgba(255,255,255,0.65)',
                }}>{o.label}</button>
            ))}
            <button onClick={saveDueDate}
              disabled={busy === 'due' || !dueDate || dueDate === String(invoice.due_at || '').slice(0, 10)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy === 'due' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
              {invoice.status === 'overdue' ? 'Reactivate with this date' : 'Save due date'}
            </button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {/* ── Signatures ───────────────────────────────────────────────── */}
        <div className="rounded-lg p-3" style={box}>
          <p className={head} style={muted}><PenLine className="w-3.5 h-3.5" />Signed for Cardtly</p>
          {signatories === null ? (
            <Loader2 className="w-4 h-4 animate-spin mt-2" style={muted} />
          ) : signatories.length === 0 ? (
            <p className="text-xs mt-1.5" style={muted}>No signatures yet. Add yours and Tio&apos;s under Accounting, Settings, Signatures.</p>
          ) : (
            <>
              <div className="mt-1.5 space-y-1">
                {signatories.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    <input type="checkbox" checked={signing.includes(s.id)} disabled={cancelled}
                      onChange={e => setSigning(e.target.checked ? [...signing, s.id] : signing.filter(x => x !== s.id))} />
                    {s.name}{s.title ? <span style={muted}> · {s.title}</span> : null}
                  </label>
                ))}
              </div>
              {!cancelled && (
                <button onClick={saveSignatures} disabled={busy === 'sign'}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" style={btn}>
                  {busy === 'sign' ? 'Saving' : 'Save signatures'}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Order number ─────────────────────────────────────────────── */}
        <div className="rounded-lg p-3" style={box}>
          <p className={head} style={muted}><Hash className="w-3.5 h-3.5" />Purchase order number</p>
          <p className="text-[11px] mt-1" style={muted}>Printed on the invoice. Theirs, if their system issued one; ours otherwise.</p>
          <div className="flex gap-2 mt-1.5">
            <input className={inputClass} style={inputStyle} value={poNumber} placeholder="e.g. PO-2026-1001"
              disabled={cancelled} onChange={e => setPoNumber(e.target.value)} />
            {!cancelled && (
              <button onClick={savePoNumber} disabled={busy === 'po' || poNumber.trim() === (invoice.po_number || '')}
                className="px-3 rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0" style={btn}>
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Purchase orders ────────────────────────────────────────────── */}
      <div className="rounded-lg p-3" style={box}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className={head} style={muted}><ClipboardCheck className="w-3.5 h-3.5" />Purchase order</p>
          {!cancelled && !newPo && (
            <button onClick={() => setNewPo({ approver_role: 'Department Manager', approver_name: '', approver_email: '', buyer_reference: '' })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: grad, color: '#fff' }}>
              {liveOrders.length ? 'Raise another' : 'Create purchase order'}
            </button>
          )}
        </div>

        {orders === null ? (
          <Loader2 className="w-4 h-4 animate-spin mt-2" style={muted} />
        ) : !liveOrders.length && !newPo ? (
          <p className="text-xs mt-1.5" style={muted}>
            For a client who cannot pay without one. Same lines and amount as this invoice, addressed with the client&apos;s
            current details, and signed by their department manager through a link or on paper.
          </p>
        ) : null}

        {newPo && (
          <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white">New purchase order from {invoice.number || 'this invoice'}</p>
              <button onClick={() => setNewPo(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input className={inputClass} style={inputStyle} placeholder="Who approves it, e.g. Department Manager"
                value={newPo.approver_role} onChange={e => setNewPo({ ...newPo, approver_role: e.target.value })} />
              <input className={inputClass} style={inputStyle} placeholder="Their name (optional)"
                value={newPo.approver_name} onChange={e => setNewPo({ ...newPo, approver_name: e.target.value })} />
              <input className={inputClass} style={inputStyle} placeholder="Their email (optional)"
                value={newPo.approver_email} onChange={e => setNewPo({ ...newPo, approver_email: e.target.value })} />
              <input className={inputClass} style={inputStyle} placeholder="Client's own order no. (optional)"
                value={newPo.buyer_reference} onChange={e => setNewPo({ ...newPo, buyer_reference: e.target.value })} />
            </div>
            <p className="text-[11px] mt-2" style={muted}>
              Signed for Cardtly by whoever signs invoices automatically (Settings, Signatures).
            </p>
            <div className="flex justify-end mt-2">
              <button onClick={createPo} disabled={busy === 'newpo' || !newPo.approver_role.trim()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: grad, color: '#fff' }}>
                {busy === 'newpo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                Raise purchase order
              </button>
            </div>
          </div>
        )}

        {liveOrders.map(po => (
          <div key={po.id} className="mt-3 flex items-center gap-3 flex-wrap rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-1 min-w-[180px]">
              <p className="font-mono text-xs text-white">{po.number}</p>
              <p className="text-[11px]" style={{ color: po.status === 'signed' ? '#22c55e' : '#f59e0b' }}>
                {po.status === 'signed'
                  ? `Signed by ${po.signer_name}${po.signer_title ? `, ${po.signer_title}` : ''} on ${String(po.signed_at).slice(0, 10)}${po.signed_via === 'recorded' ? ' (on paper)' : ''}`
                  : `Waiting for the ${po.approver_role.toLowerCase()}${po.approver_name ? ` (${po.approver_name})` : ''} to sign`}
              </p>
            </div>
            <a href={`/api/admin/billing/purchase-orders/pdf?id=${po.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={btn}>
              <FileText className="w-3.5 h-3.5" />PDF
            </a>
            {po.status === 'awaiting_signature' && (
              <>
                <button onClick={() => copyLink(po)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={btn}>
                  <Link2 className="w-3.5 h-3.5" />Copy signing link
                </button>
                <button onClick={() => setRecording({ id: po.id, number: po.number, signer_name: po.approver_name || '', signer_title: po.approver_role, png: null })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={btn}>
                  <PenLine className="w-3.5 h-3.5" />Signed on paper
                </button>
              </>
            )}
            <button onClick={() => cancelPo(po)} title="Cancel" className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Ban className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            </button>
          </div>
        ))}

        {recording && (
          <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white">Record the signature on {recording.number}</p>
              <button onClick={() => setRecording(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
            </div>
            <p className="text-[11px] mb-2" style={muted}>
              For a manager who signed the printed copy. Upload the signature from their scan (or draw it), with their name and position.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <input className={inputClass} style={inputStyle} placeholder="Their full name"
                value={recording.signer_name} onChange={e => setRecording({ ...recording, signer_name: e.target.value })} />
              <input className={inputClass} style={inputStyle} placeholder="Their position"
                value={recording.signer_title} onChange={e => setRecording({ ...recording, signer_title: e.target.value })} />
            </div>
            <SignaturePad allowUpload onChange={png => setRecording(r => r ? { ...r, png } : r)} label="Their signature" />
            <div className="flex justify-end mt-2">
              <button onClick={recordSignature} disabled={busy === 'record' || !recording.signer_name.trim() || !recording.png}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: grad, color: '#fff' }}>
                {busy === 'record' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                Record as signed
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
