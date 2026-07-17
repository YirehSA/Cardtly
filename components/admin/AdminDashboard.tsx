'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Users as UsersIcon, Building2, Search, Loader2, Trash2, Mail, MailCheck,
  KeyRound, Lock, Shield, Sparkles, ChevronDown, ChevronUp, ExternalLink, Megaphone,
  ScrollText, Wifi, AlertTriangle, CalendarClock, X, LayoutGrid, UserCog, Banknote,
} from 'lucide-react'
import TeamsTab from './TeamsTab'
import RepsTab from './RepsTab'
import { Stat, Section, StatusPill, STATUS_META, grad, inputClass, inputStyle, fmtDate, fmtWhen, randFmt } from './shared'
import { NFC_STATUSES, NFC_STATUS_COLORS, NFC_STATUS_LABELS, type NfcStatus } from '@/lib/nfc'
import type { AdminUserRow, AdminOrgRow, UserStatus } from '@/lib/admin-data'
import type { RepStats } from '@/lib/reps'

interface Stats {
  totalUsers: number; paying: number; comped: number; members: number
  trialing: number; expiring: number; expired: number
  totalCards: number; totalTeamCards: number; totalOrgs: number
  openNfcOrders: number; totalContacts: number
  views30d: number; views30dTruncated: boolean
  teamTrialsLapsed: number; teamTrialsEnding: number
  debitOrdersToCollect: number; debitOrderRandDue: number
  suspendedTeams: number
  mrrRand: number | null
  mrrError: string | null
  paystackSubs: { subscription_code: string; amount: number; email: string; next_payment_date: string | null }[]
}

interface Props {
  users: AdminUserRow[]
  orgs: AdminOrgRow[]
  cards: any[]
  teamCards: any[]
  nfcOrders: any[]
  audit: any[]
  reps: RepStats[]
  stats: Stats
  announcement: any | null
}

type Tab = 'overview' | 'users' | 'teams' | 'reps' | 'nfc' | 'activity'
type Filter = 'all' | UserStatus | 'admins' | 'unconfirmed'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'expired', label: 'Expired' },
  { id: 'expiring', label: 'Expiring' },
  { id: 'trial', label: 'Trial' },
  { id: 'paying', label: 'Paying' },
  { id: 'comped', label: 'Comped' },
  { id: 'member', label: 'Team' },
  { id: 'admins', label: 'Admins' },
  { id: 'unconfirmed', label: 'Unconfirmed' },
]

export default function AdminDashboard({ users, orgs, cards, teamCards, nfcOrders, audit, reps, stats, announcement }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Every mutation refetches from the server. The old dashboard patched local
  // state instead, so the stats and view counts went stale the moment you
  // touched anything and never recovered without a manual reload.
  async function run(key: string, body: object, okMsg: string): Promise<boolean> {
    setLoading(key)
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok || data?.error) {
      // One refusal is recoverable: comping someone Paystack still bills.
      // Offer the override right here. The route can say "confirm to do it
      // anyway" precisely because there is a way to confirm; an error that
      // names an escape hatch the UI does not provide is just a dead end.
      // force:true means the retry cannot 409 again, so this recurses once.
      if (data?.needsForce && confirm(`${data.error}\n\nComp them anyway?`)) {
        return run(key, { ...body, force: true }, okMsg)
      }
      toast.error(data?.error || 'That did not work', { duration: 9000 })
      return false
    }
    toast.success(okMsg)
    router.refresh()
    return true
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return users.filter(u => {
      if (filter === 'admins' && !u.isAdmin) return false
      if (filter === 'unconfirmed' && u.email_confirmed) return false
      if (filter !== 'all' && filter !== 'admins' && filter !== 'unconfirmed' && u.status !== filter) return false
      if (!needle) return true
      // Search everything you might actually know about a person. The old one
      // matched email substrings only, so you could not find someone by their
      // card name, slug, or team.
      return [u.email, u.card?.name, u.card?.slug, u.org?.name, u.memberOfOrg, u.country, u.city, u.id]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(needle))
    })
  }, [users, q, filter])

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#0a0a0a' }}>
      <div className="max-w-7xl mx-auto space-y-5">

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Cardtly admin</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {stats.totalUsers} users · {stats.totalCards} cards · {orgs.length} teams
            </p>
          </div>
          <Link href="/dashboard" className="text-sm px-3 py-2 rounded-lg transition hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
            Back to dashboard
          </Link>
        </div>

        {/* The one thing that needs saying loudly: whose card is dark. */}
        {stats.expired > 0 && (
          <button onClick={() => { setTab('users'); setFilter('expired'); setQ('') }}
            className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition hover:opacity-90"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
            <div>
              <p className="font-bold text-sm" style={{ color: '#ef4444' }}>
                {stats.expired} {stats.expired === 1 ? 'card is' : 'cards are'} offline right now
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Their trial ended, so their public link 404s for anyone they hand it to. Click to see them.
              </p>
            </div>
          </button>
        )}

        {/* Teams needing a human. Nothing enforces either of these, so if
            this is not said here it is not said anywhere. */}
        {(stats.teamTrialsLapsed > 0 || stats.teamTrialsEnding > 0 || stats.debitOrdersToCollect > 0) && (
          <button onClick={() => setTab('teams')}
            className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition hover:opacity-90"
            style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.4)' }}>
            <Banknote className="w-5 h-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <div>
              <p className="font-bold text-sm" style={{ color: '#f59e0b' }}>
                {[
                  stats.teamTrialsLapsed > 0 ? `${stats.teamTrialsLapsed} team trial${stats.teamTrialsLapsed === 1 ? '' : 's'} lapsed` : null,
                  stats.teamTrialsEnding > 0 ? `${stats.teamTrialsEnding} ending this week` : null,
                  stats.debitOrdersToCollect > 0 ? `${stats.debitOrdersToCollect} debit order${stats.debitOrdersToCollect === 1 ? '' : 's'} to load (${randFmt(stats.debitOrderRandDue)})` : null,
                ].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Their cards are still live and still free. Nothing collects a debit order automatically. Click to sort it.
              </p>
            </div>
          </button>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {([
            ['overview', 'Overview', LayoutGrid],
            ['users', 'Users', UsersIcon],
            ['teams', 'Teams', Building2],
            ['reps', 'Reps', UserCog],
            ['nfc', 'NFC orders', Wifi],
            ['activity', 'Activity', ScrollText],
          ] as [Tab, string, any][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition"
              style={tab === id
                ? { background: grad, color: '#fff' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Icon className="w-4 h-4" />
              {label}
              {id === 'nfc' && stats.openNfcOrders > 0 && (
                <span className="px-1.5 rounded text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                  {stats.openNfcOrders}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                label="MRR (Paystack)"
                value={stats.mrrRand == null ? '?' : randFmt(stats.mrrRand)}
                colour="#22c55e"
                hint={stats.mrrError
                  ? `Could not reach Paystack: ${stats.mrrError}`
                  : 'Summed from the real amounts Paystack is billing. Team seats are NOT included: nothing bills orgs through a subscription, so counting them would invent money.'}
              />
              <Stat label="Paying" value={stats.paying} colour="#22c55e" hint="Live Paystack subscription" />
              <Stat label="Comped" value={stats.comped} colour="#0ea5e9" hint="Free Pro we granted. Not revenue." />
              <Stat label="Cards offline" value={stats.expired} colour="#ef4444" warn={stats.expired > 0} hint="Trial ended: their public card 404s" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Expiring in 7d" value={stats.expiring} colour="#f59e0b" />
              <Stat label="On trial" value={stats.trialing} colour="#a855f7" />
              <Stat label="Team members" value={stats.members} colour="#f472b6" hint="Access via their org, not a personal trial" />
              <Stat label="Total users" value={stats.totalUsers} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Cards" value={stats.totalCards} />
              <Stat label="Team cards" value={stats.totalTeamCards} />
              <Stat label="Leads captured" value={stats.totalContacts} />
              <Stat
                label={stats.views30dTruncated ? 'Views 30d (a floor)' : 'Views 30d'}
                value={stats.views30dTruncated ? `${stats.views30d.toLocaleString()}+` : stats.views30d.toLocaleString()}
                hint={stats.views30dTruncated ? 'Hit the paging cap, so this is a lower bound, not the real number.' : undefined}
              />
            </div>

            <AnnouncementBox announcement={announcement} run={run} loading={loading} />

            <Section title="Top cards" sub="By views in the last 30 days">
              <div className="space-y-1">
                {cards.slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 text-xs rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-white flex-1 truncate">{c.name || 'Untitled'}</span>
                    {c.slug && (
                      <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 transition hover:text-white" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        /{c.slug} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="tabular-nums w-16 text-right" style={{ color: '#a855f7' }}>{c.views_30d} / 30d</span>
                    <span className="tabular-nums w-20 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.view_count || 0} all time</span>
                  </div>
                ))}
                {cards.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No cards yet.</p>}
              </div>
            </Section>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search email, card name, slug, team, country, user id"
                className={inputClass + ' pl-9'} style={inputStyle} />
              {q && (
                <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10">
                  <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => {
                const n = f.id === 'all' ? users.length
                  : f.id === 'admins' ? users.filter(u => u.isAdmin).length
                  : f.id === 'unconfirmed' ? users.filter(u => !u.email_confirmed).length
                  : users.filter(u => u.status === f.id).length
                const colour = (STATUS_META as any)[f.id]?.colour
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)} disabled={n === 0 && f.id !== 'all'}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
                    style={filter === f.id
                      ? { background: colour ? `${colour}25` : 'rgba(255,255,255,0.15)', color: colour || '#fff', border: `1px solid ${colour || 'rgba(255,255,255,0.3)'}` }
                      : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {f.label} {n}
                  </button>
                )
              })}
            </div>

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{filtered.length} of {users.length}</p>

            <div className="space-y-1.5">
              {filtered.map(u => (
                <UserRow key={u.id} u={u} expanded={expanded === u.id} reps={reps}
                  onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
                  run={run} loading={loading} />
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Nobody matches that.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'teams' && (
          <TeamsTab orgs={orgs} users={users} reps={reps} loading={loading}
            onAssignRep={(orgId, repId) => run(`reporg-${orgId}`, { action: 'assign_rep', org_id: orgId, rep_id: repId }, repId ? 'Team linked to rep' : 'Rep unlinked')}
            onMarkCollected={(orgId) => run(`collect-${orgId}`, { action: 'mark_collected', org_id: orgId }, 'Recorded as collected today')}
            onSuspend={(orgId, suspended, message) => run(`susp-${orgId}`, { action: 'set_org_suspended', org_id: orgId, suspended, message }, suspended ? 'Team suspended. Their cards still work, with a notice.' : 'Suspension lifted')}
            onSave={(f) => run(`org-${f.userId}`, {
              action: 'create_org',
              user_id: f.userId,
              org_name: f.name,
              seat_count: Number(f.seats),
              billing_period: f.mode,
              billing_notes: f.notes || null,
              trial_ends_at: f.trialEndsAt || null,
            }, `${f.name}: ${f.seats} seats, ${f.mode === 'comp' ? 'free' : f.mode.replace('_', ' ')}`)} />
        )}

        {tab === 'reps' && (
          <RepsTab reps={reps} loading={loading}
            onSave={(f) => run('rep-save', {
              action: 'upsert_rep',
              rep_id: f.repId,
              name: f.name,
              email: f.email || null,
              phone: f.phone || null,
              target_cards: Number(f.target),
              commission_rand: Number(f.rate),
              started_on: f.startedOn || null,
              notes: f.notes || null,
              active: f.active,
            }, `${f.name} saved`)} />
        )}

        {tab === 'nfc' && <NfcTab orders={nfcOrders} run={run} loading={loading} />}
        {tab === 'activity' && <ActivityTab audit={audit} />}
      </div>
    </div>
  )
}

// ── User row ──────────────────────────────────────────────────────────────

function UserRow({ u, expanded, onToggle, run, loading, reps }: {
  u: AdminUserRow; expanded: boolean; onToggle: () => void; reps: RepStats[]
  run: (key: string, body: object, msg: string) => Promise<boolean>
  loading: string | null
}) {
  const [extend, setExtend] = useState('14')

  return (
    <div className="rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="p-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-white text-sm truncate">{u.email}</p>
            <StatusPill status={u.status} daysLeft={u.trialDaysLeft} />
            {u.isAdmin && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)' }}>Admin</span>
            )}
            {!u.email_confirmed && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>Unconfirmed</span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>Joined {fmtDate(u.created_at)}</span>
            <span>·</span>
            <span title="Last sign in">Seen {fmtWhen(u.last_sign_in_at)}</span>
            {u.org && <><span>·</span><span style={{ color: '#f472b6' }}>{u.org.name} ({u.org.cardsClaimed}/{u.org.maxSeats})</span></>}
            {u.memberOfOrg && <><span>·</span><span style={{ color: '#f472b6' }}>member of {u.memberOfOrg}</span></>}
            {u.country && <><span>·</span><span>{u.city ? `${u.city}, ` : ''}{u.country}</span></>}
          </p>
        </div>

        {u.card?.slug && (
          <a href={`/card/${u.card.slug}`} target="_blank" rel="noreferrer"
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            /{u.card.slug} <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>{u.views} views</span>

        <button onClick={onToggle} className="p-1.5 rounded-lg transition hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          {/* Trial. The old dashboard did not fetch trial_ends_at at all. */}
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <CalendarClock className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#a855f7' }} />
                {u.status === 'member' ? (
                  <>Covered by <strong className="text-white">{u.memberOfOrg}</strong>. Their personal trial does not gate their card.</>
                ) : u.trialEndsAt ? (
                  <>Trial {u.trialDaysLeft != null && u.trialDaysLeft <= 0 ? 'ended' : 'ends'} <strong className="text-white">{fmtDate(u.trialEndsAt)}</strong>
                    {u.trialDaysLeft != null && u.trialDaysLeft > 0 && <> ({u.trialDaysLeft} days)</>}</>
                ) : (
                  <>No trial date. Fails open, so their card stays live.</>
                )}
                {u.remindersSent.length > 0 && (
                  <span className="ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    · emailed: {u.remindersSent.map(k => k.replace('trial_', '')).join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input value={extend} onChange={e => setExtend(e.target.value)} type="number" min={1}
                  className="w-16 px-2 py-1 rounded-lg border text-xs text-white" style={inputStyle} />
                <button
                  disabled={loading === `trial-${u.id}` || !(Number(extend) >= 1)}
                  onClick={() => run(`trial-${u.id}`, { action: 'extend_trial', user_id: u.id, days: Number(extend) }, `Trial extended by ${extend} days`)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition hover:bg-white/10 disabled:opacity-40"
                  style={{ border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
                  {loading === `trial-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Extend'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {u.planId && (
              <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
                {u.planId}{u.billingCycle ? ` · ${u.billingCycle}` : ''}
              </span>
            )}
            {u.status === 'paying' ? (
              <button disabled={loading === `pro-${u.id}`}
                onClick={() => {
                  if (!confirm(`Cancel ${u.email}'s Paystack subscription and remove Pro?\n\nPaystack is cancelled first. If that fails, nothing changes and they keep access.`)) return
                  run(`pro-${u.id}`, { action: 'deactivate_pro', user_id: u.id }, 'Cancelled at Paystack and removed Pro')
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                {loading === `pro-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel subscription'}
              </button>
            ) : u.status === 'comped' ? (
              <button disabled={loading === `pro-${u.id}`}
                onClick={() => run(`pro-${u.id}`, { action: 'deactivate_pro', user_id: u.id }, 'Comp removed')}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                {loading === `pro-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove comp'}
              </button>
            ) : (
              <button disabled={loading === `pro-${u.id}`}
                onClick={() => run(`pro-${u.id}`, { action: 'activate_pro', user_id: u.id, email: u.email }, `${u.email} comped to Pro`)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: grad }}>
                {loading === `pro-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 inline mr-1" />Comp to Pro</>}
              </button>
            )}

            {reps.length > 0 && (
              <select
                value={u.repId || ''}
                disabled={loading === `rep-${u.id}`}
                onChange={e => run(`rep-${u.id}`, { action: 'assign_rep', user_id: u.id, rep_id: e.target.value || null },
                  e.target.value ? 'Client linked to rep' : 'Rep unlinked')}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                style={{ ...inputStyle, border: `1px solid ${u.repId ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.12)'}`, color: u.repId ? '#a855f7' : 'rgba(255,255,255,0.5)' }}>
                <option value="" style={{ background: '#1a1a1a' }}>No rep</option>
                {reps.filter(r => r.active).map(r => (
                  <option key={r.id} value={r.id} style={{ background: '#1a1a1a' }}>Rep: {r.name}</option>
                ))}
              </select>
            )}

            <button disabled={loading === `admin-${u.id}`}
              onClick={() => run(`admin-${u.id}`, { action: 'set_admin', user_id: u.id, value: !u.isAdmin }, u.isAdmin ? 'Admin removed' : 'Admin granted')}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
              style={{ border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
              <Shield className="w-3 h-3 inline mr-1" />{u.isAdmin ? 'Remove admin' : 'Make admin'}
            </button>
          </div>

          {/* Labelled, not five identical icons with delete next to set-password. */}
          <div className="flex gap-2 flex-wrap">
            <SmallBtn icon={Mail} label="Resend confirmation" busy={loading === `conf-${u.id}`}
              onClick={() => run(`conf-${u.id}`, { action: 'resend_confirmation', email: u.email }, 'Confirmation sent')} />
            {!u.email_confirmed && (
              <SmallBtn icon={MailCheck} label="Force confirm" busy={loading === `force-${u.id}`}
                onClick={() => run(`force-${u.id}`, { action: 'force_confirm', user_id: u.id }, 'Email confirmed')} />
            )}
            <SmallBtn icon={KeyRound} label="Send reset link" busy={loading === `reset-${u.id}`}
              onClick={() => run(`reset-${u.id}`, { action: 'send_password_reset', email: u.email }, 'Reset link sent')} />
            <SmallBtn icon={Lock} label="Set password" busy={loading === `pw-${u.id}`}
              onClick={() => {
                const pw = window.prompt(`Set a new password for ${u.email}\n\nThey will not be told. Prefer "Send reset link" unless they asked for this.`)
                if (!pw) return
                if (pw.length < 8) { toast.error('At least 8 characters'); return }
                run(`pw-${u.id}`, { action: 'set_password', user_id: u.id, password: pw }, 'Password set')
              }} />
            <SmallBtn icon={Trash2} label="Delete account" danger busy={loading === `del-${u.id}`}
              onClick={() => {
                if (!confirm(`Permanently delete ${u.email}?\n\nThis removes their cards, contacts, team cards, orders and subscription rows. It cannot be undone.`)) return
                if (!confirm(`Last check: really delete ${u.email}?`)) return
                run(`del-${u.id}`, { action: 'delete_user', user_id: u.id }, `${u.email} deleted`)
              }} />
          </div>
        </div>
      )}
    </div>
  )
}

function SmallBtn({ icon: Icon, label, onClick, busy, danger }: {
  icon: any; label: string; onClick: () => void; busy?: boolean; danger?: boolean
}) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition hover:bg-white/10 disabled:opacity-40"
      style={danger
        ? { border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }
        : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  )
}

// ── NFC ───────────────────────────────────────────────────────────────────

function NfcTab({ orders, run, loading }: { orders: any[]; run: any; loading: string | null }) {
  const [tracking, setTracking] = useState<Record<string, string>>({})

  return (
    <Section title="NFC orders" sub={`${orders.length} total`}>
      {orders.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No orders yet.</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => {
            const st = (o.status as NfcStatus) || 'pending_payment'
            const colour = NFC_STATUS_COLORS[st] || '#6b7280'
            return (
              <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${colour}1f`, color: colour, border: `1px solid ${colour}55` }}>
                    {NFC_STATUS_LABELS[st] || st}
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm text-white font-medium">{o.full_name || o.email || o.id.slice(0, 8)}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {fmtDate(o.created_at)}
                      {o.quantity ? ` · ${o.quantity}x` : ''}
                      {o.tracking_number ? ` · tracking ${o.tracking_number}` : ''}
                    </p>
                  </div>
                </div>

                {/* Shipping detail. select('*') already loaded this and the old
                    UI showed only city/province, so fulfilling an order meant
                    opening the database. */}
                {(o.address_line1 || o.city) && (
                  <p className="text-[11px] mt-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}>
                    {[o.address_line1, o.address_line2, o.city, o.province, o.postal_code].filter(Boolean).join(', ')}
                    {o.phone ? ` · ${o.phone}` : ''}
                  </p>
                )}

                <div className="flex gap-1.5 flex-wrap mt-2.5 items-center">
                  {NFC_STATUSES.filter(s => s !== st).map(s => (
                    <button key={s} disabled={loading === `nfc-${o.id}`}
                      onClick={() => {
                        if (s === 'cancelled' && !confirm('Cancel this order?')) return
                        // Tracking is deliberately NOT sent. The route only
                        // touches that column when a string is supplied, so a
                        // status change can no longer wipe it.
                        run(`nfc-${o.id}`, { action: 'update_nfc_status', order_id: o.id, status: s }, `Marked ${NFC_STATUS_LABELS[s]}`)
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg font-medium transition hover:bg-white/10 disabled:opacity-40"
                      style={{ border: `1px solid ${NFC_STATUS_COLORS[s]}44`, color: NFC_STATUS_COLORS[s] }}>
                      {NFC_STATUS_LABELS[s]}
                    </button>
                  ))}
                  {/* Editable at any status. It used to render only on 'paid',
                      so tracking could never be corrected once shipped. */}
                  <input
                    value={tracking[o.id] ?? o.tracking_number ?? ''}
                    onChange={e => setTracking(t => ({ ...t, [o.id]: e.target.value }))}
                    placeholder="Tracking number"
                    className="px-2 py-1 rounded-lg border text-[11px] text-white w-40" style={inputStyle} />
                  <button disabled={loading === `nfc-${o.id}`}
                    onClick={() => run(`nfc-${o.id}`, { action: 'update_nfc_status', order_id: o.id, status: o.status, tracking_number: tracking[o.id] ?? '' }, 'Tracking saved')}
                    className="text-[11px] px-2 py-1 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                    style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                    Save tracking
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ── Activity ──────────────────────────────────────────────────────────────

function ActivityTab({ audit }: { audit: any[] }) {
  return (
    <Section title="Recent admin activity" sub="Every admin action runs with the service-role key. This is the only record of who did what.">
      {audit.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Nothing logged yet. If this stays empty after you act, migration 028 has not been applied.
        </p>
      ) : (
        <div className="space-y-1.5">
          {audit.map(a => (
            <div key={a.id} className="flex items-center gap-3 flex-wrap text-xs rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]"
                style={a.ok
                  ? { background: 'rgba(34,197,94,0.14)', color: '#22c55e' }
                  : { background: 'rgba(239,68,68,0.14)', color: '#ef4444' }}>
                {a.action}
              </span>
              <span className="text-white">{a.target_email || a.target_user_id?.slice(0, 8) || '-'}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>by {a.actor_email || 'unknown'}</span>
              <span className="ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmtWhen(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Announcement ──────────────────────────────────────────────────────────

function AnnouncementBox({ announcement, run, loading }: { announcement: any; run: any; loading: string | null }) {
  const [msg, setMsg] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')

  return (
    <Section title="App announcement" sub="Shows in the dashboard for every user."
      right={announcement ? (
        <button disabled={loading === 'ann-clear'}
          onClick={() => run('ann-clear', { action: 'clear_announcement' }, 'Announcement cleared')}
          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
          Clear
        </button>
      ) : undefined}>
      {announcement && (
        <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', color: '#0ea5e9' }}>
          <Megaphone className="w-3 h-3 inline mr-1.5" />
          Live: {announcement.message}
        </p>
      )}
      <div className="space-y-2">
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message" className={inputClass} style={inputStyle} />
        <div className="flex gap-2 flex-wrap">
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="Link URL (optional)" className={inputClass + ' flex-1 min-w-[160px]'} style={inputStyle} />
          <input value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Link text" className={inputClass + ' flex-1 min-w-[120px]'} style={inputStyle} />
          <button disabled={!msg.trim() || loading === 'ann-post'}
            onClick={async () => {
              const ok = await run('ann-post', { action: 'post_announcement', message: msg.trim(), link_url: linkUrl.trim() || null, link_text: linkText.trim() || null, variant: 'info', display_style: 'banner' }, 'Announcement posted')
              if (ok) { setMsg(''); setLinkUrl(''); setLinkText('') }
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: grad }}>
            {loading === 'ann-post' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        </div>
      </div>
    </Section>
  )
}
