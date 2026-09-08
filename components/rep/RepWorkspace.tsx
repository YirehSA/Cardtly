'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock, PhoneCall, Mail, Users, Plus, ChevronLeft, ChevronRight,
  Handshake, TrendingUp, MessageSquareReply, Linkedin,
} from 'lucide-react'
import MeetingsView from '@/components/rep/MeetingsView'
import CallLog from '@/components/calls/CallLog'
import ActivityLog from '@/components/activities/ActivityLog'
import ActivityForm, {
  blankActivity, activityToBody, type ActivityFormState,
} from '@/components/activities/ActivityForm'
import { APP_SKIN, useMounted, useNow, useInk, INK } from '@/components/calendar/shared'
import { shiftAnchor, periodLabel, type CalendarView } from '@/lib/calendar'
import type { CalendarMeeting } from '@/lib/rep-meetings'
import type { LoggedCall } from '@/lib/rep-calls'
import {
  ACTIVITY_KINDS, summariseActivities, activityRange, withinRange, dueFollowUps,
  type ActivityKind, type LoggedActivity,
} from '@/lib/rep-activities'

// The rep's Activity Log: everything they did to win work, in one place.
//
// FOUR TABS, TWO SHAPES. Calendar and Call log keep the views they already had
// - a month grid and a call list - because they answer different questions and
// squashing them into one table would lose both. Email and Networking are the
// same table over the same rows, split only by kind, because "who did I write
// to" and "who did I meet" are the same question about different channels.
//
// The figures at the top do NOT change with the tab. They are the four numbers
// a rep is measured on, and a card whose meaning shifts under you while you
// click around is a card nobody trusts. The period picker governs them, and it
// is always on screen for the same reason.

type Tab = 'calendar' | 'calls' | 'email' | 'networking'

/** Which kinds each activity tab covers. A connection made on LinkedIn and one
 *  made at a breakfast are the same job, so they share a tab. */
const TAB_KINDS: Record<'email' | 'networking', readonly ActivityKind[]> = {
  email: ['email'],
  networking: ['linkedin', 'networking'],
}

const PERIODS: { id: CalendarView; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'list', label: 'All' },
]

export default function RepWorkspace({ repName, active, meetings, calls, activities: initialActivities }: {
  repName: string
  active: boolean
  meetings: CalendarMeeting[]
  calls: LoggedCall[]
  activities: LoggedActivity[]
}) {
  const mounted = useMounted()
  const now = useNow()
  const ink = useInk()

  const [tab, setTab] = useState<Tab>('email')
  const [activities, setActivities] = useState<LoggedActivity[]>(initialActivities)
  const [period, setPeriod] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [quick, setQuick] = useState<ActivityFormState | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const data = await fetch('/api/rep/activities').then(r => r.json()).catch(() => null)
    if (data?.activities) setActivities(data.activities)
    else if (data?.error) toast.error(data.error, { duration: 8000 })
  }, [])

  const range = activityRange(period as any, anchor)

  const inPeriod = useMemo(
    () => (range ? withinRange(activities, range.from, range.to) : activities),
    [activities, range?.from?.getTime(), range?.to?.getTime()])

  const callsInPeriod = useMemo(() => {
    if (!range) return calls
    const a = range.from.getTime(), b = range.to.getTime()
    return calls.filter(c => {
      const t = new Date(c.called_at).getTime()
      return Number.isFinite(t) && t >= a && t < b
    })
  }, [calls, range?.from?.getTime(), range?.to?.getTime()])

  const stats = useMemo(() => summariseActivities(inPeriod, callsInPeriod), [inPeriod, callsInPeriod])

  // The same window, one step back. This is what makes "up 33%" a fact rather
  // than a decoration: without it a card can only ever say how many, never
  // whether that is better or worse than the last one.
  const previous = useMemo(() => {
    if (!range) return null
    const prevAnchor = shiftAnchor(period, anchor, -1)
    const prev = activityRange(period as any, prevAnchor)
    if (!prev) return null
    return summariseActivities(
      withinRange(activities, prev.from, prev.to),
      [],
    )
  }, [activities, period, anchor, range?.from?.getTime()])

  // Off the WHOLE log, not the period. Somebody owed a follow-up is owed it
  // whichever month you happen to be looking at.
  const due = useMemo(() => dueFollowUps(activities, now), [activities, now])

  const label = range ? periodLabel(period, anchor) : 'All time'

  // Two values per tab: the hue for the tint and the border, and the deeper
  // one for the label. See useInk - the bright hue is 3.0:1 on the light theme.
  const TABS: {
    id: Tab; label: string; icon: React.ReactNode; count: number
    hue: { bright: string; deep: string }
  }[] = [
    { id: 'calendar', label: 'Calendar', icon: <CalendarClock className="w-4 h-4" />, count: meetings.length, hue: INK.sky },
    { id: 'calls', label: 'Call log', icon: <PhoneCall className="w-4 h-4" />, count: calls.length, hue: INK.green },
    {
      id: 'email', label: 'Email log', icon: <Mail className="w-4 h-4" />, hue: INK.blue,
      count: activities.filter(a => a.kind === 'email').length,
    },
    {
      id: 'networking', label: 'Networking', icon: <Users className="w-4 h-4" />, hue: INK.purple,
      count: activities.filter(a => a.kind !== 'email').length,
    },
  ]

  async function saveQuick() {
    if (!quick) return
    setBusy(true)
    const res = await fetch('/api/rep/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityToBody(quick)),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return }
    toast.success('Activity logged')
    await refresh()
    // Land on the tab the new row is actually in, so it is not logged into
    // apparent nothingness.
    setTab(quick.kind === 'email' ? 'email' : 'networking')
    setQuick(null)
  }

  if (!mounted) {
    return <div className="h-96 rounded-2xl animate-pulse" style={{ background: 'hsl(var(--muted))' }} aria-hidden />
  }

  return (
    <div className="space-y-4" style={APP_SKIN}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Track your outreach. Build relationships. Create opportunities.
          </p>
        </div>
        {/* Period. Always on screen, because the figures below answer to it. */}
        <div className="flex items-center gap-2">
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
      </div>

      {/* The four figures. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={<Mail className="w-5 h-5" />} colour="#3b82f6"
          value={stats.emailsSent} label="Emails sent"
          note={delta(stats.emailsSent, previous?.emailsSent, period)} />
        <Stat
          icon={<MessageSquareReply className="w-5 h-5" />} colour="#22c55e"
          value={stats.positive} label="Positive replies"
          note={stats.responseRate === null
            ? { text: 'Nothing sent yet', tone: 'muted' }
            : { text: `${stats.responseRate}% response rate`, tone: 'good' }} />
        <Stat
          icon={<Linkedin className="w-5 h-5" />} colour="#a855f7"
          value={stats.connections} label="New connections"
          note={{ text: 'LinkedIn and networking', tone: 'muted' }} />
        <Stat
          icon={<Handshake className="w-5 h-5" />} colour="#ec4899"
          value={stats.meetings} label="Meetings booked"
          note={{ text: 'From outreach and calls', tone: 'muted' }} />
      </div>

      {/* Owed a follow-up. Above the tabs, because it is true on all of them. */}
      {due.length > 0 && (
        <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ borderColor: '#f59e0b55', background: '#f59e0b0f' }}>
          <CalendarClock className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-sm flex-1 min-w-[200px]">
            <strong>{due.length} due to follow up.</strong>{' '}
            <span style={{ color: 'var(--cal-muted)' }}>
              {due.slice(0, 3).map(a => a.company).join(', ')}{due.length > 3 ? ` and ${due.length - 3} more` : ''}
            </span>
          </p>
        </div>
      )}

      {/* Quick log. One button per kind, so a rep who knows what they did does
          not have to open a form and then choose. */}
      {active && (
        <div className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
          <div>
            <p className="font-semibold text-sm">Quick log</p>
            <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>
              Add it now while you still remember what was said.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_KINDS.map(k => (
              <button key={k.id} onClick={() => setQuick(blankActivity(k.id))}
                className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2"
                // solid, not colour. See the note on ACTIVITY_KINDS: the bright
                // hue carries white at 2.8:1.
                style={{ background: k.solid }}>
                {/* Not lowercased. "Log linkedin" is a spelling mistake on a
                    button, and LinkedIn is the one word here that carries a
                    capital in the middle. */}
                <Plus className="w-4 h-4" />Log {k.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Activity log">
        {TABS.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
              className="px-4 min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition"
              style={{
                background: on ? `${t.hue.bright}1f` : 'transparent',
                border: `1px solid ${on ? `${t.hue.bright}59` : 'hsl(var(--border))'}`,
                color: on ? ink(t.hue.bright, t.hue.deep) : 'hsl(var(--muted-foreground))',
              }}>
              {t.icon}
              {t.label}
              {/* The count takes the page's own text colour rather than the
                  tab's hue. The hue on its own tint came out at 3.9:1, and a
                  number is not decoration - it is the thing being counted. */}
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                style={{
                  background: on ? `${t.hue.bright}26` : 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                }}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'calendar' && <MeetingsView repName={repName} active={active} initial={meetings} />}
      {tab === 'calls' && <CallLog calls={calls} endpoint="/api/rep/calls" skin={APP_SKIN} canWrite={active} />}
      {(tab === 'email' || tab === 'networking') && (
        <ActivityLog
          activities={inPeriod.filter(a => TAB_KINDS[tab].includes(a.kind))}
          allInTab={activities.filter(a => TAB_KINDS[tab].includes(a.kind))}
          kinds={TAB_KINDS[tab]}
          endpoint="/api/rep/activities"
          skin={APP_SKIN}
          canWrite={active}
          onRefresh={refresh}
          periodName={label}
        />
      )}

      {quick && (
        <ActivityForm
          form={quick} setForm={setQuick as any} busy={busy} skin={APP_SKIN}
          onClose={() => setQuick(null)}
          onSave={saveQuick}
        />
      )}
    </div>
  )
}

/** How this period compares with the one before it. Says nothing rather than
 *  inventing a percentage when there was nothing to compare against: "up 100%"
 *  from zero to one is arithmetically true and useless. */
function delta(now: number, before: number | undefined, period: CalendarView): Note {
  if (before === undefined) return { text: 'All time', tone: 'muted' }
  const unit = period === 'week' ? 'week' : 'month'
  if (before === 0) {
    return now === 0
      ? { text: `Nothing last ${unit} either`, tone: 'muted' }
      : { text: `Up from none last ${unit}`, tone: 'good' }
  }
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { text: `Same as last ${unit}`, tone: 'muted' }
  return {
    text: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% vs last ${unit}`,
    tone: pct > 0 ? 'good' : 'bad',
  }
}

type Note = { text: string; tone: 'good' | 'bad' | 'muted' }

function Stat({ icon, colour, value, label, note }: {
  icon: React.ReactNode; colour: string; value: number; label: string; note: Note
}) {
  const ink = useInk()
  const TONE: Record<Note['tone'], string> = {
    good: ink(INK.green.bright, INK.green.deep),
    bad: ink(INK.amber.bright, INK.amber.deep),
    muted: 'var(--cal-muted)',
  }
  return (
    <div className="rounded-2xl border p-4 flex items-start gap-3"
      style={{
        borderColor: colour + '33',
        // 0e, not 14. At 8% the green card's own tint pushed the muted note on
        // it to 4.43:1 - the app sets --muted-foreground precisely to clear
        // 4.56 on its surfaces, and a decorative wash must not spend that. This
        // is the same card to look at and leaves the token its headroom.
        background: `linear-gradient(150deg, ${colour}0e 0%, transparent 60%)`,
      }}>
      <span className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0"
        style={{ background: colour + '22', color: colour }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-3xl font-bold leading-none tabular-nums">{value}</p>
        <p className="text-sm font-medium mt-1">{label}</p>
        {/* The tone is carried by an arrow as well as a colour, so it still
            reads as up or down to somebody who cannot separate the two. */}
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: TONE[note.tone] }}>
          {note.tone === 'good' && <TrendingUp className="w-3 h-3" />}
          {note.tone === 'bad' && <TrendingUp className="w-3 h-3 rotate-180" />}
          {note.text}
        </p>
      </div>
    </div>
  )
}
