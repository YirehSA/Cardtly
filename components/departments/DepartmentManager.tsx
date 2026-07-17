'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Layers, Palette, Loader2, UserPlus, Mail, X, ExternalLink, Eye, Users, Check, RefreshCw, ArrowRightLeft } from 'lucide-react'

interface Card {
  id: string
  name: string | null
  slug: string | null
  claimed: boolean
  inviteEmail: string | null
  views30d: number
  leads: number
  viewCount: number
  brand: Record<string, any>
}
interface Dept {
  id: string
  name: string
  viaOwner: boolean
  brand: Record<string, any>
  hasBrand: boolean
  cards: Card[]
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function DepartmentManager({ departments }: { departments: Dept[] }) {
  const router = useRouter()
  const [selId, setSelId] = useState(departments[0]?.id)
  const [loading, setLoading] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  const dept = departments.find(d => d.id === selId) || departments[0]

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

  if (!dept) return null

  const totalViews = dept.cards.reduce((n, c) => n + c.views30d, 0)
  const totalLeads = dept.cards.reduce((n, c) => n + c.leads, 0)
  const claimed = dept.cards.filter(c => c.claimed).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6" style={{ color: '#a855f7' }} />
          {departments.length > 1 ? 'My departments' : dept.name}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Set your department&apos;s look, invite your people, and see how you are doing. You only see and manage your own department.
        </p>
      </div>

      {/* Department switcher when they run more than one */}
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

      {/* Scoped analytics */}
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

      {/* Department look */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4" style={{ color: '#a855f7' }} />
          <h2 className="font-bold">Your department&apos;s look</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {dept.hasBrand
            ? 'Your department has its own look. Every card in it wears this instead of the company default.'
            : 'Your cards use the company look. Set a card up the way you want the department to look, then apply it here.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {dept.cards.filter(c => Object.keys(c.brand).length > 0).map(c => (
            <button key={c.id} disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: c.brand }, `Department look set from ${c.name || 'that card'}`)}
              className="text-xs px-3 py-2 rounded-xl font-semibold border transition hover:bg-muted disabled:opacity-40"
              style={{ borderColor: 'hsl(var(--border))' }}>
              {loading === `brand-${dept.id}` ? <Loader2 className="w-3 h-3 inline animate-spin" /> : <Check className="w-3 h-3 inline mr-1" />}
              Use {c.name || 'this card'}&apos;s look
            </button>
          ))}
          {dept.hasBrand && (
            <button disabled={loading === `brand-${dept.id}`}
              onClick={() => call(`brand-${dept.id}`, { action: 'set_brand', department_id: dept.id, brand: {} }, 'Reverted to the company look')}
              className="text-xs px-3 py-2 rounded-xl font-semibold border transition hover:bg-muted disabled:opacity-40"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
              Revert to company look
            </button>
          )}
          {dept.cards.every(c => Object.keys(c.brand).length === 0) && (
            <p className="text-xs text-muted-foreground">
              None of your cards has a look set yet. Design one under My Card, then come back.
            </p>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold mb-3">Your people</h2>

        {/* Invite */}
        <div className="flex gap-2 flex-wrap mb-4">
          <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)"
            className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="their@email.com" type="email"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <button
            disabled={!inviteEmail.trim() || loading === `invite-${dept.id}`}
            onClick={async () => {
              const ok = await call(`invite-${dept.id}`, { action: 'add_member', department_id: dept.id, name: inviteName.trim(), email: inviteEmail.trim() }, 'Invite sent')
              if (ok) { setInviteName(''); setInviteEmail('') }
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: grad }}>
            {loading === `invite-${dept.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 inline mr-1" />Invite</>}
          </button>
        </div>

        {dept.cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody in this department yet. Invite your first person above.</p>
        ) : (
          <div className="space-y-1.5">
            {dept.cards.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 bg-muted/30">
                <span className="font-medium truncate max-w-[140px]">{c.name || 'Unnamed'}</span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={c.claimed
                    ? { background: 'rgba(34,197,94,0.14)', color: '#22c55e' }
                    : { background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}>
                  {c.claimed ? 'active' : 'invited'}
                </span>
                {!c.claimed && c.inviteEmail && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{c.inviteEmail}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{c.views30d} views &middot; {c.leads} leads</span>
                {c.slug && (
                  <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {/* Move between the departments this manager runs */}
                {departments.length > 1 && (
                  <select
                    value={dept.id}
                    disabled={loading === `move-${c.id}`}
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
                      className="text-red-400 hover:text-red-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
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
