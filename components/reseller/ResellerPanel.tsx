'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2, Plus, Loader2, Wifi, Receipt, Pause, Play, XCircle, Mail, Download, Check, AlertTriangle, X,
} from 'lucide-react'
import { randCents, nfcOrderTotalCents, type ResellerClientState, type ResellerNfcKind } from '@/lib/reseller-pricing'

// The reseller's own page. Everything comes from /api/reseller, which scopes
// every read and write to the reseller this login runs.

interface Client {
  id: string; name: string; seats: number; state: ResellerClientState
  cardsMade: number; ownerEmail: string | null; createdAt: string | null; offBill: boolean
}
interface Data {
  ownCardFree?: boolean
  reseller: {
    name: string; status: 'active' | 'suspended' | 'ended'; seatPool: number; seatPriceCents: number
    nfcBlankCents: number; nfcPrintedCents: number; nfcShippingCents: number; invoicesReady: boolean
  }
  sold: number
  left: number
  clients: Client[]
  thisMonth: { label: string; seats: number; cents: number }
  nfcOrders: Array<{ id: string; kind: ResellerNfcKind; quantity: number; total_cents: number; client_name: string | null; status: string; tracking_number: string | null; created_at: string }>
  invoices: Array<{ id: string; number: string | null; status: string; issued_at: string | null; due_at: string | null; total_cents: number; outstanding_cents: number }>
}

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition'
const accent = 'hsl(var(--accent))'

const STATE_META: Record<ResellerClientState, { label: string; tone: string }> = {
  live: { label: 'Live', tone: '#22c55e' },
  paused: { label: 'Paused', tone: '#f59e0b' },
  cancelled: { label: 'Cancelled', tone: '#94a3b8' },
}
const ORDER_STATUS: Record<string, string> = {
  awaiting_payment: 'Invoice sent, waiting for payment',
  paid: 'Paid, in the queue',
  in_production: 'Being made',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  issued: { label: 'Unpaid', tone: '#a855f7' },
  sent: { label: 'Unpaid', tone: '#0ea5e9' },
  part_paid: { label: 'Part paid', tone: '#f59e0b' },
  overdue: { label: 'Overdue', tone: '#ef4444' },
  paid: { label: 'Paid', tone: '#22c55e' },
  credited: { label: 'Credited', tone: '#0ea5e9' },
  written_off: { label: 'Written off', tone: '#94a3b8' },
}

const fmtDate = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  : ''

async function post(body: Record<string, any>) {
  const res = await fetch('/api/reseller', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && !data?.error, data }
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: `${tone}1f`, color: tone, border: `1px solid ${tone}55` }}>
      {label}
    </span>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

export default function ResellerPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'clients' | 'nfc' | 'invoices'>('clients')

  async function load() {
    const res = await fetch('/api/reseller', { cache: 'no-store' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { setError(d?.error || 'Could not load your reseller account'); return }
    setError(null)
    setData(d)
  }
  useEffect(() => { load() }, [])

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>
  if (!data) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading</div>
  }

  const r = data.reseller
  const onHold = r.status !== 'active'

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label">Reseller</p>
        <h1 className="page-title mt-1.5">{r.name}</h1>
        <p className="page-subtitle mt-1.5">
          Give seats to your clients and charge them what you like. Cardtly invoices you {randCents(r.seatPriceCents)} a seat each month.
        </p>
        {data.ownCardFree && (
          <p className="text-sm mt-2 inline-flex items-center gap-1.5 text-emerald-500">
            <Check className="w-4 h-4" />Your own Cardtly card is free while you are a reseller.
          </p>
        )}
      </div>

      {onHold && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-600">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {r.status === 'ended'
            ? 'Your reseller account has ended, so clients and orders can no longer be changed. Your invoices are still here.'
            : <>Your reseller account is on hold, so clients and orders cannot be changed right now. Your clients&apos; cards are not affected. Contact Cardtly at hello@cardtly.com.</>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Seats in your pool" value={r.seatPool} />
        <Stat label="Given to clients" value={data.sold} />
        <Stat label="Still free" value={data.left} hint={data.left === 0 ? 'Ask Cardtly for more seats.' : undefined} />
        <Stat label={`${data.thisMonth.label} so far`} value={randCents(data.thisMonth.cents)}
          hint={`${data.thisMonth.seats} seat${data.thisMonth.seats === 1 ? '' : 's'}. Invoiced on the 1st.`} />
      </div>

      <div className="flex gap-4 sm:gap-6 border-b border-border overflow-x-auto overflow-y-hidden">
        {([
          ['clients', 'Clients', Building2, data.clients.length || null],
          ['nfc', 'NFC cards', Wifi, data.nfcOrders.length || null],
          ['invoices', 'Invoices', Receipt, data.invoices.length || null],
        ] as const).map(([id, label, Icon, count]) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 pb-3 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors ${
                active ? 'border-current text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground font-medium'}`}
              style={active ? { borderBottomColor: accent } : undefined}>
              <Icon className="w-4 h-4" />{label}
              {count !== null && (
                <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'clients' && <ClientsSection data={data} onHold={onHold} reload={load} />}
      {tab === 'nfc' && <NfcSection data={data} onHold={onHold} reload={load} />}
      {tab === 'invoices' && <InvoicesSection data={data} />}
    </div>
  )
}

// ── Clients ─────────────────────────────────────────────────────────────────

function ClientsSection({ data, onHold, reload }: { data: Data; onHold: boolean; reload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ company: '', owner_email: '', seats: '5' })
  const [busy, setBusy] = useState<string | null>(null)
  const [seatEdits, setSeatEdits] = useState<Record<string, string>>({})

  async function add() {
    setBusy('add')
    const { ok, data: d } = await post({ action: 'add_client', ...form, seats: Number(form.seats) })
    setBusy(null)
    if (!ok) { toast.error(d?.error || 'That did not save'); return }
    toast.success(`${form.company} is live. ${(d.notes || []).join(' ')}`)
    setForm({ company: '', owner_email: '', seats: '5' })
    setAdding(false)
    await reload()
  }

  async function saveSeats(c: Client) {
    const seats = Number(seatEdits[c.id])
    setBusy(`seats-${c.id}`)
    const { ok, data: d } = await post({ action: 'set_seats', org_id: c.id, seats })
    setBusy(null)
    if (!ok) { toast.error(d?.error || 'That did not save'); return }
    toast.success(`${c.name}: ${seats} seats`)
    setSeatEdits(e => { const { [c.id]: _gone, ...rest } = e; return rest })
    await reload()
  }

  async function setState(c: Client, to: ResellerClientState) {
    const question = to === 'paused'
      ? `Pause ${c.name}?\n\nTheir cards stay up with a notice, and their team loses its Pro features until you switch them back on. They keep their ${c.seats} seats. A paused month is not billed.`
      : to === 'cancelled'
      ? `Cancel ${c.name}?\n\nTheir cards stop working and their ${c.seats} seats go back to your pool. If they were live at any time this month, this month is still billed.`
      : `Switch ${c.name} back on? Their cards work again straight away, and this month is billed.`
    if (!confirm(question)) return
    setBusy(`state-${c.id}`)
    const { ok, data: d } = await post({ action: 'set_state', org_id: c.id, to })
    setBusy(null)
    if (!ok) { toast.error(d?.error || 'That did not save'); return }
    toast.success(to === 'paused' ? `${c.name} paused` : to === 'cancelled' ? `${c.name} cancelled` : `${c.name} is live again`)
    await reload()
  }

  async function resend(c: Client) {
    setBusy(`mail-${c.id}`)
    const { ok, data: d } = await post({ action: 'resend_welcome', org_id: c.id })
    setBusy(null)
    if (!ok) { toast.error(d?.error || 'The email did not send'); return }
    toast.success(`Setup email sent to ${d.email}`)
  }

  const seatsWanted = Math.max(0, Math.floor(Number(form.seats)) || 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Each client gets its own Cardtly team. Their admin builds the cards; you decide how many seats they have.
        </p>
        {!onHold && !adding && (
          <button onClick={() => setAdding(true)} disabled={data.left === 0}
            title={data.left === 0 ? 'Your pool is fully used. Ask Cardtly for more seats.' : undefined}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: accent }}>
            <Plus className="w-4 h-4" />Add client
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">New client</p>
            <button onClick={() => setAdding(false)} aria-label="Close"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-1">
              <span className="text-xs font-medium text-muted-foreground">Company name</span>
              <input className={`${inputClass} mt-1.5`} value={form.company} placeholder="Acme (Pty) Ltd"
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs font-medium text-muted-foreground">Their admin&apos;s email</span>
              <input className={`${inputClass} mt-1.5`} type="email" value={form.owner_email} placeholder="name@acme.co.za"
                onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs font-medium text-muted-foreground">Seats ({data.left} free)</span>
              <input className={`${inputClass} mt-1.5`} type="number" min={1} max={data.left} value={form.seats}
                onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            The team goes live straight away and their admin gets an email to choose a password.
            {seatsWanted > 0 && ` Adds ${randCents(seatsWanted * data.reseller.seatPriceCents)} a month to your Cardtly invoice.`}
          </p>
          <div className="flex justify-end">
            <button onClick={add} disabled={busy === 'add' || !form.company.trim() || !form.owner_email.trim() || seatsWanted < 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: accent }}>
              {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Create client
            </button>
          </div>
        </div>
      )}

      {data.clients.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No clients yet. Add your first one and their team is live in a minute.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {data.clients.map(c => {
            const meta = STATE_META[c.state]
            const edit = seatEdits[c.id]
            const changed = edit !== undefined && Number(edit) !== c.seats
            return (
              <div key={c.id} className="p-4 bg-card flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <Pill label={c.offBill ? 'Billed by Cardtly' : meta.label} tone={c.offBill ? '#0ea5e9' : meta.tone} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.cardsMade} of {c.seats} cards made{c.ownerEmail ? ` · admin ${c.ownerEmail}` : ''}
                  </p>
                </div>

                {!c.offBill && c.state !== 'cancelled' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`seats-${c.id}`}>Seats</label>
                    <input id={`seats-${c.id}`} type="number" min={Math.max(1, c.cardsMade)} disabled={onHold}
                      value={edit ?? String(c.seats)}
                      onChange={e => setSeatEdits(s => ({ ...s, [c.id]: e.target.value }))}
                      className="w-20 px-3 py-1.5 rounded-lg border border-border bg-background text-sm tabular-nums" />
                    {changed && (
                      <button onClick={() => saveSeats(c)} disabled={busy === `seats-${c.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: accent }}>
                        {busy === `seats-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                      </button>
                    )}
                  </div>
                )}

                {!c.offBill && !onHold && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.state === 'live' && (
                      <button onClick={() => setState(c, 'paused')} disabled={!!busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
                        <Pause className="w-3.5 h-3.5" />Pause
                      </button>
                    )}
                    {c.state !== 'live' && (
                      <button onClick={() => setState(c, 'live')} disabled={!!busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
                        <Play className="w-3.5 h-3.5" />Switch on
                      </button>
                    )}
                    {c.state !== 'cancelled' && (
                      <button onClick={() => setState(c, 'cancelled')} disabled={!!busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition text-red-500">
                        <XCircle className="w-3.5 h-3.5" />Cancel
                      </button>
                    )}
                    <button onClick={() => resend(c)} disabled={!!busy} title="Send their admin the set-your-password email again"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
                      {busy === `mail-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}Setup email
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── NFC cards ───────────────────────────────────────────────────────────────

function NfcSection({ data, onHold, reload }: { data: Data; onHold: boolean; reload: () => Promise<void> }) {
  const r = data.reseller
  const [kind, setKind] = useState<ResellerNfcKind>('blank')
  const [quantity, setQuantity] = useState('10')
  const [orgId, setOrgId] = useState('')
  const [cards, setCards] = useState<Array<{ id: string; name: string; title: string | null; slug: string | null }> | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [ship, setShip] = useState({ name: r.name, phone: '', address: '', city: '', province: '', postalCode: '' })
  const [busy, setBusy] = useState(false)

  const prices = { nfcBlankCents: r.nfcBlankCents, nfcPrintedCents: r.nfcPrintedCents, nfcShippingCents: r.nfcShippingCents }
  const qty = kind === 'printed' && picked.size > 0 ? picked.size : Math.max(0, Math.floor(Number(quantity)) || 0)
  const total = useMemo(() => nfcOrderTotalCents(kind, qty, prices), [kind, qty, prices.nfcBlankCents, prices.nfcPrintedCents, prices.nfcShippingCents])
  const liveClients = data.clients.filter(c => c.state !== 'cancelled' && !c.offBill)

  async function pickClient(id: string) {
    setOrgId(id)
    setCards(null)
    setPicked(new Set())
    if (!id) return
    const { ok, data: d } = await post({ action: 'client_cards', org_id: id })
    if (ok) setCards(d.cards || [])
  }

  async function order() {
    if (!confirm(`Order ${qty} ${kind === 'printed' ? 'printed' : 'blank'} card${qty === 1 ? '' : 's'} for ${randCents(total)}${r.nfcShippingCents ? ' including shipping' : ''}?\n\nCardtly sends the invoice, and the cards are made once it is paid.`)) return
    setBusy(true)
    const { ok, data: d } = await post({
      action: 'nfc_order', kind, quantity: qty, org_id: kind === 'printed' ? orgId : null,
      card_ids: kind === 'printed' ? Array.from(picked) : [], notes, ship_to: ship,
    })
    setBusy(false)
    if (!ok) { toast.error(d?.error || 'The order did not go through'); return }
    toast.success('Order placed. Cardtly will send the invoice; the cards are made once it is paid.')
    setNotes('')
    setPicked(new Set())
    await reload()
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Blank card" value={randCents(r.nfcBlankCents)} hint="You print and programme them." />
        <Stat label="Printed by Cardtly" value={randCents(r.nfcPrintedCents)} hint="Printed and programmed with each person's card." />
        <Stat label="Shipping" value={r.nfcShippingCents ? randCents(r.nfcShippingCents) : 'Free'} hint="Per order, not per card." />
      </div>

      {!onHold && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="font-semibold text-sm">Order cards</p>
          <div className="flex gap-2 flex-wrap">
            {(['blank', 'printed'] as const).map(k => (
              <button key={k} onClick={() => setKind(k)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${kind === k ? 'border-transparent text-white' : 'border-border hover:bg-muted'}`}
                style={kind === k ? { background: accent } : undefined}>
                {k === 'blank' ? `Blank, ${randCents(r.nfcBlankCents)} each` : `Printed by Cardtly, ${randCents(r.nfcPrintedCents)} each`}
              </button>
            ))}
          </div>

          {kind === 'printed' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">For which client</span>
                <select className={`${inputClass} mt-1.5`} value={orgId} onChange={e => pickClient(e.target.value)}>
                  <option value="">Choose a client</option>
                  {liveClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              {cards && cards.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-2 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">One card per person picked, each programmed with their own link.</span>
                    <button className="text-xs underline" onClick={() => setPicked(picked.size === cards.length ? new Set() : new Set(cards.map(c => c.id)))}>
                      {picked.size === cards.length ? 'Clear' : 'Pick everyone'}
                    </button>
                  </div>
                  {cards.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={picked.has(c.id)}
                        onChange={e => setPicked(p => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n })} />
                      <span>{c.name || 'Unnamed card'}{c.title ? <span className="text-muted-foreground">, {c.title}</span> : null}</span>
                    </label>
                  ))}
                </div>
              )}
              {cards && cards.length === 0 && (
                <p className="text-xs text-muted-foreground">This client has made no cards yet. Type a quantity below and say what to print in the notes.</p>
              )}
            </div>
          )}

          {!(kind === 'printed' && picked.size > 0) && (
            <label className="block max-w-[200px]">
              <span className="text-xs font-medium text-muted-foreground">How many cards</span>
              <input className={`${inputClass} mt-1.5`} type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Notes {kind === 'printed' ? '(artwork, colours, anything we should know)' : '(optional)'}</span>
            <textarea className={`${inputClass} mt-1.5`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Deliver to</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                ['name', 'Name or company'], ['phone', 'Phone'], ['address', 'Street address'],
                ['city', 'City'], ['province', 'Province'], ['postalCode', 'Postal code'],
              ] as const).map(([k, label]) => (
                <input key={k} className={inputClass} placeholder={label} aria-label={label} value={ship[k]}
                  onChange={e => setShip(s => ({ ...s, [k]: e.target.value }))} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <p className="text-sm">
              {qty} card{qty === 1 ? '' : 's'}{r.nfcShippingCents ? ' plus shipping' : ''}: <strong>{randCents(total)}</strong>
              <span className="text-xs text-muted-foreground"> {'(VAT added on the invoice if it applies)'}</span>
            </p>
            <button onClick={order}
              disabled={busy || qty < 1 || (kind === 'printed' && !orgId) || !ship.name.trim() || !ship.address.trim() || !ship.city.trim() || !ship.postalCode.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: accent }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}Place order
            </button>
          </div>
        </div>
      )}

      {data.nfcOrders.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {data.nfcOrders.map(o => (
            <div key={o.id} className="p-4 bg-card flex items-center gap-3 flex-wrap text-sm">
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">
                  {o.quantity} {o.kind === 'printed' ? 'printed' : 'blank'} card{o.quantity === 1 ? '' : 's'}{o.client_name ? ` for ${o.client_name}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(o.created_at)} · {ORDER_STATUS[o.status] || o.status}{o.tracking_number ? ` · tracking ${o.tracking_number}` : ''}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{randCents(o.total_cents)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Invoices ────────────────────────────────────────────────────────────────

function InvoicesSection({ data }: { data: Data }) {
  const owing = data.invoices.reduce((n, i) => n + (i.outstanding_cents || 0), 0)
  if (!data.invoices.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
        No invoices yet. Your first seat invoice arrives on the 1st of next month, by email as well as here.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {owing > 0 && <p className="text-sm">You owe <strong>{randCents(owing)}</strong> across your open invoices. Pay by EFT with the invoice number as the reference.</p>}
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {data.invoices.map(i => {
          const meta = INVOICE_STATUS[i.status] || { label: i.status, tone: '#94a3b8' }
          return (
            <div key={i.id} className="p-4 bg-card flex items-center gap-3 flex-wrap text-sm">
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{i.number || 'Invoice'}</p>
                  <Pill label={meta.label} tone={meta.tone} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(i.issued_at)}{i.due_at ? ` · due ${fmtDate(i.due_at)}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{randCents(i.total_cents)}</p>
                {i.outstanding_cents > 0 && i.outstanding_cents !== i.total_cents && (
                  <p className="text-xs text-muted-foreground">{randCents(i.outstanding_cents)} still owing</p>
                )}
              </div>
              <a href={`/api/reseller/invoices/pdf?id=${i.id}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
                <Download className="w-3.5 h-3.5" />PDF
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
