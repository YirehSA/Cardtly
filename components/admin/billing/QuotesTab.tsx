'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, FileText, Send, Trash2, Lock, Link2, ArrowRight, UserPlus } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, toCents, toRands, Empty, fmtDate } from './shared'

// Quotes: draft, issue, send, accept, convert.
//
// Same one-way door as invoices. The addition is the accept link, which is what
// the whole document exists for: issuing mints it, and it is what the client
// signs against.

type Quote = {
  id: string; number: string | null; status: string; display_status: string
  client_id: string; client_name: string; issued_at: string | null; valid_until: string | null
  total_cents: number; public_token: string | null
  accepted_at: string | null; accepted_name: string | null
}
type Line = { description: string; qty: string; unit_price_cents: string }
const BLANK_LINE: Line = { description: '', qty: '1', unit_price_cents: '' }

const STATUS: Record<string, { label: string; colour: string; hint: string }> = {
  draft:     { label: 'Draft',     colour: '#6b7280', hint: 'No number yet. Freely editable, nobody outside can see it.' },
  issued:    { label: 'Issued',    colour: '#a855f7', hint: 'Numbered and frozen, with an accept link. Not emailed yet.' },
  sent:      { label: 'Sent',      colour: '#0ea5e9', hint: 'With the client, awaiting their decision.' },
  accepted:  { label: 'Accepted',  colour: '#22c55e', hint: 'Signed by the client. Ready to become an invoice.' },
  declined:  { label: 'Declined',  colour: '#ef4444', hint: 'The client said no.' },
  expired:   { label: 'Expired',   colour: '#f59e0b', hint: 'Past the date it said it stood until. It can no longer be accepted.' },
  cancelled: { label: 'Cancelled', colour: '#6b7280', hint: 'Withdrawn by us.' },
}

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
  { id: 'all', label: 'Everything' },
]

function Pill({ status }: { status: string }) {
  const m = STATUS[status] || { label: status, colour: '#6b7280', hint: '' }
  return <span title={m.hint}
    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
    style={{ background: `${m.colour}1f`, color: m.colour, border: `1px solid ${m.colour}55` }}>{m.label}</span>
}

export default function QuotesTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [filter, setFilter] = useState('open')
  const [editing, setEditing] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  // Adding a client from here, rather than sending somebody to another screen.
  // A rep quoting a new prospect has nowhere else to go: the Clients tab is
  // staff only, so without this the first quote of every relationship is a
  // dead end.
  const [newClient, setNewClient] = useState<any | null>(null)

  async function load() {
    setLoading(true)
    const [qRes, cRes] = await Promise.all([
      fetch(`/api/admin/billing/quotes?status=${filter}`),
      fetch('/api/admin/billing/clients'),
    ])
    const qData = await qRes.json().catch(() => ({}))
    const cData = await cRes.json().catch(() => ({}))
    setLoading(false)
    if (!qRes.ok) { setUnavailable(qData?.error || 'Could not load quotes'); return }
    setUnavailable(null)
    setQuotes(qData.quotes || [])
    setClients(cData.clients || [])
  }
  useEffect(() => { load() }, [filter])

  async function createClient() {
    setBusy(true)
    const res = await fetch('/api/admin/billing/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not add them'); return }

    // Added to the list AND selected, because the reason somebody added a
    // client here is that they are about to quote them.
    const client = d.client
    setClients(cs => [...cs, client].sort((a, b) => a.name.localeCompare(b.name)))
    setEditing((e: any) => e
      ? { ...e, client_id: client.id }
      : { id: null, client_id: client.id, notes: '', lines: [{ ...BLANK_LINE }] })
    setNewClient(null)
    toast.success(`${client.name} added`)
  }

  function startNew() {
    // No clients means there is nobody to address this to. Rather than a dead
    // button with a tooltip nobody sees, say so and go to the screen that fixes
    // it. A disabled control that will not explain itself is a dead end.
    if (clients.length === 0) {
      setNewClient({ name: '', contact_person: '', email: '', phone: '' })
      return
    }
    setEditing({ id: null, client_id: clients[0]?.id || '', notes: '', lines: [{ ...BLANK_LINE }] })
  }

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return (editing.lines || []).reduce(
      (n: number, l: Line) => n + Math.round(Number(l.qty || 0) * toCents(l.unit_price_cents || 0)), 0)
  }, [editing])

  async function openQuote(q: Quote) {
    const res = await fetch(`/api/admin/billing/quotes?id=${q.id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data?.error || 'Could not open it'); return }
    setEditing({
      id: data.quote.id, client_id: data.quote.client_id, notes: data.quote.notes || '',
      status: data.quote.status, number: data.quote.number, token: data.quote.public_token,
      lines: (data.lines || []).map((l: any) => ({
        description: l.description, qty: String(Number(l.qty)), unit_price_cents: toRands(l.unit_price_cents),
      })),
    })
  }

  async function save(): Promise<string | null> {
    setBusy(true)
    const res = await fetch('/api/admin/billing/quotes', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id || undefined,
        client_id: editing.client_id,
        notes: editing.notes,
        lines: (editing.lines || []).filter((l: Line) => l.description.trim()).map((l: Line) => ({
          description: l.description, qty: Number(l.qty || 0), unit_price_cents: toCents(l.unit_price_cents || 0),
        })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return null }
    return data.quote?.id || editing.id
  }

  async function saveAndClose() {
    const id = await save()
    if (id) { toast.success('Draft saved'); setEditing(null); load() }
  }

  async function issue() {
    const id = await save()
    if (!id) return
    if (!confirm('Issue this quote? It gets a number and an accept link, and can no longer be edited.')) return
    setBusy(true)
    const res = await fetch('/api/admin/billing/quotes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'issue' }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not issue'); return }
    if (data.warning) toast.warning(data.warning, { duration: 8000 })
    toast.success(`Issued as ${data.quote.number}, valid until ${data.quote.valid_until}`)
    setEditing(null); load()
  }

  async function convert(q: Quote) {
    if (!confirm(`Turn ${q.number} into an invoice? It arrives as a draft so you can change it before issuing.`)) return
    const res = await fetch('/api/admin/billing/quotes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, action: 'convert' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not convert'); return }
    toast.success('Draft invoice created. It is on the Invoices tab.', { duration: 7000 })
    load()
  }

  async function cancel(q: Quote) {
    if (!confirm(`Cancel ${q.number || 'this draft'}? The accept link stops working.`)) return
    const res = await fetch('/api/admin/billing/quotes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, action: 'cancel' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not cancel'); return }
    toast.success('Cancelled'); load()
  }

  function copyLink(q: Quote) {
    const url = `${window.location.origin}/quote/${q.public_token}`
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Accept link copied. Anyone with it can read and sign this quote.'),
      () => toast.error('Could not copy. The link is /quote/' + q.public_token))
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <Loader2 className="w-4 h-4 animate-spin" />Loading quotes
  </div>
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  const frozen = !!editing?.status && editing.status !== 'draft'

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
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: grad, color: '#fff' }}>
          <Plus className="w-4 h-4" />New quote
        </button>
      </div>

      {newClient && (
        <Section title="New client" sub="Just enough to address a quote. The rest can be filled in later."
          right={<button onClick={() => setNewClient(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([['name', 'Company name'], ['contact_person', 'Contact person'], ['email', 'Email'], ['phone', 'Phone']] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                <input className={`${inputClass} mt-1.5`} style={inputStyle} value={newClient[k] ?? ''}
                  onChange={e => setNewClient({ ...newClient, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={createClient} disabled={busy || !newClient.name?.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Add and use
            </button>
          </div>
        </Section>
      )}

      {editing && (
        <Section
          title={editing.number ? `Quote ${editing.number}` : editing.id ? 'Edit draft' : 'New quote'}
          sub={frozen ? 'Issued. Frozen, and shown here read only.' : 'A draft has no number and no accept link.'}
          right={<button onClick={() => setEditing(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>

          {frozen && (
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs mb-4"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)', color: 'rgba(255,255,255,0.75)' }}>
              <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#a855f7' }} />
              <div>This quote is issued, so it cannot be changed. A signed quote has to be able to prove
                what was signed, which only works if the document could not move afterwards. Cancel it and
                raise a new one if the price has changed.</div>
            </div>
          )}

          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Client</span>
            <div className="flex gap-2 mt-1.5">
              <select className={inputClass} style={{ ...inputStyle, flex: '1 1 auto' }} value={editing.client_id} disabled={frozen}
                onChange={e => setEditing({ ...editing, client_id: e.target.value })}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!frozen && (
                <button onClick={() => setNewClient({ name: '', contact_person: '', email: '', phone: '' })}
                  title="Add a client without leaving this quote"
                  className="flex items-center gap-2 px-3 rounded-lg text-sm font-semibold whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <UserPlus className="w-4 h-4" />New
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {(editing.lines || []).map((l: Line, i: number) => (
              <div key={i} className="flex gap-2 items-start flex-wrap">
                <input className={inputClass} style={{ ...inputStyle, flex: '1 1 180px', minWidth: 180 }}
                  placeholder="Description" value={l.description} disabled={frozen}
                  onChange={e => { const lines = [...editing.lines]; lines[i] = { ...l, description: e.target.value }; setEditing({ ...editing, lines }) }} />
                <input className={inputClass} style={{ ...inputStyle, width: 76, flex: 'none' }}
                  placeholder="Qty" inputMode="decimal" value={l.qty} disabled={frozen}
                  onChange={e => { const lines = [...editing.lines]; lines[i] = { ...l, qty: e.target.value }; setEditing({ ...editing, lines }) }} />
                <input className={inputClass} style={{ ...inputStyle, width: 110, flex: 'none' }}
                  placeholder="Unit (R)" inputMode="decimal" value={l.unit_price_cents} disabled={frozen}
                  onChange={e => { const lines = [...editing.lines]; lines[i] = { ...l, unit_price_cents: e.target.value }; setEditing({ ...editing, lines }) }} />
                <div className="w-28 text-right text-sm py-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {money(Math.round(Number(l.qty || 0) * toCents(l.unit_price_cents || 0)))}
                </div>
                {!frozen && (
                  <button onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_: any, n: number) => n !== i) })}
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!frozen && (
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
            <input className={`${inputClass} mt-1.5`} style={inputStyle} value={editing.notes ?? ''} disabled={frozen}
              onChange={e => setEditing({ ...editing, notes: e.target.value })} />
          </label>

          <div className="flex justify-end gap-2 mt-4 flex-wrap">
            {editing.id && (
              <a href={`/api/admin/billing/quotes/pdf?id=${editing.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <FileText className="w-4 h-4" />PDF
              </a>
            )}
            {!frozen && (
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

      {clients.length === 0 && (
        <div className="rounded-lg p-4 flex items-start gap-3 flex-wrap"
          style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)' }}>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold text-white">There are no clients yet</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              A quote is addressed to somebody, and that name and address get frozen onto the document
              when it is issued. Add a client and this will work.
            </p>
          </div>
          <button onClick={() => setNewClient({ name: '', contact_person: '', email: '', phone: '' })}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: grad, color: '#fff' }}>
            Add a client
          </button>
        </div>
      )}

      {quotes.length === 0 ? (
        <Empty>{filter === 'open' ? 'No open quotes.' : 'No quotes here.'}</Empty>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {quotes.map((q, i) => {
            const live = ['issued', 'sent'].includes(q.display_status)
            return (
              <div key={q.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-28">
                  <p className="font-mono text-xs text-white">{q.number || 'Draft'}</p>
                  <Pill status={q.display_status} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm text-white">{q.client_name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {q.accepted_at
                      ? `Signed by ${q.accepted_name} on ${fmtDate(q.accepted_at)}`
                      : q.valid_until ? `Valid until ${fmtDate(q.valid_until)}` : 'Not issued'}
                  </p>
                </div>
                <div className="text-right w-28">
                  <p className="text-sm font-bold text-white">{money(q.total_cents)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {q.public_token && q.display_status !== 'cancelled' && (
                    <button onClick={() => copyLink(q)} title="Copy the accept link"
                      className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Link2 className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                    </button>
                  )}
                  {q.number && (
                    <a href={`/api/admin/billing/quotes/pdf?id=${q.id}`} target="_blank" rel="noreferrer"
                      title="PDF" className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                    </a>
                  )}
                  {q.display_status === 'accepted' && (
                    <button onClick={() => convert(q)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                      <ArrowRight className="w-3.5 h-3.5" />Invoice
                    </button>
                  )}
                  <button onClick={() => openQuote(q)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>
                    {q.status === 'draft' ? 'Edit' : 'View'}
                  </button>
                  {['draft', 'issued', 'sent'].includes(q.status) && (
                    <button onClick={() => cancel(q)} title="Cancel"
                      className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
