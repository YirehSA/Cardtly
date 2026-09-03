'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, Search, Layers, X, BarChart2, Inbox, Eye, Mail, Phone, Building2,
  ExternalLink, Calendar,
} from 'lucide-react'
import HeadTeamCard, { type HeadCard } from '@/components/team/HeadTeamCard'

// A department head's view of their own people.
//
// Deliberately NOT the owner's Team Cards screen with parts hidden. That page
// carries seats, billing, org identity and delete, and hiding those one by one
// is the kind of guard that survives until somebody adds a button and forgets
// the flag. A head's page holds only what a head may see, so nothing
// owner-only can leak into it by omission.
//
// Three tabs, because a head asks three separate questions: who is on my team,
// is any of it working, and who has been in touch. The owner's Analytics and
// Leads pages answer the last two for a whole company and refuse a head
// outright, so the head-scoped versions live here rather than as a permission
// carved into those.

type Card = HeadCard

export type HeadLead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  message: string | null
  createdAt: string
  /** Whose card captured it. */
  cardName: string
  departmentName: string
}

type Tab = 'people' | 'analytics' | 'leads'

// Same treatment as the owner's tabs on Team Cards: an underline on the
// selected one. See the note at the tab strip for why the colour-per-tab
// scheme it replaced could not be made to pass contrast.
const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'people', label: 'My people', icon: Users },
  { id: 'analytics', label: 'Team analytics', icon: BarChart2 },
  { id: 'leads', label: 'Leads', icon: Inbox },
]

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

export default function HeadTeamView({
  orgName, departmentNames, cards, forms = [], leads = [],
}: {
  orgName: string
  departmentNames: string[]
  cards: Card[]
  /** The org's lead-capture form library, for the per-card picker. */
  forms?: { id: string; title?: string }[]
  /** Every lead captured by a card in the departments this person runs. */
  leads?: HeadLead[]
}) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('people')

  // Word-AND, the same rule as the owner's search: "andrew restorations"
  // finds the person whose name and company are each half of it.
  const visible = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return cards
    return cards.filter(c => {
      const hay = [c.name, c.title, c.email, c.phone, c.slug, c.inviteEmail, c.departmentName]
        .filter(Boolean).join(' ').toLowerCase()
      return terms.every(t => hay.includes(t))
    })
  }, [q, cards])

  const claimed = cards.filter(c => c.claimed).length
  const totalViews = cards.reduce((n, c) => n + c.views, 0)
  const totalLeads = cards.reduce((n, c) => n + c.leads, 0)

  // Busiest first. A head reading this wants to know who is being opened and
  // who is not, and alphabetical buries exactly that.
  const ranked = useMemo(
    () => [...cards].sort((a, b) => b.views - a.views || b.leads - a.leads),
    [cards]
  )
  const busiest = ranked[0]?.views || 0

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(var(--accent))' }}>
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight">My Team</h1>
          <p className="text-sm text-muted-foreground">
            {departmentNames.length === 1
              ? departmentNames[0]
              : `${departmentNames.length} departments`}
            {orgName ? ` at ${orgName}` : ''}
          </p>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">Nobody here yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add people to your department and their cards appear here.
          </p>
          <Link href="/dashboard/departments"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
            <Layers className="w-4 h-4" />Go to Departments
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'People', value: cards.length, tone: undefined, hint: 'Cards in the departments you run' },
              { label: 'Using their card', value: claimed, tone: '#22c55e', hint: 'People who accepted their invitation and opened their card' },
              { label: 'Leads captured', value: totalLeads, tone: totalLeads > 0 ? '#22c55e' : undefined, hint: 'People who left their details on one of your team\'s cards' },
            ].map(({ label, value, tone, hint }) => (
              <div key={label} className="rounded-lg bg-card border border-border p-3" title={hint}>
                <p className="text-xl font-bold leading-none tabular-nums" style={{ color: tone }}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Underline tabs, one accent.
              Each tab used to take a different brand colour when selected, and the
              text colour on each had to be hand-solved against it. Measured on the
              real tokens, none of the alternatives worked: white on the accent is
              3.64:1 in dark mode, accent text on the muted track is 3.93:1 light
              and 4.36:1 dark, and a card-coloured pill on a muted track is 1.11:1,
              which is the invisibility that drove the colour-coding in the first
              place.
              An underline sidesteps all of it. The active label is --foreground at
              15.6:1, the inactive one is --muted-foreground, which the tokens
              already hold above 4.5:1, and the accent is left carrying only the
              rule, where the requirement is 3:1 for a non-text indicator. */}
          <div className="flex gap-6 border-b border-border overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              const count = id === 'people' ? cards.length : id === 'leads' ? leads.length : null
              return (
                <button key={id} onClick={() => setTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 pb-3 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? 'border-current text-foreground font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground font-medium'}`}
                  style={active ? { borderBottomColor: 'hsl(var(--accent))' } : undefined}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {count !== null && count > 0 && (
                    <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── My people ─────────────────────────────────────────────── */}
          {tab === 'people' && (
            <>
              {cards.length > 1 && (
                <div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="Search by name, job title, email or department..."
                      aria-label="Search my team"
                      className="w-full px-4 py-2.5 pl-10 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                    />
                    {q && (
                      <button onClick={() => setQ('')} aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {q && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {visible.length === 0
                        ? <>Nothing matches &ldquo;{q}&rdquo;.</>
                        : <><strong className="text-foreground">{visible.length}</strong> of {cards.length} people</>}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map(c => (
                  <HeadTeamCard key={c.id} card={c} forms={forms} onChanged={() => window.location.reload()} />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                To invite someone or change how the whole department looks, go to{' '}
                <Link href="/dashboard/departments" className="underline hover:text-foreground">Departments</Link>.
              </p>
            </>
          )}

          {/* ── Team analytics ────────────────────────────────────────── */}
          {tab === 'analytics' && (
            <div className="space-y-4">
              <Explainer
                title="Who is actually being opened"
                body="Every time somebody opens one of your team's cards it counts as a view. A lead is somebody who went further and left their details. A card with plenty of views and no leads is being handed out but not converting; a card with neither has not been shared yet."
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat icon={Eye} label="Views in total" value={totalViews} />
                <Stat icon={Inbox} label="Leads captured" value={totalLeads} />
                <Stat icon={Users} label="Cards being used" value={`${claimed}/${cards.length}`} />
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-bold text-sm">Card by card</p>
                  <p className="text-xs text-muted-foreground">Busiest first.</p>
                </div>
                <ul className="divide-y divide-border">
                  {ranked.map(c => (
                    <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{c.name || c.inviteEmail || 'Unnamed'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.title ? `${c.title} · ` : ''}{c.departmentName}
                        </p>
                        {/* A bar rather than only a number: the comparison
                            between people is the thing being read, and eight
                            numbers in a column do not make one. */}
                        <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{
                              width: busiest > 0 ? `${Math.max(2, (c.views / busiest) * 100)}%` : '0%',
                              background: 'hsl(var(--accent))',
                            }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{c.views}</p>
                        <p className="text-[10px] text-muted-foreground">views</p>
                      </div>
                      <div className="text-right shrink-0 w-12">
                        <p className="text-sm font-bold tabular-nums" style={{ color: c.leads > 0 ? '#22c55e' : undefined }}>
                          {c.leads}
                        </p>
                        <p className="text-[10px] text-muted-foreground">leads</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Leads ─────────────────────────────────────────────────── */}
          {tab === 'leads' && (
            <div className="space-y-4">
              <Explainer
                title="People who asked your team to get back to them"
                body="When somebody opens one of your team's cards they can leave their name and number. Those land here, newest first, with the card that captured them. Nothing is sent automatically, so somebody still has to follow up."
              />

              {leads.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center">
                  <Inbox className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No leads yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Once someone fills in the form on one of your team&rsquo;s cards, they will appear here.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {leads.map(l => (
                    <li key={l.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm truncate">{l.name || 'Someone'}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{fmtDate(l.createdAt)}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {l.email && (
                          <a href={`mailto:${l.email}`} className="flex items-center gap-2 truncate hover:text-foreground transition">
                            <Mail className="w-3.5 h-3.5 shrink-0" />{l.email}
                          </a>
                        )}
                        {l.phone && (
                          <a href={`tel:${l.phone}`} className="flex items-center gap-2 truncate hover:text-foreground transition">
                            <Phone className="w-3.5 h-3.5 shrink-0" />{l.phone}
                          </a>
                        )}
                        {l.company && (
                          <p className="flex items-center gap-2 truncate"><Building2 className="w-3.5 h-3.5 shrink-0" />{l.company}</p>
                        )}
                      </div>
                      {l.message && (
                        <p className="text-xs bg-muted/60 rounded-lg p-2.5 leading-relaxed">{l.message}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                        Came in on <strong className="text-foreground">{l.cardName}</strong>
                        {l.departmentName ? ` · ${l.departmentName}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Every tab opens with a sentence saying what it is for. The people running a
// department are not the people who chose the software, and a screen of
// numbers with no explanation is where most of them stop.
function Explainer({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">{body}</p>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: {
  icon: any; label: string; value: number | string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Icon className="w-4 h-4 mb-2 text-muted-foreground" />
      <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
