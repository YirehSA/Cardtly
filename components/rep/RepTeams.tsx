'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Phone, MessageCircle, Mail, ChevronDown, AlertTriangle, Info, Check, ExternalLink,
  CalendarClock, Search, Eye, UserCheck, Users, Inbox,
} from 'lucide-react'
import { TONE_META, INVITE_WAIT_DAYS, QUIET_DAYS, type Tone } from '@/lib/rep-teams'
import { BILLING_MODE_META, type OrgBillingMode } from '@/lib/org-billing'
import { waLink, waAppLink } from '@/lib/whatsapp'
import { isNativeApp } from '@/lib/capacitor'
import type { RepTeam, RepTeamCard, RepTeamContact } from '@/lib/rep-teams-server'

// My Teams: the teams a rep signed, and which of them need a call.
//
// Worst first. A team is "Needs a call" when something concrete is wrong
// (cards offline, nothing opened in a month, a renewal date passed),
// "Keep an eye on" when something is slipping (invites not accepted, empty
// seats, an owner who stopped signing in), and "Doing well" otherwise. Every
// reason is written out, so the rep knows what to say before they dial.
//
// The call itself is one tap: phone, WhatsApp or email to the owner, with a
// friendly opening already written. Logging it is one more, on Activity Log.

const accent = 'hsl(var(--accent))'

const fmt = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  : ''
const daysAgo = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return Number.isFinite(d) ? d : null
}
// "Acme Holdings' cards", not "Acme Holdings's cards".
const possessive = (name: string) => /s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`
const ago = (iso: string | null | undefined) => {
  const d = daysAgo(iso)
  return d === null ? '' : d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

function Pill({ label, colour }: { label: string; colour: string }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: `${colour}1f`, color: colour, border: `1px solid ${colour}55` }}>
      {label}
    </span>
  )
}

function Stat({ label, value, hint, colour }: { label: string; value: string | number; hint?: string; colour?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1" style={colour ? { color: colour } : undefined}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

/** How the team pays, in words, without a price: reps quote, they do not bill. */
function billingLine(t: RepTeam): string {
  const mode = BILLING_MODE_META[t.billingPeriod as OrgBillingMode]?.short || t.billingPeriod || 'Unknown billing'
  if (t.suspended) return `${mode} · suspended`
  if (t.billingPeriod === 'prepaid') return t.paidUntil ? `Prepaid, paid up to ${fmt(t.paidUntil)}` : 'Prepaid, waiting for the first payment'
  if (t.billingPeriod === 'trial') return t.trialEndsAt ? `Trial until ${fmt(t.trialEndsAt)}` : 'Trial'
  return `${mode}${t.live ? '' : ' · not live'}`
}

const STATUS: Record<RepTeamCard['status'], { label: string; colour: string }> = {
  accepted: { label: 'Accepted', colour: '#22c55e' },
  waiting: { label: 'Invite waiting', colour: '#f59e0b' },
  not_invited: { label: 'Run by the owner', colour: '#94a3b8' },
}

function ContactButtons({ contact, team, repName }: { contact: RepTeamContact; team: RepTeam; repName: string | null }) {
  const first = contact.name?.trim().split(/\s+/)[0] || 'there'
  const opener = `Hi ${first}, it's ${repName || 'your rep'} from Cardtly. I'm checking in to see how ${possessive(team.name)} cards are going, and whether there is anything I can help with.`
  const wa = waLink(contact.phone, opener)
  const tel = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, '')}` : null
  const mail = contact.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(`Checking in on ${possessive(team.name)} Cardtly cards`)}&body=${encodeURIComponent(opener)}`
    : null
  const btn = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground min-w-0">
        <span className="font-semibold text-foreground">{contact.label}</span>
        {contact.name ? `: ${contact.name}` : ''}{contact.email ? ` · ${contact.email}` : ''}
      </span>
      {tel && <a href={tel} className={`${btn} bg-primary/10 text-primary hover:bg-primary/20`}><Phone className="w-3 h-3" />Call</a>}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer"
          // In the Cardtly app a wa.me link opens the phone's browser, not
          // WhatsApp, so open the app by its own address there. See waAppLink.
          onClick={e => {
            const app = isNativeApp() ? waAppLink(contact.phone, opener) : null
            if (app) { e.preventDefault(); window.location.href = app }
          }}
          className={btn} style={{ background: 'rgba(37,211,102,0.12)', color: '#16a34a' }}>
          <MessageCircle className="w-3 h-3" />WhatsApp
        </a>
      )}
      {mail && <a href={mail} className={`${btn} bg-muted text-foreground hover:bg-muted/70`}><Mail className="w-3 h-3" />Email</a>}
      {!tel && !mail && <span className="text-xs text-muted-foreground">No phone or email on record.</span>}
    </div>
  )
}

function TeamCard({ team, repName, showRep }: { team: RepTeam; repName: string | null; showRep: boolean }) {
  const [open, setOpen] = useState(false)
  const h = team.health
  const tone = TONE_META[h.tone]
  const n = h.numbers

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${tone.colour}` }}>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <Building2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base">{team.name}</h2>
              <Pill label={tone.label} colour={tone.colour} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {billingLine(team)}{showRep && team.repName ? ` · ${team.repName}` : ''}
              {team.createdAt ? ` · set up ${fmt(team.createdAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            [Users, 'Seats used', `${n.made} of ${n.seats}`],
            [UserCheck, 'Accepted', `${n.accepted} of ${n.made}`],
            [Eye, `Opens, ${QUIET_DAYS} days`, String(n.opens)],
            [Inbox, `Leads, ${QUIET_DAYS} days`, String(n.leads)],
          ] as const).map(([Icon, label, value]) => (
            <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
              <p className="text-base font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {h.flags.length > 0 ? (
          <ul className="space-y-1.5">
            {h.flags.map((f, i) => {
              const c = f.tone === 'red' ? '#ef4444' : f.tone === 'amber' ? '#f59e0b' : '#0ea5e9'
              const Icon = f.tone === 'blue' ? Info : AlertTriangle
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: c }} />
                  <span>{f.text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4" />Cards are out and being opened. Nothing needs a call.
          </p>
        )}

        <div className="space-y-2 pt-3 border-t border-border">
          {team.contacts.map(c => <ContactButtons key={c.label} contact={c} team={team} repName={repName} />)}
          <Link href="/dashboard/meetings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <CalendarClock className="w-3.5 h-3.5" />Log the call or email on Activity Log
          </Link>
        </div>
      </div>

      {team.cards.length > 0 && (
        <>
          <button onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground border-t border-border bg-muted/30">
            <span>{open ? 'Hide' : 'Show'} the {team.cards.length} card{team.cards.length === 1 ? '' : 's'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul className="divide-y divide-border border-t border-border">
              {team.cards.map(c => {
                const s = STATUS[c.status]
                const waited = c.status === 'waiting' ? daysAgo(c.inviteSentAt) : null
                return (
                  <li key={c.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                        {c.name}
                        {!c.isActive && <Pill label="Switched off" colour="#94a3b8" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.title || 'No job title'}{c.hasPhoto ? '' : ' · no photo'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill label={waited !== null ? `${s.label}, ${waited} day${waited === 1 ? '' : 's'}` : s.label}
                        colour={c.status === 'waiting' && (waited ?? 0) < INVITE_WAIT_DAYS ? '#0ea5e9' : s.colour} />
                      <span className="text-xs text-muted-foreground tabular-nums sm:w-[220px] sm:text-right">
                        {c.opens ? `${c.opens} open${c.opens === 1 ? '' : 's'}, last ${ago(c.lastOpenAt)}` : `Not opened in ${QUIET_DAYS} days`}
                        {c.leads ? ` · ${c.leads} lead${c.leads === 1 ? '' : 's'}` : ''}
                      </span>
                      {c.slug && c.isActive && (
                        <a href={`/card/${c.slug}`} target="_blank" rel="noopener noreferrer" title="Open the card"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function RepTeams({ teams, repName, viewer, inactive = false }: {
  teams: RepTeam[]
  repName: string | null
  viewer: 'rep' | 'admin' | 'admin_all'
  inactive?: boolean
}) {
  const needing = teams.filter(t => t.health.tone !== 'green')
  const [filter, setFilter] = useState<'attention' | 'all'>(needing.length ? 'attention' : 'all')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return teams
      .filter(t => filter === 'all' || t.health.tone !== 'green')
      .filter(t => !needle || [t.name, t.repName, ...t.contacts.flatMap(c => [c.name, c.email])]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(needle)))
  }, [teams, filter, q])

  const count = (tone: Tone) => teams.filter(t => t.health.tone === tone).length
  const opens = teams.reduce((n, t) => n + t.health.numbers.opens, 0)
  const leads = teams.reduce((n, t) => n + t.health.numbers.leads, 0)
  const made = teams.reduce((n, t) => n + t.health.numbers.made, 0)
  const accepted = teams.reduce((n, t) => n + t.health.numbers.accepted, 0)

  const title = viewer === 'admin_all' ? 'Every rep\'s teams' : viewer === 'admin' ? `${possessive(repName || 'The rep')} teams` : 'My teams'

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label">After sales</p>
        <h1 className="page-title mt-1.5">{title}</h1>
        <p className="page-subtitle mt-1.5">
          {viewer === 'rep'
            ? 'The teams you signed, and how their cards are doing. The ones that need a call are at the top, with the reason.'
            : 'What the rep sees on My Teams: their teams, worst first, with the reason each one needs a call.'}
        </p>
      </div>

      {inactive ? (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-600">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Your rep account is no longer active, so client teams are not shown. Contact Cardtly at hello@cardtly.com.
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {viewer === 'rep'
            ? 'No teams are assigned to you yet. When Cardtly links a team you signed to you, it appears here.'
            : 'No teams are assigned to a rep yet. Assign one under Admin, Teams.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Teams" value={teams.length} hint={`${count('green')} doing well`} />
            <Stat label="Need a call" value={count('red')} colour={count('red') ? '#ef4444' : undefined}
              hint={count('amber') ? `${count('amber')} more to keep an eye on` : undefined} />
            <Stat label="Cards accepted" value={`${accepted} of ${made}`} hint="Taken over by the person they are for" />
            <Stat label={`Opens, ${QUIET_DAYS} days`} value={opens} hint={`${leads} lead${leads === 1 ? '' : 's'} collected`} />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-4 sm:gap-6 border-b border-border">
              {([['attention', `Needs attention (${needing.length})`], ['all', `All teams (${teams.length})`]] as const).map(([id, label]) => {
                const active = filter === id
                return (
                  <button key={id} onClick={() => setFilter(id)} aria-current={active ? 'page' : undefined}
                    className={`pb-3 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors ${
                      active ? 'text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground font-medium'}`}
                    style={active ? { borderBottomColor: accent } : undefined}>
                    {label}
                  </button>
                )
              })}
            </div>
            {teams.length > 5 && (
              <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search teams or people"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
              {filter === 'attention' ? 'Every team is doing well. Nothing needs a call right now.' : 'No team matches that.'}
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map(t => <TeamCard key={t.id} team={t} repName={repName} showRep={viewer === 'admin_all'} />)}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Opens and leads cover the last {QUIET_DAYS} days. A team or card younger than two weeks is not counted as quiet.
            If a team&apos;s analytics were reset after setup, opens start from that day.
          </p>
        </>
      )}
    </div>
  )
}
