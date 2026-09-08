'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import ActivityLog from '@/components/activities/ActivityLog'
import ActivityStats from '@/components/activities/ActivityStats'
import { ADMIN_SKIN, useMounted, useNow, useInk, INK, inputClass, inputStyle } from '@/components/calendar/shared'
import { shiftAnchor, periodLabel, type CalendarView } from '@/lib/calendar'
import {
  summariseActivities, activityRange, withinRange, dueFollowUps,
  type ActivityKind, type LoggedActivity,
} from '@/lib/rep-activities'
import type { LoggedCall } from '@/lib/rep-calls'

// The admin's view of a rep's outreach.
//
// Same components as the rep's own page, in the admin skin and pointed at the
// admin endpoint, so there is one email log rather than two that drift. What
// this adds is the rep picker: with nobody chosen it is the whole team, and the
// figures answer "how is outreach going"; choose a name and every number and
// every row narrows to that person, which is what a one-on-one needs.

const PERIODS: { id: CalendarView; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'list', label: 'All' },
]

export default function OutreachTab({ kinds, initial, calls, reps }: {
  /** ['email'] for the Email log tab; the other two for Networking. */
  kinds: readonly ActivityKind[]
  initial: LoggedActivity[]
  /** Only their outcomes are read, for the meetings figure. */
  calls: LoggedCall[]
  reps: { id: string; name: string }[]
}) {
  const mounted = useMounted()
  const now = useNow()
  const ink = useInk()

  const [activities, setActivities] = useState<LoggedActivity[]>(initial)
  const [repId, setRepId] = useState<string | null>(null)
  const [period, setPeriod] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const refresh = useCallback(async () => {
    const data = await fetch('/api/admin/activities').then(r => r.json()).catch(() => null)
    if (data?.activities) setActivities(data.activities)
    else if (data?.error) toast.error(data.error, { duration: 8000 })
  }, [])

  // The figures answer to the rep picker as well as the period. A card reading
  // "43% response rate" beside one rep's rows, but computed over the whole
  // team, is the sort of number somebody quotes in a review.
  const scoped = useMemo(
    () => (repId ? activities.filter(a => a.rep_id === repId) : activities),
    [activities, repId])
  const scopedCalls = useMemo(
    () => (repId ? calls.filter(c => c.rep_id === repId) : calls),
    [calls, repId])

  const range = activityRange(period as any, anchor)
  const inPeriod = useMemo(
    () => (range ? withinRange(scoped, range.from, range.to) : scoped),
    [scoped, range?.from?.getTime(), range?.to?.getTime()])

  const callsInPeriod = useMemo(() => {
    if (!range) return scopedCalls
    const a = range.from.getTime(), b = range.to.getTime()
    return scopedCalls.filter(c => {
      const t = new Date(c.called_at).getTime()
      return Number.isFinite(t) && t >= a && t < b
    })
  }, [scopedCalls, range?.from?.getTime(), range?.to?.getTime()])

  const previous = useMemo(() => {
    if (!range) return null
    const prev = activityRange(period as any, shiftAnchor(period, anchor, -1))
    if (!prev) return null
    return summariseActivities(withinRange(scoped, prev.from, prev.to), [])
  }, [scoped, period, anchor, range?.from?.getTime()])

  // Off the whole log, not the period, and narrowed to the chosen rep.
  const due = useMemo(() => dueFollowUps(scoped, now), [scoped, now])

  const label = range ? periodLabel(period, anchor) : 'All time'
  const whose = repId ? reps.find(r => r.id === repId)?.name : null

  if (!mounted) {
    return <div className="h-96 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} aria-hidden />
  }

  return (
    <div className="space-y-4" style={ADMIN_SKIN}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={repId || ''} aria-label="Filter by rep"
          onChange={e => setRepId(e.target.value || null)}
          className={`${inputClass} flex-1 min-w-[180px] max-w-[280px]`} style={inputStyle}>
          <option value="">Everyone</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--cal-border)' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className="px-3 min-h-[44px] text-sm font-semibold transition"
              style={{
                background: period === p.id ? `${INK.sky.bright}1f` : 'transparent',
                color: period === p.id ? ink(INK.sky.bright, INK.sky.deep) : 'var(--cal-muted)',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {range && (
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor(a => shiftAnchor(period, a, -1))} aria-label="Previous period"
              className="w-11 h-11 rounded-xl grid place-items-center" style={{ border: '1px solid var(--cal-border)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setAnchor(new Date())}
              className="px-3 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap"
              style={{ border: '1px solid var(--cal-border)' }}>
              {label}
            </button>
            <button onClick={() => setAnchor(a => shiftAnchor(period, a, 1))} aria-label="Next period"
              className="w-11 h-11 rounded-xl grid place-items-center" style={{ border: '1px solid var(--cal-border)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ActivityStats
        activities={inPeriod} calls={callsInPeriod} previous={previous} period={period}
        connectionsNote={whose ? `${whose} on LinkedIn and at events` : 'Across the team'} />

      {due.length > 0 && (
        <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ borderColor: '#f59e0b55', background: '#f59e0b0f' }}>
          <CalendarClock className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-sm flex-1 min-w-[200px]">
            <strong>{due.length} due to follow up{whose ? ` for ${whose}` : ''}.</strong>{' '}
            <span style={{ color: 'var(--cal-muted)' }}>
              {due.slice(0, 3).map(a => a.company).join(', ')}{due.length > 3 ? ` and ${due.length - 3} more` : ''}
            </span>
          </p>
        </div>
      )}

      <ActivityLog
        activities={inPeriod.filter(a => kinds.includes(a.kind))}
        allInTab={scoped.filter(a => kinds.includes(a.kind))}
        kinds={kinds}
        endpoint="/api/admin/activities"
        skin={ADMIN_SKIN}
        onRefresh={refresh}
        periodName={label}
        reps={reps}
        repId={repId}
      />
    </div>
  )
}
