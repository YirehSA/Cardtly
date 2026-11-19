'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Download, Lock } from 'lucide-react'
import { RESELLER_LEVELS, levelByKey, levelProgress, levelRank, progressLine, type LevelKey } from '@/lib/reseller-levels'
import { badgePngPath, badgeWebpPath } from '@/lib/reseller-badge'

// The reseller's level on their own page: their badge, how far to the next
// level, what every level unlocks, and the badge to download. Rules in
// lib/reseller-levels, the badge files in lib/reseller-badge.

const SIZES = { sm: 28, md: 56, lg: 136 } as const

/**
 * The level badge: Andre's artwork (lib/reseller-badge). `locked` greys it
 * out, for a level not reached yet.
 */
export function LevelBadge({ levelKey, size = 'md', locked = false }: {
  levelKey: LevelKey; size?: keyof typeof SIZES | number; locked?: boolean
}) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const level = levelByKey(levelKey)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={badgeWebpPath(level.key)} width={px} height={px} loading="lazy" decoding="async"
      alt={`${level.name} reseller badge${locked ? ', not reached yet' : ''}`}
      className="inline-block flex-shrink-0 select-none"
      style={{ width: px, height: px, filter: locked ? 'grayscale(1)' : undefined, opacity: locked ? 0.45 : 1 }} />
  )
}

export default function ResellerLevelCard({ cardsSold }: { cardsSold: number }) {
  const p = levelProgress(cardsSold)
  // Open while there is still a level to reach, so a new reseller sees what
  // is on offer without looking for it.
  const [open, setOpen] = useState(p.level.key !== 'platinum')
  const rank = levelRank(p.level.key)
  // Something to show off from Bronze, the first level that is earned.
  const downloadable = rank >= levelRank('bronze')

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <LevelBadge levelKey={p.level.key} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your reseller level</p>
          <p className="text-2xl font-bold leading-tight mt-0.5">{p.level.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{progressLine(p)}</p>

          {p.next && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
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
              <LevelBadge levelKey={p.next.key} size="sm" locked />
            </div>
          )}

          {downloadable && (
            <a href={badgePngPath(p.level.key)} download={`cardtly-${p.level.key}-reseller.png`}
              className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
              <Download className="w-4 h-4" />Download your badge
            </a>
          )}
          {downloadable && (
            <p className="text-xs text-muted-foreground mt-1.5">Show it on your website, email signature and social posts.</p>
          )}
        </div>
      </div>

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
                  }}>
                  <div className="flex items-center gap-2.5">
                    <LevelBadge levelKey={l.key} size="md" locked={!reached} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1">
                        {l.name}
                        {reached
                          ? <Check className="w-3.5 h-3.5 text-emerald-500" aria-label="reached" />
                          : <Lock className="w-3 h-3 text-muted-foreground" aria-label="not reached yet" />}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {l.from === 0 ? 'From your first card' : `From ${l.from} cards`}
                      </p>
                    </div>
                  </div>
                  <ul className={`mt-2 space-y-1 ${reached ? '' : 'opacity-75'}`}>
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
