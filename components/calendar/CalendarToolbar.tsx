'use client'

import { ChevronLeft, ChevronRight, CalendarDays, Columns3, Square, List } from 'lucide-react'
import { periodLabel, type CalendarView } from '@/lib/calendar'

// Where you are, how you are looking at it, and how to move.

const VIEWS: { id: CalendarView; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: 'month', label: 'Month', icon: CalendarDays, hint: 'Month view (M)' },
  { id: 'week', label: 'Week', icon: Columns3, hint: 'Week view (W)' },
  { id: 'day', label: 'Day', icon: Square, hint: 'Day view (D)' },
  { id: 'list', label: 'List', icon: List, hint: 'Every meeting as a list (L)' },
]

export default function CalendarToolbar({
  view, anchor, onView, onShift, onToday, right,
}: {
  view: CalendarView
  anchor: Date
  onView: (v: CalendarView) => void
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  right?: React.ReactNode
}) {
  const isList = view === 'list'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onShift(-1)}
          disabled={isList}
          aria-label="Previous period"
          title="Previous (left arrow)"
          className="w-9 h-9 rounded-xl grid place-items-center transition disabled:opacity-30"
          style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onShift(1)}
          disabled={isList}
          aria-label="Next period"
          title="Next (right arrow)"
          className="w-9 h-9 rounded-xl grid place-items-center transition disabled:opacity-30"
          style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onToday}
          title="Back to today (T)"
          className="h-9 px-3 rounded-xl text-xs font-bold transition"
          style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
          Today
        </button>
      </div>

      <p className="font-display text-base sm:text-lg font-bold px-1 flex-1 min-w-[150px]"
        style={{ color: 'var(--cal-text)' }}>
        {periodLabel(view, anchor)}
      </p>

      <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--cal-raised)' }}>
        {VIEWS.map(({ id, label, icon: Icon, hint }) => {
          const active = view === id
          return (
            <button key={id} onClick={() => onView(id)} title={hint}
              aria-pressed={active}
              className="flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-lg text-xs font-bold transition"
              style={active
                ? { background: '#7c3aed', color: '#fff' }
                : { color: 'var(--cal-muted)' }}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>

      {right}
    </div>
  )
}
