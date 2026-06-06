'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Users, CreditCard, BarChart2, Package, Loader2,
  Search, Check, X, ChevronDown, ChevronUp, Building2,
  Wifi, MessageSquare, Shield, Trash2, Mail, KeyRound, MailCheck, Trophy, ArrowLeft
} from 'lucide-react'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at?: string | null
  email_confirmed?: boolean
  signup_country?: string | null
  signup_country_code?: string | null
  signup_city?: string | null
  signup_region?: string | null
  isPro: boolean
  isAdmin?: boolean
  subscription: any
  org: any
}

// Convert a 2-letter country code to its flag emoji
function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return ''
  const A = 0x1F1E6
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0),
    A + code.toUpperCase().charCodeAt(1) - 'A'.charCodeAt(0),
  )
}

interface Card {
  id: string
  name: string
  slug: string | null
  user_id: string
  created_at: string
}

interface NfcOrder {
  id: string
  color: string
  name_on_card: string
  shipping_city: string
  shipping_province: string
  amount: number
  status: string
  created_at: string
  tracking_number: string | null
}

interface Stats {
  totalUsers: number
  proUsers: number
  totalCards: number
  totalOrgs: number
  totalNfcOrders: number
  totalContacts: number
}

interface Announcement {
  id: string
  message: string
  link_url: string | null
  link_text: string | null
  variant: 'info' | 'success' | 'warning'
  created_at: string
}

interface Props {
  users: User[]
  cards: Card[]
  orgs: any[]
  nfcOrders: NfcOrder[]
  stats: Stats
  announcement: Announcement | null
}

type Tab = 'overview' | 'users' | 'cards' | 'nfc'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"

const NFC_STATUSES = ['pending_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#f59e0b',
  paid: '#3b82f6',
  in_production: '#8b5cf6',
  shipped: '#06b6d4',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

export default function AdminDashboard({ users, cards, orgs, nfcOrders, stats, announcement }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [annMessage, setAnnMessage] = useState(announcement?.message || '')
  const [annLinkUrl, setAnnLinkUrl] = useState(announcement?.link_url || '')
  const [annLinkText, setAnnLinkText] = useState(announcement?.link_text || '')
  const [annVariant, setAnnVariant] = useState<'info' | 'success' | 'warning'>(announcement?.variant || 'info')
  const [annActive, setAnnActive] = useState(!!announcement)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgSeats, setOrgSeats] = useState(5)
  const [localUsers, setLocalUsers] = useState(users)
  const [localOrders, setLocalOrders] = useState(nfcOrders)

  async function api(body: object) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async function activatePro(user: User) {
    setLoading(`pro-${user.id}`)
    const data = await api({ action: 'activate_pro', user_id: user.id, email: user.email })
    if (data.success) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, isPro: true } : u))
      toast.success(`Pro activated for ${user.email}`)
    } else toast.error(data.error)
    setLoading(null)
  }

  async function deactivatePro(user: User) {
    setLoading(`depro-${user.id}`)
    const data = await api({ action: 'deactivate_pro', user_id: user.id })
    if (data.success) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, isPro: false } : u))
      toast.success(`Pro deactivated for ${user.email}`)
    } else toast.error(data.error)
    setLoading(null)
  }

  async function toggleAdmin(user: User) {
    const next = !user.isAdmin
    if (!next && !confirm(`Remove admin access from ${user.email}?`)) return
    setLoading(`admin-${user.id}`)
    const data = await api({ action: 'set_admin', user_id: user.id, value: next })
    if (data.success) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, isAdmin: next } : u))
      toast.success(next ? `${user.email} is now an admin` : `Admin removed from ${user.email}`)
    } else {
      toast.error(data.error || 'Could not update')
    }
    setLoading(null)
  }

  async function resendConfirmation(user: User) {
    setLoading(`confirm-${user.id}`)
    const data = await api({ action: 'resend_confirmation', email: user.email })
    if (data.success) {
      toast.success(`Confirmation email resent to ${user.email}`)
    } else {
      toast.error(data.error || 'Could not resend')
    }
    setLoading(null)
  }

  async function forceConfirm(user: User) {
    if (!confirm(`Mark ${user.email} as email-confirmed without them clicking a link?`)) return
    setLoading(`forceconfirm-${user.id}`)
    const data = await api({ action: 'force_confirm', user_id: user.id })
    if (data.success) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, email_confirmed: true } : u))
      toast.success(`${user.email} email confirmed`)
    } else {
      toast.error(data.error || 'Could not confirm')
    }
    setLoading(null)
  }

  async function sendPasswordReset(user: User) {
    setLoading(`reset-${user.id}`)
    const data = await api({ action: 'send_password_reset', email: user.email })
    if (data.success) {
      toast.success(`Password reset link sent to ${user.email}`)
    } else {
      toast.error(data.error || 'Could not send reset')
    }
    setLoading(null)
  }

  async function postAnnouncement() {
    if (!annMessage.trim()) {
      toast.error('Enter a message first')
      return
    }
    setLoading('announce')
    const data = await api({
      action: 'post_announcement',
      message: annMessage.trim(),
      link_url: annLinkUrl.trim() || null,
      link_text: annLinkText.trim() || null,
      variant: annVariant,
    })
    if (data.success) {
      setAnnActive(true)
      toast.success('Announcement posted to all users')
    } else {
      toast.error(data.error || 'Could not post')
    }
    setLoading(null)
  }

  async function clearAnnouncement() {
    setLoading('announce-clear')
    const data = await api({ action: 'clear_announcement' })
    if (data.success) {
      setAnnActive(false)
      setAnnMessage('')
      setAnnLinkUrl('')
      setAnnLinkText('')
      toast.success('Announcement cleared')
    }
    setLoading(null)
  }

  async function deleteUser(user: User) {
    const confirmText = `delete ${user.email}`
    const entered = prompt(
      `This permanently deletes the user, all their cards, contacts, subscriptions, NFC orders, and teams. There is no undo.\n\nType "${confirmText}" to confirm:`
    )
    if (entered !== confirmText) {
      if (entered !== null) toast.error('Confirmation did not match. Nothing was deleted.')
      return
    }
    setLoading(`del-${user.id}`)
    const data = await api({ action: 'delete_user', user_id: user.id })
    if (data.success) {
      setLocalUsers(prev => prev.filter(u => u.id !== user.id))
      toast.success(`Deleted ${user.email}`)
    } else {
      toast.error(data.error || 'Deletion failed')
    }
    setLoading(null)
  }

  async function createOrg(user: User) {
    if (!orgName.trim()) { toast.error('Enter org name'); return }
    setLoading(`org-${user.id}`)
    const data = await api({ action: 'create_org', user_id: user.id, org_name: orgName, seat_count: orgSeats })
    if (data.success) {
      toast.success(`Team plan set up for ${user.email}`)
      setOrgName('')
      setExpandedUser(null)
    } else toast.error(data.error)
    setLoading(null)
  }

  async function updateNfcStatus(orderId: string, status: string, tracking?: string) {
    setLoading(`nfc-${orderId}`)
    const data = await api({ action: 'update_nfc_status', order_id: orderId, status, tracking_number: tracking })
    if (data.success) {
      setLocalOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, tracking_number: tracking || o.tracking_number } : o))
      toast.success('Order updated')
    } else toast.error(data.error)
    setLoading(null)
  }

  const filteredUsers = localUsers.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'users',    label: `Users (${localUsers.length})`, icon: Users },
    { id: 'cards',    label: `Cards (${cards.length})`, icon: CreditCard },
    { id: 'nfc',      label: `NFC Orders (${localOrders.length})`, icon: Package },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#050510' }}>
      {/* Header */}
      <div className="border-b border-white/08 px-8 py-5 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: grad }}>
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Cardtly Admin</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Internal dashboard — restricted access</p>
        </div>
        <Link href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)' }}>
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <Link href="/admin/promotions"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Trophy className="w-4 h-4" />
          Promotions
        </Link>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white/03 border border-white/06 p-1 rounded-xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as Tab)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
              style={tab === id
                ? { background: grad, color: 'white' }
                : { color: 'rgba(255,255,255,0.5)' }}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* Announcement composer */}
            <div className="rounded-2xl border p-5"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Site-wide announcement</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {annActive ? 'Currently shown to all logged-in users' : 'Nothing active. Post a message to show a banner on every dashboard.'}
                  </p>
                </div>
                {annActive && (
                  <button onClick={clearAnnouncement} disabled={loading === 'announce-clear'}
                    className="text-xs px-3 py-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                    {loading === 'announce-clear' ? 'Clearing...' : 'Clear'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <input value={annMessage}
                  onChange={e => setAnnMessage(e.target.value)}
                  placeholder="What do you want to tell everyone?"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={annLinkUrl}
                    onChange={e => setAnnLinkUrl(e.target.value)}
                    placeholder="Optional link URL (e.g. /upgrade)"
                    className="px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <input value={annLinkText}
                    onChange={e => setAnnLinkText(e.target.value)}
                    placeholder="Optional link text (e.g. Learn more)"
                    className="px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Style:</span>
                  {(['info', 'success', 'warning'] as const).map(v => (
                    <button key={v} onClick={() => setAnnVariant(v)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition ${annVariant === v ? 'ring-1 ring-white/30' : ''}`}
                      style={{
                        background: v === 'info' ? 'rgba(0,212,255,0.15)' : v === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                        color: v === 'info' ? '#00d4ff' : v === 'success' ? '#22c55e' : '#fbbf24',
                      }}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                  <button onClick={postAnnouncement} disabled={loading === 'announce' || !annMessage.trim()}
                    className="ml-auto text-xs font-bold px-4 py-1.5 rounded-lg text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: grad }}>
                    {loading === 'announce' ? 'Posting...' : annActive ? 'Update banner' : 'Post banner'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total users',   value: stats.totalUsers,    icon: Users },
                { label: 'Pro users',     value: stats.proUsers,      icon: CreditCard },
                { label: 'Total cards',   value: stats.totalCards,    icon: CreditCard },
                { label: 'Team orgs',     value: stats.totalOrgs,     icon: Building2 },
                { label: 'NFC orders',    value: stats.totalNfcOrders, icon: Wifi },
                { label: 'Contacts',      value: stats.totalContacts, icon: MessageSquare },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-4 border"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <Icon className="w-4 h-4 mb-2" style={{ color: '#7c3aed' }} />
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Country breakdown - top 10 countries by signups */}
            {(() => {
              const counts: Record<string, { country: string; code: string; count: number }> = {}
              localUsers.forEach(u => {
                if (!u.signup_country || !u.signup_country_code) return
                const key = u.signup_country_code
                if (!counts[key]) counts[key] = { country: u.signup_country, code: u.signup_country_code, count: 0 }
                counts[key].count += 1
              })
              const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10)
              const totalWithLocation = sorted.reduce((sum, c) => sum + c.count, 0)
              const unknownCount = localUsers.length - totalWithLocation
              if (sorted.length === 0) return null
              return (
                <div className="rounded-2xl border p-5"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-sm font-semibold text-white mb-4">Signups by country</p>
                  <div className="space-y-2">
                    {sorted.map(c => {
                      const pct = totalWithLocation > 0 ? Math.round((c.count / localUsers.length) * 100) : 0
                      return (
                        <div key={c.code} className="flex items-center gap-3">
                          <span className="text-base flex-shrink-0">{countryFlag(c.code)}</span>
                          <span className="text-sm text-white flex-shrink-0 w-32 truncate">{c.country}</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full transition-all"
                              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00d4ff, #7c3aed)' }} />
                          </div>
                          <span className="text-xs text-white/60 flex-shrink-0 w-12 text-right">{c.count}</span>
                        </div>
                      )
                    })}
                    {unknownCount > 0 && (
                      <p className="text-xs text-white/30 pt-2">{unknownCount} user{unknownCount !== 1 ? 's' : ''} with no location data (signed up before tracking, or geo lookup failed)</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Recent users */}
            <div className="rounded-2xl border p-5"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold text-white mb-4">Recent signups</p>
              <div className="space-y-2">
                {localUsers.slice(0, 10).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/05 last:border-0">
                    <div>
                      <p className="text-sm text-white">{u.email}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-ZA')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.org && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>Team</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={u.isPro
                          ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }
                          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                        {u.isPro ? 'Pro' : 'Free'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by email..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div className="space-y-2">
              {filteredUsers.map(user => (
                <div key={user.id} className="rounded-2xl border overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ background: user.isPro ? grad : 'rgba(255,255,255,0.1)' }}>
                        {user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate flex items-center gap-2">
                          {user.email}
                          {user.signup_country_code && (
                            <span title={`${user.signup_city ? user.signup_city + ', ' : ''}${user.signup_country}`}>
                              {countryFlag(user.signup_country_code)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <span>Joined {new Date(user.created_at).toLocaleDateString('en-ZA')}</span>
                          {(user.signup_city || user.signup_country) && (
                            <span>
                              · {[user.signup_city, user.signup_region, user.signup_country].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {user.org && <span>· Team: {user.org.name} ({user.org.max_seats} seats)</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {user.email_confirmed === false && (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          title="User has not confirmed their email yet"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Unconfirmed</span>
                      )}

                      {user.isPro ? (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Pro</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>Free</span>
                      )}

                      {user.isAdmin && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                          <Shield className="w-3 h-3" />Admin
                        </span>
                      )}

                      {user.isPro ? (
                        <button onClick={() => deactivatePro(user)}
                          disabled={loading === `depro-${user.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                          {loading === `depro-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Remove Pro
                        </button>
                      ) : (
                        <button onClick={() => activatePro(user)}
                          disabled={loading === `pro-${user.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ background: grad }}>
                          {loading === `pro-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Activate Pro
                        </button>
                      )}

                      {/* Make/Revoke admin toggle */}
                      <button onClick={() => toggleAdmin(user)}
                        disabled={loading === `admin-${user.id}`}
                        title={user.isAdmin ? 'Revoke admin access' : 'Grant admin access (sees /admin in their sidebar)'}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                        style={user.isAdmin
                          ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
                          : { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                        {loading === `admin-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                        {user.isAdmin ? 'Remove admin' : 'Make admin'}
                      </button>

                      <button onClick={() => resendConfirmation(user)}
                        disabled={loading === `confirm-${user.id}`}
                        title={user.email_confirmed ? 'Send a fresh confirmation email (Supabase may reject for already-confirmed users)' : 'Resend the email-confirmation link to this user'}
                        className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-50"
                        style={{ color: '#00d4ff' }}>
                        {loading === `confirm-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      </button>
                      {user.email_confirmed === false && (
                        <button onClick={() => forceConfirm(user)}
                          disabled={loading === `forceconfirm-${user.id}`}
                          title="Force-confirm email without making them click the link"
                          className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-50"
                          style={{ color: '#22c55e' }}>
                          {loading === `forceconfirm-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
                        </button>
                      )}

                      <button onClick={() => sendPasswordReset(user)}
                        disabled={loading === `reset-${user.id}`}
                        title="Send a password reset link to this user"
                        className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-50"
                        style={{ color: '#fbbf24' }}>
                        {loading === `reset-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      </button>

                      <button onClick={() => deleteUser(user)}
                        disabled={loading === `del-${user.id}`}
                        title="Delete user and all their data"
                        className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-50"
                        style={{ color: '#f87171' }}>
                        {loading === `del-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>

                      <button onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                        className="p-1.5 rounded-lg transition hover:bg-white/05"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {expandedUser === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded — team setup */}
                  {expandedUser === user.id && (
                    <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {user.org ? `Edit team plan — currently ${user.org.max_seats} seats` : 'Set up team plan'}
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        <input
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          placeholder={user.org?.name || 'Company name'}
                          className="px-3 py-2 rounded-lg border text-white text-sm focus:outline-none transition flex-1 min-w-40"
                          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={() => setOrgSeats(Math.max(1, orgSeats - 1))}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center text-white font-bold transition hover:bg-white/05"
                            style={{ borderColor: 'rgba(255,255,255,0.1)' }}>−</button>
                          <span className="text-white font-bold w-8 text-center">{orgSeats}</span>
                          <button onClick={() => setOrgSeats(orgSeats + 1)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center text-white font-bold transition hover:bg-white/05"
                            style={{ borderColor: 'rgba(255,255,255,0.1)' }}>+</button>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>seats</span>
                        </div>
                        <button onClick={() => createOrg(user)}
                          disabled={loading === `org-${user.id}`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ background: grad }}>
                          {loading === `org-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Building2 className="w-3 h-3" />}
                          {user.org ? 'Update team' : 'Create team'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards */}
        {tab === 'cards' && (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Name', 'Slug', 'User ID', 'Created'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.map(card => (
                  <tr key={card.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3 text-white">{card.name || '—'}</td>
                    <td className="px-4 py-3">
                      {card.slug
                        ? <a href={`/card/${card.slug}`} target="_blank" className="text-xs font-mono hover:text-white transition" style={{ color: '#00d4ff' }}>{card.slug}</a>
                        : <span style={{ color: 'rgba(255,255,255,0.3)' }}>No slug</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{card.user_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{new Date(card.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* NFC Orders */}
        {tab === 'nfc' && (
          <div className="space-y-3">
            {localOrders.length === 0 && (
              <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No NFC orders yet
              </div>
            )}
            {localOrders.map(order => {
              const color = STATUS_COLORS[order.status] || '#6b7280'
              return (
                <div key={order.id} className="rounded-2xl border p-5"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${order.color === 'black' ? 'bg-gray-950 text-white border border-white/10' : 'bg-white text-gray-900 border border-gray-200'}`}>
                        {order.color === 'black' ? '⬛' : '⬜'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{order.name_on_card}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {order.shipping_city}, {order.shipping_province} · R{(order.amount / 100).toFixed(0)} · {new Date(order.created_at).toLocaleDateString('en-ZA')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {order.tracking_number && (
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                          🚚 {order.tracking_number}
                        </span>
                      )}
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: color + '20', color }}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Status actions */}
                  <div className="mt-4 pt-4 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Update status:</p>
                    {NFC_STATUSES.filter(s => s !== order.status).map(s => (
                      <button key={s} onClick={() => updateNfcStatus(order.id, s)}
                        disabled={loading === `nfc-${order.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border transition hover:bg-white/05 disabled:opacity-50"
                        style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                    {order.status === 'paid' && (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          placeholder="Tracking number"
                          className="px-3 py-1.5 rounded-lg border text-white text-xs focus:outline-none transition"
                          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              updateNfcStatus(order.id, 'shipped', (e.target as HTMLInputElement).value)
                            }
                          }}
                        />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Press Enter to mark shipped</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
