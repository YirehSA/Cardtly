'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Users, Plus, Edit2, Trash2, ExternalLink, Loader2,
  CreditCard, ChevronDown, ChevronUp, Check, Building2, X, Mail, UserCheck, Send
} from 'lucide-react'

interface TeamCard {
  id: string
  name: string
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  slug: string | null
  profile_image_url: string | null
  is_active: boolean
  created_at: string
  // Team-member invite fields (migration 005)
  user_id?: string | null
  invite_email?: string | null
  invite_sent_at?: string | null
  claimed_at?: string | null
}

interface Org {
  id: string
  name: string
  max_seats: number
  business_plan_active: boolean
  billing_period: string | null
}

interface Props {
  user: { id: string; email: string }
  org: Org | null
  teamCards: TeamCard[]
}

const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"

export default function TeamDashboard({ user, org: initialOrg, teamCards: initialCards }: Props) {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [org, setOrg] = useState<Org | null>(initialOrg)
  const [cards, setCards] = useState<TeamCard[]>(initialCards)
  const [loading, setLoading] = useState(false)

  // Create org form
  const [orgName, setOrgName] = useState('')
  const [seatCount, setSeatCount] = useState(5)

  // Add card form
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ name: '', title: '', email: '', phone: '', company: '' })
  const [copyFromId, setCopyFromId] = useState<string>('')

  // Edit card
  const [editingCard, setEditingCard] = useState<TeamCard | null>(null)
  const [editForm, setEditForm] = useState<Partial<TeamCard>>({})

  // Add seats
  const [showAddSeats, setShowAddSeats] = useState(false)
  const [selectedTier, setSelectedTier] = useState(0)

  // Invite UI state: which card is currently showing the inline
  // invite form, and the email being entered. Inline (no modal) so
  // the admin can see the card while typing.
  const [invitingCardId, setInvitingCardId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  // Which card is mid-cancel or mid-revoke - we just block the
  // buttons during the round-trip to avoid double-fires.
  const [actioningCardId, setActioningCardId] = useState<string | null>(null)

  type InviteStatus = 'not_invited' | 'invited' | 'claimed'
  function getInviteStatus(card: TeamCard): InviteStatus {
    if (card.claimed_at) return 'claimed'
    if (card.invite_sent_at && card.invite_email) return 'invited'
    return 'not_invited'
  }

  async function sendInvite(cardId: string, email: string, resend = false) {
    if (!email.trim()) {
      toast.error('Enter an email address')
      return
    }
    setInviteSending(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, email, resend }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not send invite')
      } else {
        toast.success(resend ? 'Invite email resent' : 'Invite sent')
        // Optimistic update so the status pill flips immediately
        setCards(prev => prev.map(c => c.id === cardId
          ? { ...c, invite_email: email, invite_sent_at: new Date().toISOString() }
          : c))
        setInvitingCardId(null)
        setInviteEmail('')
      }
    } catch {
      toast.error('Network error')
    }
    setInviteSending(false)
  }

  async function cancelInvite(cardId: string) {
    if (!confirm('Cancel this pending invite? The claim link will stop working immediately.')) return
    setActioningCardId(cardId)
    try {
      const res = await fetch('/api/team/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not cancel')
      } else {
        toast.success('Invite cancelled')
        setCards(prev => prev.map(c => c.id === cardId
          ? { ...c, invite_email: null, invite_sent_at: null }
          : c))
      }
    } catch {
      toast.error('Network error')
    }
    setActioningCardId(null)
  }

  async function revokeMember(cardId: string, memberEmail: string | null | undefined) {
    const label = memberEmail ? memberEmail : 'this member'
    if (!confirm(`Remove ${label}'s access to this card? Their Cardtly account stays active; they just lose ownership of this team card.`)) return
    setActioningCardId(cardId)
    try {
      const res = await fetch('/api/team/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not revoke')
      } else {
        toast.success('Access revoked')
        setCards(prev => prev.map(c => c.id === cardId
          ? { ...c, user_id: null, invite_email: null, invite_sent_at: null, claimed_at: null }
          : c))
      }
    } catch {
      toast.error('Network error')
    }
    setActioningCardId(null)
  }

  useEffect(() => {
    if (status === 'success') toast.success('Payment confirmed! Your team plan is active.')
    if (status === 'failed') toast.error('Payment failed. Please try again.')
    if (status === 'error') toast.error('Something went wrong. Contact support if you were charged.')
  }, [status])

  async function api(body: object) {
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  // Create org + pay
  async function handleCreateOrg() {
    if (!orgName.trim()) { toast.error('Enter a company name'); return }
    setLoading(true)
    const data = await api({ action: 'create_org', org_name: orgName, max_seats: seatCount })
    if (data.authorization_url) {
      window.location.href = data.authorization_url
    } else {
      toast.error(data.error || 'Something went wrong')
      setLoading(false)
    }
  }

  // Add card
  async function handleAddCard() {
    if (!newCard.name.trim()) { toast.error('Enter a name'); return }
    setLoading(true)
    const data = await api({ action: 'add_card', org_id: org!.id, copy_from_id: copyFromId || null, ...newCard })
    if (data.card) {
      setCards(prev => [...prev, data.card])
      setNewCard({ name: '', title: '', email: '', phone: '', company: '' })
      setShowAddCard(false)
      toast.success('Card added')
    } else {
      toast.error(data.error || 'Failed to add card')
    }
    setLoading(false)
  }

  // Save edit
  async function handleSaveEdit() {
    if (!editingCard) return
    setLoading(true)
    const data = await api({ action: 'update_card', org_id: org!.id, card_id: editingCard.id, ...editForm })
    if (data.success) {
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...editForm } : c))
      setEditingCard(null)
      toast.success('Card updated')
    } else {
      toast.error(data.error || 'Failed to update')
    }
    setLoading(false)
  }

  // Delete card
  async function handleDelete(cardId: string, name: string) {
    if (!confirm(`Delete ${name}'s card? This cannot be undone.`)) return
    setLoading(true)
    const data = await api({ action: 'delete_card', org_id: org!.id, card_id: cardId })
    if (data.success) {
      setCards(prev => prev.filter(c => c.id !== cardId))
      toast.success('Card deleted')
    } else {
      toast.error(data.error || 'Failed to delete')
    }
    setLoading(false)
  }

  // Add seats
  async function handleAddSeats() {
    if (!selectedTier) { toast.error('Please select a seat plan'); return }
    setLoading(true)
    const data = await api({ action: 'add_seats', org_id: org!.id, new_seat_count: selectedTier })
    if (data.authorization_url) {
      window.location.href = data.authorization_url
    } else {
      toast.error(data.error || 'Something went wrong')
      setLoading(false)
    }
  }

  const seatsUsed = cards.length
  const seatsTotal = Number(org?.max_seats) || 0
  const seatsAvailable = seatsTotal - seatsUsed

  // ── No org yet — setup screen ────────────────────────────────────────────────
  if (!org || !org.business_plan_active) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />Team Cards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Give your whole team a professional digital business card.
          </p>
        </div>

        {/* Value prop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Per card/month', value: 'R65', sub: '$9 outside SA' },
            { label: 'Minimum cards', value: '2', sub: 'No maximum' },
            { label: 'Admin controls', value: '100%', sub: 'You manage all cards' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs font-semibold mt-0.5">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Setup form */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-lg">Set up your team</h2>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Company name</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="Yireh Business Solutions" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Number of cards — <span className="text-foreground font-bold">{seatCount} cards × R65 = R{seatCount * 65}/month</span>
            </label>
            <div className="flex items-center gap-3">
              <button onClick={() => setSeatCount(Math.max(2, seatCount - 1))}
                className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition font-bold text-lg">
                −
              </button>
              <span className="text-2xl font-black w-12 text-center">{seatCount}</span>
              <button onClick={() => setSeatCount(seatCount + 1)}
                className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition font-bold text-lg">
                +
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You can add more cards later. Billed monthly, cancel anytime.
            </p>
          </div>

          {/* Inclusions */}
          <div className="space-y-2">
            {[
              'All 9 card templates for every team member',
              'Admin dashboard — you create and manage all cards',
              'Each card gets its own public URL and QR code',
              'Analytics, email signature, virtual background per card',
              'Add more seats anytime',
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />{f}
              </div>
            ))}
          </div>

          <button onClick={handleCreateOrg} disabled={loading || !orgName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecting to payment...</>
              : <><CreditCard className="w-4 h-4" />Pay R{seatCount * 65}/month — Start team plan</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Main team dashboard ──────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />{org.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Team Cards · Admin Dashboard</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Seat usage */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{seatsUsed}</span>
            <span className="text-muted-foreground">/ {seatsTotal} cards</span>
          </div>

          {/* Add seats */}
          <button onClick={() => setShowAddSeats(p => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
            <Plus className="w-4 h-4" />Add seats
            {showAddSeats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Add card */}
          {(seatsAvailable > 0 || seatsTotal === 0) && (
            <button onClick={() => setShowAddCard(p => !p)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <Plus className="w-4 h-4" />Add card
            </button>
          )}
        </div>
      </div>

      {/* Add seats panel */}
      {showAddSeats && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <p className="font-semibold text-sm">Upgrade seat plan</p>
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={selectedTier}
              onChange={e => setSelectedTier(Number(e.target.value))}
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition flex-1 min-w-[200px]">
              <option value={0}>Select a plan...</option>
              {[
                { seats: 5,  price: 325 },
                { seats: 10, price: 650 },
                { seats: 15, price: 975 },
                { seats: 20, price: 1300 },
                { seats: 25, price: 1625 },
                { seats: 30, price: 1950 },
                { seats: 40, price: 2600 },
                { seats: 50, price: 3250 },
              ].filter(t => t.seats > seatsTotal).map(t => (
                <option key={t.seats} value={t.seats}>
                  {t.seats} seats — R{t.price}/month
                </option>
              ))}
            </select>
            <button onClick={handleAddSeats} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upgrade plan'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Switching to a higher seat tier replaces your current plan with the new monthly amount.
          </p>
        </div>
      )}

      {/* Seat limit warning */}
      {seatsTotal > 0 && seatsAvailable === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-600 flex items-center gap-2">
          <Users className="w-4 h-4 flex-shrink-0" />
          All {seatsTotal} seats are in use. Add more seats to create additional cards.
        </div>
      )}

      {/* Add card panel */}
      {showAddCard && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">New team member card</p>
            <button onClick={() => { setShowAddCard(false); setCopyFromId('') }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Copy from existing card */}
          {(cards.length > 0) && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Copy design & settings from
              </label>
              <select
                value={copyFromId}
                onChange={e => {
                  setCopyFromId(e.target.value)
                  // Pre-fill company if copying
                  if (e.target.value) {
                    const src = cards.find(c => c.id === e.target.value)
                    if (src) setNewCard(p => ({ ...p, company: src.company || p.company }))
                  }
                }}
                className={inputClass}>
                <option value="">Start fresh (blank card)</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.title || 'No title'}</option>
                ))}
              </select>
              {copyFromId && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Design, logo, links and social profiles will be copied. Just update the personal details below.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full name *</label>
              <input value={newCard.name} onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))}
                placeholder="Jane Smith" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Job title</label>
              <input value={newCard.title} onChange={e => setNewCard(p => ({ ...p, title: e.target.value }))}
                placeholder="Sales Manager" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email</label>
              <input type="email" value={newCard.email} onChange={e => setNewCard(p => ({ ...p, email: e.target.value }))}
                placeholder="jane@company.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone</label>
              <input value={newCard.phone} onChange={e => setNewCard(p => ({ ...p, phone: e.target.value }))}
                placeholder="+27 82 000 0000" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Company</label>
              <input value={newCard.company} onChange={e => setNewCard(p => ({ ...p, company: e.target.value }))}
                placeholder={org.name} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAddCard(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition">
              Cancel
            </button>
            <button onClick={handleAddCard} disabled={loading || !newCard.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create card'}
            </button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {cards.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-semibold text-lg mb-2">No cards yet</h2>
          <p className="text-sm text-muted-foreground mb-5">Create your first team member card to get started.</p>
          <button onClick={() => setShowAddCard(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
            <Plus className="w-4 h-4" />Add first card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-card border border-border rounded-2xl overflow-hidden group">
              {/* Card colour strip */}
              <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

              <div className="p-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  {card.profile_image_url ? (
                    <img src={card.profile_image_url} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {card.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{card.name || 'Unnamed'}</p>
                    {card.title && <p className="text-xs text-muted-foreground truncate">{card.title}</p>}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1 mb-4">
                  {card.email && <p className="text-xs text-muted-foreground truncate">✉️ {card.email}</p>}
                  {card.phone && <p className="text-xs text-muted-foreground">📞 {card.phone}</p>}
                  {card.company && <p className="text-xs text-muted-foreground truncate">🏢 {card.company}</p>}
                </div>

                {/* Member status — shows whether this card has been claimed,
                    invited, or is still unassigned. */}
                {(() => {
                  const inviteStatus = getInviteStatus(card)
                  const isInviting = invitingCardId === card.id
                  return (
                    <div className="mb-4">
                      {inviteStatus === 'claimed' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span className="flex-1 truncate">Claimed by {card.invite_email}</span>
                            <button onClick={() => revokeMember(card.id, card.invite_email)}
                              disabled={actioningCardId === card.id}
                              title="Remove this member's access. Card is preserved; admin keeps managing it."
                              className="text-[10px] uppercase tracking-wider font-bold hover:underline disabled:opacity-50">
                              Revoke
                            </button>
                          </div>
                        </div>
                      )}
                      {inviteStatus === 'invited' && !isInviting && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}>
                            <Mail className="w-3.5 h-3.5" />
                            <span className="flex-1 truncate">Invite sent to {card.invite_email}</span>
                          </div>
                          <div className="flex items-center gap-3 px-1">
                            <button onClick={() => sendInvite(card.id, card.invite_email || '', true)}
                              disabled={inviteSending || actioningCardId === card.id}
                              className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">
                              Resend
                            </button>
                            <button onClick={() => { setInvitingCardId(card.id); setInviteEmail(card.invite_email || '') }}
                              className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground">
                              Change email
                            </button>
                            <button onClick={() => cancelInvite(card.id)}
                              disabled={actioningCardId === card.id}
                              className="text-[10px] uppercase tracking-wider font-bold text-destructive/80 hover:text-destructive disabled:opacity-50 ml-auto">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {inviteStatus === 'not_invited' && !isInviting && (
                        <button onClick={() => { setInvitingCardId(card.id); setInviteEmail('') }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
                          <Send className="w-3.5 h-3.5" />
                          Invite team member to claim
                        </button>
                      )}
                      {isInviting && (
                        <div className="space-y-2">
                          <input
                            type="email"
                            autoFocus
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') sendInvite(card.id, inviteEmail) }}
                            placeholder={`${card.name?.split(' ')[0]?.toLowerCase() || 'member'}@company.com`}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => sendInvite(card.id, inviteEmail)}
                              disabled={inviteSending || !inviteEmail.trim()}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                              {inviteSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Send invite
                            </button>
                            <button onClick={() => { setInvitingCardId(null); setInviteEmail('') }}
                              className="px-3 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-muted transition">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  {card.slug && (
                    <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
                      <ExternalLink className="w-3 h-3" />View
                    </a>
                  )}
                  <Link href={`/dashboard/team/card/${card.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition ml-auto">
                    <Edit2 className="w-3 h-3" />Edit
                  </Link>
                  <button onClick={() => handleDelete(card.id, card.name)}
                    className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition">
                    <Trash2 className="w-3 h-3" />Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Edit {editingCard.name}'s card</h2>
              <button onClick={() => setEditingCard(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { key: 'name', label: 'Full name', placeholder: 'Jane Smith' },
                { key: 'title', label: 'Job title', placeholder: 'Sales Manager' },
                { key: 'company', label: 'Company', placeholder: org.name },
                { key: 'email', label: 'Email', placeholder: 'jane@company.com', type: 'email' },
                { key: 'phone', label: 'Phone', placeholder: '+27 82 000 0000' },
                { key: 'work_phone', label: 'Work phone', placeholder: '+27 11 000 0000' },
                { key: 'whatsapp', label: 'WhatsApp', placeholder: '+27 82 000 0000' },
                { key: 'website', label: 'Website', placeholder: 'https://company.com', type: 'url' },
                { key: 'address', label: 'Address', placeholder: 'Johannesburg, SA' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
                  <input
                    type={type || 'text'}
                    value={(editForm as any)[key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Bio</label>
                <textarea
                  value={editForm.bio || ''}
                  onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Short professional bio..."
                  rows={3}
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingCard(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan summary */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm">
          <p className="font-semibold">{org.name} · Team plan</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {seatsTotal} seats · R{seatsTotal * 65}/month
            {org.billing_period && ` · ${org.billing_period} billing`}
          </p>
        </div>
        <a href="/dashboard/settings"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition underline">
          Manage billing
        </a>
      </div>
    </div>
  )
}
