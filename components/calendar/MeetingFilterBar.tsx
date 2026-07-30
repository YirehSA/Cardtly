'use client'

import { useState } from 'react'
import { Search, X, SlidersHorizontal, AlertTriangle } from 'lucide-react'
import { MEETING_STATUSES, MEETING_OUTCOMES } from '@/lib/rep-meetings'
import {
  activeFilterCount, filterIsActive, EMPTY_FILTER,
  type MeetingFilterState, type OutcomeFilter,
} from '@/lib/meeting-filters'
import { repColour } from '@/lib/calendar'
import { inputClass, inputStyle } from './shared'

// Search and narrow. Shared by the rep's calendar and the admin's, so the two
// can never disagree about what "no show" means or what an empty chip row does.

export interface FilterRep { id: string; name: string }

export default function MeetingFilterBar({
  filter, onChange, reps, searchRef, hits, total,
}: {
  filter: MeetingFilterState
  onChange: (f: MeetingFilterState) => void
  /** Only passed where more than one rep is on screen. */
  reps?: FilterRep[] | null
  searchRef?: React.RefObject<HTMLInputElement>
  /** How many meetings match, out of how many there are. Shown so a filter that
   *  is hiding things can never do it silently. */
  hits: number
  total: number
}) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filter)
  const active = filterIsActive(filter)

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter(x => x !== value) : [...list, value]
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--cal-muted)' }} />
          <input
            ref={searchRef}
            value={filter.q}
            onChange={e => onChange({ ...filter, q: e.target.value })}
            placeholder="Search company, person, phone, notes..."
            aria-label="Search meetings"
            className={inputClass + ' pl-9 pr-9'}
            style={inputStyle}
          />
          {filter.q && (
            <button onClick={() => onChange({ ...filter, q: '' })} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center transition"
              style={{ color: 'var(--cal-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="h-[38px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
          style={{
            border: `1px solid ${count > 0 ? '#7c3aed' : 'var(--cal-border)'}`,
            color: count > 0 ? '#a855f7' : 'var(--cal-text)',
            background: count > 0 ? 'rgba(124,58,237,0.10)' : undefined,
          }}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </button>
      </div>

      {/* Said out loud whenever a filter is on. A calendar quietly hiding two
          thirds of the meetings looks identical to a quiet month. */}
      {active && (
        <p className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--cal-muted)' }}>
          <span><strong style={{ color: 'var(--cal-text)' }}>{hits}</strong> of {total} meetings match</span>
          <button onClick={() => onChange({ ...EMPTY_FILTER })}
            className="font-bold hover:underline" style={{ color: '#a855f7' }}>
            Clear filters
          </button>
        </p>
      )}

      {open && (
        <div className="rounded-2xl border p-3 space-y-3"
          style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>

          <Group label="Status">
            {MEETING_STATUSES.map(s => (
              <ChipToggle key={s.id} label={s.label} colour={s.colour}
                on={filter.statuses.includes(s.id)}
                onClick={() => onChange({ ...filter, statuses: toggle(filter.statuses, s.id) })} />
            ))}
            <ChipToggle
              label="Needs an outcome"
              colour="#f59e0b"
              icon={<AlertTriangle className="w-3 h-3" />}
              title="Still marked planned, but the time has passed"
              on={filter.overdueOnly}
              onClick={() => onChange({ ...filter, overdueOnly: !filter.overdueOnly })} />
          </Group>

          <Group label="Outcome">
            {MEETING_OUTCOMES.map(o => (
              <ChipToggle key={o.id} label={o.label} colour={o.colour}
                on={filter.outcomes.includes(o.id)}
                onClick={() => onChange({ ...filter, outcomes: toggle<OutcomeFilter>(filter.outcomes, o.id) })} />
            ))}
            <ChipToggle label="Not recorded" colour="#94a3b8"
              title="Happened, but nobody said what came of it"
              on={filter.outcomes.includes('none')}
              onClick={() => onChange({ ...filter, outcomes: toggle<OutcomeFilter>(filter.outcomes, 'none') })} />
          </Group>

          {reps && reps.length > 0 && (
            <Group label={`Rep${filter.repIds.length ? ` · ${filter.repIds.length} selected` : ' · everyone'}`}>
              {reps.map(r => (
                <ChipToggle key={r.id} label={r.name} colour={repColour(r.id)}
                  on={filter.repIds.includes(r.id)}
                  onClick={() => onChange({ ...filter, repIds: toggle(filter.repIds, r.id) })} />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cal-muted)' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function ChipToggle({ label, colour, on, onClick, title, icon }: {
  label: string; colour: string; on: boolean; onClick: () => void; title?: string; icon?: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} aria-pressed={on}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
      style={on
        ? { background: colour + '26', color: colour, border: `1px solid ${colour}` }
        : { background: 'var(--cal-raised)', color: 'var(--cal-muted)', border: '1px solid transparent' }}>
      {icon}
      {label}
    </button>
  )
}
