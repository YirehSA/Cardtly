'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Users as UsersIcon, Building2, Handshake, Ticket, UserCog, CalendarClock, PhoneCall, Mail,
  Network, Wifi, Flag, ScrollText, Receipt, FileSignature, RefreshCw, Banknote,
  Contact, SlidersHorizontal, Wallet, Search, Menu, X, ArrowLeft, CornerDownLeft, Sun, ChevronDown,
} from 'lucide-react'
import { matchesAllWords } from './shared'
import type { AdminUserRow, AdminOrgRow } from '@/lib/admin-data'

// THE ADMIN'S FRAME: where everything is, and getting to it.
//
// WHAT IT REPLACED (Andre, 2026-10-21: "difficult to use, hard to find
// things"). Twenty screens sat behind two rows of pills: five group buttons,
// then the screens inside whichever group was open. A screen was only visible
// once you had guessed its group, the address never changed so Back left the
// admin and a refresh lost your place, and every page opened under the same
// stack of warning banners.
//
// Now every screen is listed on its own in a sidebar that is always there,
// under the job it belongs to, with a count beside anything waiting on you. The
// address carries the screen (?tab=), so Back, refresh and bookmarks work.
// Search jumps straight to a screen, a person or a team from anywhere
// (Ctrl K). The warnings moved to Today, which is the first screen and says
// what needs doing rather than repeating it above every page.

export const TABS = [
  'overview', 'users', 'teams', 'resellers', 'trials',
  'reps', 'meetings', 'calls', 'emails', 'networking',
  'accounting', 'invoices', 'quotes', 'recurring', 'payments', 'clients', 'billing',
  'nfc', 'reports', 'activity',
] as const
export type Tab = typeof TABS[number]

export const isTab = (s: unknown): s is Tab => typeof s === 'string' && (TABS as readonly string[]).includes(s)

interface Item { id: Tab; label: string; icon: any; desc: string; keywords?: string }
interface SectionDef { id: string; label: string; icon?: any; items: Item[] }

export const SECTIONS: SectionDef[] = [
  { id: 'home', label: '', items: [
    { id: 'overview', label: 'Today', icon: Sun, desc: 'What needs you right now, and how Cardtly is doing.', keywords: 'home overview dashboard attention' },
  ] },
  { id: 'customers', label: 'Customers', icon: UsersIcon, items: [
    { id: 'users', label: 'Users', icon: UsersIcon, desc: 'Every account: who pays, who is on a trial, and whose card is offline.', keywords: 'people accounts customers members email' },
    { id: 'teams', label: 'Teams', icon: Building2, desc: 'Company teams: seats, billing mode, departments and their owners.', keywords: 'companies organisations orgs seats departments enterprise debit order' },
    { id: 'resellers', label: 'Resellers', icon: Handshake, desc: 'Agencies that resell Cardtly: their seat pools, clients and monthly invoices.', keywords: 'agency partner pool marketing' },
    { id: 'trials', label: 'Trials and codes', icon: Ticket, desc: 'Trials about to end, and the codes that start them.', keywords: 'trial codes expiring extend' },
  ] },
  { id: 'sales', label: 'Sales', icon: UserCog, items: [
    { id: 'reps', label: 'Reps', icon: UserCog, desc: 'Your sales reps, the clients they signed and their commission.', keywords: 'commission payout sales' },
    { id: 'meetings', label: 'Calendar', icon: CalendarClock, desc: 'Every rep\'s meetings in one calendar.', keywords: 'meetings appointments calendar' },
    { id: 'calls', label: 'Call log', icon: PhoneCall, desc: 'Calls the reps logged, and how they went.', keywords: 'phone calls' },
    { id: 'emails', label: 'Email log', icon: Mail, desc: 'Outreach emails the reps sent.', keywords: 'outreach email' },
    { id: 'networking', label: 'Networking', icon: Network, desc: 'LinkedIn and networking-event outreach.', keywords: 'linkedin events networking' },
  ] },
  { id: 'money', label: 'Money', icon: Banknote, items: [
    { id: 'accounting', label: 'Money overview', icon: Wallet, desc: 'What is owed, what is late and what came in this month.', keywords: 'accounting finance books owed overdue' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, desc: 'Draft, approve, send and chase invoices.', keywords: 'invoice bill owed overdue tax' },
    { id: 'quotes', label: 'Quotes', icon: FileSignature, desc: 'Quotes out with clients, and turning accepted ones into invoices.', keywords: 'quote quotation proposal' },
    { id: 'recurring', label: 'Recurring', icon: RefreshCw, desc: 'Monthly and yearly invoice schedules, and drafts waiting for approval.', keywords: 'recurring monthly schedules subscriptions seats' },
    { id: 'payments', label: 'Payments', icon: Banknote, desc: 'Money received, and which invoices it settles.', keywords: 'payments receipts eft received allocate' },
    { id: 'clients', label: 'Billing clients', icon: Contact, desc: 'Who Cardtly invoices, with statements of account.', keywords: 'clients billing statement accounts' },
    { id: 'billing', label: 'Billing settings', icon: SlidersHorizontal, desc: 'Company details, banking, VAT, terms, signatures and reminders.', keywords: 'settings banking bank vat terms company signature reminders' },
  ] },
  { id: 'operations', label: 'Operations', icon: Wifi, items: [
    { id: 'nfc', label: 'NFC orders', icon: Wifi, desc: 'Card orders from customers: invoice, make, ship.', keywords: 'nfc cards print orders shipping tracking' },
    { id: 'reports', label: 'Reported cards', icon: Flag, desc: 'Cards people reported, and how long each has waited.', keywords: 'reports moderation flagged impersonation abuse' },
    { id: 'activity', label: 'Activity log', icon: ScrollText, desc: 'Everything an admin changed, newest first.', keywords: 'audit log history changes' },
  ] },
]

const ALL: Array<Item & { section: string }> = SECTIONS.flatMap(s => s.items.map(i => ({ ...i, section: s.label })))
export const ITEMS = Object.fromEntries(ALL.map(i => [i.id, i])) as Record<Tab, Item & { section: string }>

export type BadgeTone = 'red' | 'amber' | 'blue' | 'green'
export interface Badge { n: number; tone: BadgeTone; title?: string }
export type Badges = Partial<Record<Tab, Badge>>

export const TONE: Record<BadgeTone, string> = { red: '#ef4444', amber: '#f59e0b', blue: '#38bdf8', green: '#22c55e' }

const accent = 'hsl(var(--accent))'
const BG = '#0a0a0a'
const PANEL = '#0f0f10'
const LINE = 'rgba(255,255,255,0.08)'

// What a folded section has waiting: the total, in the most urgent colour
// among its screens. Red outranks amber outranks green outranks blue.
const TONE_RANK: Record<BadgeTone, number> = { red: 0, amber: 1, green: 2, blue: 3 }
function sectionBadge(s: SectionDef, badges: Badges): Badge | null {
  const hits = s.items.map(i => badges[i.id]).filter((b): b is Badge => !!b && b.n > 0)
  if (!hits.length) return null
  const tone = hits.reduce((t, b) => (TONE_RANK[b.tone] < TONE_RANK[t] ? b.tone : t), hits[0].tone)
  return { n: hits.reduce((n, b) => n + b.n, 0), tone }
}

const sectionOf = (t: Tab) => SECTIONS.find(s => s.items.some(i => i.id === t))?.id || 'home'
const OPEN_KEY = 'cardtly-admin-nav-open'

function NavPanel({ tab, onGo, badges, onSearch, meta, onClose, open, onToggle }: {
  tab: Tab; onGo: (t: Tab) => void; badges: Badges; onSearch: () => void; meta?: string; onClose?: () => void
  open: Record<string, boolean>; onToggle: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 h-16 flex-shrink-0" style={{ borderBottom: `1px solid ${LINE}` }}>
        <img src="/cardtly-icon.png" alt="" className="h-8 w-8 rounded-full" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Cardtly</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>Admin</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="ml-auto p-2 -mr-2 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        )}
      </div>

      <div className="px-3 pt-3 flex-shrink-0">
        <button onClick={onSearch}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, color: 'rgba(255,255,255,0.55)' }}>
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search everything</span>
          <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>Ctrl K</kbd>
        </button>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.14) transparent' }}>
        {SECTIONS.map(s => {
          // Today has no heading and is always shown. Every other section
          // folds away under its heading, and says what is waiting inside
          // while it is folded, so closing one never hides a problem.
          const foldable = !!s.label
          const isOpen = !foldable || !!open[s.id]
          const waiting = sectionBadge(s, badges)
          const listId = `admin-nav-${s.id}`
          return (
            <div key={s.id} className={foldable ? 'pt-1' : 'pb-1'}>
              {foldable && (
                <button onClick={() => onToggle(s.id)} aria-expanded={isOpen} aria-controls={listId}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition hover:bg-white/[0.05]">
                  {s.icon && <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: isOpen ? accent : 'rgba(255,255,255,0.5)' }} />}
                  <span className="flex-1 text-left text-[13px] font-semibold"
                    style={{ color: isOpen ? '#fff' : 'rgba(255,255,255,0.75)' }}>{s.label}</span>
                  {!isOpen && waiting && (
                    <span title={`${waiting.n} waiting in ${s.label}`}
                      className="min-w-[22px] text-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                      style={{ background: `${TONE[waiting.tone]}24`, color: TONE[waiting.tone] }}>
                      {waiting.n > 99 ? '99+' : waiting.n}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                    style={{ color: 'rgba(255,255,255,0.4)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                </button>
              )}
              {/* Folds with a grid-rows transition so it slides rather than
                  jumps. While folded the items leave the tab order and the
                  reading order, not just the screen. */}
              <div id={listId}
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                aria-hidden={!isOpen}>
                <ul className={`space-y-0.5 overflow-hidden ${foldable ? 'ml-[19px] pl-2 border-l' : ''}`}
                  style={foldable ? { borderColor: LINE, marginTop: isOpen ? 2 : 0 } : undefined}>
                  {s.items.map(it => {
                    const active = tab === it.id
                    const badge = badges[it.id]
                    const Icon = it.icon
                    return (
                      <li key={it.id}>
                        <button onClick={() => onGo(it.id)} aria-current={active ? 'page' : undefined} tabIndex={isOpen ? undefined : -1}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition ${active ? 'font-semibold' : 'font-medium hover:bg-white/[0.05]'}`}
                          style={active
                            ? { background: 'rgba(255,255,255,0.08)', color: '#fff', boxShadow: `inset 3px 0 0 ${accent}` }
                            : { color: 'rgba(255,255,255,0.62)' }}>
                          <Icon className="w-4 h-4 flex-shrink-0" style={active ? { color: accent } : undefined} />
                          <span className="flex-1 text-left truncate">{it.label}</span>
                          {badge && badge.n > 0 && (
                            <span title={badge.title}
                              className="min-w-[22px] text-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                              style={{ background: `${TONE[badge.tone]}24`, color: TONE[badge.tone] }}>
                              {badge.n > 99 ? '99+' : badge.n}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${LINE}` }}>
        {meta && <p className="px-3 pb-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{meta}</p>}
        <Link href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition hover:bg-white/[0.05]"
          style={{ color: 'rgba(255,255,255,0.62)' }}>
          <ArrowLeft className="w-4 h-4" />Back to my dashboard
        </Link>
      </div>
    </>
  )
}

export function AdminShell({ tab, onGo, badges, onSearch, meta, children }: {
  tab: Tab; onGo: (t: Tab) => void; badges: Badges; onSearch: () => void; meta?: string; children: React.ReactNode
}) {
  const [drawer, setDrawer] = useState(false)

  // Which sections are unfolded. Starts with only the one you are in; after
  // that this browser remembers what you opened and closed. The section the
  // open screen belongs to is always unfolded, so arriving at a screen by
  // search or from Today never leaves its place in the sidebar hidden.
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [sectionOf(tab)]: true }))
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(OPEN_KEY) || 'null')
      if (saved && typeof saved === 'object') setOpen(o => ({ ...saved, ...o }))
    } catch { /* first visit, or storage blocked */ }
  }, [])
  useEffect(() => {
    const sec = sectionOf(tab)
    setOpen(o => (o[sec] ? o : { ...o, [sec]: true }))
  }, [tab])
  function toggle(id: string) {
    setOpen(o => {
      const next = { ...o, [id]: !o[id] }
      try { window.localStorage.setItem(OPEN_KEY, JSON.stringify(next)) } catch { /* not remembered, still works */ }
      return next
    })
  }

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const waiting = Object.values(badges).reduce((n, b) => n + (b && (b.tone === 'red' || b.tone === 'amber') ? b.n : 0), 0)

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[264px] flex-col" style={{ background: PANEL, borderRight: `1px solid ${LINE}` }}>
        <NavPanel tab={tab} onGo={onGo} badges={badges} onSearch={onSearch} meta={meta} open={open} onToggle={toggle} />
      </aside>

      {/* Below lg the sidebar becomes a drawer behind a menu button. */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-1 px-2 h-14"
        style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${LINE}` }}>
        <button onClick={() => setDrawer(true)} aria-label="Open the admin menu" className="relative p-2.5 rounded-lg hover:bg-white/5">
          <Menu className="w-5 h-5 text-white" />
          {waiting > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: TONE.amber }} />}
        </button>
        <span className="font-semibold text-white text-sm truncate">{ITEMS[tab].label}</span>
        <button onClick={onSearch} aria-label="Search everything" className="ml-auto p-2.5 rounded-lg hover:bg-white/5">
          <Search className="w-5 h-5 text-white" />
        </button>
      </header>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[290px] max-w-[86vw] flex flex-col" style={{ background: PANEL, borderRight: `1px solid ${LINE}` }}>
            <NavPanel tab={tab} badges={badges} meta={meta} open={open} onToggle={toggle}
              onGo={(t) => { setDrawer(false); onGo(t) }}
              onSearch={() => { setDrawer(false); onSearch() }}
              onClose={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 lg:py-9 space-y-5">
          {children}
        </main>
      </div>
    </div>
  )
}

/** The top of every screen: where you are, what this screen is for. */
export function PageHeader({ tab, children }: { tab: Tab; children?: React.ReactNode }) {
  const it = ITEMS[tab]
  const Icon = it.icon
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
      <div className="min-w-0">
        {it.section && (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>{it.section}</p>
        )}
        <h1 className="mt-1 text-2xl sm:text-[28px] font-bold text-white tracking-tight flex items-center gap-2.5">
          <Icon className="w-6 h-6 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }} />{it.label}
        </h1>
        <p className="text-sm mt-1 mb-2 max-w-2xl" style={{ color: 'rgba(255,255,255,0.52)' }}>{it.desc}</p>
      </div>
      {children}
    </div>
  )
}

type Hit =
  | { kind: 'page'; key: string; tab: Tab; label: string; sub: string; icon: any }
  | { kind: 'team'; key: string; org: AdminOrgRow; label: string; sub: string }
  | { kind: 'user'; key: string; user: AdminUserRow; label: string; sub: string }

/** Ctrl K: jump to any screen, person or team from anywhere in the admin. */
export function JumpPalette({ open, onClose, users, orgs, onGo, onUser, onTeam }: {
  open: boolean; onClose: () => void
  users: AdminUserRow[]; orgs: AdminOrgRow[]
  onGo: (t: Tab) => void; onUser: (u: AdminUserRow) => void; onTeam: (o: AdminOrgRow) => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    const t = setTimeout(() => input.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  const hits: Hit[] = useMemo(() => {
    const needle = q.trim()
    const pages: Hit[] = ALL
      .filter(i => matchesAllWords(needle.toLowerCase(), [i.label, i.desc, i.section, i.keywords]))
      .map(i => ({ kind: 'page', key: `p-${i.id}`, tab: i.id, label: i.label, sub: i.section || 'Home', icon: i.icon }))
    if (!needle) return pages
    const lower = needle.toLowerCase()
    const teams: Hit[] = orgs
      .filter(o => matchesAllWords(lower, [o.name, o.adminEmail]))
      .slice(0, 5)
      .map(o => ({ kind: 'team', key: `t-${o.id}`, org: o, label: o.name, sub: `${o.cardsCreated}/${o.maxSeats} cards${o.adminEmail ? ` · ${o.adminEmail}` : ''}` }))
    const people: Hit[] = users
      .filter(u => matchesAllWords(lower, [u.email, u.card?.name, u.card?.slug, u.org?.name, u.memberOfOrg]))
      .slice(0, 7)
      .map(u => ({ kind: 'user', key: `u-${u.id}`, user: u, label: u.card?.name || u.email, sub: [u.card?.name ? u.email : null, u.org?.name || u.memberOfOrg, u.status].filter(Boolean).join(' · ') }))
    return [...pages.slice(0, 6), ...teams, ...people]
  }, [q, users, orgs])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  function choose(h: Hit | undefined) {
    if (!h) return
    onClose()
    if (h.kind === 'page') onGo(h.tab)
    else if (h.kind === 'team') onTeam(h.org)
    else onUser(h.user)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(hits[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  const groupTitle = (h: Hit, i: number) => {
    const prev = hits[i - 1]
    if (prev && prev.kind === h.kind) return null
    return h.kind === 'page' ? 'Screens' : h.kind === 'team' ? 'Teams' : 'People'
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search the admin">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#141416', border: `1px solid rgba(255,255,255,0.12)` }}>
        <div className="flex items-center gap-2.5 px-4 h-14" style={{ borderBottom: `1px solid ${LINE}` }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }} />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="A screen, a person, a team, an email..."
            aria-label="Search the admin"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 focus:outline-none" />
          <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>Esc</kbd>
        </div>
        <div ref={list} className="max-h-[60vh] overflow-y-auto py-2">
          {hits.length === 0 && (
            <p className="px-4 py-6 text-sm text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Nothing matches "{q}".</p>
          )}
          {hits.map((h, i) => {
            const title = groupTitle(h, i)
            const on = i === active
            const Icon = h.kind === 'page' ? h.icon : h.kind === 'team' ? Building2 : UsersIcon
            return (
              <div key={h.key}>
                {title && (
                  <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.35)' }}>{title}</p>
                )}
                <button data-i={i} onMouseEnter={() => setActive(i)} onClick={() => choose(h)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                  style={{ background: on ? 'rgba(255,255,255,0.07)' : 'transparent' }}>
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: on ? accent : 'rgba(255,255,255,0.45)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white truncate">{h.label}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.42)' }}>{h.sub}</span>
                  </span>
                  {on && <CornerDownLeft className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** One thing waiting on a person, on the Today screen. */
export interface Attention {
  key: string
  tone: BadgeTone
  title: string
  detail: string
  action: string
  onClick: () => void
}

export function NeedsYou({ items, loadingMoney }: { items: Attention[]; loadingMoney: boolean }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold text-white">Needs you</h2>
        {loadingMoney && <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Checking the books...</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {loadingMoney ? 'Looking...' : 'Nothing is waiting on you. Every card is live and the books are up to date.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(a => (
            <li key={a.key}>
              <button onClick={a.onClick}
                className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition hover:brightness-125"
                style={{ background: `${TONE[a.tone]}12`, border: `1px solid ${TONE[a.tone]}40` }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TONE[a.tone] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: TONE[a.tone] }}>{a.title}</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{a.detail}</span>
                </span>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.75)' }}>{a.action} →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
