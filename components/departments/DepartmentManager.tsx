'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Layers, Palette, Loader2, UserPlus, X, ExternalLink, Eye, Users, Check,
  RefreshCw, Building2, Crown, Plus, Pencil, Trash2, ShieldCheck,
} from 'lucide-react'

interface Card {
  id: string; name: string | null; slug: string | null; claimed: boolean
  inviteEmail: string | null; views30d: number; leads: number; viewCount: number; brand: Record<string, any>
}
interface Head { userId: string; email: string | null }
interface Dept {
  id: string; name: string; organizationId: string; isOwner: boolean
  brand: Record<string, any>; hasBrand: boolean; heads: Head[]; cards: Card[]
}
interface OwnedOrg { id: string; name: string }

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function DepartmentManager({ departments, ownedOrgs }: { departments: Dept[]; ownedOrgs: OwnedOrg[] }) {
  const router = useRouter()
  const [selId, setSelId] = useState(departments[0]?.id)
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

  const dept = departments.find(d => d.id === selId) || departments[0]
  const isCompanyAdmin = ownedOrgs.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6" style={{ color: '#a855f7' }} />
          {isCompanyAdmin ? 'Departments' : (departments.length > 1 ? 'My departments' : dept?.name || 'My department')}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isCompanyAdmin
            ? 'Set up your departments, appoint a head for each, and manage your own. Each department can look different.'
            : 'Set your department’s look, invite your people, and see how you are doing. You only see and manage your own department.'}
        </p>
      </div>

      {/* Owner-only: the company structure. Create departments, appoint heads. */}
      {isCompanyAdmin && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <h2 className="font-bold">You run this company</h2>
          </div>
          {ownedOrgs.map(org => (
            <OrgStructure key={org.id} org={org}
              depts={departments.filter(d => d.organizationId === org.id && d.isOwner)}
              call={call} loading={loading} />
          ))}
        </div>
      )}

      {departments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No departments yet. Create your first one above, then appoint a head for it.</p>
        </div>
      ) : (
        <>
          {/* Manager view of the selected department. Works for owner and head alike. */}
          {departments.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {departments.map(d => (
                <button key={d.id} onClick={() => setSelId(d.id)}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold border transition"
                  style={d.id === selId
                    ? { borderColor: 'transparent', background: grad, color: '#fff' }
                    : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {dept && <ManagerView dept={dept} departments={departments} call={call} loading={loading} />}
        </>
      )}
    </div>
  )
}

// ── Owner: one owned org's departments ─────────────────────────────────────
function OrgStructure({ org, depts, call, loading }: {
  org: OwnedOrg; depts: Dept[]
  call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [newName, setNewName] = useState('')
  const [headEmail, setHeadEmail] = useState<Record<string, string>>({})

  return (
    <div>
      <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
        <Building2 className="w-3.5 h-3.5" style={{ color: '#f472b6' }} />{org.name}
      </p>

      <div className="space-y-2">
        {depts.map(d => (
          <div key={d.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{d.name}</span>
              <span className="text-xs text-muted-foreground">{d.cards.length} card{d.cards.length === 1 ? '' : 's'}</span>
              {d.hasBrand
                ? <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(34,197,94,0.14)', color: '#22c55e' }}><Palette className="w-2.5 h-2.5" />custom look</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inherits company look</span>}
              <button className="ml-auto text-muted-foreground hover:text-foreground" title="Rename"
                onClick={() => { const n = prompt(`Rename "${d.name}" to:`, d.name); if (n && n.trim()) call(`rename-${d.id}`, { action: 'rename_department', department_id: d.id, name: n.trim() }, 'Renamed') }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button className="text-red-400 hover:text-red-300" title="Delete department"
                onClick={() => { if (confirm(`Delete "${d.name}"?\n\nIts ${d.cards.length} card${d.cards.length === 1 ? '' : 's'} are NOT deleted; they fall back to the company look.`)) call(`deldept-${d.id}`, { action: 'delete_department', department_id: d.id }, 'Department deleted') }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Heads */}
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Head{d.heads.length === 1 ? '' : 's'} of this department</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {d.heads.map(h => (
                  <span key={h.userId} className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(168,85,247,0.12)', color: '#a78bfa' }}>
                    {h.email || h.userId.slice(0, 8)}
                    <button onClick={() => call(`rmhead-${d.id}-${h.userId}`, { action: 'remove_head', department_id: d.id, user_id: h.userId }, 'Head removed')} className="hover:text-white">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {d.heads.length === 0 && <span className="text-[11px] text-muted-foreground">No head yet</span>}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={headEmail[d.id] || ''} onChange={e => setHeadEmail(s => ({ ...s, [d.id]: e.target.value }))}
                  placeholder="Appoint a head by their email" type="email"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs" />
                <button
                  disabled={!(headEmail[d.id] || '').trim() || loading === `head-${d.id}`}
                  onClick={async () => {
                    const ok = await call(`head-${d.id}`, { action: 'appoint_head', department_id: d.id, email: (headEmail[d.id] || '').trim() }, 'Head appointed')
                    if (ok) setHeadEmail(s => ({ ...s, [d.id]: '' }))
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: grad }}>
                  {loading === `head-${d.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Appoint'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">They need a Cardtly account first. Once appointed, they see and manage only this department.</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create a department */}
      <div className="flex gap-2 mt-2.5">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New department, e.g. Sales"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        <button disabled={!newName.trim() || loading === `newdept-${org.id}`}
          onClick={async () => { const ok = await call(`newdept-${org.id}`, { action: 'create_department', org_id: org.id, name: newName.trim() }, `${newName.trim()} created`); if (ok) setNewName('') }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: grad }}>
          {loading === `newdept-${org.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add department
        </button>
      </div>
    </div>
  )
}

// ── Manager view of one department (owner or head) ─────────────────────────
function ManagerView({ dept, departments, call, loading }: {
  dept: Dept; departments: Dept[]
  call: (k: string, b: object, m: string) => Promise<boolean>; loading: string | null
}) {
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const totalViews = dept.cards.reduce((n, c) => n + c.views30d, 0)
  const totalLeads = dept.cards.reduce((n, c) => n + c.leads, 0)
  const claimed = dept.cards.filter(c => c.claimed).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Views (30d)', value: totalViews, icon: Eye, color: '#06b6d4' },
          { label: 'Leads', value: totalLeads, icon: Users, color: '#22c55e' },
          { label: 'People', value: `${claimed}/${dept.cards.length}`, icon: UserPlus, color: '#a855f7' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4 border border-border bg-card">
            <Icon className="w-4 h-4 mb-2" style={{ color }} />
            <p className="text-2xl font-black tracking-tight">{value}</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4" style={{ color: '#a855f7' }} />
          <h2 className="font-bold">{dept.name}: the look</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {dept.hasBrand
            ? 'This department has its own look. Every card in it wears this instead of the company default.'
            : 'These cards use the company look. Set a card up how you want the department to look, then apply it here.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {dept.cards.filter(c => Object.keys(c.brand).length > 0).map(c => (
            <button key={c.id} disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: c.brand }, `Look set from ${c.name || 'that card'}`)}
              className="text-xs px-3 py-2 rounded-xl font-semibold border border-border transition hover:bg-muted disabled:opacity-40">
              {loading === `brand-${dept.id}` ? <Loader2 className="w-3 h-3 inline animate-spin" /> : <Check className="w-3 h-3 inline mr-1" />}
              Use {c.name || 'this card'}&apos;s look
            </button>
          ))}
          {dept.hasBrand && (
            <button disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: {} }, 'Reverted to the company look')}
              className="text-xs px-3 py-2 rounded-xl font-semibold border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40">
              Revert to company look
            </button>
          )}
          {dept.cards.every(c => Object.keys(c.brand).length === 0) && (
            <p className="text-xs text-muted-foreground">No card here has a look set yet. Design one under My Card, then come back.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold mb-3">{dept.name}: the people</h2>
        <div className="flex gap-2 flex-wrap mb-4">
          <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)"
            className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="their@email.com" type="email"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <button disabled={!inviteEmail.trim() || loading === `invite-${dept.id}`}
            onClick={async () => { const ok = await call(`invite-${dept.id}`, { action: 'add_member', department_id: dept.id, name: inviteName.trim(), email: inviteEmail.trim() }, 'Invite sent'); if (ok) { setInviteName(''); setInviteEmail('') } }}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40" style={{ background: grad }}>
            {loading === `invite-${dept.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 inline mr-1" />Invite</>}
          </button>
        </div>

        {dept.cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody here yet. Invite your first person above.</p>
        ) : (
          <div className="space-y-1.5">
            {dept.cards.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 bg-muted/30">
                <span className="font-medium truncate max-w-[130px]">{c.name || 'Unnamed'}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={c.claimed ? { background: 'rgba(34,197,94,0.14)', color: '#22c55e' } : { background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}>
                  {c.claimed ? 'active' : 'invited'}
                </span>
                {!c.claimed && c.inviteEmail && <span className="text-xs text-muted-foreground truncate max-w-[140px]">{c.inviteEmail}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{c.views30d} views &middot; {c.leads} leads</span>
                {c.slug && <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>}
                {departments.length > 1 && (
                  <select value={dept.id} disabled={loading === `move-${c.id}`}
                    onChange={e => call(`move-${c.id}`, { action: 'move_card', team_card_id: c.id, to_department_id: e.target.value }, 'Card moved')}
                    className="text-xs px-1.5 py-1 rounded border border-border bg-background">
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
                {!c.claimed && (
                  <>
                    <button disabled={loading === `resend-${c.id}`} title="Resend invite"
                      onClick={() => call(`resend-${c.id}`, { action: 'resend_invite', team_card_id: c.id }, 'Invite resent')}
                      className="text-muted-foreground hover:text-foreground">
                      {loading === `resend-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button disabled={loading === `rm-${c.id}`} title="Remove invite"
                      onClick={() => { if (confirm(`Remove the invite for ${c.name || c.inviteEmail || 'this card'}?`)) call(`rm-${c.id}`, { action: 'remove_member', team_card_id: c.id }, 'Removed') }}
                      className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          You can only remove invites that have not been claimed. To remove someone who has already signed in, ask your main admin.
        </p>
      </div>
    </div>
  )
}
