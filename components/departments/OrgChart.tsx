'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Building2, Users, ChevronRight, ArrowLeft, Settings2, ShieldCheck, ExternalLink, Eye, Mail, Layers } from 'lucide-react'

// A drill-down org chart: the group on top, its companies fanned out beneath
// it, and one level shown at a time.
//
// The old overview drew the whole tree at once as an indented list with
// connector rails. That reads fine at two levels and stops working at three:
// a group of seven companies holding twenty departments is a hundred-row
// column, and the shape of the business - the thing the page exists to show -
// is the first casualty. Clicking a node promotes it to the top and shows only
// its children, so the depth is walked rather than displayed.

interface Card {
  id: string; name: string | null; slug: string | null; claimed: boolean
  inviteEmail: string | null; views30d: number; leads: number; viewCount: number
}
interface Head { userId: string; email: string | null }
interface Dept {
  id: string; name: string; organizationId: string; isOwner: boolean
  parentId?: string | null
  kind?: 'company' | 'department'
  slugSegment?: string | null
  hasBrand: boolean; heads: Head[]; cards: Card[]
}
interface OwnedOrg { id: string; name: string; lockedFields: string[] }
// Matches rollUpSubtrees in DepartmentManager: totals for a node and
// everything beneath it, so a company holding three departments and no cards
// of its own does not report zero.
interface Rollup { people: number; claimed: number; views30d: number; leads: number }

// Cardtly's full gradient runs cyan to purple to pink, and white text over the
// cyan end is 1.77:1. That is fine on an icon tile and not fine on a block
// carrying a heading and a line of detail, so the group block runs only the
// half of the gradient that can hold text: #7c3aed (5.7:1) to #db2777 (4.6:1),
// with every blend between them sitting inside that range.
const GRAD = 'linear-gradient(135deg, #7c3aed, #db2777)'

// Cardtly's palette, one colour per level. Text colour is measured against the
// background rather than defaulted to white:
//
//   #00d4ff on white  1.77:1   unreadable, so cyan carries near-black
//   #00d4ff on #062a33 8.55:1
//   #7c3aed on white  5.70:1
//   #ec4899 on white  3.53:1   passes for a 24px heading and fails for the
//                              14px line and 12px button sitting beside it
//   #db2777 on white  4.60:1   the same brand pink, one step down, AA clean
//
// So the pink surfaces that carry text use #db2777; #ec4899 stays the accent
// on icons and borders, where nothing has to be read off it.
const LEVEL = {
  group: { solid: '#7c3aed', on: '#ffffff', label: 'Group' },
  company: { solid: '#00d4ff', on: '#062a33', label: 'Company' },
  department: { solid: '#db2777', on: '#ffffff', label: 'Department' },
  card: { solid: '#22c55e', on: '#052e16', label: 'Card' },
} as const

type Level = keyof typeof LEVEL

function initials(s: string): string {
  const t = (s || '').trim()
  if (!t) return '?'
  const p = t.split(/\s+/)
  return (p.length >= 2 ? p[0][0] + p[1][0] : t.slice(0, 2)).toUpperCase()
}

// How many blocks sit in a row before wrapping. Cards get five, as asked;
// companies and departments are wider so they get four.
function usePerRow(desktop: number) {
  const [n, setN] = useState(desktop)
  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)')
    const lg = window.matchMedia('(min-width: 1024px)')
    const apply = () => setN(lg.matches ? desktop : sm.matches ? Math.min(3, desktop) : 2)
    apply()
    sm.addEventListener('change', apply); lg.addEventListener('change', apply)
    return () => { sm.removeEventListener('change', apply); lg.removeEventListener('change', apply) }
  }, [desktop])
  return n
}

const GAP = 12 // px, matches gap-3 below

// The horizontal bus joining a row of blocks, and the drop lines down to each.
//
// The width has to come out of the same arithmetic the grid uses, gap
// included. A first attempt spanned (0.5/perRow) to ((k-0.5)/perRow) of the
// row, which reads as correct and is not: the grid gap is subtracted from the
// columns, so the true centres sit inboard of those percentages and the first
// and last blocks hung visibly past the ends of their own line.
//
// With n columns and gap g, each column is (100% - g(n-1))/n wide, so the
// centre of column i is at i*(col + g) + col/2. The bus runs from the first
// centre to the last.
function ConnectedRow({ items, perRow, children }: {
  items: number; perRow: number; children: React.ReactNode
}) {
  const col = `((100% - ${GAP * (perRow - 1)}px) / ${perRow})`
  return (
    <div className="relative pt-6">
      {items > 1 && (
        <div className="absolute top-0 h-px bg-border" aria-hidden
          style={{
            left: `calc(${col} / 2)`,
            width: `calc((${col} + ${GAP}px) * ${items - 1})`,
          }} />
      )}
      <div className="grid" style={{ gap: GAP, gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </div>
  )
}

// The short vertical line joining a block up to the bus above it.
const Drop = () => (
  <span className="absolute left-1/2 -top-6 w-px h-6 bg-border" aria-hidden />
)

export default function OrgChart({ departments, ownedOrgs, rollup, onManage }: {
  departments: Dept[]
  ownedOrgs: OwnedOrg[]
  rollup: Record<string, Rollup>
  onManage: (deptId: string) => void
}) {
  // The node currently promoted to the top. null means the group.
  const [focusId, setFocusId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])
  const focus = focusId ? byId.get(focusId) || null : null

  // A head of one department is not an admin of anything and has no group to
  // show, so their chart starts at the departments they actually run.
  const org = ownedOrgs[0] || null
  const hasHierarchy = departments.some(d => d.parentId || d.kind === 'company')

  const rootDepts = useMemo(() => {
    // Roots are nodes whose parent the viewer cannot see. A manager of one
    // branch of a group must still see their own node rather than losing it
    // to a parent that permissions filtered out.
    const visible = new Set(departments.map(d => d.id))
    return departments.filter(d => !d.parentId || !visible.has(d.parentId))
  }, [departments])

  const childrenOf = (id: string) => departments.filter(d => d.parentId === id)

  // The trail back to the top, so the breadcrumb can walk out the way it
  // walked in. Guarded against a cycle: the trigger in migration 053 rejects
  // them, but a walk that trusts the data is one bad row from hanging the tab.
  const trail = useMemo(() => {
    const out: Dept[] = []
    const seen = new Set<string>()
    let cur = focus
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      out.unshift(cur)
      cur = cur.parentId ? byId.get(cur.parentId) || null : null
    }
    return out
  }, [focus, byId])

  const kids = focus ? childrenOf(focus.id) : rootDepts
  const cards = focus ? focus.cards : []
  const level: Level = !focus ? 'group' : focus.kind === 'company' ? 'company' : 'department'

  const perRowNodes = usePerRow(4)
  const perRowCards = usePerRow(5)

  // ── The promoted node ─────────────────────────────────────────────────────
  const headline = focus ? focus.name : (org?.name || 'My teams')
  const tone = LEVEL[level]
  const roll = focus ? rollup[focus.id] : null
  const totalPeople = focus
    ? (roll?.people ?? focus.cards.length)
    : departments.reduce((n, d) => n + d.cards.length, 0)

  return (
    <div className="space-y-4">
      {/* Breadcrumb. The chart shows one level, so the path is the only thing
          saying where in the business you are standing. */}
      <div className="flex items-center gap-1 flex-wrap text-sm">
        <button onClick={() => setFocusId(null)}
          className={`px-2.5 py-1 rounded-lg font-medium transition ${
            focus ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'bg-muted text-foreground'}`}>
          {org?.name || 'My teams'}
        </button>
        {trail.map(node => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <button onClick={() => setFocusId(node.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition truncate max-w-[180px] ${
                node.id === focusId ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {node.name}
            </button>
          </span>
        ))}
      </div>

      {/* ── Top block ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-xl rounded-2xl p-5 text-center relative overflow-hidden"
          style={{ background: level === 'group' ? GRAD : tone.solid, color: tone.on }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {level === 'group' ? <Layers className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-90">
              {tone.label}
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight break-words">{headline}</h2>
          {/* Full opacity: the measured 4.6:1 on this background is the whole
              budget, and dimming the text spends what is not there. */}
          <p className="text-sm mt-1">
            {kids.length > 0 && `${kids.length} ${level === 'group' && hasHierarchy
              ? (kids.length === 1 ? 'company' : 'companies')
              : (kids.length === 1 ? 'department' : 'departments')}`}
            {kids.length > 0 && cards.length > 0 && ' · '}
            {cards.length > 0 && `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} here`}
            {kids.length === 0 && cards.length === 0 && 'Nothing under this yet'}
            {totalPeople > 0 && (kids.length > 0) && ` · ${totalPeople} people in total`}
          </p>
          {/* Says where you are standing, not what the box contains. Both are
              needed: the counts above are the data, this is the orientation. */}
          <p className="text-xs mt-2 opacity-90 max-w-md mx-auto leading-relaxed">
            {levelExplainer(level, hasHierarchy)}
          </p>

          {/* Everything the old tile could do still has to be reachable, so the
              detail view is one press from the node it belongs to. */}
          {focus && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button onClick={() => onManage(focus.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-90"
                style={{ background: tone.on, color: tone.solid }}>
                <Settings2 className="w-3.5 h-3.5" />Manage
              </button>
              <button onClick={() => setFocusId(focus.parentId && byId.has(focus.parentId) ? focus.parentId : null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition hover:bg-black/10"
                style={{ borderColor: tone.on, color: tone.on }}>
                <ArrowLeft className="w-3.5 h-3.5" />Up
              </button>
            </div>
          )}
        </div>

        {/* Stem from the top block down to the bus */}
        {(kids.length > 0 || cards.length > 0) && <span className="w-px h-6 bg-border" aria-hidden />}
      </div>

      {/* ── Child companies or departments ──────────────────────────────── */}
      {kids.length > 0 && (
        <div className="space-y-3">
          <SectionHeading {...childrenHeading(level, hasHierarchy, kids.length, headline)} />
          {chunk(kids, perRowNodes).map((row, ri) => (
            <ConnectedRow key={ri} items={row.length} perRow={perRowNodes}>
              {row.map(d => {
                const isCompany = d.kind === 'company'
                const c = isCompany ? LEVEL.company : LEVEL.department
                const r = rollup[d.id]
                const kidCount = childrenOf(d.id).length
                return (
                  <button key={d.id} onClick={() => setFocusId(d.id)}
                    className="relative group text-left rounded-2xl border border-border bg-card p-4 aspect-square flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
                    style={{ boxShadow: `inset 0 3px 0 ${c.solid}` }}>
                    <Drop />
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${c.solid}22`, border: `1px solid ${c.solid}55` }}>
                      <Building2 className="w-4 h-4" style={{ color: c.solid }} />
                    </div>
                    <p className="font-bold text-sm leading-snug mt-2.5 line-clamp-2 break-words">{d.name}</p>
                    {isCompany && d.slugSegment && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">/{d.slugSegment}</p>
                    )}
                    <div className="mt-auto space-y-1.5">
                      {d.heads.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full">
                          <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: c.solid }} />
                          <span className="truncate">
                            {d.heads.length === 1 ? (d.heads[0].email?.split('@')[0] || 'head') : `${d.heads.length} heads`}
                          </span>
                        </span>
                      ) : d.isOwner ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                          <ShieldCheck className="w-3 h-3" />No boss yet
                        </span>
                      ) : null}
                      {/* The subtree total, not the node's own count. A
                          company with three departments and no cards of its
                          own reads "0 cards" otherwise: true, useless, and
                          nobody questions it. */}
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {kidCount > 0 && <>{kidCount} {kidCount === 1 ? 'dept' : 'depts'} · </>}
                        {(r?.people ?? d.cards.length)} {(r?.people ?? d.cards.length) === 1 ? 'card' : 'cards'}
                        {r && r.people > r.claimed && (
                          <span className="text-amber-500"> · {r.people - r.claimed} pending</span>
                        )}
                      </p>
                      {/* Views and leads for the whole subtree. rollUpSubtrees
                          has always computed both and nothing ever rendered
                          them, so a group could see how many cards a business
                          held but not whether any of them were being used,
                          which is the question a group actually asks. */}
                      {r && (r.views30d > 0 || r.leads > 0) && (
                        <p className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1" title="Views in the last 30 days, this business and everything under it">
                            <Eye className="w-3 h-3" />{r.views30d}
                          </span>
                          <span className="inline-flex items-center gap-1" title="Leads captured, this business and everything under it">
                            <Mail className="w-3 h-3" />{r.leads}
                          </span>
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 absolute top-4 right-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                  </button>
                )
              })}
            </ConnectedRow>
          ))}
        </div>
      )}

      {/* ── Cards on the focused node ───────────────────────────────────── */}
      {cards.length > 0 && (
        <div className="space-y-3">
          <SectionHeading
            title={kids.length > 0
              ? `Cards attached straight to ${focus?.name}`
              : (cards.length === 1 ? 'The person in this team' : 'The people in this team')}
            body={kids.length > 0
              ? 'These belong to this level rather than to one of the teams below it.'
              : 'One card per person. Green means they have accepted their invitation and their card is live; grey means it is still waiting for them.'} />
          {chunk(cards, perRowCards).map((row, ri) => (
            <ConnectedRow key={ri} items={row.length} perRow={perRowCards}>
              {row.map(card => {
                const label = card.name || card.inviteEmail || 'Unclaimed'
                return (
                  <div key={card.id}
                    className="relative rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center gap-1.5">
                    <Drop />
                    {/* Dark initials, not white: white on #22c55e is 2.2:1 and
                        on #94a3b8 is 2.3:1, so the two-letter label is the
                        first thing to disappear on both. */}
                    <span className="rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{
                        width: 38, height: 38, fontSize: 13,
                        background: card.claimed ? LEVEL.card.solid : '#94a3b8',
                        color: card.claimed ? LEVEL.card.on : '#1e293b',
                      }}>
                      {initials(label)}
                    </span>
                    <p className="font-semibold text-xs leading-tight line-clamp-2 break-words">{label}</p>
                    {card.claimed ? (
                      <p className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-2">
                        <span className="inline-flex items-center gap-0.5"><Eye className="w-3 h-3" />{card.viewCount}</span>
                        <span className="inline-flex items-center gap-0.5"><Mail className="w-3 h-3" />{card.leads}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-500 font-medium">Not joined yet</p>
                    )}
                    {card.slug && (
                      <Link href={`/card/${card.slug}`} target="_blank"
                        className="text-[10px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition">
                        <ExternalLink className="w-3 h-3" />View
                      </Link>
                    )}
                  </div>
                )
              })}
            </ConnectedRow>
          ))}
        </div>
      )}

      {/* A leaf with nothing under it should say so rather than ending in
          whitespace that reads like a page still loading. */}
      {focus && kids.length === 0 && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Users className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nothing under {focus.name} yet</p>
          <button onClick={() => onManage(focus.id)}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: GRAD }}>
            <Settings2 className="w-3.5 h-3.5" />Add people to this team
          </button>
        </div>
      )}
    </div>
  )
}


// What the row beneath the promoted node contains, and what to do with it.
// The words matter more than the boxes: somebody who has never seen an org
// chart is being asked to recognise a structure they have not been told
// about, and "Companies" over the row does most of that work.
function childrenHeading(level: Level, hasHierarchy: boolean, count: number, parentName: string) {
  if (level === 'group') {
    return hasHierarchy
      ? {
        title: count === 1 ? 'The company in this group' : 'The companies in this group',
        body: 'These are the businesses under ' + parentName + '. Each one keeps its own branding, its own manager and its own web address. Click a company to see the departments inside it.',
      }
      : {
        title: count === 1 ? 'Your department' : 'Your departments',
        body: 'These are the teams in ' + parentName + '. Each one can have its own look and its own manager. Click a department to see the people in it.',
      }
  }
  if (level === 'company') {
    return {
      title: count === 1 ? 'The department in this company' : 'The departments in this company',
      body: 'These are the teams inside ' + parentName + ' - sales, admin, a branch, whatever fits. People\u2019s cards belong to a department, never straight to the company. Click one to see its people.',
    }
  }
  return {
    title: count === 1 ? 'The team inside this one' : 'The teams inside this one',
    body: 'Departments can sit inside other departments when a team is big enough to need it.',
  }
}

// One line under the promoted block saying where you are and what happens
// next, in the second person, because the chart is a place you are standing
// rather than a diagram you are reading.
function levelExplainer(level: Level, hasHierarchy: boolean): string {
  if (level === 'group')
    return hasHierarchy
      ? 'You are at the top. Everything in the business sits somewhere below this.'
      : 'You are at the top. Your departments are below.'
  if (level === 'company')
    return 'You are looking at one company inside the group. Its departments are below, and its people are inside those.'
  return 'You are looking at one team. The cards below belong to the people in it.'
}

function SectionHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="pt-2">
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-2xl">{body}</p>
    </div>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
