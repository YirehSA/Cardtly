'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Phone, Search, X, PhoneCall, CalendarClock, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { shiftAnchor, periodLabel, type CalendarView } from '@/lib/calendar'
import {
  CALL_OUTCOMES, callOutcomeMeta, summariseCalls, dueCallbacks, filterCalls,
  withinCallRange, callRange, dayKey,
  type LoggedCall, type CallOutcome,
} from '@/lib/rep-calls'
import { Pill, useMounted, useNow, inputClass, inputStyle } from '@/components/calendar/shared'
import CallForm, { blankCall, callFormFrom, callToBody, type CallFormState } from './CallForm'

// The call log, shared by the rep's own page and the admin panel.
//
// A list, not a grid. Meetings get a calendar because you plan them; calls get
// a list because you have already made them and what you want is "who did I
// ring, what came of it, who is owed a call back".

/** The windows come from callRange, not the calendar's viewRange: a month here
 *  means the month, not the six-week page a month grid is drawn on. 'list' is
 *  every call ever. The type is the calendar's, so shiftAnchor and periodLabel
 *  can be reused as they are. */
const PERIODS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'list', label: 'All' },
]

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
  // Month by default: wide enough to be worth looking at, narrow enough that a
  // year of calls is not rendered to answer "how did this week go".
  const [period, setPeriod] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [form, setForm] = useState<CallFormState | null>(null)
  const [busy, setBusy] = useState(false)

  const scoped = useMemo(
    () => (repId ? calls.filter(c => c.rep_id === repId) : calls),
    [calls, repId])

  const range = callRange(period as any, anchor)
  const inPeriod = useMemo(
    () => (range ? withinCallRange(scoped, range.from, range.to) : scoped),
    [scoped, range?.from?.getTime(), range?.to?.getTime()])

  const shown = useMemo(() => filterCalls(inPeriod, search, outcome), [inPeriod, search, outcome])
  const stats = useMemo(() => summariseCalls(shown), [shown])
  // Deliberately off the WHOLE log, not the period. Somebody owed a call back
  // is owed it whichever month you happen to be looking at.
  const due = useMemo(() => dueCallbacks(scoped, now), [scoped, now])
  const today = useMemo(
    () => scoped.filter(c => dayKey(new Date(c.called_at)) === dayKey(now)),
    [scoped, now])

  // Matches the search but sits outside the period on screen. Without this, a
  // call from March looks exactly like a call that was never logged.
  const outside = range ? filterCalls(scoped, search, outcome).length - shown.length : 0

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
      {/* What the period adds up to. Dials are effort, conversations are
          progress, and one without the other tells you nothing. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Calls today" value={String(today.length)} />
        <Stat label="In this view" value={String(stats.total)} />
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

      {/* Period, then search, then the add button. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--cal-border)' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className="px-3 min-h-[44px] text-sm font-semibold transition"
              style={{
                background: period === p.id ? '#0ea5e91f' : 'transparent',
                color: period === p.id ? '#0ea5e9' : 'var(--cal-muted)',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {range && (
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor(a => shiftAnchor(period, a, -1))} aria-label="Previous"
              className="w-11 h-11 rounded-xl grid place-items-center" style={{ border: '1px solid var(--cal-border)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setAnchor(new Date())}
              className="px-3 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap"
              style={{ border: '1px solid var(--cal-border)' }}>
              {periodLabel(period, anchor)}
            </button>
            <button onClick={() => setAnchor(a => shiftAnchor(period, a, 1))} aria-label="Next"
              className="w-11 h-11 rounded-xl grid place-items-center" style={{ border: '1px solid var(--cal-border)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {canWrite && (
          <button onClick={() => setForm(blankCall(repId || ''))}
            className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 flex-shrink-0 ml-auto"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Plus className="w-4 h-4" />Log a call
          </button>
        )}
      </div>

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
        {/* min-w-[150px] rather than shrink-to-fit: sharing the row squeezed
            this down to its chevron, and a filter you cannot read is a filter
            nobody uses. With a floor it wraps to its own line instead. */}
        <select value={outcome || ''} onChange={e => setOutcome((e.target.value || null) as CallOutcome | null)}
          className={`${inputClass} flex-1 min-w-[150px]`} style={inputStyle}>
          <option value="">Every outcome</option>
          {CALL_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {outside > 0 && (
        <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>
          {outside} more {outside === 1 ? 'call matches' : 'calls match'} outside this period. Switch to All to see {outside === 1 ? 'it' : 'them'}.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--cal-border)' }}>
          <Phone className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--cal-muted)' }} />
          <p className="font-semibold mb-1">
            {scoped.length === 0 ? 'No calls logged yet' : 'Nothing in this view'}
          </p>
          <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
            {scoped.length === 0
              ? 'Log one the moment you put the phone down and the follow-ups look after themselves.'
              : 'Try another period, fewer words, or a different outcome.'}
          </p>
        </div>
      ) : (
        <>
          {/* A real table from sm up: company, name and number are three things
              you scan down, not one line to read across. Below sm there is no
              room for seven columns, so the same fields stack with their own
              labels rather than running together behind a bullet. */}
          <div className="hidden sm:block rounded-2xl border overflow-x-auto"
            style={{ borderColor: 'var(--cal-border)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cal-raised)' }}>
                  <Th>Company</Th><Th>Name</Th><Th>Number</Th><Th>Email</Th>
                  <Th>Outcome</Th><Th>When</Th><Th>Call back</Th><Th>Notes</Th>
                  {reps && <Th>Rep</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map(c => {
                  const meta = callOutcomeMeta(c.outcome)
                  const overdue = !!c.follow_up_on && c.follow_up_on <= dayKey(now)
                  return (
                    <tr key={c.id}
                      onClick={() => canWrite && setForm(callFormFrom(c))}
                      className={canWrite ? 'cursor-pointer transition hover:opacity-80' : ''}
                      style={{ borderTop: '1px solid var(--cal-border)' }}>
                      <Td bold>{c.company}</Td>
                      <Td muted={!c.contact_name}>{c.contact_name || '-'}</Td>
                      <Td muted={!c.phone}>
                        {c.phone
                          ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                              className="hover:underline">{c.phone}</a>
                          : '-'}
                      </Td>
                      <Td muted={!c.email}>
                        {c.email
                          ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                              className="hover:underline">{c.email}</a>
                          : '-'}
                      </Td>
                      <Td><Pill label={meta.label} colour={meta.colour} /></Td>
                      <Td muted>{when(c.called_at)}</Td>
                      <Td>
                        {c.follow_up_on
                          ? <span style={{ color: overdue ? '#f59e0b' : '#0ea5e9', fontWeight: 600 }}>
                              {overdue ? 'Due' : c.follow_up_on}
                            </span>
                          : <span style={{ color: 'var(--cal-muted)' }}>-</span>}
                      </Td>
                      <Td muted title={c.notes || ''}>
                        <span className="line-clamp-2 max-w-[22ch] inline-block align-top">{c.notes || '-'}</span>
                      </Td>
                      {reps && <Td muted>{c.repName || '-'}</Td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="sm:hidden space-y-2">
            {shown.map(c => {
              const meta = callOutcomeMeta(c.outcome)
              const overdue = !!c.follow_up_on && c.follow_up_on <= dayKey(now)
              return (
                <li key={c.id}>
                  <button onClick={() => canWrite && setForm(callFormFrom(c))} disabled={!canWrite}
                    className="w-full text-left rounded-2xl border p-3 space-y-1.5 disabled:cursor-default"
                    style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0"
                        style={{ background: meta.colour + '22', color: meta.colour }}>
                        <PhoneCall className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{c.company}</p>
                        <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>{when(c.called_at)}</p>
                      </div>
                      <Pill label={meta.label} colour={meta.colour} />
                    </div>
                    <Row label="Name" value={c.contact_name} />
                    <Row label="Number" value={c.phone} />
                    <Row label="Email" value={c.email} />
                    <Row label="Notes" value={c.notes} />
                    {c.repName && <Row label="Rep" value={c.repName} />}
                    {c.follow_up_on && (
                      <Row label="Call back"
                        value={overdue ? 'Due now' : c.follow_up_on}
                        tone={overdue ? '#f59e0b' : '#0ea5e9'} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap"
      style={{ color: 'var(--cal-muted)' }}>{children}</th>
  )
}

function Td({ children, bold, muted, title }: {
  children: React.ReactNode; bold?: boolean; muted?: boolean; title?: string
}) {
  return (
    <td className="px-3 py-2 align-top" title={title}
      style={{ fontWeight: bold ? 600 : 400, color: muted ? 'var(--cal-muted)' : 'var(--cal-text)' }}>
      {children}
    </td>
  )
}

/** One labelled line on a phone, where the table cannot go. */
function Row({ label, value, tone }: { label: string; value?: string | null; tone?: string }) {
  if (!value) return null
  return (
    <p className="text-sm flex gap-2">
      <span className="flex-shrink-0 w-[68px]" style={{ color: 'var(--cal-muted)' }}>{label}</span>
      <span className="min-w-0 flex-1" style={{ color: tone || 'var(--cal-text)', fontWeight: tone ? 600 : 400 }}>{value}</span>
    </p>
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
