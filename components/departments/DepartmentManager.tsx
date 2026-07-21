'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LOCK_GROUPS } from '@/lib/team-locks'
import { Layers, Palette, Loader2, UserPlus, X, ExternalLink, Eye, Users, Check, RefreshCw, Building2, Crown, Plus, Pencil, Trash2, ShieldCheck, ArrowRight, Sparkles, Mail, ChevronLeft, Lock, LockOpen } from 'lucide-react'

interface Card {
  id: string; name: string | null; slug: string | null; claimed: boolean
  inviteEmail: string | null; views30d: number; leads: number; viewCount: number; brand: Record<string, any>
}
interface Head { userId: string; email: string | null }
interface Dept {
  id: string; name: string; organizationId: string; isOwner: boolean
  brand: Record<string, any>; hasBrand: boolean; heads: Head[]; cards: Card[]
  lockedFields: string[]
}
interface OwnedOrg { id: string; name: string; lockedFields: string[] }

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

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

// A tiny visual of the department's look: the accent colour, or a muted "same
// as company" chip. Gives the abstract idea of "a look" something to see.
function LookSwatch({ dept, accent }: { dept: Dept; accent: string }) {
  if (!dept.hasBrand) {
    return <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground">Company look</span>
  }
  return (
    <span className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1.5 font-medium"
      style={{ background: `${accent}1a`, color: accent }}>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
      Own look
    </span>
  )
}

export default function DepartmentManager({ departments, ownedOrgs }: { departments: Dept[]; ownedOrgs: OwnedOrg[] }) {
  const router = useRouter()
  const [selId, setSelId] = useState<string | null>(departments.length === 1 ? departments[0].id : null)
  const [loading, setLoading] = useState<string | null>(null)

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
        onBack={canGoBack ? () => setSelId(null) : undefined}
        call={call} loading={loading} />
    )
  }

  // ── Overview: pick a department, or set the company up ───────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: grad }}>
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
          {/* Department cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {departments.map((d, i) => {
              const accent = accentFor(i)
              const claimed = d.cards.filter(c => c.claimed).length
              return (
                <button key={d.id} onClick={() => setSelId(d.id)}
                  className="group text-left rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ boxShadow: `0 1px 0 ${accent}22` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accent}1f`, border: `1px solid ${accent}44` }}>
                      <Building2 className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.cards.length} {d.cards.length === 1 ? 'person' : 'people'}
                        {claimed < d.cards.length && ` · ${d.cards.length - claimed} not joined yet`}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition -mr-1 mt-1" />
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <LookSwatch dept={d} accent={accent} />
                    {d.heads.length > 0 ? (
                      <span className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1.5 bg-muted"
                        style={{ color: '#a78bfa' }}>
                        <ShieldCheck className="w-3 h-3" />
                        {d.heads.length === 1 ? (d.heads[0].email?.split('@')[0] || 'head') : `${d.heads.length} heads`}
                      </span>
                    ) : d.isOwner ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />No boss yet
                      </span>
                    ) : null}
                    {/* Overlapping member avatars */}
                    <div className="flex -space-x-1.5 ml-auto">
                      {d.cards.slice(0, 4).map((c, ci) => (
                        <span key={c.id} className="ring-2 ring-card rounded-full">
                          <Avatar label={c.name || c.inviteEmail || '?'} color={accentFor(i + ci + 1)} size={22} />
                        </span>
                      ))}
                      {d.cards.length > 4 && (
                        <span className="ring-2 ring-card rounded-full w-[22px] h-[22px] flex items-center justify-center text-[9px] font-bold bg-muted text-muted-foreground">
                          +{d.cards.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {isCompanyAdmin && <NewDeptTile ownedOrgs={ownedOrgs} call={call} loading={loading} />}
          </div>

          {/* Company-wide rules. The API has always supported these - the
              company level is what a department can only ever add to - but
              nothing in the app called it, so the only way to lock anything
              was department by department, and a company with six teams had
              to set the same rule six times. */}
          {isCompanyAdmin && ownedOrgs.map(org => (
            <CompanyRules key={org.id} org={org} call={call} loading={loading} />
          ))}
        </>
      )}
    </div>
  )
}

// ── Company-wide locks (org admin) ──────────────────────────────────────────
function CompanyRules({ org, call, loading }: {
  org: OwnedOrg; call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const locked = org.lockedFields || []
  const key = `orglocks-${org.id}`
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-amber-500" />
        <h2 className="font-bold text-sm">Company rules{org.name ? ` for ${org.name}` : ''}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Tap anything that should stay the same on every card in the company. This applies to every
        department at once. A department head can lock more for their own team, but cannot unlock
        anything you set here.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LOCK_GROUPS.map(g => {
          const on = locked.includes(g.id)
          return (
            <button key={g.id} disabled={loading === key}
              onClick={() => {
                const next = on ? locked.filter(id => id !== g.id) : [...locked, g.id]
                call(key, { action: 'set_org_locks', org_id: org.id, locked: next },
                  on ? `${g.label} unlocked company-wide` : `${g.label} locked company-wide`)
              }}
              className={`text-left rounded-2xl border-2 p-3 transition-all disabled:opacity-40 ${on ? '' : 'border-border hover:border-foreground/20 hover:-translate-y-0.5'}`}
              style={on ? { borderColor: '#f59e0b', background: '#f59e0b14' } : undefined}>
              <span className="flex items-center gap-2">
                {on
                  ? <Lock className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  : <LockOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                <span className={`text-sm font-bold ${on ? 'text-amber-500' : ''}`}>{g.label}</span>
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5 ml-5.5">
                {on ? g.hint : 'Each department decides'}
              </span>
            </button>
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
  const org = ownedOrgs[0]
  const steps = [
    { icon: Building2, color: '#7c3aed', title: 'Make a department', text: 'Like Sales, or Support. Give it a name.' },
    { icon: ShieldCheck, color: '#06b6d4', title: 'Put someone in charge', text: 'Pick a head. They run just that team.' },
    { icon: UserPlus, color: '#ec4899', title: 'They invite their people', text: 'Each head builds their own team.' },
  ]
  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="p-6 sm:p-8 text-center" style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.08), transparent)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: grad }}>
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold">Split your company into departments</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Each one gets its own look and its own boss. It takes three easy steps.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 pb-2">
        {steps.map((s, i) => (
          <div key={i} className="rounded-2xl border border-border p-4 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 relative"
              style={{ background: `${s.color}1f`, border: `1px solid ${s.color}44` }}>
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center" style={{ background: s.color }}>{i + 1}</span>
            </div>
            <p className="font-semibold text-sm">{s.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        <label className="text-sm font-semibold block mb-2">Start now — name your first department</label>
        <div className="flex gap-2 flex-wrap">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Sales"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) call(`newdept-${org.id}`, { action: 'create_department', org_id: org.id, name: name.trim() }, `${name.trim()} created`).then(ok => ok && setName('')) }}
            className="flex-1 min-w-[180px] px-4 py-3 rounded-xl border border-border bg-background text-base" />
          <button disabled={!name.trim() || loading === `newdept-${org.id}`}
            onClick={async () => { const ok = await call(`newdept-${org.id}`, { action: 'create_department', org_id: org.id, name: name.trim() }, `${name.trim()} created`); if (ok) setName('') }}
            className="px-5 py-3 rounded-xl text-base font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            style={{ background: grad }}>
            {loading === `newdept-${org.id}` ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ── "New department" tile in the grid ───────────────────────────────────────
function NewDeptTile({ ownedOrgs, call, loading }: {
  ownedOrgs: OwnedOrg[]; call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [orgId, setOrgId] = useState(ownedOrgs[0]?.id)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-dashed border-border p-4 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition hover:border-purple-500/50 hover:text-foreground min-h-[104px]">
        <Plus className="w-5 h-5" /> New department
      </button>
    )
  }
  return (
    <div className="rounded-2xl border border-purple-500/40 bg-card p-4" style={{ background: 'rgba(124,58,237,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">New department</span>
        <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      {ownedOrgs.length > 1 && (
        <select value={orgId} onChange={e => setOrgId(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg border border-border bg-background text-sm">
          {ownedOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <input value={name} autoFocus onChange={e => setName(e.target.value)} placeholder="e.g. Support"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        <button disabled={!name.trim() || loading === `newdept-${orgId}`}
          onClick={async () => { const ok = await call(`newdept-${orgId}`, { action: 'create_department', org_id: orgId, name: name.trim() }, `${name.trim()} created`); if (ok) { setName(''); setOpen(false) } }}
          className="px-3 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40" style={{ background: grad }}>
          {loading === `newdept-${orgId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── One department's full detail ────────────────────────────────────────────
function DepartmentDetail({ dept, accent, departments, orgLocks = [], onBack, call, loading }: {
  dept: Dept; accent: string; departments: Dept[]; orgLocks?: string[]; onBack?: () => void
  call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [headEmail, setHeadEmail] = useState('')

  const views = dept.cards.reduce((n, c) => n + c.views30d, 0)
  const leads = dept.cards.reduce((n, c) => n + c.leads, 0)
  const claimed = dept.cards.filter(c => c.claimed).length
  const brandCards = dept.cards.filter(c => Object.keys(c.brand).length > 0)

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-3xl p-5 sm:p-6 relative overflow-hidden border border-border"
        style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}>
        {onBack && (
          <button onClick={onBack} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
            <ChevronLeft className="w-3.5 h-3.5" /> All departments
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}26`, border: `1px solid ${accent}55` }}>
            <Building2 className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">{dept.name}</h1>
            <p className="text-sm text-muted-foreground">{dept.isOwner ? 'You run this department' : 'You are the head of this department'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Views this month', value: views, icon: Eye },
            { label: 'Leads', value: leads, icon: Users },
            { label: 'People', value: `${claimed}/${dept.cards.length}`, icon: UserPlus },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl p-3 bg-card/60 backdrop-blur border border-border">
              <Icon className="w-4 h-4 mb-1.5" style={{ color: accent }} />
              <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Owner: who's in charge, rename, delete */}
      {dept.isOwner && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <h2 className="font-bold text-sm">Who&apos;s in charge</h2>
            <div className="ml-auto flex gap-1">
              <button title="Rename" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                onClick={() => { const n = prompt(`Rename "${dept.name}" to:`, dept.name); if (n && n.trim()) call(`rename-${dept.id}`, { action: 'rename_department', department_id: dept.id, name: n.trim() }, 'Renamed') }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
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
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4" style={{ color: accent }} />
          <h2 className="font-bold text-sm">How this department looks</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {dept.hasBrand
            ? 'These cards have their own look, different from the rest of the company.'
            : 'Right now these cards use the company look. Want them to stand out? Copy a card you like.'}
        </p>
        {brandCards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {brandCards.map(c => (
              <button key={c.id} disabled={loading === `brand-${dept.id}`}
                onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: c.brand }, `Look copied from ${c.name || 'that card'}`)}
                className="text-sm px-3.5 py-2 rounded-xl font-semibold border border-border transition hover:bg-muted disabled:opacity-40 flex items-center gap-2">
                {loading === `brand-${dept.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" style={{ color: accent }} />}
                Use {c.name || 'this card'}&apos;s look
              </button>
            ))}
            {dept.hasBrand && (
              <button disabled={loading === `brand-${dept.id}`}
                onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: {} }, 'Back to the company look')}
                className="text-sm px-3.5 py-2 rounded-xl font-semibold border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40">
                Back to company look
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs rounded-xl px-3 py-2.5 bg-muted/50 text-muted-foreground">
            None of your people has designed their card yet. Once one does (under My Card), you can copy that look for the whole department here.
          </p>
        )}
      </div>

      {/* What the team may change. This is the department head's version of
          the company rules: they can add locks for their own team, and the
          company's own locks always apply on top. */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4" style={{ color: accent }} />
          <h2 className="font-bold text-sm">What your team can change</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Tap anything you want kept the same on every card in this department. Your people can still
          edit everything else - their name, photo, job title and phone number.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOCK_GROUPS.map(g => {
            const own = (dept.lockedFields || []).includes(g.id)
            // A company-wide lock already applies to this team - the save
            // endpoint unions the two sets. This tile used to read only the
            // department's own list, so anything the company had locked showed
            // here as "Anyone can change this", which was simply untrue. It is
            // shown as locked and cannot be toggled off from inside a
            // department, because a department can tighten but never loosen.
            const fromCompany = orgLocks.includes(g.id)
            const on = own || fromCompany
            return (
              <button key={g.id} disabled={loading === `locks-${dept.id}` || fromCompany}
                title={fromCompany ? 'Locked for the whole company. Change it in Company rules.' : undefined}
                onClick={() => {
                  if (fromCompany) return
                  const next = own
                    ? (dept.lockedFields || []).filter(id => id !== g.id)
                    : [...(dept.lockedFields || []), g.id]
                  call(`locks-${dept.id}`, { action: 'set_locks', department_id: dept.id, locked: next },
                    own ? `${g.label} unlocked` : `${g.label} locked`)
                }}
                className={`text-left rounded-2xl border-2 p-3 transition-all disabled:opacity-60 ${on ? '' : 'border-border hover:border-foreground/20 hover:-translate-y-0.5'} ${fromCompany ? 'cursor-not-allowed' : ''}`}
                style={on ? { borderColor: accent, background: accent + '14' } : undefined}>
                <span className="flex items-center gap-2">
                  {on
                    ? <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                    : <LockOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                  <span className="text-sm font-bold" style={on ? { color: accent } : undefined}>{g.label}</span>
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5 ml-5.5">
                  {fromCompany ? 'Locked company-wide' : on ? g.hint : 'Anyone can change this'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* The people */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold text-sm mb-3">The people</h2>

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
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
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
                {c.slug && (
                  <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer" title="Open card"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
                )}
                {departments.length > 1 && (
                  <select value={dept.id} disabled={loading === `move-${c.id}`} title="Move to another department"
                    onChange={e => call(`move-${c.id}`, { action: 'move_card', team_card_id: c.id, to_department_id: e.target.value }, 'Moved')}
                    className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background max-w-[110px]">
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
