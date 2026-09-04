'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Users, Plus, Edit2, Trash2, ExternalLink, Loader2,
  CreditCard, ChevronDown, ChevronUp, Check, Building2, X, Mail, UserCheck, Send, BarChart2, Sparkles, ClipboardList, Network,
  Search, Eye, Inbox, FileSpreadsheet, Phone,
} from 'lucide-react'
import UsdEstimate from '@/components/marketing/UsdEstimate'
import BulkImportModal from '@/components/team/BulkImportModal'
import WebhookPanel from '@/components/team/WebhookPanel'
import ApiKeyPanel from '@/components/team/ApiKeyPanel'

interface TeamCard {
  id: string
  name: string
  title: string | null
  company: string | null
  bio: string | null
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
  use_team_brand?: boolean | null
  use_team_questionnaire?: boolean | null
  // Per-card lead form: addons.assignedFormId picks which org form this card
  // shows. Absent = the org's default form.
  addons?: Record<string, any> | null
  // Network listing (migrations 036, 039). Two flags: hide_from_network is
  // the member's own choice, org_hide_from_network is the admin's. Listed
  // only when both are false.
  hide_from_network?: boolean | null
  org_hide_from_network?: boolean | null
  /** Public opens of this card, all time. */
  view_count?: number | null
  /** Which department the card sits in, and through it which company. */
  department_id?: string | null
}

interface Org {
  id: string
  name: string
  max_seats: number
  business_plan_active: boolean
  billing_period: string | null
  addons?: Record<string, any> | null
}

interface Props {
  user: { id: string; email: string }
  org: Org | null
  teamCards: TeamCard[]
  /** Leads captured per card id. null when the count could not be read - the
   *  figure is then hidden rather than shown as zero, because "nobody has
   *  contacted this rep" is a conclusion somebody would act on. */
  leadCounts: Record<string, number> | null
  // Departments a spreadsheet import can route people into.
  // parentName carries the company a department sits under, which is what
  // lets a spreadsheet pick between two businesses that each have a "Sales".
  importTargets: Array<{ id: string; name: string; kind?: 'company' | 'department'; parentName?: string | null }>
  // The businesses in this group, and which one each department sits under.
  // Both empty for a flat organisation, and the filter hides itself.
  companies?: Array<{ id: string; name: string }>
  companyByDept?: Record<string, string>
}

const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"

// The only seat counts Paystack has plan codes for (see TEAM_PLANS in
// app/api/team/route.ts). The picker must offer ONLY these - any other
// count has no plan and checkout fails. R97 per seat per month. Above 20
// there is no plan on purpose: those are Enterprise, billed by debit order.
const SEAT_PRICE = 97
const MAX_SELF_SERVE_SEATS = 20
const SEAT_TIERS = Array.from({ length: MAX_SELF_SERVE_SEATS - 1 }, (_, i) => i + 2) as readonly number[]

export default function TeamDashboard({ user, org: initialOrg, teamCards: initialCards, leadCounts, importTargets, companies = [], companyByDept = {} }: Props) {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [org, setOrg] = useState<Org | null>(initialOrg)
  const [cards, setCards] = useState<TeamCard[]>(initialCards)
  const [loading, setLoading] = useState(false)

  // Finding one person in a 50-seat team is a scroll. In a 500-seat team it is
  // not possible, and the grid was the only way in.
  //
  // Every word has to match, in any order, across everything you might
  // remember about somebody - their name, their job title, their email, their
  // number, their link, or the address that claimed the card. Substring
  // matching on the whole phrase would fail on "anthony sales", which is two
  // true things about one person that are never next to each other.
  const [cardQuery, setCardQuery] = useState('')

  // Which business we are looking at. A group holding several companies showed
  // every card in every one of them in a single grid, so finding "the Vistio
  // people" meant knowing all their names. '' is everything.
  const [companyId, setCompanyId] = useState<string>('')
  const companyOfCard = (c: TeamCard) =>
    (c.department_id && companyByDept[c.department_id]) || null
  const countFor = (id: string) =>
    id === '' ? cards.length
      : id === 'none' ? cards.filter(c => !companyOfCard(c)).length
      : cards.filter(c => companyOfCard(c) === id).length
  // Cards that belong to no company at all: a flat department, or nobody has
  // filed them yet. They get their own tab rather than vanishing, because a
  // filter that can hide a seat you are paying for is worse than no filter.
  const looseCount = countFor('none')

  const visibleCards = (() => {
    const byCompany = companyId === ''
      ? cards
      : companyId === 'none'
        ? cards.filter(c => !companyOfCard(c))
        : cards.filter(c => companyOfCard(c) === companyId)
    const terms = cardQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return byCompany
    return byCompany.filter(c => {
      const hay = [
        c.name, c.title, c.company, c.email, c.phone, c.slug, c.invite_email,
      ].filter(Boolean).join('  ').toLowerCase()
      return terms.every(t => hay.includes(t))
    })
  })()

  // The per-card form picker only makes sense when the org has the add-on on
  // AND at least one form is built. orgForms is the library each card can be
  // allocated from.
  const qAddons = (org as any)?.addons || {}
  const orgForms: { id: string; title?: string; questions: any[] }[] =
    Array.isArray(qAddons.questionnaires)
      ? qAddons.questionnaires.filter((f: any) => Array.isArray(f?.questions) && f.questions.length > 0)
      : []
  const questionnaireAvailable = !!(qAddons.questionnaireEnabled && orgForms.length > 0)

  // The same reasoning applies to the brand toggle, which was never gated.
  // mergeBrand leaves a card untouched when the brand is empty, so switching
  // "Use team brand" on before a brand exists reported success and changed
  // nothing at all - the card looked identical and the toast said otherwise.
  const hasTeamBrand = Object.keys((org as any)?.brand || {}).length > 0

  // Create org form
  // Prefilled from an org that was started but never paid for, so resuming
  // shows what they already chose instead of an empty form.
  const [orgName, setOrgName] = useState(initialOrg?.name || '')
  const [seatCount, setSeatCount] = useState(Number(initialOrg?.max_seats) || 5)

  // Add card form
  const [showAddCard, setShowAddCard] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // Which of the three jobs this page does the admin is here for.
  const [tab, setTab] = useState<'people' | 'integrations' | 'billing'>('people')
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
          ? { ...c, invite_email: email, invite_sent_at: new Date().toISOString(), is_active: true }
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
    if (!confirm(`Remove ${label}'s access to this card?\n\nThe public card stops working straight away, so their details are no longer served to anyone who taps the NFC card or opens the link.\n\nThe card itself is kept and you carry on managing it. Inviting somebody else puts it back online on the same link. Their own Cardtly account is untouched.`)) return
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
        // is_active mirrors what the server just did, so the Offline badge
        // appears without waiting for a refresh.
        setCards(prev => prev.map(c => c.id === cardId
          ? { ...c, user_id: null, invite_email: null, invite_sent_at: null, claimed_at: null, is_active: false }
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

  // Never throws. It used to call res.json() bare, so a dropped connection or
  // an HTML error page rejected inside the caller's await - which meant the
  // caller's setLoading(false) never ran and the whole panel sat spinning with
  // no message, and the optimistic toggles never reverted. Every caller already
  // handles data.error, so failures are funnelled into that shape.
  async function api(body: object): Promise<any> {
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data?.error) {
        return { error: `Something went wrong (${res.status}). Please try again.` }
      }
      return data ?? {}
    } catch {
      return { error: 'No connection. Check your internet and try again.' }
    }
  }

  // Create org + pay
  async function handleCreateOrg() {
    if (!orgName.trim()) { toast.error('Enter a company name'); return }
    setLoading(true)
    const data = await api({ action: 'create_org', org_name: orgName, seat_count: seatCount })
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
  async function toggleCardBrand(card: TeamCard) {
    const next = !card.use_team_brand
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, use_team_brand: next } : c))
    const data = await api({ action: 'set_card_team_brand', org_id: org!.id, card_id: card.id, value: next })
    if (data.success) {
      toast.success(next ? `Team brand applied to ${card.name.split(' ')[0]}'s card` : `${card.name.split(' ')[0]}'s card now uses its own branding`)
    } else {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, use_team_brand: !next } : c)) // revert
      toast.error(data.error || 'Could not update')
    }
  }

  // The admin's veto over a single card's Network listing. Goes through the
  // visibility endpoint rather than the team API, because that is the only
  // route that checks the caller is the org admin before touching this flag.
  //
  // This cannot force a card to be listed - a member who has switched
  // themselves off stays off. It only decides whether the org allows it.
  async function toggleCardNetwork(card: TeamCard) {
    const nextListed = !!card.org_hide_from_network // currently excluded -> allow
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, org_hide_from_network: !nextListed } : c))
    const res = await fetch('/api/cards/visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, org_hide_from_network: !nextListed }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const who = card.name.split(' ')[0]
      if (!nextListed) toast.success(`${who} will not appear in the Network`)
      else if (card.hide_from_network) toast.success(`${who} is allowed in the Network, but has switched it off for themselves`)
      else toast.success(`${who} will appear in the Network`)
    } else {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, org_hide_from_network: nextListed } : c)) // revert
      toast.error(data.error || 'Could not update')
    }
  }

  // Which form a card currently shows: 'off', 'default', or a form id.
  function cardFormValue(card: TeamCard): string {
    if (card.use_team_questionnaire === false) return 'off'
    return card.addons?.assignedFormId || 'default'
  }

  // Allocate a specific form (or default / none) to one card.
  async function setCardForm(card: TeamCard, formId: string) {
    const prevValue = cardFormValue(card)
    if (formId === prevValue) return
    // Optimistic local update mirroring what the server will store.
    setCards(prev => prev.map(c => {
      if (c.id !== card.id) return c
      const addons = { ...(c.addons || {}) }
      if (formId === 'off') return { ...c, use_team_questionnaire: false }
      if (formId === 'default') { delete addons.assignedFormId; return { ...c, use_team_questionnaire: true, addons } }
      addons.assignedFormId = formId
      return { ...c, use_team_questionnaire: true, addons }
    }))
    const data = await api({ action: 'set_card_form', org_id: org!.id, card_id: card.id, form_id: formId })
    if (data.success) {
      toast.success(`Lead form updated for ${card.name.split(' ')[0]}`)
    } else {
      setCards(prev => prev.map(c => c.id === card.id ? card : c)) // revert to original
      toast.error(data.error || 'Could not update')
    }
  }

  async function handleDelete(cardId: string, name: string) {
    // Deleting a claimed card is a different act from deleting an unused one:
    // somebody is using it, their public link dies with it, and any printed
    // card or NFC tag pointing at that link stops working. The warning used to
    // read the same for both.
    const card = cards.find(c => c.id === cardId)
    const claimed = !!card?.claimed_at
    const msg = claimed
      ? `Delete ${name}'s card?\n\nThey are already using it. Their card link stops working straight away, and any printed cards or NFC tags pointing at it will stop working too. This cannot be undone.`
      : `Delete ${name}'s card? This cannot be undone.`
    if (!confirm(msg)) return
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

  // Uses the same rule as the per-card badge, so the summary and the list can
  // never disagree.
  const activation = {
    claimed: cards.filter(c => getInviteStatus(c) === 'claimed').length,
    invited: cards.filter(c => getInviteStatus(c) === 'invited').length,
    notInvited: cards.filter(c => getInviteStatus(c) === 'not_invited').length,
  }

  // ── No org yet, or one started and never paid for ───────────────────────────
  // These are different situations and used to look identical: someone who
  // abandoned checkout was shown a blank "set up your team" form, with no sign
  // their team already existed and no hint that submitting it again just made
  // another one.
  const resuming = !!org && !org.business_plan_active

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

        {resuming && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
            <CreditCard className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">You started setting up {org?.name}, but the payment did not go through</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nothing was charged. Check the details below and finish it, and your team goes live straight away.
                You will not end up with two teams.
              </p>
            </div>
          </div>
        )}

        {/* Value prop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Per card/month', value: `R${SEAT_PRICE}`, sub: 'ZAR, billed monthly' },
            { label: 'Plans from', value: '5', sub: 'cards, scale to 50' },
            { label: 'Admin controls', value: '100%', sub: 'You manage all cards' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs font-semibold mt-0.5">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Setup form */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <h2 className="font-semibold text-lg">{resuming ? 'Finish setting up your team' : 'Set up your team'}</h2>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Company name</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="Yireh Business Solutions" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Number of cards — <span className="text-foreground font-bold">{seatCount} cards × R{SEAT_PRICE} = R{seatCount * SEAT_PRICE}/month</span>
            </label>
            {/* Tier buttons - only the seat counts Paystack has plans for */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEAT_TIERS.map(seats => {
                const active = seatCount === seats
                return (
                  <button key={seats} type="button" onClick={() => setSeatCount(seats)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-bold transition ${active ? 'border-transparent text-white' : 'border-border text-foreground hover:bg-muted'}`}
                    style={active ? { background: 'hsl(var(--accent))' } : undefined}>
                    {seats} cards
                    <span className="block text-[11px] font-medium opacity-80">R{seats * SEAT_PRICE}/mo</span>
                  </button>
                )
              })}
            </div>
            {/* Live USD estimate of the team total for non-rand admins */}
            <UsdEstimate zar={seatCount * SEAT_PRICE} suffix="/mo" className="block text-sm font-medium text-muted-foreground mt-3" />
            <p className="text-xs text-muted-foreground mt-1">
              You can add more cards later. Billed monthly, cancel anytime.
            </p>
          </div>

          {/* Inclusions */}
          <div className="space-y-2">
            {[
              'All 12 card templates for every team member',
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
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'hsl(var(--accent))' }}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecting to payment...</>
              : <><CreditCard className="w-4 h-4" />Pay R{seatCount * SEAT_PRICE}/month — {resuming ? 'Finish setup' : 'Start team plan'}</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Main team dashboard ──────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-5 sm:p-6" style={{ background: 'hsl(var(--card))' }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg grid place-items-center text-white shrink-0"
                style={{ background: 'hsl(var(--accent))' }}>
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight">{org.name}</h1>
                <p className="text-muted-foreground text-sm">
                  {seatsUsed} of {seatsTotal} cards used
                  {seatsAvailable > 0
                    ? ` · ${seatsAvailable} still free`
                    : seatsTotal > 0 ? ' · all seats taken' : ''}
                </p>
              </div>
            </div>

            {/* Only the things you DO here.
                Brand, Analytics and Contacts were sitting in this row at the
                same weight as Add card, but they are not actions on this page
                - they are three other pages. Six identical buttons means
                reading all six every time to find the one you came for.
                Add seats moved to Billing, where it belongs. */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Shown whether or not there are seats free. Hiding it on a
                  full team meant the whole import feature disappeared from
                  Sicon, which is 10 of 10 used and exactly the size that
                  wants it - and a button that is absent teaches nobody why.
                  The preview inside already marks every row that would go
                  over the limit and refuses to create those, so the honest
                  place to explain the seat position is there. */}
              {tab === 'people' && (
                <button onClick={() => setShowImport(true)}
                  title="Upload an Excel file or paste a staff list to create cards in bulk"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
                  <FileSpreadsheet className="w-4 h-4" />Import from Excel
                </button>
              )}
              {tab === 'people' && (seatsAvailable > 0 || seatsTotal === 0) && (
                <button onClick={() => setShowAddCard(p => !p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: 'hsl(var(--accent))' }}>
                  <Plus className="w-4 h-4" />Add card
                </button>
              )}
              {tab === 'billing' && (
                <button onClick={() => setShowAddSeats(p => !p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: 'hsl(var(--accent))' }}>
                  <Plus className="w-4 h-4" />Add seats
                  {showAddSeats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

          {/* The other team pages. Still quieter than the primary action, but
              they were 12px grey-on-grey text and people could not find them.
              Now they are bordered pills with a coloured icon: readable at a
              glance, and still clearly not the main button. */}
          <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border/60">
            {[
              { href: '/dashboard/team/brand', label: 'Team brand', icon: Sparkles },
              { href: '/dashboard/team/analytics', label: 'Team analytics', icon: BarChart2 },
              { href: '/dashboard/team/contacts', label: 'All leads', icon: Mail },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted hover:border-foreground/20 transition">
                <Icon className="w-4 h-4 text-muted-foreground" />{label}
              </Link>
            ))}
          </div>

          {/* Whether the team is actually using the cards. A card nobody has
              opened is a seat being paid for and not used, and that was only
              visible by reading down the list one card at a time. */}
          {cards.length > 0 && tab === 'people' && (
            <div className="mt-5 space-y-3">
              {/* One bar instead of three numbers you have to add up.
                  The proportions ARE the point: a team that is mostly amber
                  is paying for cards nobody has picked up, and that reads off
                  the bar instantly where three separate counts did not. */}
              <div className="flex h-2.5 rounded-full overflow-hidden bg-muted" role="img"
                aria-label={`${activation.claimed} using their card, ${activation.invited} invited but not opened, ${activation.notInvited} not invited yet`}>
                {[
                  { value: activation.claimed, tone: '#22c55e' },
                  { value: activation.invited, tone: '#f59e0b' },
                  { value: activation.notInvited, tone: '#94a3b8' },
                ].filter(s => s.value > 0).map(({ value, tone }, i) => (
                  <div key={i} style={{ width: `${(value / cards.length) * 100}%`, background: tone }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {[
                  { label: 'using their card', value: activation.claimed, tone: '#22c55e' },
                  { label: 'invited, not opened', value: activation.invited, tone: '#f59e0b' },
                  { label: 'not invited yet', value: activation.notInvited, tone: '#94a3b8' },
                ].map(({ label, value, tone }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone }} />
                    <strong className="tabular-nums" style={{ color: value > 0 ? undefined : 'var(--muted-foreground)' }}>{value}</strong>
                    <span className="text-muted-foreground">{label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Three things happen on this page and they were one scroll: the people,
          where their leads go, and what it costs. Tabs because the tasks are
          unrelated - nobody comes here to add a person AND change billing -
          and a page that shows everything at once means hunting for the thing
          you came for. */}
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
        {([
          ['people', 'People', Users, cards.length || null],
          ['integrations', 'Integrations', Network, null],
          ['billing', 'Billing', CreditCard, null],
        ] as const).map(([id, label, Icon, count]) => {
          const active = tab === id
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
              {count !== null && (
                <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Add seats panel */}
      {tab === 'billing' && showAddSeats && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="font-semibold text-sm">Upgrade seat plan</p>
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={selectedTier}
              onChange={e => setSelectedTier(Number(e.target.value))}
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition flex-1 min-w-[200px]">
              <option value={0}>Select a plan...</option>
              {SEAT_TIERS.filter(seats => seats > seatsTotal).map(seats => (
                <option key={seats} value={seats}>
                  {seats} seats — R{seats * SEAT_PRICE}/month
                </option>
              ))}
            </select>
            <button onClick={handleAddSeats} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ background: 'hsl(var(--accent))' }}>
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

      {showImport && org && (
        <BulkImportModal
          orgId={org.id}
          orgName={org.name}
          seatsAvailable={seatsAvailable}
          cards={cards.map(c => ({ id: c.id, name: c.name }))}
          existingEmails={cards.flatMap(c => [c.email, c.invite_email]).filter(Boolean) as string[]}
          targets={importTargets}
          onClose={() => setShowImport(false)}
          // A full reload rather than patching state: an import can add two
          // hundred cards, and the view counts and lead counts beside them are
          // read on the server.
          onDone={() => { setTimeout(() => window.location.reload(), 1200) }}
        />
      )}

      {/* Where the team's leads go afterwards. Owner only: a webhook carries
          every lead in the organisation, including from departments a head
          does not manage. */}
      {tab === 'integrations' && org && (
        <div className="space-y-4">
          <WebhookPanel orgId={org.id} />
          <ApiKeyPanel orgId={org.id} />
        </div>
      )}

      {/* Add card panel */}
      {showAddCard && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">New team member card</p>
            <button onClick={() => { setShowAddCard(false); setCopyFromId('') }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Brand is applied automatically from your Team Brand, so
              adding a member is just their personal details. */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Your <a href="/dashboard/team/brand" className="underline hover:text-foreground">team brand</a> (logo, company, colours, website, links) is applied to this card automatically. Just add the person&apos;s details below.
          </div>

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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'hsl(var(--accent))' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create card'}
            </button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {tab === 'people' && (cards.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-semibold text-lg mb-2">No cards yet</h2>
          <p className="text-sm text-muted-foreground mb-5">Create your first team member card to get started.</p>
          <button onClick={() => setShowAddCard(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90" style={{ background: 'hsl(var(--accent))' }}>
            <Plus className="w-4 h-4" />Add first card
          </button>
        </div>
      ) : (
        <>
        {/* One business at a time. Only for a group that has companies: a
            single-business team has nothing to switch between, and a row of
            one tab is furniture. */}
        {companies.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: '', label: 'All companies' },
              ...companies.map(c => ({ id: c.id, label: c.name })),
              ...(looseCount > 0 ? [{ id: 'none', label: 'No company' }] : []),
            ].map(t => {
              const active = companyId === t.id
              return (
                <button key={t.id || 'all'} onClick={() => setCompanyId(t.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition ${
                    active
                      ? 'border-foreground/50 bg-muted text-foreground font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/25 font-medium'}`}>
                  {t.label}
                  <span className="text-[11px] tabular-nums text-muted-foreground">{countFor(t.id)}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Search. Shown from the second card on. It was hidden below seven
            on the theory that a small team is quicker to scan than to type -
            but that also hid it from every team small enough to be new, which
            is most of them, and made a working feature look missing. */}
        {cards.length > 1 && (
          <div className="mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={cardQuery}
                onChange={e => setCardQuery(e.target.value)}
                placeholder="Search by name, job title, email, phone or link..."
                aria-label="Search team cards"
                className={inputClass + ' pl-10 pr-10'}
              />
              {cardQuery && (
                <button onClick={() => setCardQuery('')} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {cardQuery && (
              <p className="text-xs text-muted-foreground mt-2">
                {visibleCards.length === 0
                  ? <>Nothing matches &ldquo;{cardQuery}&rdquo;{companyId ? ' in this company' : ''}.</>
                  : <><strong className="text-foreground">{visibleCards.length}</strong> of {countFor(companyId)} cards</>}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCards.map(card => (
            <div key={card.id} className="bg-card border border-border rounded-lg overflow-hidden group">
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
                  {/* A revoked card is taken off the air, and until now nothing
                      said so: the tile looked identical to a live one, so an
                      admin had no way to tell which links still work. */}
                  {!card.is_active && (
                    <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                      title="This card is not published. Its public link and QR code do not resolve. Invite somebody to put it back online.">
                      Offline
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1 mb-4">
                  {card.email && <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" />{card.email}</p>}
                  {card.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" />{card.phone}</p>}
                  {card.company && <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5"><Building2 className="w-3 h-3 shrink-0" />{card.company}</p>}
                </div>

                {/* Is this card doing anything?
                    Two numbers, because they answer different questions: views
                    say the card is being handed out, leads say it is working.
                    A rep with 200 views and no leads has a card people open and
                    do nothing with; one with neither has not shared it at all.
                    Leads are omitted rather than shown as 0 when the count
                    could not be read - see the leadCounts prop. */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Times this card has been opened">
                    <Eye className="w-3.5 h-3.5" />
                    <strong className="text-foreground tabular-nums">{card.view_count ?? 0}</strong>
                    view{(card.view_count ?? 0) === 1 ? '' : 's'}
                  </span>
                  {leadCounts && (
                    <span className="inline-flex items-center gap-1.5"
                      style={{ color: (leadCounts[card.id] || 0) > 0 ? '#22c55e' : undefined }}
                      title="People who left their details on this card">
                      <Inbox className="w-3.5 h-3.5" />
                      <strong className="tabular-nums">{leadCounts[card.id] || 0}</strong>
                      lead{(leadCounts[card.id] || 0) === 1 ? '' : 's'}
                    </span>
                  )}
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
                              style={{ background: 'hsl(var(--accent))' }}>
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

                {/* Team brand toggle. Disabled until a brand exists, because
                    without one it is a switch that does nothing. */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className={`text-xs flex items-center gap-1.5 ${hasTeamBrand ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    {hasTeamBrand ? 'Use team brand' : (
                      <>No team brand yet &middot;{' '}
                        <Link href="/dashboard/team/brand" className="underline hover:text-foreground">Set one up</Link>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    disabled={!hasTeamBrand}
                    aria-checked={!!card.use_team_brand}
                    onClick={() => hasTeamBrand && toggleCardBrand(card)}
                    title={!hasTeamBrand
                      ? 'Set up a team brand first, otherwise this changes nothing.'
                      : card.use_team_brand ? 'This card shows the team brand. Tap to use its own branding.' : 'This card uses its own branding. Tap to apply the team brand.'}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: card.use_team_brand && hasTeamBrand ? 'hsl(var(--accent))' : 'hsl(var(--muted))' }}>
                    <span className="inline-block h-4 w-4 rounded-full bg-white transition"
                      style={{ transform: card.use_team_brand && hasTeamBrand ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </div>

                {/* Network listing. The admin decides whether the org allows
                    this card in the directory; the member has their own switch
                    and can still opt out, which is what the note below says
                    rather than leaving the admin wondering why someone the
                    toggle says is allowed does not show up. */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5" />In the Network
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!card.org_hide_from_network}
                    onClick={() => toggleCardNetwork(card)}
                    title={card.org_hide_from_network
                      ? 'This card is kept out of the Network directory. Tap to allow it.'
                      : 'This card may appear in the Network directory. Tap to keep it out.'}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition"
                    style={{ background: !card.org_hide_from_network ? 'hsl(var(--accent))' : 'hsl(var(--muted))' }}>
                    <span className="inline-block h-4 w-4 rounded-full bg-white transition"
                      style={{ transform: !card.org_hide_from_network ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </div>
                {!card.org_hide_from_network && card.hide_from_network && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
                    Allowed, but {card.name.split(' ')[0]} has switched the Network off on their own card.
                  </p>
                )}

                {/* Per-card lead form picker - shown when the org add-on is on
                    and at least one form is built. Allocates which form (or
                    none) this specific card shows. With one form it behaves like
                    the old on/off; with several you assign different forms to
                    different cards. */}
                {questionnaireAvailable && (
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <ClipboardList className="w-3.5 h-3.5" />Lead form
                    </span>
                    <select
                      value={cardFormValue(card)}
                      onChange={e => setCardForm(card, e.target.value)}
                      title="Which lead-capture form this card shows"
                      className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background max-w-[160px] focus:outline-none focus:ring-1 focus:ring-ring transition"
                    >
                      <option value="default">Company default</option>
                      {orgForms.map((f, i) => (
                        <option key={f.id} value={f.id}>{f.title?.trim() || `Form ${i + 1}`}</option>
                      ))}
                      <option value="off">No form</option>
                    </select>
                  </div>
                )}

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
        </>
      ))}

      {/* Edit modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: 'hsl(var(--accent))' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan summary */}
      {tab === 'billing' && (
      <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm">
          <p className="font-semibold">{org.name} · Team plan</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {seatsTotal} seats · R{seatsTotal * SEAT_PRICE}/month
            {org.billing_period && ` · ${org.billing_period} billing`}
          </p>
        </div>
        <a href="/dashboard/settings"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition underline">
          Manage billing
        </a>
      </div>
      )}
    </div>
  )
}
