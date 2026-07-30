'use client'

import type { MeetingSummary, MeetingFilterState } from '@/lib/meeting-filters'

// The numbers worth looking at, and every one of them a way in.
//
// A tile you cannot click is a dead end: you read "3 no-shows" and then have to
// go and find them yourself. Each tile here hands the parent the filter that
// shows exactly what it just counted.

interface Tile {
  label: string
  value: string | number
  colour: string
  hint: string
  filter?: Partial<MeetingFilterState>
  warn?: boolean
}

export default function MeetingStats({ summary, onFilter, scope }: {
  summary: MeetingSummary
  onFilter?: (patch: Partial<MeetingFilterState>) => void
  /** What the numbers are counting, e.g. "this month" or "everything". */
  scope?: string
}) {
  const tiles: Tile[] = [
    {
      label: 'Coming up', value: summary.upcoming, colour: '#0ea5e9',
      hint: 'Planned, and still ahead of you',
      filter: { statuses: ['planned'] },
    },
    {
      label: 'Needs an outcome', value: summary.needsOutcome, colour: '#f59e0b',
      hint: 'The time has passed and it is still marked planned. Nobody has said what happened.',
      filter: { overdueOnly: true },
      warn: summary.needsOutcome > 0,
    },
    {
      label: 'Happened', value: summary.done, colour: '#22c55e',
      hint: 'Meetings that took place',
      filter: { statuses: ['done'] },
    },
    {
      label: 'No shows', value: summary.noShow, colour: '#f59e0b',
      hint: 'They did not turn up',
      filter: { statuses: ['no_show'] },
    },
    {
      label: 'Signed up', value: summary.signed, colour: '#22c55e',
      hint: 'Meetings that closed',
      filter: { outcomes: ['signed'] },
    },
    {
      label: 'Close rate',
      // null and 0% are different claims: one is "none converted", the other is
      // "nothing has happened yet to convert".
      value: summary.closeRate === null ? '-' : `${summary.closeRate}%`,
      colour: '#a855f7',
      hint: summary.closeRate === null
        ? 'No meetings have happened yet, so there is nothing to work it out from'
        : `${summary.signed} signed out of ${summary.done} that happened`,
    },
    {
      label: 'Follow-ups due', value: summary.followUpsDue, colour: '#ec4899',
      hint: 'A follow-up date that has arrived or gone by',
      filter: { outcomes: ['follow_up'] },
      warn: summary.followUpsDue > 0,
    },
  ]

  return (
    <div>
      {scope && (
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cal-muted)' }}>
          {scope}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {tiles.map(t => {
          const clickable = !!(onFilter && t.filter)
          const Inner = (
            <>
              <p className="text-xl font-black tracking-tight tabular-nums" style={{ color: t.colour }}>{t.value}</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-wider leading-tight" style={{ color: 'var(--cal-muted)' }}>
                {t.label}
              </p>
            </>
          )
          const style = {
            background: t.warn ? 'rgba(245,158,11,0.08)' : 'var(--cal-surface)',
            border: `1px solid ${t.warn ? 'rgba(245,158,11,0.35)' : 'var(--cal-border)'}`,
          }
          return clickable ? (
            <button key={t.label} title={`${t.hint} · click to show them`} onClick={() => onFilter!(t.filter!)}
              className="rounded-xl p-2.5 text-left transition hover:brightness-125" style={style}>
              {Inner}
            </button>
          ) : (
            <div key={t.label} title={t.hint} className="rounded-xl p-2.5" style={style}>
              {Inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
