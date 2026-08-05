'use client'

import { useState, useMemo } from 'react'
import { CalendarX2, ExternalLink, Loader2, Eye, AlertTriangle } from 'lucide-react'
import { Section, fmtWhen, StatusPill } from './shared'
import type { AdminUserRow } from '@/lib/admin-data'

// When every trial runs out, and whose card goes dark with it.
//
// Built after a Paystack reconciliation turned up something the books could not
// show: 63 profiles carry the identical trial_ends_at, to the microsecond, from
// one bulk backfill in July. On that date 30 live cards stop serving in the same
// minute, and every printed QR and NFC card behind them stops with it. The
// admin could see "50 on trial" but not that they were nearly all the SAME day,
// which is the difference between a pipeline and a cliff.
//
// Grouped by date on purpose. A flat list sorted by days-left would have shown
// the same 30 rows and told you nothing.

interface Props {
  users: AdminUserRow[]
  onExtend: (user: AdminUserRow, days: number) => Promise<boolean>
  loading: string | null
}

// A card only goes dark on the trial clock if the trial is the thing holding it
// up. Paying, comped and team-served accounts carry their own precedence in
// status, so filtering on it here keeps this honest - the old "trial ending
// soonest" sort had to learn the same lesson when it started ranking team rows
// on a countdown that meant nothing.
//
// Known edge, measured rather than assumed: somebody who holds a team card AND
// a personal one reads as 'member' and is left out, even though their PERSONAL
// card is still gated on their own trial and would go dark. Today that is
// exactly one account - info@cardtly.com, one view - so it is documented rather
// than restructured. If team cards ever become common among people who also
// keep a personal card, this filter needs to look at the card, not the status.
const AT_RISK = new Set(['trial', 'expiring', 'expired'])

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ExpiryBoard({ users, onExtend, loading }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  const groups = useMemo(() => {
    const atRisk = users.filter(u => AT_RISK.has(u.status) && u.card && u.trialEndsAt)
    const by: Record<string, { when: string; users: AdminUserRow[] }> = {}
    for (const u of atRisk) {
      const k = dayKey(u.trialEndsAt!)
      ;(by[k] ||= { when: u.trialEndsAt!, users: [] }).users.push(u)
    }
    return Object.entries(by)
      .map(([key, g]) => ({
        key,
        when: g.when,
        daysAway: Math.ceil((new Date(g.when).getTime() - Date.now()) / 86400000),
        // Most-used first: a card with 122 views is a customer, one with 0 is a
        // signup that never went anywhere, and they deserve different effort.
        users: g.users.sort((a, b) => (b.card?.views || 0) - (a.card?.views || 0)),
        views: g.users.reduce((n, u) => n + (u.card?.views || 0), 0),
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [users])

  const total = groups.reduce((n, g) => n + g.users.length, 0)
  const biggest = groups.reduce<null | (typeof groups)[number]>((b, g) => (!b || g.users.length > b.users.length ? g : b), null)

  if (total === 0) {
    return (
      <Section title="Expiring cards" sub="Nothing is running down a trial clock right now.">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Every live card is on a subscription, a comp, or a team.
        </p>
      </Section>
    )
  }

  return (
    <Section
      title="Expiring cards"
      sub={`${total} card${total === 1 ? '' : 's'} go dark when their trial ends${
        biggest && biggest.users.length > 4 ? ` · ${biggest.users.length} of them on ${fmtDay(biggest.when)}` : ''
      }`}
    >
      {biggest && biggest.users.length > 4 && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-2.5"
          style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
            <strong style={{ color: '#f59e0b' }}>{biggest.users.length} cards expire together on {fmtDay(biggest.when)}</strong>
            {biggest.daysAway > 0 ? `, ${biggest.daysAway} days away` : ''}. They were all given the same trial
            in one go, so they end in the same minute - every printed QR and NFC card behind them stops working
            that morning, and they all get the "your card is offline" email in one batch.
            Worth working the list below before then, starting at the top where the usage is.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {groups.map(g => {
          const isOpen = open === g.key
          const cliff = g.users.length > 4
          return (
            <div key={g.key} className="rounded-xl border"
              style={{ borderColor: cliff ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <button onClick={() => setOpen(isOpen ? null : g.key)}
                className="w-full text-left p-3.5 flex items-center gap-3 flex-wrap transition hover:bg-white/[0.03]">
                <CalendarX2 className="w-4 h-4 flex-shrink-0" style={{ color: cliff ? '#f59e0b' : 'rgba(255,255,255,0.35)' }} />
                <div className="flex-1 min-w-[170px]">
                  <p className="text-sm font-semibold text-white">{fmtDay(g.when)}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {g.daysAway <= 0 ? 'already past' : `in ${g.daysAway} day${g.daysAway === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm" style={{ color: cliff ? '#f59e0b' : '#fff' }}>{g.users.length}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>cards</p>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className="font-bold text-sm" style={{ color: '#0ea5e9' }}>{g.views}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>views</p>
                </div>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{isOpen ? 'Hide' : 'Show'}</span>
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-0 space-y-1.5">
                  {g.users.map(u => (
                    <div key={u.id} className="rounded-lg p-2.5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white">{u.card?.name || u.email}</span>
                        <StatusPill status={u.status} daysLeft={u.trialDaysLeft} />
                        {u.card?.slug && (
                          <a href={`/card/${u.card.slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] inline-flex items-center gap-1 hover:underline"
                            style={{ color: '#0ea5e9' }}>
                            /{u.card.slug}<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        <span className="ml-auto text-[11px] inline-flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <Eye className="w-3 h-3" />{u.card?.views ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-1.5">
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{u.email}</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          seen {fmtWhen(u.last_sign_in_at)}
                        </span>
                        {u.remindersSent.length > 0 && (
                          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            emailed: {u.remindersSent.join(', ')}
                          </span>
                        )}
                        <span className="ml-auto flex gap-1.5">
                          {[30, 90].map(d => (
                            <button key={d}
                              disabled={loading === `trial-${u.id}`}
                              onClick={() => onExtend(u, d)}
                              className="text-[11px] px-2 py-1 rounded-md font-semibold transition hover:bg-white/10 disabled:opacity-40"
                              style={{ border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                              {loading === `trial-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : `+${d}d`}
                            </button>
                          ))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
