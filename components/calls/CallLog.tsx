'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Phone, Search, X, PhoneCall, CalendarClock, Loader2 } from 'lucide-react'
import {
  CALL_OUTCOMES, callOutcomeMeta, summariseCalls, dueCallbacks, filterCalls, dayKey,
  type LoggedCall, type CallOutcome,
} from '@/lib/rep-calls'
import { Pill, useMounted, useNow, inputClass, inputStyle } from '@/components/calendar/shared'
import CallForm, { blankCall, callFormFrom, callToBody, type CallFormState } from './CallForm'

// The call log, shared by the rep's own page and the admin panel.
//
// A list, not a grid. Meetings get a calendar because you plan them; calls get
// a list because you have already made them and what you want is "who did I
// ring, what came of it, who is owed a call back".

export default function CallLog({
  calls: initial, endpoint, skin, reps, repId, canWrite = true,
}: {
  calls: LoggedCall[]
  /** '/api/rep/calls' or '/api/admin/calls'. */
  endpoint: string
  skin: React.CSSProperties
  /** Admin only: lets a call be filed against any rep. */
  reps?: { id: string; name: string }[] | null
  /** Admin only: which rep the log is filtered to, or null for everyone. */
  repId?: string | null
  canWrite?: boolean
}) {
  const mounted = useMounted()
  const now = useNow()

  const [calls, setCalls] = useState<LoggedCall[]>(initial)
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [form, setForm] = useState<CallFormState | null>(null)
  const [busy, setBusy] = useState(false)

  const scoped = useMemo(
    () => (repId ? calls.filter(c => c.rep_id === repId) : calls),
    [calls, repId])
  const shown = useMemo(() => filterCalls(scoped, search, outcome), [scoped, search, outcome])
  const stats = useMemo(() => summariseCalls(shown), [shown])
  const due = useMemo(() => dueCallbacks(scoped, now), [scoped, now])
  const today = useMemo(
    () => scoped.filter(c => dayKey(new Date(c.called_at)) === dayKey(now)),
    [scoped, now])

  async function refresh() {
    const data = await fetch(endpoint).then(r => r.json()).catch(() => null)
    if (data?.calls) setCalls(data.calls)
    else if (data?.error) toast.error(data.error, { duration: 8000 })
  }

  async function post(body: Record<string, any>, okMsg: string) {
    setBusy(true)
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return false }
    toast.success(okMsg)
    await refresh()
    setForm(null)
    return true
  }

  if (!mounted) {
    return <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--cal-raised)' }} aria-hidden />
  }

  return (
    <div className="space-y-4" style={skin}>
      {/* What the day and the filter add up to. Dials are effort, conversations
          are progress, and one without the other tells you nothing. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Calls today" value={String(today.length)} />
        <Stat label="In this list" value={String(stats.total)} />
        <Stat label="Reached" value={stats.connectRate === null ? '-' : `${stats.reached} · ${stats.connectRate}%`} />
        <Stat label="Meetings booked" value={String(stats.meetings)} tone="#7c3aed" />
      </div>

      {due.length > 0 && (
        <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ borderColor: '#0ea5e955', background: '#0ea5e90f' }}>
          <CalendarClock className="w-4 h-4 flex-shrink-0" style={{ color: '#0ea5e9' }} />
          <p className="text-sm flex-1 min-w-[200px]">
            <strong>{due.length} due to call back.</strong>{' '}
            <span style={{ color: 'var(--cal-muted)' }}>
              {due.slice(0, 3).map(c => c.company).join(', ')}{due.length > 3 ? ` and ${due.length - 3} more` : ''}
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--cal-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Company, name, number, notes"
            className={`${inputClass} pl-9`} style={inputStyle} />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center">
              <X className="w-3.5 h-3.5" style={{ color: 'var(--cal-muted)' }} />
            </button>
          )}
        </div>
        {/* min-w-[150px] rather than shrink-to-fit. Sharing the row three ways
            on a phone squeezed this down to its chevron - a filter you cannot
            read is a filter nobody uses. With a floor it wraps to its own line
            instead. */}
        <select value={outcome || ''} onChange={e => setOutcome((e.target.value || null) as CallOutcome | null)}
          className={`${inputClass} flex-1 min-w-[150px]`} style={inputStyle}>
          <option value="">Every outcome</option>
          {CALL_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {canWrite && (
          <button onClick={() => setForm(blankCall(repId || ''))}
            className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Plus className="w-4 h-4" />Log a call
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--cal-border)' }}>
          <Phone className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--cal-muted)' }} />
          <p className="font-semibold mb-1">
            {scoped.length === 0 ? 'No calls logged yet' : 'Nothing matches that'}
          </p>
          <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
            {scoped.length === 0
              ? 'Log one the moment you put the phone down and the follow-ups look after themselves.'
              : 'Try fewer words, or a different outcome.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map(c => {
            const meta = callOutcomeMeta(c.outcome)
            const overdue = !!c.follow_up_on && c.follow_up_on <= dayKey(now)
            return (
              <li key={c.id}>
                <button onClick={() => canWrite && setForm(callFormFrom(c))}
                  disabled={!canWrite}
                  className="w-full text-left rounded-2xl border p-3 transition hover:opacity-90 disabled:cursor-default"
                  style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0"
                      style={{ background: meta.colour + '22', color: meta.colour }}>
                      <PhoneCall className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold truncate">{c.company}</p>
                        <Pill label={meta.label} colour={meta.colour} />
                        {c.repName && <Pill label={c.repName} colour="#94a3b8" />}
                      </div>
                      <p className="text-sm truncate" style={{ color: 'var(--cal-muted)' }}>
                        {[c.contact_name, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
                      </p>
                      {c.notes && (
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--cal-muted)' }}>{c.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>{when(c.called_at)}</p>
                      {c.follow_up_on && (
                        <p className="text-xs mt-1 font-semibold" style={{ color: overdue ? '#f59e0b' : '#0ea5e9' }}>
                          {overdue ? 'Call back due' : `Call back ${c.follow_up_on}`}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {form && (
        <CallForm
          form={form} setForm={setForm as any} busy={busy} skin={skin} reps={reps}
          onClose={() => setForm(null)}
          onSave={() => post(callToBody(form), form.id ? 'Call updated' : 'Call logged')}
          onDelete={form.id
            ? () => {
                if (!confirm('Delete this call?\n\nThe note goes with it.')) return
                post({ action: 'delete', id: form.id, rep_id: form.repId || undefined }, 'Call deleted')
              }
            : undefined}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
      <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: tone || 'var(--cal-text)' }}>{value}</p>
    </div>
  )
}

/** Today and yesterday by name, anything older by date. A log is read from the
 *  top, and "today 14:20" is what a rep is actually looking for. */
function when(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = dayKey(new Date())
  const key = dayKey(d)
  if (key === today) return `Today ${time}`
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (key === dayKey(y)) return `Yesterday ${time}`
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} ${time}`
}
