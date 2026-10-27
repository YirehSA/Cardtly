'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, ChevronDown, ChevronUp, Send, RefreshCw, UserPlus, Trash2, FileText, Check, Inbox, Undo2 } from 'lucide-react'
import { Section, Stat, inputClass, inputStyle, grad, fmtDate } from './shared'
import { money, toCents, toRands, StatusPill as InvoicePill } from './billing/shared'
import { addressLine } from '@/lib/reseller-application'

// Resellers: companies that sell Cardtly to their own clients. Cardtly gives
// each a seat pool, it hands seats to client teams from its own page, and on
// the 1st a draft invoice appears here for every seat live the month before.
// See lib/reseller-billing and migration 094.

const muted = 'rgba(255,255,255,0.5)'
const faint = 'rgba(255,255,255,0.35)'

const NFC_STATUSES = [
  ['awaiting_payment', 'Waiting for payment'], ['paid', 'Paid'], ['in_production', 'In production'],
  ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'],
] as const

const STATE_TONE: Record<string, string> = { live: '#22c55e', paused: '#f59e0b', cancelled: '#94a3b8' }

const BLANK = {
  name: '', legal_name: '', contact_name: '', email: '', phone: '', address: '', vat_number: '',
  seat_pool: '100', seat: '70.00', blank: '50.00', printed: '125.00', shipping: '100.00', notes: '',
  // Blank until a yearly price is agreed: the invoice then uses twelve times
  // the monthly price (lib/reseller-pricing yearlySeatCents).
  seat_year: '',
  // Set when the form was opened from an application, which approving it
  // closes in the same step (see POST /api/admin/resellers).
  application_id: '',
}

/** The New reseller form, filled in from an application. */
function fromApplication(a: any): typeof BLANK {
  const notes = [
    `From the website application of ${fmtDate(a.created_at)}.`,
    a.registration_number ? `Reg no ${a.registration_number}.` : null,
    `${a.business_type}. Expects ${a.expected_clients} clients${a.expected_seats ? `, ${a.expected_seats} cards` : ''}. Printing: ${a.printing}.`,
  ].filter(Boolean).join(' ')
  return {
    ...BLANK,
    name: a.trading_name || '', legal_name: a.registered_name || '', contact_name: a.contact_name || '',
    email: a.email || '', phone: a.phone || '', address: addressLine(a), vat_number: a.vat_number || '',
    notes, application_id: a.id,
  }
}

async function call(method: 'POST' | 'PATCH', body: Record<string, any>) {
  const res = await fetch('/api/admin/resellers', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && !data?.error, data }
}

/** Issue a draft, then email it. The same two calls the Recurring tab makes. */
async function approveAndSend(invoiceId: string, what: string): Promise<boolean> {
  if (!confirm(`Approve ${what}? It gets an invoice number, is frozen, and is emailed to the reseller.`)) return false
  const issued = await fetch('/api/admin/billing/invoices', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: invoiceId, action: 'issue' }),
  })
  const i = await issued.json().catch(() => ({}))
  if (!issued.ok || i?.error) { toast.error(i?.error || 'Could not issue it'); return false }
  const sent = await fetch('/api/admin/billing/invoices/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: invoiceId }),
  })
  const s = await sent.json().catch(() => ({}))
  if (!sent.ok || s?.error) { toast.error(`Issued, but not emailed: ${s?.error || 'unknown error'}. Send it from Invoices.`); return true }
  toast.success('Issued and emailed')
  return true
}

/** What a blank yearly price comes to: twelve times the monthly one. */
const yearPlaceholder = (monthly: string) => {
  const n = Number(String(monthly).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? (n * 12).toFixed(2) : '12 x monthly'
}

const TERM_TEXT = (c: any, thisMonth: string) => {
  if (c.offBill) return ''
  const paid = c.paidTo && c.paidTo >= thisMonth ? ` to ${monthName(c.paidTo)}` : ''
  if (c.term === 'yearly') return paid ? `yearly, paid${paid}` : 'yearly, next invoice'
  return paid ? `monthly after yearly${paid}` : 'monthly'
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthName = (m: string) => {
  const hit = /^(\d{4})-(\d{2})/.exec(m || '')
  return hit ? `${MONTH_NAMES[Number(hit[2]) - 1]} ${hit[1]}` : m
}

const field = (label: string, input: React.ReactNode, wide = false) => (
  <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
    <div className="mt-1.5">{input}</div>
  </label>
)

export default function ResellersTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [list, setList] = useState<any[]>([])
  const [adding, setAdding] = useState<typeof BLANK | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Applications from cardtly.com/resellers. null until migration 095 is run,
  // when the section says so instead of the whole tab failing.
  const [applications, setApplications] = useState<any[] | null>(null)
  const [appsNote, setAppsNote] = useState<string | null>(null)

  async function load() {
    const [res, appsRes] = await Promise.all([
      fetch('/api/admin/resellers', { cache: 'no-store' }),
      fetch('/api/admin/reseller-applications', { cache: 'no-store' }),
    ])
    const data = await res.json().catch(() => ({}))
    const apps = await appsRes.json().catch(() => ({}))
    setLoading(false)
    if (appsRes.ok) { setApplications(apps.applications || []); setAppsNote(null) }
    else { setApplications(null); setAppsNote(apps?.error || 'Could not load applications') }
    if (!res.ok) { setUnavailable(data?.error || 'Could not load resellers'); return }
    setUnavailable(null)
    setList(data.resellers || [])
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!adding) return
    setBusy('create')
    const { ok, data } = await call('POST', {
      name: adding.name, legal_name: adding.legal_name, contact_name: adding.contact_name, email: adding.email,
      phone: adding.phone, address: adding.address, vat_number: adding.vat_number, notes: adding.notes,
      seat_pool: Number(adding.seat_pool),
      seat_price_cents: toCents(adding.seat), nfc_blank_cents: toCents(adding.blank),
      nfc_printed_cents: toCents(adding.printed), nfc_shipping_cents: toCents(adding.shipping),
      seat_price_year_cents: adding.seat_year.trim() ? toCents(adding.seat_year) : null,
      ...(adding.application_id ? { application_id: adding.application_id } : {}),
    })
    setBusy(null)
    if (!ok) { toast.error(data?.error || 'That did not save'); return }
    toast.success(`${adding.name} ${adding.application_id ? 'approved and set up' : 'added'}. ${data.warning || ''}`)
    setAdding(null)
    setOpen(data.reseller?.id || null)
    load()
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: muted }}><Loader2 className="w-4 h-4 animate-spin" />Loading resellers</div>
  if (unavailable) return <p className="text-sm" style={{ color: muted }}>{unavailable}</p>

  const totalMonth = list.reduce((n, r) => n + (r.thisMonth?.cents || 0), 0)
  const drafts = list.flatMap(r => [
    ...(r.months || []).filter((m: any) => m.invoice?.status === 'draft'),
    ...(r.nfcOrders || []).filter((o: any) => o.invoice?.status === 'draft'),
  ]).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Resellers" value={list.length} />
        <Stat label="Seats sold" value={list.reduce((n, r) => n + (r.sold || 0), 0)} colour="#ec4899" />
        <Stat label="This month so far" value={money(totalMonth)} colour="#22c55e" hint="Monthly clients' seats live this month, and yearly terms starting this month, at each reseller's prices. Invoiced on the 1st." />
        <Stat label="Drafts to approve" value={drafts} colour="#f59e0b" warn={drafts > 0} />
      </div>

      <ApplicationsSection applications={applications} note={appsNote} reload={load}
        onApprove={(a) => { setAdding(fromApplication(a)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />

      <div className="flex justify-end">
        <button onClick={() => setAdding({ ...BLANK })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: grad, color: '#fff' }}>
          <Plus className="w-4 h-4" />New reseller
        </button>
      </div>

      {adding && (
        <Section title={adding.application_id ? `Approve ${adding.name || 'this application'}` : 'New reseller'}
          sub={adding.application_id
            ? 'Filled in from their application. Set their seat pool and prices, then create: they get a login and an email to choose a password.'
            : 'They get a login and an email to choose a password. Invoices go to the billing details below.'}
          right={<button onClick={() => setAdding(null)}><X className="w-4 h-4" style={{ color: faint }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['name', 'Company name'], ['legal_name', 'Registered name on invoices (if different)'],
              ['contact_name', 'Contact person'], ['email', 'Email (their login)'],
              ['phone', 'Phone'], ['vat_number', 'VAT number'],
            ] as const).map(([k, label]) => (
              <div key={k}>
                {field(label, <input className={inputClass} style={inputStyle} value={adding[k]}
                  onChange={e => setAdding({ ...adding, [k]: e.target.value })} />)}
              </div>
            ))}
            {field('Address', <input className={inputClass} style={inputStyle} value={adding.address}
              onChange={e => setAdding({ ...adding, address: e.target.value })} />, true)}
            {field('Seat pool', <input type="number" min={0} className={inputClass} style={inputStyle} value={adding.seat_pool}
              onChange={e => setAdding({ ...adding, seat_pool: e.target.value })} />)}
            {field('Per seat per month (R)', <input className={inputClass} style={inputStyle} value={adding.seat}
              onChange={e => setAdding({ ...adding, seat: e.target.value })} />)}
            {field('Per seat per year (R)', <input className={inputClass} style={inputStyle} value={adding.seat_year}
              placeholder={`${yearPlaceholder(adding.seat)} (12 months)`}
              onChange={e => setAdding({ ...adding, seat_year: e.target.value })} />)}
            {field('Blank NFC card (R)', <input className={inputClass} style={inputStyle} value={adding.blank}
              onChange={e => setAdding({ ...adding, blank: e.target.value })} />)}
            {field('Printed NFC card (R)', <input className={inputClass} style={inputStyle} value={adding.printed}
              onChange={e => setAdding({ ...adding, printed: e.target.value })} />)}
            {field('Shipping per NFC order (R)', <input className={inputClass} style={inputStyle} value={adding.shipping}
              onChange={e => setAdding({ ...adding, shipping: e.target.value })} />)}
            {field('Notes', <input className={inputClass} style={inputStyle} value={adding.notes}
              onChange={e => setAdding({ ...adding, notes: e.target.value })} />)}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={create} disabled={busy === 'create' || !adding.name.trim() || !adding.email.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: grad, color: '#fff' }}>
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{adding.application_id ? 'Approve and create reseller' : 'Create reseller'}
            </button>
          </div>
        </Section>
      )}

      {list.length === 0 && !adding && (
        <p className="text-sm text-center py-8" style={{ color: faint }}>No resellers yet.</p>
      )}

      {list.map(r => (
        <ResellerCard key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} reload={load} />
      ))}
    </div>
  )
}

function ResellerCard({ r, open, onToggle, reload }: { r: any; open: boolean; onToggle: () => void; reload: () => void }) {
  const [edit, setEdit] = useState(() => ({
    seat_pool: String(r.seat_pool), seat: toRands(r.seat_price_cents),
    seat_year: r.seat_price_year_cents === null || r.seat_price_year_cents === undefined ? '' : toRands(r.seat_price_year_cents),
    blank: toRands(r.nfc_blank_cents),
    printed: toRands(r.nfc_printed_cents), shipping: toRands(r.nfc_shipping_cents),
    contact_name: r.contact_name || '', phone: r.phone || '', notes: r.notes || '',
    address: r.billingClient?.address || '', vat_number: r.billingClient?.vat_number || '',
  }))
  const [loginEmail, setLoginEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [tracking, setTracking] = useState<Record<string, string>>({})

  async function patch(key: string, body: Record<string, any>, done: string) {
    setBusy(key)
    const { ok, data } = await call('PATCH', { id: r.id, ...body })
    setBusy(null)
    if (!ok) { toast.error(data?.error || 'That did not save'); return false }
    toast.success(`${done}${data.warning ? ` ${data.warning}` : ''}`)
    reload()
    return true
  }

  const suspended = r.status === 'suspended'
  const ended = r.status === 'ended'

  return (
    <div className="rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-white text-sm flex items-center gap-2">
            {r.name}
            {suspended && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>On hold</span>}
            {ended && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Ended</span>}
          </p>
          <p className="text-xs" style={{ color: muted }}>
            {r.sold} of {r.seat_pool} seats sold · {r.clients.length} client{r.clients.length === 1 ? '' : 's'} · {money(r.seat_price_cents)}/seat a month · {money(r.yearlyCents ?? r.seat_price_cents * 12)}/seat a year
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{money(r.thisMonth.cents)}</p>
          <p className="text-[11px]" style={{ color: faint }}>{r.thisMonth.label} so far, {r.thisMonth.seats} seats</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: faint }} /> : <ChevronDown className="w-4 h-4" style={{ color: faint }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {!r.billingClient && (
            <p className="text-xs mt-3" style={{ color: '#f59e0b' }}>No billing client is linked, so nothing can be invoiced. Recreate the reseller or link one under Clients.</p>
          )}

          {/* Months */}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Monthly invoices</p>
              <button onClick={() => patch('draft', { action: 'draft_month', month: r.lastMonth.month }, `${r.lastMonth.label} drafted`)}
                disabled={!!busy || r.months.some((m: any) => m.month === r.lastMonth.month)}
                title={`Drafts ${r.lastMonth.label} now instead of waiting for the daily run`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)' }}>
                <FileText className="w-3.5 h-3.5" />Draft {r.lastMonth.label} now
              </button>
            </div>
            {r.months.length === 0 ? (
              <p className="text-xs" style={{ color: faint }}>Nothing billed yet. The first draft appears on the 1st after a month with seats sold.</p>
            ) : (
              <div className="space-y-1">
                {r.months.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-3 text-xs rounded-lg px-3 py-2 flex-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-white flex-1 min-w-[120px]">{m.label}</span>
                    {m.invoice ? <>
                      <span style={{ color: muted }}>{m.invoice.number || 'Draft'}</span>
                      <InvoicePill status={m.invoice.status} />
                      <span className="tabular-nums text-white">{money(m.invoice.total_cents)}</span>
                      {m.invoice.status === 'draft' && <>
                        <button onClick={() => patch(`rebuild-${m.month}`, { action: 'draft_month', month: m.month, rebuild: true }, `${m.label} rebuilt from the current counts`)}
                          disabled={!!busy} title="Refresh the lines from the seat counts as they are now"
                          className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <RefreshCw className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                        </button>
                        <a href={`/api/admin/billing/invoices/pdf?id=${m.invoice.id}`} target="_blank" rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)' }}>Preview</a>
                        <button onClick={async () => { if (await approveAndSend(m.invoice.id, `${r.name}, ${m.label} (${money(m.invoice.total_cents)})`)) reload() }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold" style={{ background: grad, color: '#fff' }}>
                          <Send className="w-3 h-3" />Approve and send
                        </button>
                      </>}
                    </> : <span style={{ color: '#f59e0b' }}>Claimed, but no invoice was made. Draft it again.</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clients */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Clients</p>
            {r.clients.length === 0 ? (
              <p className="text-xs" style={{ color: faint }}>None yet. The reseller adds them from their Reseller page.</p>
            ) : (
              <div className="space-y-1">
                {r.clients.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 text-xs rounded-lg px-3 py-2 flex-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-white flex-1 min-w-[140px]">{c.name}</span>
                    <span style={{ color: c.offBill ? '#0ea5e9' : STATE_TONE[c.state] }}>{c.offBill ? 'Billed by Cardtly' : c.state}</span>
                    {!c.offBill && <span style={{ color: c.term === 'yearly' ? '#a78bfa' : muted }}>{TERM_TEXT(c, r.thisMonth.month)}</span>}
                    <span className="tabular-nums" style={{ color: muted }}>{c.cardsMade}/{c.seats} cards</span>
                    <span style={{ color: faint }}>{c.ownerEmail || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NFC orders */}
          {r.nfcOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>NFC orders</p>
              <div className="space-y-1.5">
                {r.nfcOrders.map((o: any) => (
                  <div key={o.id} className="rounded-lg px-3 py-2 text-xs space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white flex-1 min-w-[180px]">
                        {o.quantity} {o.kind} card{o.quantity === 1 ? '' : 's'}{o.client_name ? ` for ${o.client_name}` : ''} · {fmtDate(o.created_at)}
                      </span>
                      <span className="tabular-nums text-white">{money(o.total_cents)}</span>
                      {o.invoice && <InvoicePill status={o.invoice.status} />}
                      {o.invoice?.status === 'draft' && (
                        <button onClick={async () => { if (await approveAndSend(o.invoice.id, `${r.name}'s NFC order (${money(o.invoice.total_cents)})`)) reload() }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold" style={{ background: grad, color: '#fff' }}>
                          <Send className="w-3 h-3" />Approve and send
                        </button>
                      )}
                    </div>
                    <p style={{ color: faint }}>
                      Ship to {o.ship_to?.name}, {o.ship_to?.phone} · {o.ship_to?.address}, {o.ship_to?.city} {o.ship_to?.province} {o.ship_to?.postalCode}
                    </p>
                    {Array.isArray(o.cards) && o.cards.length > 0 && (
                      <p style={{ color: faint }}>Cards: {o.cards.map((c: any) => `${c.name}${c.slug ? ` (/card/${c.slug})` : ''}`).join(', ')}</p>
                    )}
                    {o.notes && <p style={{ color: muted, whiteSpace: 'pre-wrap' }}>Notes: {o.notes}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={o.status} disabled={!!busy}
                        onChange={e => patch(`nfc-${o.id}`, { action: 'nfc_status', order_id: o.id, status: e.target.value, tracking_number: tracking[o.id] ?? o.tracking_number ?? '' }, 'Order updated')}
                        className="text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                        {NFC_STATUSES.map(([v, label]) => <option key={v} value={v} style={{ background: '#1a1a1a' }}>{label}</option>)}
                      </select>
                      <input placeholder="Tracking number" value={tracking[o.id] ?? o.tracking_number ?? ''}
                        onChange={e => setTracking(t => ({ ...t, [o.id]: e.target.value }))}
                        className="text-xs px-2 py-1.5 rounded-lg w-40" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                      {tracking[o.id] !== undefined && tracking[o.id] !== (o.tracking_number ?? '') && (
                        <button onClick={() => patch(`nfc-${o.id}`, { action: 'nfc_status', order_id: o.id, status: o.status, tracking_number: tracking[o.id] }, 'Tracking saved')}
                          className="px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>Save</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Pool, prices and details</p>
            <div className="grid sm:grid-cols-4 gap-3">
              {field('Seat pool', <input type="number" min={r.sold} className={inputClass} style={inputStyle} value={edit.seat_pool}
                onChange={e => setEdit({ ...edit, seat_pool: e.target.value })} />)}
              {field('Per seat, month (R)', <input className={inputClass} style={inputStyle} value={edit.seat}
                onChange={e => setEdit({ ...edit, seat: e.target.value })} />)}
              {field('Per seat, year (R)', <input className={inputClass} style={inputStyle} value={edit.seat_year}
                placeholder={`${yearPlaceholder(edit.seat)} (12 months)`} title="Blank means twelve times the monthly price"
                onChange={e => setEdit({ ...edit, seat_year: e.target.value })} />)}
              {field('Blank card (R)', <input className={inputClass} style={inputStyle} value={edit.blank}
                onChange={e => setEdit({ ...edit, blank: e.target.value })} />)}
              {field('Printed card (R)', <input className={inputClass} style={inputStyle} value={edit.printed}
                onChange={e => setEdit({ ...edit, printed: e.target.value })} />)}
              {field('Shipping per order (R)', <input className={inputClass} style={inputStyle} value={edit.shipping}
                onChange={e => setEdit({ ...edit, shipping: e.target.value })} />)}
              {field('Contact person', <input className={inputClass} style={inputStyle} value={edit.contact_name}
                onChange={e => setEdit({ ...edit, contact_name: e.target.value })} />)}
              {field('Phone', <input className={inputClass} style={inputStyle} value={edit.phone}
                onChange={e => setEdit({ ...edit, phone: e.target.value })} />)}
              {field('VAT number', <input className={inputClass} style={inputStyle} value={edit.vat_number}
                onChange={e => setEdit({ ...edit, vat_number: e.target.value })} />)}
              {field('Address', <input className={inputClass} style={inputStyle} value={edit.address}
                onChange={e => setEdit({ ...edit, address: e.target.value })} />, true)}
              {field('Notes', <input className={inputClass} style={inputStyle} value={edit.notes}
                onChange={e => setEdit({ ...edit, notes: e.target.value })} />, true)}
            </div>
            <p className="text-[11px] mt-2" style={{ color: faint }}>
              A price change applies to the next invoice drafted. Invoices already issued keep the price they were issued at.
              The yearly price is what a client sold yearly is billed for twelve months upfront; left blank, it is twelve times the monthly price.
            </p>
            <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
              {ended ? (
                <button onClick={() => {
                  if (!confirm(`Restart ${r.name} as a reseller? Their page opens again and their own card becomes free again.`)) return
                  patch('restart', { action: 'restart' }, `${r.name} is a reseller again`)
                }} disabled={!!busy}
                  className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                  Restart reseller
                </button>
              ) : (<>
              <button onClick={() => {
                const to = suspended ? 'active' : 'suspended'
                if (!confirm(suspended
                  ? `Take ${r.name} off hold? They can add clients and order cards again.`
                  : `Put ${r.name} on hold?\n\nThey can still sign in and see their invoices, but cannot add clients, change seats or order cards. Their clients' cards are NOT affected: pause those from Teams if you need to.`)) return
                patch('status', { action: 'update', status: to }, to === 'suspended' ? `${r.name} is on hold` : `${r.name} is active again`)
              }} disabled={!!busy}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={suspended ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {suspended ? 'Take off hold' : 'Put on hold'}
              </button>
              <button onClick={() => {
                if (!confirm(`End ${r.name} as a reseller?\n\nTheir page becomes read-only (their invoices stay there), their own card stops being free, and the last month they had seats live in is still invoiced on the 1st.\n\nAny clients still on their bill must be cancelled, or moved to another billing mode under Teams, first.`)) return
                patch('end', { action: 'end' }, `${r.name} has ended as a reseller`)
              }} disabled={!!busy}
                className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }}>
                End reseller
              </button>
              </>)}
              </div>
              <button onClick={() => patch('save', {
                action: 'update', seat_pool: Number(edit.seat_pool),
                seat_price_cents: toCents(edit.seat), nfc_blank_cents: toCents(edit.blank),
                nfc_printed_cents: toCents(edit.printed), nfc_shipping_cents: toCents(edit.shipping),
                seat_price_year_cents: edit.seat_year.trim() ? toCents(edit.seat_year) : null,
                contact_name: edit.contact_name, phone: edit.phone, notes: edit.notes,
                address: edit.address, vat_number: edit.vat_number,
              }, 'Saved')} disabled={!!busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: grad, color: '#fff' }}>
                {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
              </button>
            </div>
          </div>

          {/* Logins */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Logins</p>
            {r.freeCard && (
              <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 mb-2 flex-wrap"
                style={{ background: r.freeCard.state === 'paying' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${r.freeCard.state === 'paying' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.22)'}` }}>
                <span className="flex-1 min-w-[200px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <strong className="text-white">Free card, {r.freeCard.email}:</strong> {r.freeCard.text}
                </span>
                {(r.freeCard.state === 'pending' || r.freeCard.state === 'paying') && !ended && (
                  <button onClick={() => patch('free', { action: 'sync_free_card' }, 'Checked')} disabled={!!busy}
                    className="px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                    Check again
                  </button>
                )}
              </div>
            )}
            <div className="space-y-1">
              {r.logins.map((l: any) => (
                <div key={l.user_id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-white flex-1">{l.email || l.user_id}</span>
                  <button onClick={() => { if (confirm(`Remove ${l.email}'s access to ${r.name}? Their Cardtly login itself is not deleted.`)) patch(`rm-${l.user_id}`, { action: 'remove_login', user_id: l.user_id }, 'Login removed') }}
                    className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }} title="Remove access">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input placeholder="Another person's email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                className={inputClass} style={inputStyle} />
              <button onClick={async () => { if (await patch('login', { action: 'add_login', email: loginEmail }, 'Login added')) setLoginEmail('') }}
                disabled={!!busy || !loginEmail.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                <UserPlus className="w-3.5 h-3.5" />Add login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Applications from the website ─────────────────────────────────────────

function ApplicationsSection({ applications, note, reload, onApprove }: {
  applications: any[] | null; note: string | null; reload: () => void; onApprove: (a: any) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const [declining, setDeclining] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  if (!applications) {
    return note ? <p className="text-xs" style={{ color: faint }}>{note}</p> : null
  }
  const pending = applications.filter(a => a.status === 'pending')
  const done = applications.filter(a => a.status !== 'pending')

  async function patch(id: string, body: Record<string, any>, ok: string) {
    setBusy(id)
    const res = await fetch('/api/admin/reseller-applications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return }
    toast.success(`${ok}${data.warning ? ` ${data.warning}` : ''}`)
    setDeclining(null); setDeclineNote('')
    reload()
  }

  const detail = (k: string, v: any) => v ? (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: faint }}>{k}</p>
      <p className="text-xs text-white break-words">{v}</p>
    </div>
  ) : null

  return (
    <Section title="Applications" sub="From cardtly.com/resellers. Approve to set them up with a login, or decline."
      right={<span className="text-xs font-semibold px-2 py-1 rounded-lg" style={pending.length
        ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' } : { background: 'rgba(255,255,255,0.05)', color: muted }}>
        {pending.length ? `${pending.length} to review` : 'All reviewed'}</span>}>
      {pending.length === 0 && (
        <p className="text-sm flex items-center gap-2" style={{ color: muted }}><Inbox className="w-4 h-4" />Nothing waiting. New applications show up here, and in Today.</p>
      )}
      <div className="space-y-3">
        {pending.map(a => (
          <div key={a.id} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-white">{a.trading_name}</p>
                <p className="text-xs" style={{ color: muted }}>{a.business_type} · {a.city}, {a.province} · applied {fmtDate(a.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onApprove(a)} disabled={!!busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: grad, color: '#fff' }}>
                  <Check className="w-3.5 h-3.5" />Approve
                </button>
                <button onClick={() => { setDeclining(declining === a.id ? null : a.id); setDeclineNote(''); setNotify(true) }} disabled={!!busy}
                  className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  Decline
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {detail('Contact', `${a.contact_name}${a.contact_role ? `, ${a.contact_role}` : ''}`)}
              {detail('Email', <a href={`mailto:${a.email}`} className="underline">{a.email}</a>)}
              {detail('Phone', <a href={`tel:${String(a.phone).replace(/[^\d+]/g, '')}`} className="underline">{a.phone}</a>)}
              {detail('Website', a.website ? <a href={/^https?:\/\//.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="underline">{a.website}</a> : null)}
              {detail('Registered name', a.registered_name)}
              {detail('Registration no', a.registration_number)}
              {detail('VAT no', a.vat_number)}
              {detail('Address', addressLine(a))}
              {detail('Clients in 6 months', a.expected_clients)}
              {detail('Cards in year one', a.expected_seats)}
              {detail('NFC printing', a.printing)}
              {detail('Heard about us', a.heard_about)}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: faint }}>Their clients and how they would sell</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.75)' }}>{a.pitch}</p>
            </div>
            {declining === a.id && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <textarea rows={2} value={declineNote} onChange={e => setDeclineNote(e.target.value)}
                  placeholder="Why, for our own records. Never sent to them."
                  className={inputClass} style={inputStyle} />
                <label className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
                  Email them a polite no
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDeclining(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: muted }}>Keep it</button>
                  <button onClick={() => patch(a.id, { action: 'decline', note: declineNote, notify }, `${a.trading_name} declined.`)}
                    disabled={busy === a.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#ef4444', color: '#fff' }}>
                    {busy === a.id && <Loader2 className="w-3 h-3 animate-spin" />}Decline{notify ? ' and email' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowDone(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: muted }}>
            {showDone ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Earlier applications ({done.length})
          </button>
          {showDone && (
            <div className="space-y-1 mt-2">
              {done.map(a => (
                <div key={a.id} className="flex items-center gap-3 text-xs rounded-lg px-3 py-2 flex-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-white flex-1 min-w-[160px]">{a.trading_name}</span>
                  <span style={{ color: faint }}>{a.email}</span>
                  <span style={{ color: a.status === 'approved' ? '#22c55e' : '#ef4444' }}>{a.status}{a.decided_at ? ` ${fmtDate(a.decided_at)}` : ''}</span>
                  {a.decision_note && <span className="w-full" style={{ color: faint }}>Note: {a.decision_note}</span>}
                  {a.status === 'declined' && (
                    <button onClick={() => patch(a.id, { action: 'reopen' }, `${a.trading_name} is back in the queue.`)} disabled={!!busy}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}>
                      <Undo2 className="w-3 h-3" />Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
