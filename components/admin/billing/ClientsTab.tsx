'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Search, Save, X, FileText, Trash2 } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, Empty, fmtDate } from './shared'

// Who Cardtly bills, and what each one owes.
//
// A client is not an organization and not a user: the party that pays is often
// not the party that uses the product. Linking one to an org is optional and
// stays that way.

type Client = {
  id: string; name: string; contact_person: string | null; email: string | null
  phone: string | null; address: string | null; vat_number: string | null; notes: string | null
  outstandingCents: number; openCount: number
}

const BLANK = { name: '', contact_person: '', email: '', phone: '', address: '', vat_number: '', notes: '' }

export default function ClientsTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [statement, setStatement] = useState<any | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/billing/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setUnavailable(data?.error || 'Could not load clients'); return }
    setUnavailable(null)
    setClients(data.clients || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setBusy(true)
    const isNew = !editing.id
    const res = await fetch('/api/admin/billing/clients', {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return }
    toast.success(isNew ? 'Client added' : 'Saved')
    setEditing(null); load()
  }

  async function remove(c: Client) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/billing/clients?id=${c.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not delete'); return }
    toast.success('Client deleted'); load()
  }

  async function openStatement(c: Client) {
    const res = await fetch(`/api/admin/billing/statement?client_id=${c.id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not build the statement'); return }
    setStatement(data)
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <Loader2 className="w-4 h-4 animate-spin" />Loading clients
  </div>
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  const totalOwed = clients.reduce((n, c) => n + c.outstandingCents, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input className={inputClass} style={{ ...inputStyle, paddingLeft: 36 }}
            placeholder="Search name, contact or email" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Search
        </button>
        <button onClick={() => setEditing({ ...BLANK })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: grad, color: '#fff' }}>
          <Plus className="w-4 h-4" />New client
        </button>
      </div>

      {totalOwed > 0 && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {money(totalOwed)} outstanding across {clients.filter(c => c.outstandingCents > 0).length} client
          {clients.filter(c => c.outstandingCents > 0).length === 1 ? '' : 's'}.
        </p>
      )}

      {editing && (
        <Section title={editing.id ? 'Edit client' : 'New client'} sub="Copied onto an invoice when it is issued, and frozen there."
          right={<button onClick={() => setEditing(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([['name', 'Name'], ['contact_person', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['vat_number', 'VAT number']] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                <input className={`${inputClass} mt-1.5`} style={inputStyle} value={editing[k] ?? ''}
                  onChange={e => setEditing({ ...editing, [k]: e.target.value })} />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Address</span>
              <input className={`${inputClass} mt-1.5`} style={inputStyle} value={editing.address ?? ''}
                onChange={e => setEditing({ ...editing, address: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={save} disabled={busy || !editing.name?.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
            </button>
          </div>
        </Section>
      )}

      {clients.length === 0 ? (
        <Empty>No clients yet. Add one before raising an invoice.</Empty>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {clients.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-white text-sm">{c.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {[c.contact_person, c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: c.outstandingCents > 0 ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
                  {c.outstandingCents > 0 ? money(c.outstandingCents) : 'Nothing owing'}
                </p>
                {c.openCount > 0 && (
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {c.openCount} open invoice{c.openCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openStatement(c)} title="Statement"
                  className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <FileText className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
                <button onClick={() => setEditing({ ...c })} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>Edit</button>
                <button onClick={() => remove(c)} title="Delete"
                  className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {statement && (
        <Section title={`Statement: ${statement.client.name}`}
          sub={`Opening ${money(statement.openingCents)} · Closing ${money(statement.closingCents)}`}
          right={<button onClick={() => setStatement(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          {statement.rows.length === 0 ? (
            <Empty>Nothing on this account yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)' }} className="text-[11px] uppercase tracking-wider">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left">Reference</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((r: any, i: number) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                      <td className="py-2">{fmtDate(r.date)}</td>
                      <td>{r.reference}</td>
                      <td className="text-right">{r.debitCents ? money(r.debitCents) : ''}</td>
                      <td className="text-right" style={{ color: '#22c55e' }}>{r.creditCents ? money(r.creditCents) : ''}</td>
                      <td className="text-right font-semibold text-white">{money(r.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {statement.unappliedCents > 0 && (
            <p className="text-xs mt-3" style={{ color: '#0ea5e9' }}>
              {money(statement.unappliedCents)} received and not yet allocated to an invoice. It is not in the balance
              above because it settles no particular invoice, but it is money this client has paid.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}
