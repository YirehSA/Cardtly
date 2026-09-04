'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LOCK_GROUPS } from '@/lib/team-locks'
import Toggle from '@/components/ui/Toggle'
import OrgChart from '@/components/departments/OrgChart'
import { Layers, Palette, Loader2, UserPlus, X, ExternalLink, Eye, Users, Check, RefreshCw, Building2, Crown, Plus, Pencil, Trash2, ShieldCheck, ArrowRight, Sparkles, Mail, ChevronLeft, Lock, LockOpen, Link2 } from 'lucide-react'

interface Card {
  id: string; name: string | null; slug: string | null; claimed: boolean
  inviteEmail: string | null; views30d: number; leads: number; viewCount: number; brand: Record<string, any>
  // Which lead-capture form this card shows: use_team_questionnaire=false means
  // none; assignedFormId picks a specific form; neither means the org default.
  useTeamQuestionnaire?: boolean | null
  assignedFormId?: string | null
}
interface LeadForm { id: string; title?: string; questions: any[] }
interface Head { userId: string; email: string | null }
interface Dept {
  id: string; name: string; organizationId: string; isOwner: boolean
  // Hierarchy. An organisation that has not opted in has parentId null and
  // kind 'department' on every row, and every list below sorts and renders
  // exactly as it did before.
  parentId?: string | null
  kind?: 'company' | 'department'
  slugSegment?: string | null
  brand: Record<string, any>; hasBrand: boolean; heads: Head[]; cards: Card[]
  // Set when this look follows a card rather than being a copy of one: edits to
  // that card reach every card here. See lib/brand-source.
  brandSource?: { table: 'cards' | 'team_cards'; id: string } | null
  brandSourceName?: string | null
  lockedFields: string[]
  // Does this node take the look from the group above it, and has the group
  // owner frozen that answer? See migration 063.
  inheritBrand?: boolean
  inheritBrandLocked?: boolean
  // Does the viewer already hold a card anywhere in this department's org?
  // Heads are appointed without one, so the offer to make theirs only appears
  // when they genuinely have none.
  viewerHasCard?: boolean
  // The company look, offered as a starting point for this department.
  orgBrand?: Record<string, any>
  // The org's lead-capture form library, for the per-card form picker.
  forms?: LeadForm[]
}
interface OwnedOrg { id: string; name: string; lockedFields: string[] }
/** One of the viewer's own personal cards, offered as a look to copy. */
interface MyCard { id: string; name: string | null; brand: Record<string, any> }

const grad = 'hsl(var(--accent))'

// A steady palette so each department gets its own colour, cycled by position.
const ACCENTS = ['#7c3aed', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#14b8a6']
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length]

function initials(s: string): string {
  const t = (s || '').trim()
  if (!t) return '?'
  const parts = t.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

function Avatar({ label, color, size = 28 }: { label: string; color: string; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color }}>
      {initials(label)}
    </span>
  )
}
export default function DepartmentManager({ departments, ownedOrgs, myCards = [] }: { departments: Dept[]; ownedOrgs: OwnedOrg[]; myCards?: MyCard[] }) {
  const router = useRouter()
  const [selId, setSelId] = useState<string | null>(departments.length === 1 ? departments[0].id : null)
  const [loading, setLoading] = useState<string | null>(null)
  // Totals for a department and everything beneath it.
  //
  // The number on a company has to include its departments, or a group holding
  // seven businesses reports seven zeroes while carrying five hundred people.
  const rollup = useMemo(() => rollUpSubtrees(departments), [departments])

  async function call(key: string, body: object, okMsg: string): Promise<boolean> {
    setLoading(key)
    const res = await fetch('/api/department', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return false }
    toast.success(okMsg)
    router.refresh()
    return true
  }

  const isCompanyAdmin = ownedOrgs.length > 0
  const selected = departments.find(d => d.id === selId) || null
  const idxOf = (id: string) => departments.findIndex(d => d.id === id)

  // A company admin always needs a way back, even with a single department:
  // the overview is where "New department" and the company rules live. With
  // exactly one department this opened straight into the detail view and gave
  // no way out, so an admin could not reach either of them.
  const canGoBack = departments.length > 1 || isCompanyAdmin

  // ── Detail view of a single department ──────────────────────────────────
  if (selected) {
    return (
      <DepartmentDetail
        dept={selected}
        accent={accentFor(idxOf(selected.id))}
        departments={departments}
        orgLocks={ownedOrgs.find(o => o.id === selected.organizationId)?.lockedFields || []}
        myCards={myCards}
        onBack={canGoBack ? () => setSelId(null) : undefined}
        call={call} loading={loading} />
    )
  }

  // ── Overview: pick a department, or set the company up ───────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: grad }}>
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">
            {isCompanyAdmin ? 'Your departments' : 'My department'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCompanyAdmin
              ? 'Give each team its own look and its own boss.'
              : 'Everything for your team, in one place.'}
          </p>
        </div>
      </div>

      {/* First-run guide for a company admin with nothing yet */}
      {isCompanyAdmin && departments.length === 0 ? (
        <FirstRun ownedOrgs={ownedOrgs} call={call} loading={loading} />
      ) : (
        <>
          {/* The structure, walked one level at a time. The indented list this
              replaced drew every node at once, which is legible at two levels
              and unusable at three. */}
          <OrgChart
            departments={departments}
            ownedOrgs={ownedOrgs}
            rollup={rollup}
            onManage={setSelId} />

          {isCompanyAdmin && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NewDeptTile ownedOrgs={ownedOrgs} call={call} loading={loading} departments={departments} />
            </div>
          )}

          {/* Company-wide rules. The API has always supported these - the
              company level is what a department can only ever add to - but
              nothing in the app called it, so the only way to lock anything
              was department by department, and a company with six teams had
              to set the same rule six times. */}
          {isCompanyAdmin && ownedOrgs.map(org => (
            <GroupCompanies key={`gc-${org.id}`} org={org}
              companies={departments.filter(d => d.kind === 'company' && d.organizationId === org.id)}
              call={call} loading={loading} />
          ))}

          {isCompanyAdmin && ownedOrgs.map(org => (
            <CompanyRules key={org.id} org={org} call={call} loading={loading}
              hasCompanies={departments.some(d => d.kind === 'company' && d.organizationId === org.id)} />
          ))}
        </>
      )}
    </div>
  )
}

// ── Every company in the group, in one list (org admin) ─────────────────────
//
// The per-company switch already existed on each company's own page, which
// meant setting up a group of seven businesses was seven pages of clicking to
// answer the same question seven times. Andre asked for the group-level view,
// and he is right that it is the natural home: deciding which businesses wear
// the group look is one decision about the whole group, not seven unrelated
// ones.
//
// Same two actions as the company page, so a change made here and a change
// made there are the same write.
function GroupCompanies({ org, companies, call, loading }: {
  org: OwnedOrg; companies: Dept[]
  call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  // A flat organisation has no companies, and a list of nothing is noise.
  if (companies.length === 0) return null

  const onCount = companies.filter(c => c.inheritBrand !== false).length

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">
            Companies in {org.name || 'your group'}
          </h2>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {onCount} of {companies.length} on the group look
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Switch a company off and nothing from the group applies to it: it wears only its own
        logo, colours and details, and its own departments follow it instead. Lock the choice
        and only you can change it.
      </p>

      <div className="divide-y divide-border">
        {companies.map(c => {
          const on = c.inheritBrand !== false
          const locked = !!c.inheritBrandLocked
          return (
            <div key={c.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {on ? 'Wearing the group look' : 'Its own look'}
                    {locked && ' · locked'}
                  </p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <Toggle
                    on={on}
                    disabled={loading === `ginherit-${c.id}`}
                    label="Use group look"
                    onChange={next => call(`ginherit-${c.id}`,
                      { action: 'set_brand_inheritance', department_id: c.id, inherit: next },
                      next ? `${c.name} now uses the group look` : `${c.name} now uses its own look`)}
                  />
                  <Toggle
                    tone="lock"
                    on={locked}
                    disabled={loading === `glock-${c.id}`}
                    label="Lock"
                    onChange={next => call(`glock-${c.id}`,
                      { action: 'set_brand_inheritance_lock', department_id: c.id, locked: next },
                      next ? `${c.name} locked` : `${c.name} unlocked`)}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Company-wide locks (org admin) ──────────────────────────────────────────
function CompanyRules({ org, call, loading, hasCompanies = false }: {
  org: OwnedOrg; call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
  // A group of businesses and a single business are the same row in the
  // database and two different words to the person reading the screen.
  hasCompanies?: boolean
}) {
  const locked = org.lockedFields || []
  const key = `orglocks-${org.id}`
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-amber-500" />
        <h2 className="font-semibold text-sm">
          {hasCompanies ? 'Group rules' : 'Company rules'}{org.name ? ` for ${org.name}` : ''}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {hasCompanies
          ? 'Anything switched on here stays the same on every card in the group, in every company, whether or not that company uses the group look. A company or a team can lock more of its own, but cannot unlock anything you set here.'
          : 'Anything switched on here stays the same on every card in the company, in every department at once. A department head can lock more for their own team, but cannot unlock anything you set here.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-border">
        {LOCK_GROUPS.map(g => {
          const on = locked.includes(g.id)
          return (
            <Toggle
              key={g.id}
              tone="lock"
              on={on}
              disabled={loading === key}
              label={g.label}
              hint={on ? g.hint : 'Each company decides'}
              onChange={next => {
                call(key,
                  { action: 'set_org_locks', org_id: org.id,
                    locked: next ? [...locked, g.id] : locked.filter(id => id !== g.id) },
                  next ? `${g.label} locked across the group` : `${g.label} unlocked across the group`)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── First-run onboarding (company admin, no departments) ────────────────────
function FirstRun({ ownedOrgs, call, loading }: {
  ownedOrgs: OwnedOrg[]; call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [name, setName] = useState('')
  // Which shape the business is. Nothing is created until this is answered,
  // because the answer decides what gets made first.
  //
  // This screen used to offer one box, "name your first department", and sent
  // create_department with no kind. So setting up a group meant making a
  // department you did not want, purely to reach the screen that could make a
  // company - and a department created before any company sits outside every
  // business, which is the one arrangement the model does not allow.
  const [shape, setShape] = useState<'one' | 'group' | null>(null)
  const org = ownedOrgs[0]
  const isCompany = shape === 'group'
  const busy = loading === `newdept-${org.id}`

  async function create() {
    if (!name.trim() || !shape) return
    const ok = await call(
      `newdept-${org.id}`,
      {
        action: 'create_department',
        org_id: org.id,
        name: name.trim(),
        // Sent explicitly. The API treats a missing kind as a department,
        // which is what made a company unreachable from here.
        kind: isCompany ? 'company' : 'department',
      },
      `${name.trim()} created`,
    )
    if (ok) setName('')
  }

  const steps = isCompany
    ? [
      { icon: Building2, color: '#7c3aed', title: 'Add each business', text: 'One company per business in the group.' },
      { icon: Layers, color: '#06b6d4', title: 'Departments inside them', text: 'Sales, Admin, a branch. Cards live in these.' },
      { icon: UserPlus, color: '#ec4899', title: 'A head runs each one', text: 'They invite their own people.' },
    ]
    : [
      { icon: Building2, color: '#7c3aed', title: 'Make a department', text: 'Like Sales, or Support. Give it a name.' },
      { icon: ShieldCheck, color: '#06b6d4', title: 'Put someone in charge', text: 'Pick a head. They run just that team.' },
      { icon: UserPlus, color: '#ec4899', title: 'They invite their people', text: 'Each head builds their own team.' },
    ]

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-6 sm:p-8 text-center" style={{ background: 'linear-gradient(180deg, hsl(var(--accent) / 0.08), transparent)' }}>
        <div className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: grad }}>
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold">Set up your structure</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {shape === null
            ? 'First, which of these is you? You can change it later.'
            : isCompany
              ? 'A group holds companies, and each company holds its own departments.'
              : 'Each department gets its own look and its own boss.'}
        </p>
      </div>

      {/* ── The question, asked before anything is created ─────────────── */}
      {shape === null ? (
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            {
              id: 'one' as const, icon: Building2, tone: 'hsl(var(--accent))',
              title: 'One business',
              body: 'Everyone works for the same company. You split it into departments like Sales and Admin.',
            },
            {
              id: 'group' as const, icon: Layers, tone: 'hsl(var(--accent))',
              title: 'A group of businesses',
              body: 'You own several companies. Each keeps its own branding, its own manager and its own web address, on one invoice.',
            },
          ]).map(o => (
            <button key={o.id} onClick={() => setShape(o.id)}
              className="text-left rounded-lg border-2 border-border p-4 transition hover:shadow-lg"
              style={{ borderColor: `${o.tone}44` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{ background: `${o.tone}1f`, border: `1px solid ${o.tone}44` }}>
                <o.icon className="w-5 h-5" style={{ color: o.tone }} />
              </div>
              <p className="font-bold text-sm">{o.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{o.body}</p>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 pb-2">
            {steps.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-4 text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 relative"
                  style={{ background: `${s.color}1f`, border: `1px solid ${s.color}44` }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: s.color }}>{i + 1}</span>
                </div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="text-sm font-semibold">
                {isCompany ? 'Name your first company' : 'Name your first department'}
              </label>
              <button onClick={() => { setShape(null); setName('') }}
                className="text-xs text-muted-foreground underline hover:text-foreground">
                not right, go back
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={isCompany ? 'TBCo Roofing' : 'Sales'}
                onKeyDown={e => { if (e.key === 'Enter') create() }}
                className="flex-1 min-w-[180px] px-4 py-3 rounded-xl border border-border bg-background text-base" />
              <button disabled={!name.trim() || busy} onClick={create}
                className="px-5 py-3 rounded-xl text-base font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
                style={{ background: grad }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Create
              </button>
            </div>
            {isCompany && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Cards in it will live at <span className="font-mono">/card/{slugPreview(name) || 'name'}/person</span>.
                Choose the name once: changing it later moves every card URL underneath it, and those get printed on NFC cards.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── "New department" tile in the grid ───────────────────────────────────────
function NewDeptTile({ ownedOrgs, call, loading, departments }: {
  ownedOrgs: OwnedOrg[]; call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
  departments: Dept[]
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [orgId, setOrgId] = useState(ownedOrgs[0]?.id)
  const [kind, setKind] = useState<'company' | 'department'>('department')
  const [parentId, setParentId] = useState('')

  // Anything in this organisation can be a parent, so a group can nest as deep
  // as its structure actually goes. A company is never one: companies sit
  // directly under the group.
  const parents = kind === 'company' ? [] : departments.filter(d => d.organizationId === orgId)

  // Once a team has companies, a department has to be inside one. Offering
  // "At the top" would create a department belonging to no business, whose
  // cards have no company branding and no company URL, and which is invisible
  // to every company head at once.
  const orgHasCompanies = departments.some(d => d.organizationId === orgId && d.kind === 'company')
  const parentRequired = kind === 'department' && orgHasCompanies
  const canSubmit = !!name.trim() && (!parentRequired || !!parentId)

  // Two buttons, not one button hiding a dropdown.
  //
  // This was a single "New department" tile whose kind defaulted to
  // department, with Company tucked inside a select. Setting up a group meant
  // pressing the wrong thing and then discovering the right one, and a
  // department cannot exist before the company it belongs to - so the flow led
  // you round the wrong way. Company is listed first for a team that has none
  // yet, because that is the one to make first.
  if (!open) {
    const startWith = (k: 'company' | 'department') => { setKind(k); setOpen(true) }
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-4 flex flex-col justify-center gap-2 min-h-[104px]">
        {!orgHasCompanies && (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Running several businesses under one group? Make a company first, then put
            its departments inside it.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => startWith('company')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground transition hover:border-purple-500/50 hover:text-foreground">
            <Building2 className="w-4 h-4" />New company
          </button>
          <button onClick={() => startWith('department')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground transition hover:border-purple-500/50 hover:text-foreground">
            <Plus className="w-4 h-4" />New department
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-purple-500/40 bg-card p-4" style={{ background: 'hsl(var(--accent) / 0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">
          {kind === 'company' ? 'New company' : 'New department'}
        </span>
        <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      {/* Says what the thing being made actually is, since the two are not
          interchangeable and the difference decides where cards can go. */}
      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
        {kind === 'company'
          ? 'A business under your group. It gets its own branding, its own manager and its own web address. Departments go inside it.'
          : 'A team that people’s cards belong to, like Sales or Admin. Cards attach to a department, never straight to a company.'}
      </p>
      {ownedOrgs.length > 1 && (
        <select value={orgId} onChange={e => setOrgId(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg border border-border bg-background text-sm">
          {ownedOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      {/* What is being created, and where it sits.
          A group holds companies, each holding departments. Left alone this
          creates a plain department at the top, which is what it always did. */}
      <div className="flex flex-wrap gap-2 mb-2">
        <select value={kind} onChange={e => setKind(e.target.value as 'company' | 'department')}
          aria-label="What to create"
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="department">Department</option>
          <option value="company">Company</option>
        </select>
        {parents.length > 0 && (
          <select value={parentId} onChange={e => setParentId(e.target.value)}
            aria-label="Sits inside"
            className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-border bg-background text-sm">
            {/* No "At the top" once companies exist: a department must be in one. */}
            <option value="">{parentRequired ? 'Choose a company…' : 'At the top'}</option>
            {treeOptions(parents).map(({ dept: p, depth }) => (
              <option key={p.id} value={p.id}>
                {depth > 0 ? `${'  '.repeat(depth)}└ ` : ''}Inside {p.name}
              </option>
            ))}
          </select>
        )}
        {kind === 'company' && (
          <span className="text-xs text-muted-foreground self-center">sits under the group</span>
        )}
      </div>
      {kind === 'company' && (
        <p className="text-xs text-muted-foreground mb-2">
          Cards in this company will live at <span className="font-mono">/card/{slugPreview(name) || 'name'}/person</span>.
          Choose it once: changing it later moves every card URL underneath it.
        </p>
      )}
      <div className="flex gap-2">
        <input value={name} autoFocus onChange={e => setName(e.target.value)}
          placeholder={kind === 'company' ? 'e.g. Company A' : 'e.g. Support'}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        <button disabled={!canSubmit || loading === `newdept-${orgId}`}
          onClick={async () => { const ok = await call(`newdept-${orgId}`, { action: 'create_department', org_id: orgId, name: name.trim(), kind, parent_id: parentId || undefined }, `${name.trim()} created`); if (ok) { setName(''); setParentId(''); setOpen(false) } }}
          className="px-3 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40" style={{ background: grad }}>
          {loading === `newdept-${orgId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── One department's full detail ────────────────────────────────────────────
/**
 * A numbered section header with its own one-line explanation and a chip
 * saying what state it is currently in.
 *
 * The page was three panels of switches with a heading each. Numbering them
 * makes it read as a sequence - decide the look, decide the rules, then add
 * the people - and the state chip answers the question somebody actually
 * arrives with, which is "what is this set to right now" rather than "what
 * could I set it to".
 */
function SectionHead({ n, accent, icon: Icon, title, body, state, stateTone }: {
  n: number; accent: string; icon: any; title: string; body: string
  state?: string; stateTone?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
          {n}
        </span>
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        <h2 className="font-bold text-base">{title}</h2>
        {state && (
          <span className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={stateTone
              ? { background: `${stateTone}1f`, color: stateTone }
              : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {state}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">{body}</p>
    </div>
  )
}

function DepartmentDetail({ dept, accent, departments, orgLocks = [], myCards = [], onBack, call, loading }: {
  dept: Dept; accent: string; departments: Dept[]; orgLocks?: string[]; myCards?: MyCard[]; onBack?: () => void
  call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [headEmail, setHeadEmail] = useState('')

  // Companies this department could be moved into. Its current parent is
  // excluded, since moving somewhere it already is does nothing.
  const movableParents = departments.filter(d =>
    d.organizationId === dept.organizationId
    && d.kind === 'company'
    && d.id !== dept.id
    && d.id !== dept.parentId)

  const views = dept.cards.reduce((n, c) => n + c.views30d, 0)
  const leads = dept.cards.reduce((n, c) => n + c.leads, 0)
  const claimed = dept.cards.filter(c => c.claimed).length
  const brandCards = dept.cards.filter(c => Object.keys(c.brand).length > 0)
  const orgBrandFields = Object.keys(dept.orgBrand || {}).length

  // Everything a lock could apply to, whether this team set it or the company
  // did. The count in the section header has to match what the tiles show, and
  // the tiles show the union.
  const lockedCount = LOCK_GROUPS.filter(g =>
    (dept.lockedFields || []).includes(g.id) || orgLocks.includes(g.id)).length

  // Absent columns mean the pre-063 behaviour: inheriting, and not locked.
  const inheritOn = dept.inheritBrand !== false
  const inheritLocked = !!dept.inheritBrandLocked
  const parentName = dept.parentId
    ? (departments.find(d => d.id === dept.parentId)?.name || null)
    : null

  // The chain of parents above this node, nearest last. Cycle-guarded: the
  // trigger in migration 053 rejects them, but a walk that trusts the data is
  // one bad row away from hanging the tab.
  const ancestry = (() => {
    const byId = new Map(departments.map(d => [d.id, d]))
    const out: Dept[] = []
    const seen = new Set<string>([dept.id])
    let cur = dept.parentId ? byId.get(dept.parentId) : undefined
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      out.unshift(cur)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return out
  })()

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl p-5 sm:p-6 relative overflow-hidden border border-border"
        style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}>
        {onBack && (
          <button onClick={onBack} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
            <ChevronLeft className="w-3.5 h-3.5" /> All departments
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}26`, border: `1px solid ${accent}55` }}>
            <Building2 className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            {/* Where this sits. A department seen on its own tells you nothing
                about which company it belongs to, and in a group that is the
                first thing you need to know. */}
            {ancestry.length > 0 && (
              <p className="text-[11px] text-muted-foreground truncate mb-0.5">
                {ancestry.map(a => a.name).join(' › ')} ›
              </p>
            )}
            <h1 className="font-display text-2xl font-bold leading-tight break-words">{dept.name}</h1>
            <p className="text-sm text-muted-foreground">
              {dept.kind === 'company'
                ? (dept.isOwner ? 'You run this company' : 'You are the head of this company')
                : (dept.isOwner ? 'You run this team' : 'You are the head of this team')}
            </p>
          </div>
        </div>

        {/* One sentence on what this screen is. Whoever runs a department is
            usually not whoever chose the software, and three unexplained
            panels of switches is where most of them stop. */}
        <p className="text-sm text-muted-foreground mt-4 max-w-2xl leading-relaxed">
          Everything about {dept.name} in one place: how these cards look, what your
          people are allowed to change on their own, and who is in the team.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Views this month', value: views, icon: Eye },
            { label: 'Leads', value: leads, icon: Users },
            { label: 'People', value: `${claimed}/${dept.cards.length}`, icon: UserPlus },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg p-3 bg-card/60 backdrop-blur border border-border">
              <Icon className="w-4 h-4 mb-1.5" style={{ color: accent }} />
              <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Owner: who's in charge, rename, delete */}
      {dept.isOwner && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <h2 className="font-bold text-sm">Who&apos;s in charge</h2>
            <div className="ml-auto flex gap-1">
              <button title="Rename" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                onClick={() => { const n = prompt(`Rename "${dept.name}" to:`, dept.name); if (n && n.trim()) call(`rename-${dept.id}`, { action: 'rename_department', department_id: dept.id, name: n.trim() }, 'Renamed') }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {/* A company's web address. Its own control, not part of rename:
                  renaming is cosmetic, changing this moves the URL of every
                  card in the company, and those are printed on NFC cards. */}
              {dept.kind === 'company' && (
                <button title="Change the web address" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                  onClick={() => {
                    const current = dept.slugSegment || ''
                    const n = prompt(
                      `Web address for "${dept.name}".\n\n`
                      + `Cards here are at cardtly.com/card/${current || 'address'}/name\n\n`
                      + `WARNING: changing this changes the address of every card in this company. `
                      + `Anything already printed on an NFC card keeps pointing at the old one.`,
                      current)
                    if (n && n.trim() && n.trim() !== current) {
                      call(`seg-${dept.id}`, { action: 'set_company_segment', department_id: dept.id, slug_segment: n.trim() }, 'Web address changed')
                    }
                  }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Move this department to a different company. */}
              {dept.kind !== 'company' && movableParents.length > 0 && (
                <button title="Move to another company" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                  onClick={() => {
                    const options = movableParents.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
                    const answer = prompt(`Move "${dept.name}" into which company?\n\n${options}\n\nType a number, or 0 to leave it where it is.`, '')
                    const idx = Number(answer)
                    if (!answer || !Number.isInteger(idx) || idx < 1 || idx > movableParents.length) return
                    const target = movableParents[idx - 1]
                    call(`movedept-${dept.id}`, { action: 'move_department', department_id: dept.id, parent_id: target.id }, `Moved into ${target.name}`)
                  }}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button title="Delete department" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"
                onClick={() => { if (confirm(`Delete "${dept.name}"?\n\nIts ${dept.cards.length} card${dept.cards.length === 1 ? '' : 's'} are NOT deleted — they go back to the company look.`)) { call(`deldept-${dept.id}`, { action: 'delete_department', department_id: dept.id }, 'Department deleted').then(ok => { if (ok && onBack) onBack() }) } }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {dept.heads.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {dept.heads.map(h => (
                <span key={h.userId} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-muted">
                  <Avatar label={h.email || 'head'} color="#a855f7" size={22} />
                  <span className="text-xs font-medium">{h.email || h.userId.slice(0, 8)}</span>
                  <button onClick={() => call(`rmhead-${dept.id}-${h.userId}`, { action: 'remove_head', department_id: dept.id, user_id: h.userId }, 'Head removed')}
                    className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Nobody is in charge yet. Add their email below and they&apos;ll run this department.</p>
          )}

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={headEmail} onChange={e => setHeadEmail(e.target.value)} type="email" placeholder="boss@company.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
            </div>
            <button disabled={!headEmail.trim() || loading === `head-${dept.id}`}
              onClick={async () => { const ok = await call(`head-${dept.id}`, { action: 'appoint_head', department_id: dept.id, email: headEmail.trim() }, 'Head added'); if (ok) setHeadEmail('') }}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: grad }}>
              {loading === `head-${dept.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Make head
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">They need a Cardtly account first. Then they manage only this department.</p>
        </div>
      )}

      {/* The look */}
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHead
          n={1} accent={accent} icon={Palette}
          title="How these cards look"
          body="The colours, fonts, logo and template every card in this team uses. Pick where that look comes from: the company's, or a copy of one card you already like."
          state={dept.hasBrand ? 'Its own look' : 'Following the company'}
          stateTone={dept.hasBrand ? accent : undefined} />
        <p className="text-sm text-muted-foreground mb-4">
          {dept.hasBrand
            ? 'These cards have their own look, different from the rest of the company.'
            : 'Right now these cards use the company look, so they match everyone else. To make them stand out, copy the look of a card you like.'}
        </p>
        {/* Said out loud, because a look that follows a card and a look that
            was copied from one are indistinguishable until somebody edits that
            card and waits to see whether anything happens. */}
        {dept.brandSource && (
          <div className="rounded-xl border p-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2"
            style={{ borderColor: `${accent}55`, background: `${accent}0f` }}>
            <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <p className="text-sm flex-1 min-w-[220px]">
              <strong>Following {dept.brandSourceName || 'a card'}.</strong>{' '}
              <span className="text-muted-foreground">
                Changes to it reach every card here that has the field locked, and fill in anyone who has left it blank.
              </span>
            </p>
            <button disabled={loading === `unlink-${dept.id}`}
              onClick={() => call(`unlink-${dept.id}`, { action: 'unlink_brand_source', department_id: dept.id }, 'Look frozen as it is now')}
              className="text-sm px-3 min-h-[36px] rounded-lg font-semibold border border-border transition hover:bg-muted disabled:opacity-40">
              {loading === `unlink-${dept.id}` ? 'Working...' : 'Stop following'}
            </button>
          </div>
        )}
        {/* Sources: the company look first, then any card in this department
            that has been designed. Previously only the department's own cards
            were offered, so a department whose people had not designed
            anything yet could not be given a look at all - which is exactly
            the state a new department starts in. */}
        <div className="flex flex-wrap gap-2">
          {orgBrandFields > 0 && (
            <button disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: dept.orgBrand }, 'Started from the company look')}
              className="text-sm px-3.5 min-h-[44px] rounded-xl font-semibold border transition hover:bg-muted disabled:opacity-40 flex items-center gap-2"
              style={{ borderColor: `${accent}55`, color: accent }}>
              {loading === `brand-${dept.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
              Start from the company look
            </button>
          )}
          {/* The viewer's own cards.
              Somebody setting up a group designs the look on their own card
              first - it is the card they have been building all along - and
              there was no way to pull it across, so the only options were the
              company look or a team card already designed inside this
              department, which a new department has none of. */}
          {myCards.map(c => (
            <button key={`mine-${c.id}`} disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: c.brand, source: { table: 'cards', id: c.id } }, `Now following ${c.name || 'your card'}`)}
              className="text-sm px-3.5 min-h-[44px] rounded-xl font-semibold border transition hover:bg-muted disabled:opacity-40 flex items-center gap-2"
              style={{ borderColor: `${accent}55`, color: accent }}>
              {loading === `brand-${dept.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Use my card{myCards.length > 1 && c.name ? ` (${c.name})` : ''}
            </button>
          ))}
          {brandCards.map(c => (
            <button key={c.id} disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: c.brand, source: { table: 'team_cards', id: c.id } }, `Now following ${c.name || 'that card'}`)}
              className="text-sm px-3.5 min-h-[44px] rounded-xl font-semibold border border-border transition hover:bg-muted disabled:opacity-40 flex items-center gap-2">
              {loading === `brand-${dept.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" style={{ color: accent }} />}
              Use {c.name || 'this card'}&apos;s look
            </button>
          ))}
          {/* Outside the card list on purpose. This used to sit inside it, so
              a department with a custom look but no designed cards left had no
              way back to the company look. */}
          {dept.hasBrand && (
            <button disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: {} }, 'Back to the company look')}
              className="text-sm px-3.5 min-h-[44px] rounded-xl font-semibold border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40">
              Back to company look
            </button>
          )}
        </div>
        {/* Only when there is genuinely nothing to copy from - including the
            viewer's own cards, or this would claim there is no source while a
            button offering one sits right above it. */}
        {brandCards.length === 0 && orgBrandFields === 0 && myCards.length === 0 && (
          <p className="text-xs rounded-xl px-3 py-2.5 bg-muted/50 text-muted-foreground">
            There is no company look set yet, none of your people has designed their card, and your own card has nothing set on it. Design any one of them and you can copy it here.
          </p>
        )}
        {dept.hasBrand && (
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            A department look is a copy, not a link. Changing the company look later will not change this one - use &ldquo;Back to company look&rdquo; to follow the company again.
          </p>
        )}
      </div>

      {/* Does this one wear the look from above?
          The switch and the lock on it belong to two different people. The
          head of a company chooses their own look; the group owner chooses
          whether that head gets the choice at all. See migration 063. */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHead
          n={2} accent={accent} icon={Building2}
          title="Where this look comes from"
          body={dept.kind === 'company'
            ? 'A company can wear the group look or its own. Switched off, nothing from the group applies here, and the departments inside this company follow this company instead.'
            : 'A department can wear the look from the company above it or its own.'}
          state={inheritOn ? 'Group look' : 'Its own look'}
          stateTone={inheritOn ? accent : undefined} />

        <div className="divide-y divide-border">
          <Toggle
            on={inheritOn}
            disabled={loading === `inherit-${dept.id}` || (inheritLocked && !dept.isOwner)}
            disabledReason={inheritLocked && !dept.isOwner
              ? 'The group owner has locked this. Ask them to change it.'
              : undefined}
            label={parentName ? `Use the look from ${parentName}` : 'Use the group look'}
            hint={inheritOn
              ? 'Anything set above applies here, and anything set here overrides it.'
              : 'Only the look set here applies. Nothing comes down from above.'}
            onChange={next => call(`inherit-${dept.id}`,
              { action: 'set_brand_inheritance', department_id: dept.id, inherit: next },
              next ? 'Now following the look from above' : 'Now using its own look')}
          />

          {/* Only the group owner. A head who could lift their own lock would
              not be locked. */}
          {dept.isOwner && (
            <Toggle
              tone="lock"
              on={inheritLocked}
              disabled={loading === `inheritlock-${dept.id}`}
              label="Lock this choice"
              hint={inheritLocked
                ? `Only you can change it. ${dept.name}'s own manager cannot.`
                : `${dept.name}'s own manager can switch this either way.`}
              onChange={next => call(`inheritlock-${dept.id}`,
                { action: 'set_brand_inheritance_lock', department_id: dept.id, locked: next },
                next ? 'Locked. Only you can change it now.' : 'Unlocked. Their manager can change it.')}
            />
          )}
        </div>
      </div>

      {/* What the team may change. This is the department head's version of
          the company rules: they can add locks for their own team, and the
          company's own locks always apply on top. */}
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHead
          n={2} accent={accent} icon={Lock}
          title="What your team can change"
          body="A locked item is fixed on every card here and nobody in the team can edit it. Everything you leave open, they can change themselves."
          state={`${lockedCount} of ${LOCK_GROUPS.length} locked`}
          stateTone={lockedCount > 0 ? accent : undefined} />
        <p className="text-sm text-muted-foreground mb-4">
          Tap anything you want kept the same on every card in this team. Your people can always
          edit the rest: their own name, photo, job title and phone number.
          {orgLocks.length > 0 && ' Items the company has already locked are shown here and cannot be unlocked from inside a team.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-border">
          {LOCK_GROUPS.map(g => {
            const own = (dept.lockedFields || []).includes(g.id)
            // A company-wide lock already applies to this team - the save
            // endpoint unions the two sets. This row used to read only the
            // department's own list, so anything the company had locked showed
            // here as "Anyone can change this", which was simply untrue. It is
            // shown as locked and cannot be switched off from inside a
            // department, because a department can tighten but never loosen.
            const fromCompany = orgLocks.includes(g.id)
            return (
              <Toggle
                key={g.id}
                tone="lock"
                on={own || fromCompany}
                disabled={loading === `locks-${dept.id}` || fromCompany}
                disabledReason={fromCompany ? 'Locked for the whole group. Change it in Group rules.' : undefined}
                label={g.label}
                hint={own ? g.hint : 'Anyone in this team can change this'}
                onChange={next => {
                  const list = dept.lockedFields || []
                  call(`locks-${dept.id}`,
                    { action: 'set_locks', department_id: dept.id,
                      locked: next ? [...list, g.id] : list.filter(id => id !== g.id) },
                    next ? `${g.label} locked` : `${g.label} unlocked`)
                }}
              />
            )
          })}
        </div>
      </div>

      {/* The people */}
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHead
          n={3} accent={accent} icon={Users}
          title="The people"
          body="Everyone with a card in this team. Invite somebody by email and they get a card that is already branded and filled in, ready for them to claim."
          state={`${claimed} of ${dept.cards.length} joined`}
          stateTone={claimed === dept.cards.length && dept.cards.length > 0 ? '#22c55e' : undefined} />

        {/* A head is appointed without a card of their own. Until this button
            existed the only way to get one was inviting your own email and
            clicking the link in your own inbox. */}
        {!dept.viewerHasCard && (
          <div className="rounded-xl p-3 mb-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: `${accent}0d`, border: `1px solid ${accent}26` }}>
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: accent }}>You do not have a card yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Make one for yourself in {dept.name}. It uses one of the company&rsquo;s seats.
              </p>
            </div>
            <button
              disabled={loading === `owncard-${dept.id}`}
              onClick={() => call(`owncard-${dept.id}`, { action: 'create_own_card', department_id: dept.id }, 'Your card is ready')}
              className="shrink-0 px-4 min-h-[44px] rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: grad }}>
              {loading === `owncard-${dept.id}`
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>Create my card</>}
            </button>
          </div>
        )}

        <div className="rounded-xl p-3 mb-4" style={{ background: `${accent}0d`, border: `1px solid ${accent}26` }}>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: accent }}>
            <UserPlus className="w-3.5 h-3.5" /> Add someone to {dept.name}
          </p>
          <div className="flex gap-2 flex-wrap">
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Their name (optional)"
              className="flex-1 min-w-[120px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm" />
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" placeholder="their@email.com"
              className="flex-1 min-w-[150px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm" />
            <button disabled={!inviteEmail.trim() || loading === `invite-${dept.id}`}
              onClick={async () => { const ok = await call(`invite-${dept.id}`, { action: 'add_member', department_id: dept.id, name: inviteName.trim(), email: inviteEmail.trim() }, 'Invite sent!'); if (ok) { setInviteName(''); setInviteEmail('') } }}
              className="px-4 py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5" style={{ background: grad }}>
              {loading === `invite-${dept.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send invite</>}
            </button>
          </div>
        </div>

        {dept.cards.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No one here yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add your first person with the box above.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {dept.cards.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-border">
                <Avatar label={c.name || c.inviteEmail || '?'} color={c.claimed ? '#22c55e' : '#f59e0b'} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name || (c.inviteEmail || 'Unnamed')}</p>
                  <p className="text-[11px] flex items-center gap-1.5" style={{ color: c.claimed ? '#22c55e' : '#f59e0b' }}>
                    {c.claimed ? <><Check className="w-3 h-3" />Joined</> : <><Mail className="w-3 h-3" />Invited{c.inviteEmail ? ` · ${c.inviteEmail}` : ''}</>}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:block tabular-nums">{c.views30d} views</span>
                {/* The way into the editor. /dashboard/team/card/[id] has always
                    admitted department heads, and /api/team/card/save has always
                    accepted their writes - there was simply no link to it
                    anywhere a head can reach, so the permission existed and the
                    door did not. A head could see their people and open their
                    public cards, but not change a phone number. */}
                <Link href={`/dashboard/team/card/${c.id}`} title="Edit this card"
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                {c.slug && (
                  <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer" title="Open card"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
                )}
                {/* Per-card lead form. Same picker the owner has on Team Cards,
                    here for the department head. Only when the org has forms. */}
                {dept.forms && dept.forms.length > 0 && (
                  <select
                    value={c.useTeamQuestionnaire === false ? 'off' : (c.assignedFormId || 'default')}
                    disabled={loading === `form-${c.id}`}
                    title="Which lead-capture form this card shows"
                    onChange={e => call(`form-${c.id}`, { action: 'set_card_form', team_card_id: c.id, form_id: e.target.value }, 'Lead form updated')}
                    className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background max-w-[130px]">
                    <option value="default">Company default</option>
                    {dept.forms.map((f, fi) => <option key={f.id} value={f.id}>{f.title?.trim() || `Form ${fi + 1}`}</option>)}
                    <option value="off">No form</option>
                  </select>
                )}
                {departments.length > 1 && (
                  <select value={dept.id} disabled={loading === `move-${c.id}`} title="Move to another department"
                    onChange={e => call(`move-${c.id}`, { action: 'move_card', team_card_id: c.id, to_department_id: e.target.value }, 'Moved')}
                    className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background max-w-[110px]">
                    {/* Indented so "Sales" under Company A is distinguishable
                        from "Sales" under Company B. Two units with the same
                        name in different businesses is normal in a group, and
                        a flat list makes moving somebody a coin toss. */}
                    {treeOptions(departments).map(({ dept: d, depth }) => (
                      <option key={d.id} value={d.id}>
                        {depth > 0 ? `${'  '.repeat(depth)}└ ` : ''}{d.name}
                      </option>
                    ))}
                  </select>
                )}
                {!c.claimed && (
                  <>
                    <button disabled={loading === `resend-${c.id}`} title="Send the invite again"
                      onClick={() => call(`resend-${c.id}`, { action: 'resend_invite', team_card_id: c.id }, 'Invite resent')}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      {loading === `resend-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button disabled={loading === `rm-${c.id}`} title="Remove this invite"
                      onClick={() => { if (confirm(`Remove the invite for ${c.name || c.inviteEmail || 'this card'}?`)) call(`rm-${c.id}`, { action: 'remove_member', team_card_id: c.id }, 'Removed') }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          You can remove people who haven&apos;t joined yet. To remove someone already using their card, ask your main admin.
        </p>
      </div>
    </div>
  )
}

// What the company's URL segment will look like, shown live while typing.
// Mirrors slugifyPart in lib/card-slug; the server is what actually decides,
// and it re-slugifies and checks the name is free before saving.
function slugPreview(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
}

/**
 * Departments in tree order, each tagged with its depth.
 *
 * Used both for the overview list and for the "move this card" picker, so the
 * two cannot disagree about where something sits.
 *
 * A department whose parent the viewer cannot see is treated as a root rather
 * than disappearing into it - that is exactly what the manager of one branch
 * of a group sees, since permissions filter the parent out. The seen-set means
 * a cycle renders as a flat list instead of hanging the browser.
 */
function treeOptions(departments: Dept[]): TreeRow[] {
  const visible = new Set(departments.map(d => d.id))
  const childrenOf = new Map<string | null, Dept[]>()
  for (const d of departments) {
    const key = d.parentId && visible.has(d.parentId) ? d.parentId : null
    const list = childrenOf.get(key) || []
    list.push(d)
    childrenOf.set(key, list)
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  const out: TreeRow[] = []
  const seen = new Set<string>()

  // `rails` says, for each level ABOVE this row, whether that ancestor still
  // has siblings below - which is exactly the question "does a vertical line
  // continue past this row at that indent". Without it the connectors are
  // guesswork and the lines run through gaps they should not.
  const walk = (parent: string | null, depth: number, rails: boolean[]) => {
    const kids = childrenOf.get(parent) || []
    kids.forEach((d, i) => {
      if (seen.has(d.id)) return
      seen.add(d.id)
      const isLast = i === kids.length - 1
      out.push({ dept: d, depth, rails, isLast, hasChildren: (childrenOf.get(d.id) || []).length > 0 })
      walk(d.id, depth + 1, [...rails, !isLast])
    })
  }
  walk(null, 0, [])
  for (const d of departments) {
    if (!seen.has(d.id)) out.push({ dept: d, depth: 0, rails: [], isLast: true, hasChildren: false })
  }
  return out
}

type TreeRow = {
  dept: Dept
  depth: number
  /** For each level above this row, does a vertical line continue past it. */
  rails: boolean[]
  isLast: boolean
  hasChildren: boolean
}

type Rollup = { people: number; claimed: number; views30d: number; leads: number }

/**
 * Totals for each department including everything beneath it.
 *
 * Computed by walking down from every node rather than up from every card, so
 * a card is counted once per ancestor and never twice for the same one. The
 * seen-set makes a cycle terminate instead of adding numbers forever, which is
 * the failure mode that would turn a display bug into a hung tab.
 */
function rollUpSubtrees(departments: Dept[]): Record<string, Rollup> {
  const byId = new Map(departments.map(d => [d.id, d]))
  const childrenOf = new Map<string, string[]>()
  for (const d of departments) {
    if (!d.parentId || !byId.has(d.parentId)) continue
    const list = childrenOf.get(d.parentId) || []
    list.push(d.id)
    childrenOf.set(d.parentId, list)
  }

  const out: Record<string, Rollup> = {}
  for (const root of departments) {
    const total: Rollup = { people: 0, claimed: 0, views30d: 0, leads: 0 }
    const seen = new Set<string>()
    const stack = [root.id]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      const d = byId.get(id)
      if (!d) continue
      total.people += d.cards.length
      total.claimed += d.cards.filter(c => c.claimed).length
      for (const c of d.cards) { total.views30d += c.views30d || 0; total.leads += c.leads || 0 }
      for (const child of childrenOf.get(id) || []) stack.push(child)
    }
    out[root.id] = total
  }
  return out
}
