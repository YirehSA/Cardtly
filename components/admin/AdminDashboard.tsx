'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Users, CreditCard, BarChart2, Package, Loader2,
  Search, Check, X, ChevronDown, ChevronUp, Building2,
  Wifi, MessageSquare, Shield, Trash2
} from 'lucide-react'

interface User {
  id: string
  email: string
  created_at: string
  isPro: boolean
  subscription: any
  org: any
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

interface Props {
  users: User[]
  cards: Card[]
  orgs: any[]
  nfcOrders: NfcOrder[]
  stats: Stats
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

export default function AdminDashboard({ users, cards, orgs, nfcOrders, stats }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
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
        <div>
          <h1 className="text-lg font-bold text-white">Cardtly Admin</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Internal dashboard — restricted access</p>
        </div>
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
                        <p className="text-sm text-white truncate">{user.email}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Joined {new Date(user.created_at).toLocaleDateString('en-ZA')}
                          {user.org && ` · Team: ${user.org.name} (${user.org.max_seats} seats)`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {user.isPro ? (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Pro</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>Free</span>
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

                      <button onClick={() => deleteUser(user)}
                        disabled={loading === `del-${user.id}`}
                        title="Delete user and all their data"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        {loading === `del-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete
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
