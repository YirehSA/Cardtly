'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Plus, Clock, MapPin } from 'lucide-react'
import {
  addDays, startOfDay, isSameDay, isSameMonth, dateKey, minutesInto,
  monthMatrix, weekMatrix, shortDayNames, layoutColumn, hourBounds, fmtTime,
  type Span,
} from '@/lib/calendar'
import {
  meetingDuration, statusMeta, outcomeMeta,
  type CalendarMeeting,
} from '@/lib/rep-meetings'
import { meetingColour, isOverdue, GRAD, type ColourBy } from './shared'

// Month, week and day. One component, because all three read the same grouped
// data and share the chip, the colours and the click behaviour - and because
// three separate calendars would drift the moment one of them was fixed.

const HOUR_PX = 56
// Eleven hours on screen. Enough for a whole working day without the page
// turning into a scroll through the night.
const MAX_BODY_PX = 11 * HOUR_PX
const MONTH_CHIPS = 3

export interface MeetingCalendarProps {
  /** Already filtered. Any dates: the calendar picks out what its own period
   *  needs, so the parent never has to refetch to change month. */
  meetings: CalendarMeeting[]
  view: 'month' | 'week' | 'day'
  anchor: Date
  now: Date
  selectedId: string | null
  selectedDay: Date | null
  colourBy: ColourBy
  onSelectMeeting: (m: CalendarMeeting) => void
  onSelectDay: (d: Date) => void
  /** Jump to the day view for this date. */
  onOpenDay: (d: Date) => void
  /** null makes the calendar read-only: no add buttons, no click-to-book. */
  onCreateAt: ((when: Date) => void) | null
}

/** The part of a meeting that falls inside one day, in minutes from midnight.
 *  A late meeting that runs past midnight is drawn on both days rather than
 *  overflowing the bottom of the first one. */
function spanWithinDay(m: CalendarMeeting, day: Date): Span {
  const dayStart = startOfDay(day).getTime()
  const dayEnd = addDays(startOfDay(day), 1).getTime()
  const start = new Date(m.scheduled_at).getTime()
  const end = start + meetingDuration(m) * 60_000
  return {
    startMin: Math.round((Math.max(start, dayStart) - dayStart) / 60_000),
    endMin: Math.round((Math.min(end, dayEnd) - dayStart) / 60_000),
  }
}

function at(day: Date, minutes: number): Date {
  const d = startOfDay(day)
  d.setMinutes(minutes)
  return d
}

export default function MeetingCalendar(props: MeetingCalendarProps) {
  const { meetings, view, anchor } = props

  // Grouped once by local calendar date. Every view reads this, so a month
  // change is a re-slice rather than a round trip.
  const byDay = useMemo(() => {
    const out: Record<string, CalendarMeeting[]> = {}
    for (const m of meetings) {
      const start = new Date(m.scheduled_at)
      if (!Number.isFinite(start.getTime())) continue
      const end = start.getTime() + meetingDuration(m) * 60_000
      let cursor = startOfDay(start)
      // Capped: a corrupt duration must not spin here forever.
      for (let i = 0; i < 3 && cursor.getTime() < end; i++) {
        (out[dateKey(cursor)] ||= []).push(m)
        cursor = addDays(cursor, 1)
      }
    }
    for (const k in out) {
      out[k].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
    }
    return out
  }, [meetings])

  if (view === 'month') return <MonthGrid {...props} byDay={byDay} />
  return <TimeGrid {...props} byDay={byDay} days={view === 'week' ? weekMatrix(anchor) : [startOfDay(anchor)]} />
}

// ── The chip that appears in a month cell ──────────────────────────────────

function Chip({ m, now, colourBy, selected, onSelect }: {
  m: CalendarMeeting; now: Date; colourBy: ColourBy; selected: boolean
  onSelect: (m: CalendarMeeting) => void
}) {
  const colour = meetingColour(m, colourBy)
  const overdue = isOverdue(m, now)
  return (
    <button
      onClick={e => { e.stopPropagation(); onSelect(m) }}
      title={`${fmtTime(new Date(m.scheduled_at))} ${m.company}${m.repName ? ` (${m.repName})` : ''}`}
      className="w-full text-left px-1.5 py-1 rounded-md text-[11px] leading-tight truncate transition hover:brightness-125"
      style={{
        background: colour + '20',
        color: 'var(--cal-text)',
        borderLeft: `3px solid ${colour}`,
        boxShadow: selected ? `0 0 0 1px ${colour}` : undefined,
        // Cancelled is still worth showing - it is why the slot is empty - but
        // it should not read as a live appointment.
        textDecoration: m.status === 'cancelled' ? 'line-through' : undefined,
        opacity: m.status === 'cancelled' ? 0.65 : 1,
      }}
    >
      <span className="tabular-nums" style={{ color: 'var(--cal-muted)' }}>
        {fmtTime(new Date(m.scheduled_at))}
      </span>{' '}
      <span className="font-semibold">{m.company}</span>
      {overdue && <span className="ml-1 font-bold" style={{ color: '#f59e0b' }}>!</span>}
    </button>
  )
}

// ── Month ──────────────────────────────────────────────────────────────────

function MonthGrid({
  byDay, anchor, now, selectedId, selectedDay, colourBy,
  onSelectMeeting, onSelectDay, onOpenDay, onCreateAt,
}: MeetingCalendarProps & { byDay: Record<string, CalendarMeeting[]> }) {
  const days = monthMatrix(anchor)
  const names = shortDayNames()

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
        <div className="grid grid-cols-7">
          {names.map(n => (
            <div key={n}
              className="px-1 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center"
              style={{ color: 'var(--cal-muted)', borderBottom: '1px solid var(--cal-grid)' }}>
              <span className="sm:hidden">{n.slice(0, 1)}</span>
              <span className="hidden sm:inline">{n}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = byDay[dateKey(d)] || []
            const inMonth = isSameMonth(d, anchor)
            const today = isSameDay(d, now)
            const chosen = !!selectedDay && isSameDay(d, selectedDay)
            const label = d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
            return (
              <div
                key={dateKey(d)}
                role="gridcell"
                onClick={() => onSelectDay(d)}
                className="relative min-h-[64px] sm:min-h-[104px] p-1 sm:p-1.5 group cursor-pointer transition"
                style={{
                  borderRight: i % 7 === 6 ? undefined : '1px solid var(--cal-grid)',
                  borderBottom: i < 35 ? '1px solid var(--cal-grid)' : undefined,
                  background: chosen ? 'var(--cal-hover)' : today ? 'var(--cal-today)' : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); onOpenDay(d) }}
                    title={`Open ${label}`}
                    className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold transition hover:opacity-80"
                    style={today
                      ? { background: '#7c3aed', color: '#fff' }
                      : { color: inMonth ? 'var(--cal-text)' : 'var(--cal-muted)', opacity: inMonth ? 1 : 0.6 }}
                  >
                    {d.getDate()}
                  </button>
                  {onCreateAt && (
                    <button
                      onClick={e => { e.stopPropagation(); onCreateAt(at(d, 9 * 60)) }}
                      aria-label={`Add a meeting on ${label}`}
                      title="Add a meeting"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 rounded-md grid place-items-center transition"
                      style={{ color: 'var(--cal-muted)', background: 'var(--cal-raised)' }}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Chips on anything wider than a phone. */}
                <div className="hidden sm:block mt-1 space-y-1" style={{ opacity: inMonth ? 1 : 0.55 }}>
                  {list.slice(0, MONTH_CHIPS).map(m => (
                    <Chip key={m.id} m={m} now={now} colourBy={colourBy}
                      selected={selectedId === m.id} onSelect={onSelectMeeting} />
                  ))}
                  {list.length > MONTH_CHIPS && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenDay(d) }}
                      className="w-full text-left px-1.5 text-[10px] font-bold hover:underline"
                      style={{ color: 'var(--cal-muted)' }}>
                      +{list.length - MONTH_CHIPS} more
                    </button>
                  )}
                </div>

                {/* On a phone a cell is too small to read, so it carries a dot
                    per meeting and the day panel underneath does the reading. */}
                <div className="sm:hidden mt-1 flex flex-wrap gap-[3px]" style={{ opacity: inMonth ? 1 : 0.55 }}>
                  {list.slice(0, 8).map(m => (
                    <span key={m.id} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: meetingColour(m, colourBy) }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <DayPanel
          day={selectedDay}
          list={byDay[dateKey(selectedDay)] || []}
          now={now}
          colourBy={colourBy}
          selectedId={selectedId}
          onSelectMeeting={onSelectMeeting}
          onCreateAt={onCreateAt}
        />
      )}
    </div>
  )
}

/** What is on the chosen day, spelled out. This is the whole month view on a
 *  phone, where the cells only have room for dots. */
function DayPanel({ day, list, now, colourBy, selectedId, onSelectMeeting, onCreateAt }: {
  day: Date
  list: CalendarMeeting[]
  now: Date
  colourBy: ColourBy
  selectedId: string | null
  onSelectMeeting: (m: CalendarMeeting) => void
  onCreateAt: ((when: Date) => void) | null
}) {
  return (
    <div className="rounded-lg border p-3.5"
      style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cal-muted)' }}>
          {day.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}{list.length || 'nothing'}{list.length ? ` meeting${list.length === 1 ? '' : 's'}` : ''}
        </p>
        {onCreateAt && (
          <button onClick={() => onCreateAt(at(day, 9 * 60))}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white transition hover:opacity-90"
            style={{ background: GRAD }}>
            <Plus className="w-3 h-3" />Add
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>
          {onCreateAt ? 'Nothing booked. Add is above.' : 'Nothing booked.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {list.map(m => {
            const colour = meetingColour(m, colourBy)
            const st = statusMeta(m.status)
            const oc = outcomeMeta(m.outcome)
            return (
              <button key={m.id} onClick={() => onSelectMeeting(m)}
                className="w-full text-left rounded-xl p-2.5 transition hover:brightness-110"
                style={{
                  background: 'var(--cal-raised)',
                  borderLeft: `3px solid ${colour}`,
                  boxShadow: selectedId === m.id ? `0 0 0 1px ${colour}` : undefined,
                }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--cal-text)' }}>
                    {fmtTime(new Date(m.scheduled_at))}
                  </span>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--cal-text)' }}>{m.company}</span>
                  {m.repName && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: colour + '22', color: colour }}>{m.repName}</span>
                  )}
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: st.colour }}>{st.label}</span>
                  {oc && <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: oc.colour }}>{oc.label}</span>}
                </div>
                {(m.contact_name || m.location) && (
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--cal-muted)' }}>
                    {[m.contact_name, m.location].filter(Boolean).join(' · ')}
                  </p>
                )}
                {isOverdue(m, now) && (
                  <p className="text-[11px] mt-1 font-semibold" style={{ color: '#f59e0b' }}>
                    Still marked planned. What happened?
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Week and day ───────────────────────────────────────────────────────────

function TimeGrid({
  byDay, days, now, selectedId, colourBy,
  onSelectMeeting, onOpenDay, onCreateAt,
}: MeetingCalendarProps & { byDay: Record<string, CalendarMeeting[]>; days: Date[] }) {
  const columns = useMemo(() => days.map(day => ({
    day,
    placed: layoutColumn(byDay[dateKey(day)] || [], m => spanWithinDay(m, day)),
  })), [byDay, days])

  // The window starts at the working day and stretches to cover anything booked
  // outside it, so a 06:30 breakfast is never scrolled off its own calendar.
  const { startHour, endHour } = useMemo(
    () => hourBounds(columns.flatMap(c => c.placed.map(p => ({ startMin: p.startMin, endMin: p.endMin })))),
    [columns])

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const bodyHeight = (endHour - startHour) * HOUR_PX
  const topOf = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX

  // The grid scrolls rather than growing.
  //
  // hourBounds stretches to cover everything booked, which is right - but one
  // meeting at 23:00 makes the window 24 hours, and an un-scrolled 24-hour grid
  // is 1344px of mostly empty night with the working day squeezed into the
  // middle of it. So the body scrolls and opens on the morning.
  const scroller = useRef<HTMLDivElement | null>(null)
  // The earliest meeting that actually STARTS on one of these days.
  //
  // Not the earliest block: a meeting from 23:00 the night before is drawn from
  // 00:00 on the following day, and taking that as "the first event" opened the
  // whole week at midnight with the working day off the bottom of the scroll.
  const firstEventMin = columns.reduce((min, c) => c.placed.reduce((m, p) => (
    isSameDay(new Date(p.item.scheduled_at), c.day) ? Math.min(m, p.startMin) : m
  ), min), 24 * 60)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = Math.min(firstEventMin, 8 * 60)
    el.scrollTop = Math.max(0, topOf(target) - 12)
    // Re-aimed whenever the day or the window changes, not just on mount:
    // moving to a day whose first meeting is at 07:00 should show it.
  }, [firstEventMin, startHour, endHour])

  function slotAt(e: React.MouseEvent<HTMLDivElement>, day: Date): Date {
    const rect = e.currentTarget.getBoundingClientRect()
    const mins = startHour * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60
    // Quarter hours: precise enough to be useful, forgiving enough to hit.
    const rounded = Math.max(0, Math.min(1440 - 15, Math.round(mins / 15) * 15))
    return at(day, rounded)
  }

  return (
    <div className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 720 : undefined }}>

          {/* Day headers */}
          <div className="flex" style={{ borderBottom: '1px solid var(--cal-grid)' }}>
            <div className="w-12 sm:w-14 shrink-0" />
            {days.map(d => {
              const today = isSameDay(d, now)
              const count = (byDay[dateKey(d)] || []).length
              return (
                <button key={dateKey(d)} onClick={() => onOpenDay(d)}
                  className="flex-1 py-2 px-1 text-center transition hover:opacity-80"
                  style={{ borderLeft: '1px solid var(--cal-grid)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--cal-muted)' }}>
                    {d.toLocaleDateString('en-ZA', { weekday: 'short' })}
                  </p>
                  <p className="text-sm font-bold mt-0.5 inline-grid place-items-center w-7 h-7 rounded-full"
                    style={today ? { background: '#7c3aed', color: '#fff' } : { color: 'var(--cal-text)' }}>
                    {d.getDate()}
                  </p>
                  {count > 0 && (
                    <p className="text-[10px] font-semibold" style={{ color: 'var(--cal-muted)' }}>
                      {count}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* The grid itself. Day headers stay above it while the hours scroll. */}
          <div ref={scroller} className="overflow-y-auto" style={{ maxHeight: MAX_BODY_PX }}>
          <div className="flex" style={{ height: bodyHeight }}>
            <div className="w-12 sm:w-14 shrink-0 relative">
              {hours.map(h => (
                <div key={h} className="absolute right-1.5 text-[10px] font-semibold tabular-nums"
                  style={{ top: topOf(h * 60) - 5, color: 'var(--cal-muted)' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            <div className="flex-1 flex relative">
              {/* Hour and half-hour lines, drawn once across every column. */}
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: topOf(h * 60), borderTop: '1px solid var(--cal-grid)' }} />
              ))}
              {hours.map(h => (
                <div key={`half-${h}`} className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: topOf(h * 60 + 30), borderTop: '1px dashed var(--cal-grid)', opacity: 0.5 }} />
              ))}

              {columns.map(({ day, placed }) => (
                <div
                  key={dateKey(day)}
                  className="flex-1 relative"
                  style={{ borderLeft: '1px solid var(--cal-grid)', cursor: onCreateAt ? 'copy' : 'default' }}
                  onClick={onCreateAt ? e => onCreateAt(slotAt(e, day)) : undefined}
                  title={onCreateAt ? 'Click a time to book it' : undefined}
                >
                  {placed.map(p => {
                    const m = p.item
                    const colour = meetingColour(m, colourBy)
                    const height = Math.max(20, topOf(p.endMin) - topOf(p.startMin) - 2)
                    const tall = height >= 40
                    const st = statusMeta(m.status)
                    return (
                      <button
                        key={m.id}
                        onClick={e => { e.stopPropagation(); onSelectMeeting(m) }}
                        className="absolute rounded-lg px-1.5 py-1 text-left overflow-hidden transition hover:brightness-125"
                        style={{
                          top: topOf(p.startMin),
                          height,
                          left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / p.lanes}% - 4px)`,
                          background: colour + (m.status === 'cancelled' ? '14' : '2b'),
                          borderLeft: `3px solid ${colour}`,
                          boxShadow: selectedId === m.id ? `0 0 0 2px ${colour}` : undefined,
                          color: 'var(--cal-text)',
                          opacity: m.status === 'cancelled' ? 0.6 : 1,
                        }}
                        title={`${fmtTime(new Date(m.scheduled_at))} ${m.company} · ${st.label}`}
                      >
                        <p className="text-[11px] font-bold truncate leading-tight"
                          style={{ textDecoration: m.status === 'cancelled' ? 'line-through' : undefined }}>
                          {m.company}
                          {isOverdue(m, now) && <span className="ml-1" style={{ color: '#f59e0b' }}>!</span>}
                        </p>
                        {tall && (
                          <p className="text-[10px] tabular-nums truncate" style={{ color: 'var(--cal-muted)' }}>
                            {fmtTime(new Date(m.scheduled_at))}
                            {m.repName ? ` · ${m.repName}` : m.contact_name ? ` · ${m.contact_name}` : ''}
                          </p>
                        )}
                        {height >= 64 && m.location && (
                          <p className="text-[10px] truncate flex items-center gap-1" style={{ color: 'var(--cal-muted)' }}>
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{m.location}
                          </p>
                        )}
                      </button>
                    )
                  })}

                  {/* Where we are right now. */}
                  {isSameDay(day, now) && minutesInto(now) >= startHour * 60 && minutesInto(now) <= endHour * 60 && (
                    <div className="absolute left-0 right-0 pointer-events-none z-10"
                      style={{ top: topOf(minutesInto(now)) }}>
                      <div style={{ borderTop: '2px solid #ef4444' }} />
                      <div className="absolute w-2 h-2 rounded-full"
                        style={{ background: '#ef4444', left: -3, top: -4 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>

      {onCreateAt && (
        <p className="px-3 py-2 text-[11px] flex items-center gap-1.5"
          style={{ color: 'var(--cal-muted)', borderTop: '1px solid var(--cal-grid)' }}>
          <Clock className="w-3 h-3" />Click any empty time to book it.
        </p>
      )}
    </div>
  )
}
