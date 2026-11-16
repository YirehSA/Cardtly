'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Gem, Medal, Sprout, Trophy, type LucideIcon } from 'lucide-react'
import { RESELLER_LEVELS, levelProgress, levelRank, progressLine, type LevelKey } from '@/lib/reseller-levels'

// The reseller's level on their own page: where they are, how far to the next
// one, and what every level unlocks. Rules in lib/reseller-levels.

const ICONS: Record<LevelKey, LucideIcon> = {
  starter: Sprout, bronze: Medal, silver: Medal, gold: Trophy, platinum: Gem,
}

export function LevelBadge({ levelKey, size = 'md' }: { levelKey: LevelKey; size?: 'sm' | 'md' }) {
  const level = RESELLER_LEVELS[levelRank(levelKey)]
  const Icon = ICONS[level.key]
  const box = size === 'sm' ? 'w-7 h-7' : 'w-12 h-12'
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-6 h-6'
  return (
    <span className={`${box} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ background: `${level.colour}26`, border: `1px solid ${level.colour}66`, color: level.colour }}
      aria-hidden="true">
      <Icon className={icon} />
    </span>
  )
}

export default function ResellerLevelCard({ cardsSold }: { cardsSold: number }) {
  const p = levelProgress(cardsSold)
  // Open while there is still a level to reach, so a new reseller sees what
  // is on offer without looking for it.
  const [open, setOpen] = useState(p.level.key !== 'platinum')
  const rank = levelRank(p.level.key)

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-4">
        <LevelBadge levelKey={p.level.key} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your reseller level</p>
          <p className="text-xl font-bold leading-tight mt-0.5">{p.level.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{progressLine(p)}</p>
        </div>
      </div>

      {p.next && (
        <div className="mt-4">
          <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar"
            aria-valuemin={p.level.from} aria-valuemax={p.next.from} aria-valuenow={p.cardsSold}
            aria-label={`Cards sold towards ${p.next.name}`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, p.percent)}%`, background: p.next.colour }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
            <span>{p.level.name} ({p.level.from})</span>
            <span>{p.next.name} ({p.next.from})</span>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        What each level unlocks
      </button>

      {open && (
        <>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {RESELLER_LEVELS.map((l, i) => {
              const reached = i <= rank
              const current = i === rank
              return (
                <div key={l.key} className="rounded-lg border p-3"
                  style={{
                    borderColor: current ? l.colour : 'hsl(var(--border))',
                    background: current ? `${l.colour}14` : undefined,
                    opacity: reached || i === rank + 1 ? 1 : 0.75,
                  }}>
                  <div className="flex items-center gap-2">
                    <LevelBadge levelKey={l.key} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1">
                        {l.name}
                        {reached && <Check className="w-3.5 h-3.5 text-emerald-500" aria-label="reached" />}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {l.from === 0 ? 'From your first card' : `From ${l.from} cards`}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {l.rewards.map(r => (
                      <li key={r} className="text-xs text-muted-foreground leading-snug">{r}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Each level keeps everything below it. Every card you have ever sold counts: each client at the most
            seats it has had. So a level is never lost.
          </p>
        </>
      )}
    </div>
  )
}
