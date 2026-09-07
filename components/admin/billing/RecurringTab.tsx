'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, X, RefreshCw, Check, Trash2, Pause, Play, SkipForward, FileText, AlertTriangle } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import { money, toCents, toRands, Empty, fmtDate } from './shared'

// The monthly ritual, in one place.
//
// The queue comes first because it is the thing with a deadline: drafts the
// system has raised and nobody has approved. The schedules underneath are
// configuration, and configuration can wait.
//
// Nothing here sends on its own. Approving is a person pressing a button,
// which was the requirement and is also the only safe design.

type Pending = {
  id: string; client_name: string; due_at: string | null
  total_cents: number; notes: string | null
  /** Set when this draft is a mid-cycle seat top-up rather than the monthly
   *  charge. Approving it is the same act either way; the label is so nobody
   *  approves a second invoice for one client without knowing why. */
  adjustment: { from_seats: number; to_seats: number; period_end: string } | null
}
type Schedule = {
  id: string; name: string; client_name: string; organization_name: string | null
  source: string; cadence: string; day_of_month: number; next_run_on: string
  active: boolean; seat_price_cents: number; lead_days: number
  last_seats: number | null; seats_now: number | null; seats_changed: boolean
  next_amount_cents: number
}

export default function RecurringTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [adding, setAdding] = useState<any | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      fetch('/api/admin/billing/recurring'),
      fetch('/api/admin/billing/clients'),
    ])
    const rData = await rRes.json().catch(() => ({}))
    const cData = await cRes.json().catch(() => ({}))
    setLoading(false)
    if (!rRes.ok) { setUnavailable(rData?.error || 'Could not load schedules'); return }
    setUnavailable(null)
    setPending(rData.pending || [])
    setSchedules(rData.schedules || [])
    setClients(cData.clients || [])
    setOrgs(rData.schedules ? (rData.orgs || []) : [])
  }
  useEffect(() => { load() }, [])

  async function runNow() {
    setBusy('run')
    const res = await fetch('/api/admin/billing/recurring', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run' }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { toast.error(d?.error || 'That did not run'); return }
    const adj = d.seats || {}
    toast.success(d.created
      ? `${d.created} draft${d.created === 1 ? '' : 's'} raised from ${d.considered} schedule${d.considered === 1 ? '' : 's'}`
      : `Nothing due yet. ${d.considered} schedule${d.considered === 1 ? '' : 's'} checked.`)

    // Seat changes are reported one by one and in words, because "3 adjustments
    // raised" tells nobody whether that was right.
    for (const c of adj.changes || []) {
      toast.info(c.direction === 'increase' && c.chargeNowCents > 0
        ? `${c.schedule}: ${c.from} to ${c.to} seats. Pro rata ${money(c.chargeNowCents)} drafted.`
        : c.direction === 'decrease'
          ? `${c.schedule}: ${c.from} to ${c.to} seats. Nothing refunded; next month bills ${c.to}.`
          : `${c.schedule}: ${c.from} to ${c.to} seats.`,
        { duration: 9000 })
    }
    for (const p of [...(d.problems || []), ...(adj.problems || [])]) toast.warning(p, { duration: 8000 })
    load()
  }

  /** Approve = issue, then email. Two steps, reported separately, because the
   *  first can succeed and the second can fail and you need to know which. */
  async function approve(p: Pending) {
    if (!confirm(`Approve ${p.client_name} for ${money(p.total_cents)}? It gets a number, is frozen, and is emailed.`)) return
    setBusy(p.id)
    const issued = await fetch('/api/admin/billing/invoices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, action: 'issue' }),
    })
    const iData = await issued.json().catch(() => ({}))
    if (!issued.ok || iData?.error) { setBusy(null); toast.error(iData?.error || 'Could not issue'); return }

    const sent = await fetch('/api/admin/billing/invoices/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    const sData = await sent.json().catch(() => ({}))
    setBusy(null)
    if (!sent.ok || sData?.error) {
      // Issued but not emailed is a real state, not a failure to hide: the
      // number is allocated and the invoice is on the books.
      toast.warning(`Issued as ${iData.invoice.number}, but the email did not go: ${sData?.error || 'unknown'}. Send it from Invoices.`, { duration: 10000 })
      load(); return
    }
    toast.success(`${iData.invoice.number} issued and emailed to ${sData.to}`)
    load()
  }

  async function discard(p: Pending) {
    if (!confirm('Discard this draft? The schedule has already moved on, so it will not come back until next cycle.')) return
    const res = await fetch('/api/admin/billing/invoices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, action: 'cancel' }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not discard'); return }
    toast.success('Draft discarded'); load()
  }

  async function patch(id: string, body: any, msg: string) {
    const res = await fetch('/api/admin/billing/recurring', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { toast.error(d?.error || 'That did not save'); return }
    toast.success(msg); load()
  }

  async function createSchedule() {
    setBusy('new')
    const res = await fetch('/api/admin/billing/recurring', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...adding,
        seat_price_cents: toCents(adding.seat_price_rand || '97'),
        template: adding.source === 'fixed'
          ? [{ description: adding.line_description, qty: 1, unit_price_cents: toCents(adding.line_amount || '0') }]
          : [],
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not save'); return }
    toast.success('Schedule created'); setAdding(null); load()
  }

  async function remove(s: Schedule) {
    if (!confirm(`Delete "${s.name}"? Invoices already raised are untouched; it just stops drafting new ones.`)) return
    const res = await fetch(`/api/admin/billing/recurring?id=${s.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not delete'); return }
    toast.success('Schedule deleted'); load()
  }

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <Loader2 className="w-4 h-4 animate-spin" />Loading schedules
  </div>
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  const queueTotal = pending.reduce((n, p) => n + p.total_cents, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs flex-1 min-w-[220px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Drafts are raised automatically ahead of each due date. Nothing is sent until you approve it,
          and you can edit a draft on the Invoices tab first.
        </p>
        <button onClick={runNow} disabled={busy === 'run'}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Check now
        </button>
        <button onClick={() => setAdding({
          client_id: clients[0]?.id || '', name: '', source: 'seats', organization_id: '',
          cadence: 'monthly', day_of_month: new Date().getDate(), seat_price_rand: '97',
          lead_days: 7, line_description: '', line_amount: '', notes: '',
        })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: grad, color: '#fff' }}>
          <Plus className="w-4 h-4" />New schedule
        </button>
      </div>

      {/* ── The queue ─────────────────────────────────────────────────── */}
      <Section title={pending.length ? `${pending.length} waiting for approval` : 'Nothing waiting'}
        sub={pending.length ? `${money(queueTotal)} in total. Approving issues the invoice and emails it.` : 'Drafts appear here before each due date.'}>
        {pending.length === 0 ? (
          <Empty>No drafts to approve. The next one appears a few days before it falls due.</Empty>
        ) : (
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm text-white">
                    {p.client_name}
                    {p.adjustment && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>Pro rata</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {p.adjustment
                      ? `Seat top-up, ${p.adjustment.from_seats} to ${p.adjustment.to_seats}, due now`
                      : `Monthly, due ${fmtDate(p.due_at)}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-white w-28 text-right">{money(p.total_cents)}</p>
                <div className="flex items-center gap-1">
                  <a href={`/api/admin/billing/invoices/pdf?id=${p.id}`} target="_blank" rel="noreferrer"
                    title="Preview the PDF" className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <FileText className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </a>
                  <button onClick={() => approve(p)} disabled={busy === p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                    {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve and send
                  </button>
                  <button onClick={() => discard(p)} title="Discard"
                    className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {adding && (
        <Section title="New schedule" sub="What to bill, who to bill, and when."
          right={<button onClick={() => setAdding(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Name</span>
              <input className={`${inputClass} mt-1.5`} style={inputStyle} placeholder="Acme monthly seats"
                value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Client</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.client_id}
                onChange={e => setAdding({ ...adding, client_id: e.target.value })}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>What to bill</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.source}
                onChange={e => setAdding({ ...adding, source: e.target.value })}>
                <option value="seats">Seats, counted live each month</option>
                <option value="fixed">A fixed amount</option>
              </select>
            </label>
            {adding.source === 'seats' ? (
              <>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Organisation ID</span>
                  <input className={`${inputClass} mt-1.5`} style={inputStyle} placeholder="The team whose seats to count"
                    value={adding.organization_id} onChange={e => setAdding({ ...adding, organization_id: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Price per seat (R)</span>
                  <input className={`${inputClass} mt-1.5`} style={inputStyle} inputMode="decimal"
                    value={adding.seat_price_rand} onChange={e => setAdding({ ...adding, seat_price_rand: e.target.value })} />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Description</span>
                  <input className={`${inputClass} mt-1.5`} style={inputStyle} placeholder="Monthly retainer"
                    value={adding.line_description} onChange={e => setAdding({ ...adding, line_description: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Amount (R)</span>
                  <input className={`${inputClass} mt-1.5`} style={inputStyle} inputMode="decimal"
                    value={adding.line_amount} onChange={e => setAdding({ ...adding, line_amount: e.target.value })} />
                </label>
              </>
            )}
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>How often</span>
              <select className={`${inputClass} mt-1.5`} style={inputStyle} value={adding.cadence}
                onChange={e => setAdding({ ...adding, cadence: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Day of the month</span>
              <input type="number" min={1} max={31} className={`${inputClass} mt-1.5`} style={inputStyle}
                value={adding.day_of_month} onChange={e => setAdding({ ...adding, day_of_month: e.target.value })} />
              <span className="block mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                The anniversary of when they signed up. The 31st bills on the 28th, 29th or 30th in months that are short.
              </span>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Draft this many days early</span>
              <input type="number" min={0} max={60} className={`${inputClass} mt-1.5`} style={inputStyle}
                value={adding.lead_days} onChange={e => setAdding({ ...adding, lead_days: e.target.value })} />
              <span className="block mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Billing is in advance, so the invoice needs to be out and paid before the period starts.
              </span>
            </label>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={createSchedule} disabled={busy === 'new' || !adding.name.trim() || !adding.client_id}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Create
            </button>
          </div>
        </Section>
      )}

      {/* ── The schedules ─────────────────────────────────────────────── */}
      <Section title="Schedules" sub={`${schedules.filter(s => s.active).length} active`}>
        {schedules.length === 0 ? (
          <Empty>No schedules yet. Add one for each client you bill on a cycle.</Empty>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', opacity: s.active ? 1 : 0.55 }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm text-white font-semibold">{s.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {s.client_name} · {s.cadence} on the {s.day_of_month}
                      {s.source === 'seats'
                        ? ` · ${s.seats_now ?? '?'} seats at ${money(s.seat_price_cents)}`
                        : ' · fixed amount'}
                    </p>
                  </div>
                  <div className="text-right w-32">
                    <p className="text-sm font-bold text-white">{money(s.next_amount_cents)}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>next {fmtDate(s.next_run_on)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => patch(s.id, { skip: true }, 'Skipped one cycle')} title="Skip one cycle"
                      className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <SkipForward className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                    </button>
                    <button onClick={() => patch(s.id, { active: !s.active }, s.active ? 'Paused' : 'Resumed')}
                      title={s.active ? 'Pause' : 'Resume'}
                      className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {s.active
                        ? <Pause className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                        : <Play className="w-4 h-4" style={{ color: '#22c55e' }} />}
                    </button>
                    <button onClick={() => remove(s)} title="Delete"
                      className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
                {s.seats_changed && (
                  <div className="flex items-start gap-2 mt-2 text-xs" style={{ color: '#f59e0b' }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Seats have moved to {s.seats_now} and this has not been accounted for yet.
                      Press Check now: an increase raises a pro-rata draft for the rest of this month,
                      a decrease is recorded without a refund, and either way next month bills {s.seats_now}.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
