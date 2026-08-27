'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Eye, Inbox, ExternalLink, Loader2, UserCheck, Clock, Send,
  Sparkles, Network, ClipboardList, Info, Pencil, Building2, Mail, Phone,
} from 'lucide-react'

// One person's card, as their department head sees it.
//
// The same tile the owner gets on Team Cards, minus the one thing a head is
// not: Delete. Everything on it maps to an action the server already gates on
// canManageDepartment, so the screen shows exactly what would be allowed and
// nothing more.
//
// Delete is deliberately absent. Removing somebody from the team is what a
// head needs and it is what Revoke does; deleting the card destroys the leads
// it captured, which belong to the company rather than to the department.
//
// Edit is present. /dashboard/team/card/[id] has always admitted heads and
// /api/team/card/save has always accepted their writes - there was simply no
// link to it from here, so the permission existed and the door did not.

export type HeadCard = {
  id: string
  name: string | null
  title: string | null
  slug: string | null
  email: string | null
  phone: string | null
  company: string | null
  profileImageUrl: string | null
  claimed: boolean
  claimedEmail: string | null
  inviteEmail: string | null
  views: number
  leads: number
  departmentName: string
  useTeamBrand: boolean
  listedInNetwork: boolean
  assignedFormId: string | null
  useTeamQuestionnaire: boolean | null
}

function initials(s: string | null): string {
  const t = (s || '').trim()
  if (!t) return '?'
  const p = t.split(/\s+/)
  return (p.length >= 2 ? p[0][0] + p[1][0] : t.slice(0, 2)).toUpperCase()
}

export default function HeadTeamCard({
  card, forms, onChanged,
}: {
  card: HeadCard
  forms: { id: string; title?: string }[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  // Optimistic, so a toggle moves under the finger rather than after a round
  // trip. Reverted on failure.
  const [brand, setBrand] = useState(card.useTeamBrand)
  const [listed, setListed] = useState(card.listedInNetwork)

  async function call(key: string, body: object, ok: string): Promise<boolean> {
    setBusy(key)
    const res = await fetch('/api/department', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return false }
    toast.success(ok)
    return true
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      <div className="p-5 space-y-4">

        {/* Photo and name. The picture is the fastest way to find the right
            person in a grid of a dozen, and the tile had none. */}
        <div className="flex items-center gap-3">
          {card.profileImageUrl ? (
            <img src={card.profileImageUrl} alt=""
              className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-border" />
          ) : (
            <span className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
              {initials(card.name || card.inviteEmail)}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate">{card.name || 'Unnamed'}</p>
            {card.title && <p className="text-xs text-muted-foreground truncate">{card.title}</p>}
            <p className="text-[11px] text-muted-foreground truncate">{card.departmentName}</p>
          </div>
        </div>

        {(card.email || card.phone || card.company) && (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {card.email && (
              <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{card.email}</p>
            )}
            {card.phone && (
              <p className="flex items-center gap-2 truncate"><Phone className="w-3.5 h-3.5 shrink-0" />{card.phone}</p>
            )}
            {card.company && (
              <p className="flex items-center gap-2 truncate"><Building2 className="w-3.5 h-3.5 shrink-0" />{card.company}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Times this card has been opened">
            <Eye className="w-3.5 h-3.5" />
            <strong className="tabular-nums text-foreground">{card.views}</strong> views
          </span>
          <span className="inline-flex items-center gap-1" style={{ color: card.leads > 0 ? '#22c55e' : undefined }}
            title="People who left their details on this card">
            <Inbox className="w-3.5 h-3.5" />
            <strong className="tabular-nums">{card.leads}</strong> lead{card.leads === 1 ? '' : 's'}
          </span>
        </div>

        {/* Who has it, or who has not picked it up. The state a head acts on. */}
        {card.claimed ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)' }}>
            <span className="text-xs inline-flex items-center gap-1.5 min-w-0" style={{ color: '#22c55e' }}>
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Claimed by {card.claimedEmail || 'a member'}</span>
            </span>
            <button
              disabled={busy === 'revoke'}
              onClick={async () => {
                if (!confirm(`Remove ${card.name || 'this person'} from the team?\n\nTheir public card stops working straight away, so their details are no longer shown to anyone who opens the link or taps their NFC card.\n\nThe card itself is kept and the seat is freed. The leads they captured stay with the company.`)) return
                if (await call('revoke', { action: 'remove_member', team_card_id: card.id }, 'Removed from the team')) onChanged()
              }}
              className="text-[11px] font-bold uppercase tracking-wider shrink-0" style={{ color: '#22c55e' }}>
              {busy === 'revoke' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Revoke'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)' }}>
            <span className="text-xs inline-flex items-center gap-1.5 min-w-0" style={{ color: '#f59e0b' }}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{card.inviteEmail ? `Invited ${card.inviteEmail}` : 'Not invited yet'}</span>
            </span>
            {card.inviteEmail && (
              <button
                disabled={busy === 'resend'}
                onClick={() => call('resend', { action: 'resend_invite', team_card_id: card.id }, 'Invite sent again')}
                className="text-[11px] font-bold uppercase tracking-wider shrink-0 inline-flex items-center gap-1" style={{ color: '#f59e0b' }}>
                {busy === 'resend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" />Resend</>}
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Toggle
            icon={Sparkles} label="Use team brand" checked={brand} busy={busy === 'brand'}
            hint="On: this card follows the company or department look. Off: it keeps its own colours."
            onChange={async next => {
              setBrand(next)
              const ok = await call('brand', { action: 'set_card_team_brand', team_card_id: card.id, value: next }, 'Saved')
              if (!ok) setBrand(!next)
            }}
          />
          <Toggle
            icon={Network} label="In the Network" checked={listed} busy={busy === 'net'}
            hint="On: this person can be found in the Cardtly directory. Off: their card still works, it is just not listed."
            onChange={async next => {
              setListed(next)
              const ok = await call('net', { action: 'set_card_network', team_card_id: card.id, value: next }, 'Saved')
              if (!ok) setListed(!next)
            }}
          />

          {forms.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs inline-flex items-center gap-2 text-muted-foreground"
                title="Which set of questions visitors are asked when they leave their details">
                <ClipboardList className="w-3.5 h-3.5" />Lead form
              </span>
              <select
                value={card.useTeamQuestionnaire === false ? 'off' : (card.assignedFormId || 'default')}
                disabled={busy === 'form'}
                onChange={async e => {
                  if (await call('form', { action: 'set_card_form', team_card_id: card.id, form_id: e.target.value }, 'Lead form updated')) onChanged()
                }}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background max-w-[150px]">
                <option value="default">Company default</option>
                {forms.map((f, i) => <option key={f.id} value={f.id}>{f.title?.trim() || `Form ${i + 1}`}</option>)}
                <option value="off">No form</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border">
          {card.slug && (
            <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
              <ExternalLink className="w-3.5 h-3.5" />View
            </a>
          )}
          <Link href={`/dashboard/team/card/${card.id}`}
            className="text-xs font-medium inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
            <Pencil className="w-3.5 h-3.5" />Edit
          </Link>
          {/* Delete is the company admin's. Saying so beats a button that
              always refuses, and it explains why rather than just refusing. */}
          <span className="text-[11px] text-muted-foreground ml-auto inline-flex items-center gap-1"
            title="Revoke removes the person and frees the seat. Deleting the card would destroy the leads it captured, which belong to the company, so only the main admin can do that.">
            <Info className="w-3 h-3" />Only admin can delete
          </span>
        </div>
      </div>
    </div>
  )
}

function Toggle({ icon: Icon, label, checked, busy, hint, onChange }: {
  icon: any; label: string; checked: boolean; busy: boolean; hint?: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer" title={hint}>
      <span className="text-xs inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />{label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0"
        style={{ background: checked ? 'linear-gradient(135deg, #00d4ff, #7c3aed)' : 'rgba(120,120,130,0.35)' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: checked ? '1.375rem' : '0.125rem' }} />
      </button>
    </label>
  )
}
