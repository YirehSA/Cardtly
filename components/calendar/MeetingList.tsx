'use client'

import { useMemo } from 'react'
import { Building2, User, Phone, Mail, MapPin, Clock, CalendarX2 } from 'lucide-react'
import { dateKey, isSameDay, addDays, fmtTime, fmtDuration } from '@/lib/calendar'
import {
  meetingDuration, statusMeta, outcomeMeta,
  type CalendarMeeting,
} from '@/lib/rep-meetings'
import { isUpcoming } from '@/lib/meeting-filters'
import { meetingColour, isOverdue, Pill, type ColourBy } from './shared'

// Every matching meeting, grouped by day. This is where a search lands: the
// calendar can only show you one month, and the thing you are looking for is
// usually not in it.

export default function MeetingList({
  meetings, now, colourBy, selectedId, onSelect, note,
}: {
  /** Already filtered AND sorted by the caller. */
  meetings: CalendarMeeting[]
  now: Date
  colourBy: ColourBy
  selectedId: string | null
  onSelect: (m: CalendarMeeting) => void
  note?: string
}) {
  // Grouped by day, and each group tagged with which half of the list it is in.
  //
  // The sort puts what is still to come first and history after it, so today can
  // legitimately appear twice - a 19:00 still ahead of you and a 09:00 already
  // gone. Two groups both labelled "Today" with nothing between them reads as a
  // glitch, so the halves get a heading.
  const groups = useMemo(() => {
    const out: Array<{ key: string; day: Date; items: CalendarMeeting[]; upcoming: boolean }> = []
    let current: { key: string; day: Date; items: CalendarMeeting[]; upcoming: boolean } | null = null
    for (const m of meetings) {
      const day = new Date(m.scheduled_at)
      if (!Number.isFinite(day.getTime())) continue
      const key = dateKey(day)
      const up = isUpcoming(m, now)
      if (!current || current.key !== key || current.upcoming !== up) {
        current = { key, day, items: [], upcoming: up }
        out.push(current)
      }
      current.items.push(m)
    }
    return out
  }, [meetings, now])

  const hasBothHalves = groups.some(g => g.upcoming) && groups.some(g => !g.upcoming)

  function dayLabel(d: Date): string {
    if (isSameDay(d, now)) return 'Today'
    if (isSameDay(d, addDays(now, 1))) return 'Tomorrow'
    if (isSameDay(d, addDays(now, -1))) return 'Yesterday'
    return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (meetings.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center"
        style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
        <CalendarX2 className="w-7 h-7 mx-auto mb-2" style={{ color: 'var(--cal-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--cal-text)' }}>Nothing matches</p>
        <p className="text-xs mt-1" style={{ color: 'var(--cal-muted)' }}>
          Try clearing the search or the filters.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {note && (
        <p className="text-[11px]" style={{ color: 'var(--cal-muted)' }}>{note}</p>
      )}
      {groups.map((g, gi) => (
        <div key={`${g.key}-${g.upcoming}`}>
        {hasBothHalves && (gi === 0 || groups[gi - 1].upcoming !== g.upcoming) && (
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 mt-1"
            style={{ color: g.upcoming ? '#0ea5e9' : 'var(--cal-muted)' }}>
            {g.upcoming ? 'Still to come' : 'Already happened'}
          </p>
        )}
        <div className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
          <div className="px-3.5 py-2 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--cal-grid)', background: 'var(--cal-raised)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cal-text)' }}>
              {dayLabel(g.day)}
            </p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--cal-muted)' }}>
              {g.items.length}
            </p>
          </div>
          <div>
            {g.items.map((m, i) => {
              const colour = meetingColour(m, colourBy)
              const st = statusMeta(m.status)
              const oc = outcomeMeta(m.outcome)
              const start = new Date(m.scheduled_at)
              return (
                <button key={m.id} onClick={() => onSelect(m)}
                  className="w-full text-left px-3.5 py-3 transition hover:brightness-110 flex gap-3"
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--cal-grid)',
                    background: selectedId === m.id ? 'var(--cal-hover)' : undefined,
                  }}>
                  <div className="w-14 shrink-0 pt-0.5">
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--cal-text)' }}>
                      {fmtTime(start)}
                    </p>
                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--cal-muted)' }}>
                      {fmtDuration(meetingDuration(m))}
                    </p>
                  </div>
                  <div className="w-[3px] rounded-full shrink-0" style={{ background: colour }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--cal-muted)' }} />
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--cal-text)' }}>{m.company}</p>
                      <Pill label={st.label} colour={st.colour} title={undefined} />
                      {oc && <Pill label={oc.label} colour={oc.colour} />}
                      {m.repName && <Pill label={m.repName} colour={colour} />}
                      {isOverdue(m, now) && <Pill label="Needs an outcome" colour="#f59e0b" title="The time has passed and it is still marked planned" />}
                    </div>
                    {(m.contact_name || m.contact_phone || m.contact_email || m.location) && (
                      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px]" style={{ color: 'var(--cal-muted)' }}>
                        {m.contact_name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{m.contact_name}</span>}
                        {m.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{m.contact_phone}</span>}
                        {m.contact_email && <span className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{m.contact_email}</span>}
                        {m.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</span>}
                      </div>
                    )}
                    {m.follow_up_on && (
                      <p className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: '#ec4899' }}>
                        <Clock className="w-3 h-3" />Follow up on {m.follow_up_on}
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs mt-1.5 leading-relaxed line-clamp-2" style={{ color: 'var(--cal-muted)' }}>
                        {m.notes}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        </div>
      ))}
    </div>
  )
}
