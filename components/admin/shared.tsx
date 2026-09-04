'use client'

import type { UserStatus } from '@/lib/admin-data'

export const grad = 'hsl(var(--accent))'

export const inputClass =
  'w-full px-3 py-2 rounded-lg border text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition'
export const inputStyle = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }

// One place that decides what each status looks like and, more importantly,
// what it MEANS. The old dashboard had a single grey "Free" pill covering
// trialing, expired and legacy-free users alike, which made the one state that
// matters (their card is dark) invisible.
export const STATUS_META: Record<UserStatus, { label: string; colour: string; hint: string }> = {
  paying:   { label: 'Paying',   colour: '#22c55e', hint: 'Live Paystack subscription' },
  comped:   { label: 'Comped',   colour: '#0ea5e9', hint: 'Free Pro we granted. Not revenue.' },
  member:   { label: 'Team',     colour: '#f472b6', hint: 'Card served by their org, never gated on a personal trial' },
  trial:    { label: 'Trial',    colour: '#a855f7', hint: 'On the 60-day trial' },
  expiring: { label: 'Expiring', colour: '#f59e0b', hint: 'Trial ends within 7 days' },
  expired:  { label: 'Expired',  colour: '#ef4444', hint: 'Their public card is OFFLINE right now' },
  none:     { label: 'Unknown',  colour: '#6b7280', hint: 'No plan and no trial date' },
}

export function StatusPill({ status, daysLeft }: { status: UserStatus; daysLeft?: number | null }) {
  const m = STATUS_META[status]
  const suffix =
    status === 'expiring' && daysLeft != null ? ` ${daysLeft}d` :
    status === 'trial' && daysLeft != null ? ` ${daysLeft}d` : ''
  return (
    <span
      title={m.hint}
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: `${m.colour}1f`, color: m.colour, border: `1px solid ${m.colour}55` }}
    >
      {m.label}{suffix}
    </span>
  )
}

export function Stat({ label, value, colour, hint, warn }: {
  label: string; value: string | number; colour?: string; hint?: string; warn?: boolean
}) {
  return (
    <div className="rounded-lg p-4 border" title={hint}
      style={{
        background: warn ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
        borderColor: warn ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)',
      }}>
      <p className="text-2xl font-bold tracking-tight" style={{ color: colour || '#fff' }}>{value}</p>
      <p className="text-[11px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
    </div>
  )
}

export function Section({ title, sub, children, right }: {
  title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-white">{title}</h2>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function fmtDate(d?: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtWhen(d?: string | null): string {
  if (!d) return 'never'
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function randFmt(n: number): string {
  return 'R' + n.toLocaleString('en-ZA')
}
