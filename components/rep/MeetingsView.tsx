'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock, Plus, CalendarPlus, AlertTriangle, ArrowRight,
} from 'lucide-react'
import {
  startOfDay, viewRange, shiftAnchor, periodLabel, type CalendarView,
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
import { APP_SKIN, GRAD, useMounted, useNow, CalendarSkeleton } from '@/components/calendar/shared'

// A rep's own diary.
//
// Month, week, day and list over the same data, all held client side: a rep has
// hundreds of meetings, not millions, so changing month is a re-slice rather
// than a round trip and the whole thing stays instant on a phone in a car park.

export default function MeetingsView({ repName, active, initial }: {
  repName: string
  active: boolean
  initial: CalendarMeeting[]
}) {
  const mounted = useMounted()
  const now = useNow()

  const [meetings, setMeetings] = useState<CalendarMeeting[]>(initial)
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<MeetingFilterState>(EMPTY_FILTER)
  const [form, setForm] = useState<MeetingFormState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Derived from the list rather than held as a copy, so a quick "Happened" tap
  // is reflected in the open panel without a second piece of state to keep in
  // step. Deliberately off the UNFILTERED list: narrowing the filter should not
  // slam the panel shut on what you were reading.
  const selected = selectedId ? meetings.find(m => m.id === selectedId) || null : null

  const filtered = useMemo(() => applyFilter(meetings, filter, now), [meetings, filter, now])
  const range = viewRange(view, anchor)
  const inRange = useMemo(
    () => (range ? withinRange(filtered, range.from, range.to) : filtered),
    [filtered, range?.from?.getTime(), range?.to?.getTime()])

  const shown = view === 'list' ? sortForList(filtered, now) : inRange
  const periodSummary = useMemo(() => summarise(shown, now), [shown, now])
  const allSummary = useMemo(() => summarise(filtered, now), [filtered, now])

  // Matches the filter but sits outside the month on screen. Without this, a
  // search for a client seen in March looks exactly like a client who does not
  // exist.
  const outside = view === 'list' ? 0 : filtered.length - inRange.length

  async function refresh() {
    const fresh = await fetch('/api/rep/meetings').then(r => r.json()).catch(() => null)
    if (fresh?.meetings) setMeetings(fresh.meetings as CalendarMeeting[])
    else if (fresh?.error) toast.error(fresh.error, { duration: 8000 })
  }

  async function post(body: Record<string, any>, key: string, okMsg: string): Promise<boolean> {
    setBusy(key)
    const res = await fetch('/api/rep/meetings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) {
      toast.error(data?.error || 'Could not save that', { duration: 8000 })
      return false
    }
    // Said out loud: the meeting saved but the newer fields could not, because
    // the migration has not been run yet.
    if (data?.warning) toast.warning(data.warning, { duration: 10000 })
    // Who was emailed, under the confirmation. A rep who is not told assumes
    // their client was written to and finds out otherwise at the meeting.
    else toast.success(okMsg, data?.notified ? { description: data.notified, duration: 8000 } : undefined)
    await refresh()
    return true
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const openNew = useCallback((when?: Date) => {
    if (!active) return
    setForm(blankForm(when))
  }, [active])

  async function save() {
    if (!form) return
    const problem = formError(form, false)
    if (problem) { toast.error(problem); return }
    const ok = await post(formToBody(form), 'save', form.id ? 'Meeting updated' : 'Meeting added')
    if (ok) setForm(null)
  }

  async function remove(m: CalendarMeeting) {
    if (!confirm(`Delete the ${m.company} meeting?\n\nThe notes go with it.`)) return
    const ok = await post({ action: 'delete', id: m.id }, `del-${m.id}`, 'Meeting deleted')
    if (ok) setSelectedId(null)
  }

  // Two taps to write a meeting up, from the panel, without opening the form.
  async function quickStatus(m: CalendarMeeting, status: MeetingStatus) {
    const body: Record<string, any> = { ...formToBody(formFromMeeting(m)), status }
    if (status === 'planned') body.outcome = null
    await post(body, `status-${m.id}`, 'Updated')
  }

  async function quickOutcome(m: CalendarMeeting, outcome: MeetingOutcome) {
    // An outcome only exists on a meeting that took place, so recording one on
    // something still marked planned marks it done at the same time - otherwise
    // the server would drop the outcome and the tap would appear to do nothing.
    const status: MeetingStatus = m.status === 'planned' ? 'done' : m.status
    await post({ ...formToBody(formFromMeeting(m)), status, outcome }, `outcome-${m.id}`, 'Updated')
  }

  /** Anything applied from a tile or a banner also switches to the list.
   *  Otherwise you click "3 need an outcome", the month on screen holds none of
   *  them, and the honest answer looks like a broken button. */
  const applyFrom = useCallback((patch: Partial<MeetingFilterState>) => {
    setFilter({ ...EMPTY_FILTER, ...patch })
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

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never steal a key from something being typed into, and never fight a
      // modal that has its own Escape handling.
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
      if (k === 'n' && active) { e.preventDefault(); openNew(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, form, selected, selectedId, active, goToday, openNew])

  // Every time on this page is drawn in the reader's timezone, which the server
  // does not share. See useMounted.
  if (!mounted) {
    return <div style={APP_SKIN} className="max-w-5xl mx-auto"><CalendarSkeleton /></div>
  }

  const chase = allSummary.needsOutcome + allSummary.followUpsDue

  return (
    <div style={APP_SKIN} className="max-w-5xl mx-auto space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-5 sm:p-7" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.14), transparent 65%)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-11 h-11 rounded-lg grid place-items-center text-white shrink-0" style={{ background: GRAD }}>
              <CalendarClock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-[190px]">
              <h1 className="font-display text-2xl font-bold leading-tight">My meetings</h1>
              <p className="text-muted-foreground text-sm">
                {repName} · {allSummary.upcoming} coming up · {meetings.length} logged
              </p>
            </div>
            <div className="flex items-center gap-2">
              {meetings.length > 0 && (
                <a href="/api/rep/meetings/ics" download
                  title="Download every meeting for Google Calendar, Outlook or your phone"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold border border-border transition hover:bg-muted">
                  <CalendarPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </a>
              )}
              {active && (
                <button onClick={() => openNew()}
                  title="New meeting (N)"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: GRAD }}>
                  <Plus className="w-4 h-4" />New meeting
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {!active && (
        <p className="text-xs rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
          This rep account is marked inactive, so you can read your meetings but not add to them.
        </p>
      )}

      {/* The pile worth chasing, wherever in the calendar it happens to sit. */}
      {chase > 0 && (
        <div className="rounded-lg px-3.5 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.32)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-xs flex-1 min-w-[180px]" style={{ color: '#f59e0b' }}>
            {allSummary.needsOutcome > 0 && (
              <>{allSummary.needsOutcome} meeting{allSummary.needsOutcome === 1 ? '' : 's'} still marked planned after the fact</>
            )}
            {allSummary.needsOutcome > 0 && allSummary.followUpsDue > 0 && ' · '}
            {allSummary.followUpsDue > 0 && (
              <>{allSummary.followUpsDue} follow-up{allSummary.followUpsDue === 1 ? '' : 's'} due</>
            )}
          </p>
          {allSummary.needsOutcome > 0 && (
            <button onClick={() => applyFrom({ overdueOnly: true })}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b' }}>
              Write them up
            </button>
          )}
          {allSummary.followUpsDue > 0 && (
            <button onClick={() => applyFrom({ outcomes: ['follow_up'] })}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
              style={{ border: '1px solid rgba(236,72,153,0.5)', color: '#ec4899' }}>
              See follow-ups
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

      {/* A match hiding one month away is the exact shape of a bug that looks
          like an empty calendar. */}
      {outside > 0 && (
        <button onClick={() => setView('list')}
          className="w-full text-left text-xs rounded-xl px-3 py-2.5 flex items-center gap-2 transition hover:bg-muted"
          style={{ background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))' }}>
          <span className="font-semibold">{outside} more match{outside === 1 ? '' : 'es'} outside {periodLabel(view, anchor)}</span>
          <span className="text-muted-foreground">see them all in the list</span>
          <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0" />
        </button>
      )}

      {meetings.length === 0 && (
        <div className="rounded-lg border border-border p-5 text-center">
          <p className="text-sm font-semibold">Nothing in the diary yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {active
              ? 'Click any day or time on the calendar to book a meeting, or use New meeting above. After the meeting, open it and tap Happened to write up what came of it.'
              : 'This account is inactive, so nothing can be added.'}
          </p>
        </div>
      )}

      {view === 'list' ? (
        <MeetingList
          meetings={shown}
          now={now}
          colourBy="status"
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
          colourBy="status"
          onSelectMeeting={m => setSelectedId(m.id)}
          onSelectDay={d => setSelectedDay(startOfDay(d))}
          onOpenDay={openDay}
          onCreateAt={active ? openNew : null}
        />
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        Shortcuts: <strong>M</strong> month · <strong>W</strong> week · <strong>D</strong> day · <strong>L</strong> list ·
        {' '}<strong>T</strong> today · <strong>N</strong> new · <strong>/</strong> search · arrows to move
      </p>

      {selected && (
        <MeetingDetail
          meeting={selected}
          now={now}
          canEdit={active}
          busy={busy}
          skin={APP_SKIN}
          icsHref={`/api/rep/meetings/ics?id=${selected.id}`}
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
          skin={APP_SKIN}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
