'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Plus, AlertTriangle, ArrowRight, Users } from 'lucide-react'
import {
  startOfDay, viewRange, shiftAnchor, periodLabel, repColour, type CalendarView,
} from '@/lib/calendar'
import {
  applyFilter, withinRange, summarise, sortForList, EMPTY_FILTER,
  type MeetingFilterState,
} from '@/lib/meeting-filters'
import type { CalendarMeeting, MeetingStatus, MeetingOutcome } from '@/lib/rep-meetings'
import MeetingCalendar from '@/components/calendar/MeetingCalendar'
import MeetingList from '@/components/calendar/MeetingList'
import MeetingDetail from '@/components/calendar/MeetingDetail'
import MeetingForm, {
  blankForm, formFromMeeting, formToBody, formError, type MeetingFormState,
} from '@/components/calendar/MeetingForm'
import MeetingFilterBar from '@/components/calendar/MeetingFilterBar'
import MeetingStats from '@/components/calendar/MeetingStats'
import CalendarToolbar from '@/components/calendar/CalendarToolbar'
import { ADMIN_SKIN, GRAD, useMounted, useNow, CalendarSkeleton } from '@/components/calendar/shared'

// Every rep's diary on one calendar, or any one rep's on its own.
//
// The same components as the rep's own page, on the admin skin. The differences
// are all here: a rep selector, colour by rep rather than by status, a
// leaderboard, and writes that have to name whose meeting they are.

export interface MeetingsTabRep {
  id: string
  name: string
  active: boolean
}

export default function MeetingsTab({ initial, reps, initialRepId }: {
  initial: CalendarMeeting[]
  reps: MeetingsTabRep[]
  /** Set when the admin arrived here from a rep's row, so the calendar opens on
   *  that rep rather than on everyone. */
  initialRepId?: string | null
}) {
  const mounted = useMounted()
  const now = useNow()

  const [meetings, setMeetings] = useState<CalendarMeeting[]>(initial)
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<MeetingFilterState>(
    () => (initialRepId ? { ...EMPTY_FILTER, repIds: [initialRepId] } : EMPTY_FILTER))
  const [form, setForm] = useState<MeetingFormState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = selectedId ? meetings.find(m => m.id === selectedId) || null : null

  const filtered = useMemo(() => applyFilter(meetings, filter, now), [meetings, filter, now])
  const range = viewRange(view, anchor)
  const inRange = useMemo(
    () => (range ? withinRange(filtered, range.from, range.to) : filtered),
    [filtered, range?.from?.getTime(), range?.to?.getTime()])

  const shown = view === 'list' ? sortForList(filtered, now) : inRange
  const periodSummary = useMemo(() => summarise(shown, now), [shown, now])
  const allSummary = useMemo(() => summarise(filtered, now), [filtered, now])
  const outside = view === 'list' ? 0 : filtered.length - inRange.length

  // One rep selected means their colour carries no information, so status is the
  // more useful thing to see. Several, or all, and colour tells you whose it is.
  const oneRep = filter.repIds.length === 1 ? filter.repIds[0] : null
  const colourBy = oneRep ? 'status' : 'rep'

  // The whole period, per rep, whether or not that rep is currently selected -
  // so the board is a comparison rather than a view of the selection.
  const board = useMemo(() => {
    const byRep = applyFilter(meetings, { ...filter, repIds: [] }, now)
    const scoped = range ? withinRange(byRep, range.from, range.to) : byRep
    return reps.map(r => ({
      rep: r,
      summary: summarise(scoped.filter(m => m.rep_id === r.id), now),
    })).sort((a, b) => b.summary.total - a.summary.total || a.rep.name.localeCompare(b.rep.name))
  }, [meetings, filter, reps, now, range?.from?.getTime(), range?.to?.getTime()])

  async function refresh() {
    const fresh = await fetch('/api/admin/meetings').then(r => r.json()).catch(() => null)
    if (fresh?.meetings) {
      const nameById = Object.fromEntries(reps.map(r => [r.id, r.name]))
      setMeetings((fresh.meetings as CalendarMeeting[]).map(m => ({ ...m, repName: nameById[m.rep_id] || null })))
    } else if (fresh?.error) {
      toast.error(fresh.error, { duration: 8000 })
    }
  }

  async function post(body: Record<string, any>, key: string, okMsg: string): Promise<boolean> {
    setBusy(key)
    const res = await fetch('/api/admin/meetings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) {
      toast.error(data?.error || 'Could not save that', { duration: 8000 })
      return false
    }
    if (data?.warning) toast.warning(data.warning, { duration: 10000 })
    else toast.success(okMsg)
    await refresh()
    return true
  }

  const openNew = useCallback((when?: Date) => {
    // Prefilled when exactly one rep is in view, because then there is no
    // question whose meeting it is. Otherwise the form asks.
    setForm(blankForm(when, filter.repIds.length === 1 ? filter.repIds[0] : ''))
  }, [filter.repIds])

  async function save() {
    if (!form) return
    const problem = formError(form, true)
    if (problem) { toast.error(problem); return }
    const ok = await post(formToBody(form), 'save', form.id ? 'Meeting updated' : 'Meeting added')
    if (ok) setForm(null)
  }

  async function remove(m: CalendarMeeting) {
    if (!confirm(`Delete the ${m.company} meeting from ${m.repName || 'this rep'}'s diary?\n\nThe notes go with it.`)) return
    const ok = await post({ action: 'delete', id: m.id, rep_id: m.rep_id }, `del-${m.id}`, 'Meeting deleted')
    if (ok) setSelectedId(null)
  }

  async function quickStatus(m: CalendarMeeting, status: MeetingStatus) {
    const body: Record<string, any> = { ...formToBody(formFromMeeting(m)), status, rep_id: m.rep_id }
    if (status === 'planned') body.outcome = null
    await post(body, `status-${m.id}`, 'Updated')
  }

  async function quickOutcome(m: CalendarMeeting, outcome: MeetingOutcome) {
    const status: MeetingStatus = m.status === 'planned' ? 'done' : m.status
    await post({ ...formToBody(formFromMeeting(m)), status, outcome, rep_id: m.rep_id }, `outcome-${m.id}`, 'Updated')
  }

  /** Applied from a tile keeps whichever rep is selected: an admin narrowing to
   *  one rep and then clicking "no shows" means that rep's no-shows. */
  const applyFrom = useCallback((patch: Partial<MeetingFilterState>) => {
    setFilter(f => ({ ...EMPTY_FILTER, repIds: f.repIds, ...patch }))
    setView('list')
    setSelectedDay(null)
  }, [])

  const goToday = useCallback(() => {
    setAnchor(new Date())
    setSelectedDay(startOfDay(new Date()))
  }, [])

  const openDay = useCallback((d: Date) => {
    setAnchor(d)
    setSelectedDay(startOfDay(d))
    setView('day')
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (el?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (form) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return }
      if (e.key === 'Escape' && selectedId) { setSelectedId(null); return }
      if (selected) return
      if (e.key === 'ArrowLeft') { setAnchor(a => shiftAnchor(view, a, -1)); return }
      if (e.key === 'ArrowRight') { setAnchor(a => shiftAnchor(view, a, 1)); return }
      const k = e.key.toLowerCase()
      if (k === 't') { goToday(); return }
      if (k === 'm') { setView('month'); return }
      if (k === 'w') { setView('week'); return }
      if (k === 'd') { setView('day'); return }
      if (k === 'l') { setView('list'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, form, selected, selectedId, goToday])

  if (!mounted) return <div style={ADMIN_SKIN}><CalendarSkeleton /></div>

  const chase = allSummary.needsOutcome + allSummary.followUpsDue

  return (
    <div style={ADMIN_SKIN} className="space-y-4">
      {/* Whose calendar */}
      <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
            style={{ background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.3)' }}>
            <CalendarClock className="w-4 h-4" style={{ color: '#0ea5e9' }} />
          </div>
          <div className="flex-1 min-w-[170px]">
            <h2 className="font-bold text-white">Meetings calendar</h2>
            <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>
              {meetings.length} logged across {reps.length} rep{reps.length === 1 ? '' : 's'}
              {oneRep ? ' · showing one' : filter.repIds.length > 1 ? ` · showing ${filter.repIds.length}` : ' · showing everyone'}
            </p>
          </div>
          <button onClick={() => openNew()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: GRAD }}>
            <Plus className="w-3 h-3" />Book for a rep
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter(f => ({ ...f, repIds: [] }))}
            aria-pressed={filter.repIds.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
            style={filter.repIds.length === 0
              ? { background: 'rgba(124,58,237,0.25)', color: '#fff', border: '1px solid #7c3aed' }
              : { background: 'var(--cal-raised)', color: 'var(--cal-muted)', border: '1px solid transparent' }}>
            <Users className="w-3 h-3" />All reps
          </button>
          {reps.map(r => {
            const on = filter.repIds.includes(r.id)
            const colour = repColour(r.id)
            const count = meetings.filter(m => m.rep_id === r.id).length
            return (
              <button key={r.id}
                onClick={() => setFilter(f => ({
                  ...f,
                  repIds: f.repIds.includes(r.id) ? f.repIds.filter(x => x !== r.id) : [...f.repIds, r.id],
                }))}
                aria-pressed={on}
                title={`${r.name}${r.active ? '' : ' (inactive)'} · ${count} meeting${count === 1 ? '' : 's'}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                style={on
                  ? { background: colour + '2b', color: colour, border: `1px solid ${colour}` }
                  : { background: 'var(--cal-raised)', color: 'var(--cal-muted)', border: '1px solid transparent' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />
                {r.name}
                {!r.active && <span style={{ opacity: 0.6 }}>(off)</span>}
                <span className="tabular-nums" style={{ opacity: 0.7 }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {chase > 0 && (
        <div className="rounded-2xl px-3.5 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.32)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-xs flex-1 min-w-[180px]" style={{ color: '#f59e0b' }}>
            {allSummary.needsOutcome > 0 && <>{allSummary.needsOutcome} never written up</>}
            {allSummary.needsOutcome > 0 && allSummary.followUpsDue > 0 && ' · '}
            {allSummary.followUpsDue > 0 && <>{allSummary.followUpsDue} follow-up{allSummary.followUpsDue === 1 ? '' : 's'} due</>}
          </p>
          {allSummary.needsOutcome > 0 && (
            <button onClick={() => applyFrom({ overdueOnly: true })}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b' }}>
              Show them
            </button>
          )}
          {allSummary.followUpsDue > 0 && (
            <button onClick={() => applyFrom({ outcomes: ['follow_up'] })}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ border: '1px solid rgba(236,72,153,0.5)', color: '#ec4899' }}>
              Follow-ups
            </button>
          )}
        </div>
      )}

      <MeetingStats
        summary={periodSummary}
        onFilter={applyFrom}
        scope={view === 'list' ? 'Everything that matches' : periodLabel(view, anchor)}
      />

      <MeetingFilterBar
        filter={filter}
        onChange={setFilter}
        searchRef={searchRef}
        hits={filtered.length}
        total={meetings.length}
      />

      <CalendarToolbar
        view={view}
        anchor={anchor}
        onView={setView}
        onShift={d => setAnchor(a => shiftAnchor(view, a, d))}
        onToday={goToday}
      />

      {outside > 0 && (
        <button onClick={() => setView('list')}
          className="w-full text-left text-xs rounded-xl px-3 py-2.5 flex items-center gap-2 transition hover:brightness-125"
          style={{ background: 'var(--cal-raised)', border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
          <span className="font-semibold">{outside} more match{outside === 1 ? '' : 'es'} outside {periodLabel(view, anchor)}</span>
          <span style={{ color: 'var(--cal-muted)' }}>see them all in the list</span>
          <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0" />
        </button>
      )}

      {view === 'list' ? (
        <MeetingList
          meetings={shown}
          now={now}
          colourBy={colourBy}
          selectedId={selectedId}
          onSelect={m => setSelectedId(m.id)}
          note={`Every meeting that matches, whatever month it is in · ${shown.length} shown`}
        />
      ) : (
        <MeetingCalendar
          meetings={filtered}
          view={view}
          anchor={anchor}
          now={now}
          selectedId={selectedId}
          selectedDay={selectedDay}
          colourBy={colourBy}
          onSelectMeeting={m => setSelectedId(m.id)}
          onSelectDay={d => setSelectedDay(startOfDay(d))}
          onOpenDay={openDay}
          onCreateAt={openNew}
        />
      )}

      {/* Side by side over whatever period is on screen. */}
      {reps.length > 1 && (
        <div className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
          <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--cal-muted)', borderBottom: '1px solid var(--cal-grid)' }}>
            By rep · {view === 'list' ? 'all time' : periodLabel(view, anchor)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 520 }}>
              <thead>
                <tr style={{ color: 'var(--cal-muted)' }}>
                  <th className="text-left font-semibold px-3.5 py-2">Rep</th>
                  <th className="text-right font-semibold px-2 py-2">Booked</th>
                  <th className="text-right font-semibold px-2 py-2">Happened</th>
                  <th className="text-right font-semibold px-2 py-2">No show</th>
                  <th className="text-right font-semibold px-2 py-2">Signed</th>
                  <th className="text-right font-semibold px-2 py-2">Close</th>
                  <th className="text-right font-semibold px-3.5 py-2">To write up</th>
                </tr>
              </thead>
              <tbody>
                {board.map(({ rep, summary }) => (
                  <tr key={rep.id} className="transition hover:brightness-125 cursor-pointer"
                    onClick={() => setFilter(f => ({ ...f, repIds: [rep.id] }))}
                    title={`Show only ${rep.name}`}
                    style={{ borderTop: '1px solid var(--cal-grid)' }}>
                    <td className="px-3.5 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: repColour(rep.id) }} />
                        <span className="font-semibold" style={{ color: 'var(--cal-text)' }}>{rep.name}</span>
                        {!rep.active && <span style={{ color: 'var(--cal-muted)' }}>inactive</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--cal-text)' }}>{summary.total}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: '#22c55e' }}>{summary.done}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: summary.noShow ? '#f59e0b' : 'var(--cal-muted)' }}>{summary.noShow}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: '#22c55e' }}>{summary.signed}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: '#a855f7' }}>
                      {summary.closeRate === null ? '-' : `${summary.closeRate}%`}
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums"
                      style={{ color: summary.needsOutcome ? '#f59e0b' : 'var(--cal-muted)' }}>
                      {summary.needsOutcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <MeetingDetail
          meeting={selected}
          now={now}
          canEdit
          busy={busy}
          skin={ADMIN_SKIN}
          onClose={() => setSelectedId(null)}
          onEdit={m => { setForm(formFromMeeting(m)); setSelectedId(null) }}
          onDelete={remove}
          onQuickStatus={quickStatus}
          onQuickOutcome={quickOutcome}
        />
      )}

      {form && (
        <MeetingForm
          form={form}
          setForm={f => setForm(prev => (typeof f === 'function' ? (f as (p: MeetingFormState) => MeetingFormState)(prev!) : f))}
          busy={busy === 'save'}
          skin={ADMIN_SKIN}
          reps={reps.map(r => ({ id: r.id, name: r.active ? r.name : `${r.name} (inactive)` }))}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
