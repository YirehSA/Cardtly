'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Crown, Users, Trophy, Gift, Sparkles, DollarSign, Globe,
  TrendingUp, Heart, Hash, AtSign, Award, Dice5, Loader2, X,
} from 'lucide-react'

interface Founder {
  user_id: string
  email: string
  founder_number: number
  lifetime_pro: boolean
  referral_code: string | null
  plan_id: string | null
  sub_status: string | null
  period_end: string | null
}

interface ReferralRow {
  id: string
  referrer_email: string
  referred_email: string
  status: string
  created_at: string
  became_paid_at: string | null
  became_active_at: string | null
}

interface TopUser {
  user_id: string
  email: string
  count: number
}

interface Winner {
  id: string
  tier: string
  prize: string
  user_id: string
  email: string
  drawn_at: string
  drawn_by: string | null
}

interface Props {
  counter: { filled: number; remaining: number; total: number }
  founders: Founder[]
  referrals: ReferralRow[]
  refStats: { total: number; pending: number; active: number; paid: number; cancelled: number }
  entriesBySource: Record<string, number>
  totalEntries: number
  topUsers: TopUser[]
  winners: Winner[]
  activePaidCount: number
  totalUsers: number
}

type Tab = 'overview' | 'founders' | 'referrals' | 'entries' | 'winners'

// Tier milestone definitions for progress bars + draw dropdown
const TIERS = [
  { id: 'tier1_founder_lifetime', label: 'Tier 1 · Founder Lifetime (10)', target: 100, against: 'founders', defaultPrize: 'Cardtly Pro for life', defaultCount: 10 },
  { id: 'tier1_founder_3m', label: 'Tier 1 · Founder 3-Month (90)', target: 100, against: 'founders', defaultPrize: '3 months Pro free', defaultCount: 90 },
  { id: 'tier2_website_full', label: 'Tier 2 · Website Full', target: 1000, against: 'active', defaultPrize: 'Custom website by Yireh', defaultCount: 3 },
  { id: 'tier2_website_starter', label: 'Tier 2 · Website Starter', target: 1000, against: 'active', defaultPrize: 'Website starter prize', defaultCount: 0 },
  { id: 'tier3_1000', label: 'Tier 3 · R25,000 (1,000 paid)', target: 1000, against: 'paid', defaultPrize: 'R25,000 cash', defaultCount: 1 },
  { id: 'tier3_2500', label: 'Tier 3 · R75,000 (2,500 paid)', target: 2500, against: 'paid', defaultPrize: 'R75,000 cash', defaultCount: 1 },
  { id: 'tier3_5000', label: 'Tier 3 · R150,000 (5,000 paid)', target: 5000, against: 'paid', defaultPrize: 'R150,000 cash', defaultCount: 1 },
  { id: 'tier4_10000', label: 'Tier 4 · Grand Prize (10,000 paid)', target: 10000, against: 'paid', defaultPrize: 'The grand prize', defaultCount: 1 },
]

const SOURCE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  paid: { label: 'Paid subscription', icon: DollarSign, color: '#10b981' },
  referral: { label: 'Referral', icon: Users, color: '#8b5cf6' },
  email_alt: { label: 'Email alt', icon: AtSign, color: '#06b6d4' },
  social_instagram: { label: 'Instagram', icon: Heart, color: '#ec4899' },
  social_facebook: { label: 'Facebook', icon: Heart, color: '#3b82f6' },
  hashtag: { label: 'Hashtag', icon: Hash, color: '#f59e0b' },
  tag_friend: { label: 'Tag friend', icon: Users, color: '#a855f7' },
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function PromotionsAdmin({
  counter, founders, referrals, refStats, entriesBySource, totalEntries, topUsers, winners, activePaidCount, totalUsers,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Local mirror of the founders list so removing a row updates the
  // UI without a page reload. The server count stays accurate via
  // the trigger - next signup reclaims the freed slot.
  const [localFounders, setLocalFounders] = useState<Founder[]>(founders)
  const [removingFounderId, setRemovingFounderId] = useState<string | null>(null)

  async function removeFounder(f: Founder) {
    const label = f.email || `Founder #${f.founder_number}`
    if (!confirm(`Remove ${label} from the Founders 100? Slot #${f.founder_number} returns to the pool and the next organic signup claims it. If they're on the 3-month grant it will be cancelled.`)) return
    setRemovingFounderId(f.user_id)
    try {
      const res = await fetch('/api/admin/founders/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: f.user_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not remove founder')
      } else {
        toast.success(`Slot #${f.founder_number} freed`)
        setLocalFounders(prev => prev.filter(x => x.user_id !== f.user_id))
      }
    } catch {
      toast.error('Network error')
    }
    setRemovingFounderId(null)
  }

  // Draw form state
  const [drawTier, setDrawTier] = useState<string>('tier1_founder_lifetime')
  const [drawN, setDrawN] = useState<number>(10)
  const [drawPrize, setDrawPrize] = useState<string>('Cardtly Pro for life')
  const [drawSource, setDrawSource] = useState<string>('')
  const [drawing, setDrawing] = useState(false)
  const [drawResult, setDrawResult] = useState<{ dry_run: boolean; winners: Array<{ user_id: string; email: string }> } | null>(null)
  const [localWinners, setLocalWinners] = useState<Winner[]>(winners)

  function pickTier(tierId: string) {
    const t = TIERS.find(x => x.id === tierId)
    if (!t) return
    setDrawTier(tierId)
    setDrawN(t.defaultCount || 1)
    setDrawPrize(t.defaultPrize)
  }

  async function runDraw(dry: boolean) {
    if (!drawTier) return toast.error('Pick a tier')
    if (!drawN || drawN < 1) return toast.error('How many winners?')
    if (!dry && !drawPrize.trim()) return toast.error('Enter the prize description')

    setDrawing(true)
    setDrawResult(null)
    try {
      const res = await fetch('/api/admin/promotions/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: drawTier,
          n_winners: drawN,
          prize: drawPrize,
          source_filter: drawSource || undefined,
          dry_run: dry,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Draw failed')
        return
      }
      setDrawResult({ dry_run: data.dry_run, winners: data.winners })
      if (!dry) {
        toast.success(`${data.n_picked} winners recorded`)
        // Optimistically prepend to localWinners
        const now = new Date().toISOString()
        setLocalWinners(prev => [
          ...data.winners.map((w: any) => ({
            id: crypto.randomUUID(),
            tier: drawTier,
            prize: drawPrize,
            user_id: w.user_id,
            email: w.email,
            drawn_at: now,
            drawn_by: 'admin',
          })),
          ...prev,
        ])
      } else {
        toast.success(`Dry run: ${data.n_picked} winners picked`)
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setDrawing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition">
              Admin
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: '#f59e0b' }} />
              Promotions
            </h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {totalUsers} users · {activePaidCount} paid
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {([
            ['overview', 'Overview'],
            ['founders', `Founders (${localFounders.length})`],
            ['referrals', `Referrals (${referrals.length})`],
            ['entries', `Entries (${totalEntries})`],
            ['winners', `Winners (${localWinners.length})`],
          ] as Array<[Tab, string]>).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === k
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Crown className="w-5 h-5" />}
              label="Founders claimed"
              value={`${counter.filled} / ${counter.total}`}
              sub={`${counter.remaining} slots left`}
              accent="#f59e0b"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Total referrals"
              value={refStats.total}
              sub={`${refStats.paid} verified paid`}
              accent="#8b5cf6"
            />
            <StatCard
              icon={<Gift className="w-5 h-5" />}
              label="Total entries"
              value={totalEntries}
              sub={`${Object.keys(entriesBySource).length} sources`}
              accent="#06b6d4"
            />
            <StatCard
              icon={<Award className="w-5 h-5" />}
              label="Winners drawn"
              value={localWinners.length}
              sub={`${new Set(localWinners.map(w => w.tier)).size} tiers`}
              accent="#10b981"
            />
          </div>

          {/* Tier progress */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Tier progress
            </h2>
            <div className="space-y-4">
              <ProgressRow
                icon={<Crown className="w-4 h-4" />}
                label="Tier 1 · Founders"
                current={counter.filled}
                target={100}
                gradient="linear-gradient(90deg, #f59e0b, #ef4444)"
              />
              <ProgressRow
                icon={<Globe className="w-4 h-4" />}
                label="Tier 2 · Active accounts"
                current={activePaidCount}
                target={1000}
                gradient="linear-gradient(90deg, #8b5cf6, #d946ef)"
              />
              <ProgressRow
                icon={<DollarSign className="w-4 h-4" />}
                label="Tier 3a · R25,000 (1,000 paid)"
                current={activePaidCount}
                target={1000}
                gradient="linear-gradient(90deg, #ec4899, #f43f5e)"
              />
              <ProgressRow
                icon={<DollarSign className="w-4 h-4" />}
                label="Tier 3b · R75,000 (2,500 paid)"
                current={activePaidCount}
                target={2500}
                gradient="linear-gradient(90deg, #ec4899, #f43f5e)"
              />
              <ProgressRow
                icon={<DollarSign className="w-4 h-4" />}
                label="Tier 3c · R150,000 (5,000 paid)"
                current={activePaidCount}
                target={5000}
                gradient="linear-gradient(90deg, #ec4899, #f43f5e)"
              />
              <ProgressRow
                icon={<Sparkles className="w-4 h-4" />}
                label="Tier 4 · Grand prize (10,000 paid)"
                current={activePaidCount}
                target={10000}
                gradient="linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)"
              />
            </div>
          </div>

          {/* Referral status breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Referral pipeline
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Pending" value={refStats.pending} color="#f59e0b" />
              <MiniStat label="Active" value={refStats.active} color="#3b82f6" />
              <MiniStat label="Paid (verified)" value={refStats.paid} color="#10b981" />
              <MiniStat label="Cancelled" value={refStats.cancelled} color="#ef4444" />
            </div>
          </div>

          {/* Entries by source */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Entries by source
            </h2>
            {Object.keys(entriesBySource).length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(entriesBySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => {
                    const meta = SOURCE_LABELS[source] || { label: source, icon: Gift, color: '#64748b' }
                    const Icon = meta.icon
                    return (
                      <div key={source} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                          <p className="text-lg font-bold tabular-nums">{count}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Founders tab ─────────────────────────────────────── */}
      {tab === 'founders' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Crown className="w-5 h-5" style={{ color: '#f59e0b' }} />
                Founders ({localFounders.length} / 100)
              </h2>
              <p className="text-xs text-muted-foreground">
                Ordered by signup · Remove to free a slot
              </p>
            </div>
            {localFounders.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No founders yet. They'll appear here as new users sign up.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Lifetime</th>
                      <th className="px-4 py-3 text-left">Ref code</th>
                      <th className="px-4 py-3 text-left">Plan</th>
                      <th className="px-4 py-3 text-left">3m ends</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localFounders.map((f) => (
                      <tr key={f.user_id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono tabular-nums">{f.founder_number}</td>
                        <td className="px-4 py-3">{f.email}</td>
                        <td className="px-4 py-3">
                          {f.lifetime_pro ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white' }}>
                              <Crown className="w-3 h-3" />Lifetime
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{f.referral_code || '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {f.plan_id ? (
                            <span className={`px-2 py-0.5 rounded-md ${f.sub_status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                              {f.plan_id} · {f.sub_status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">no sub</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(f.period_end)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeFounder(f)}
                            disabled={removingFounderId === f.user_id}
                            title="Remove founder status. Slot returns to the pool."
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                            {removingFounderId === f.user_id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <X className="w-3 h-3" />}
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Referrals tab ────────────────────────────────────── */}
      {tab === 'referrals' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Referrals ({referrals.length})
              </h2>
            </div>
            {referrals.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No referrals yet. Users who sign up with <code className="px-1 py-0.5 bg-muted rounded">?ref=XXX</code> in the URL appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Referrer</th>
                      <th className="px-4 py-3 text-left">Referred</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Signed up</th>
                      <th className="px-4 py-3 text-left">Became paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">{r.referrer_email}</td>
                        <td className="px-4 py-3">{r.referred_email}</td>
                        <td className="px-4 py-3">
                          <ReferralStatusPill status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.became_paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Entries tab ──────────────────────────────────────── */}
      {tab === 'entries' && (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              By source ({totalEntries} total)
            </h2>
            {Object.keys(entriesBySource).length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(entriesBySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => {
                    const meta = SOURCE_LABELS[source] || { label: source, icon: Gift, color: '#64748b' }
                    const Icon = meta.icon
                    const pct = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0
                    return (
                      <div key={source} className="p-4 rounded-xl border border-border bg-background">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <p className="text-sm font-semibold">{meta.label}</p>
                        </div>
                        <p className="text-2xl font-bold tabular-nums">{count}</p>
                        <p className="text-xs text-muted-foreground">{pct}% of entries</p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Top users by entries</h2>
              <p className="text-xs text-muted-foreground">Cap is 10 per user</p>
            </div>
            {topUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No entries yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-right">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => (
                      <tr key={u.user_id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-xs font-bold tabular-nums" style={{ background: u.count >= 10 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#e0e7ff', color: u.count >= 10 ? 'white' : '#3730a3' }}>
                            {u.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Winners tab ──────────────────────────────────────── */}
      {tab === 'winners' && (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          {/* Draw form */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Dice5 className="w-5 h-5" />
              Run a draw
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Pick winners from the entry pool. Always do a dry run first.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Tier</label>
                <select
                  value={drawTier}
                  onChange={(e) => pickTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIERS.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Winners</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={drawN}
                  onChange={(e) => setDrawN(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Prize description</label>
                <input
                  type="text"
                  value={drawPrize}
                  onChange={(e) => setDrawPrize(e.target.value)}
                  placeholder="e.g. R25,000 cash"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Filter by source (optional)</label>
                <select
                  value={drawSource}
                  onChange={(e) => setDrawSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All sources</option>
                  {Object.keys(SOURCE_LABELS).map(s => (
                    <option key={s} value={s}>{SOURCE_LABELS[s].label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => runDraw(true)}
                disabled={drawing}
                className="px-5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dice5 className="w-4 h-4" />}
                Dry run
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Record ${drawN} winners for ${drawTier}? This writes to the database.`)) return
                  runDraw(false)
                }}
                disabled={drawing}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
                style={{ background: grad }}
              >
                {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                Record live draw
              </button>
            </div>

            {drawResult && (
              <div className="mt-5 p-4 rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">
                    {drawResult.dry_run ? 'Dry run result' : 'Recorded winners'} · {drawResult.winners.length}
                  </p>
                  {drawResult.dry_run && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold">PREVIEW</span>
                  )}
                </div>
                <ul className="space-y-1 text-sm">
                  {drawResult.winners.map((w, i) => (
                    <li key={w.user_id} className="flex items-center gap-3 py-1">
                      <span className="font-mono text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                      <Trophy className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                      <span>{w.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Existing winners */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Award className="w-5 h-5" style={{ color: '#10b981' }} />
                Recorded winners ({localWinners.length})
              </h2>
            </div>
            {localWinners.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No draws yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Tier</th>
                      <th className="px-4 py-3 text-left">Prize</th>
                      <th className="px-4 py-3 text-left">Winner</th>
                      <th className="px-4 py-3 text-left">Drawn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localWinners.map((w) => (
                      <tr key={w.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs">{w.tier}</td>
                        <td className="px-4 py-3">{w.prize}</td>
                        <td className="px-4 py-3">{w.email}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(w.drawn_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-background">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}

function ProgressRow({ icon, label, current, target, gradient }: { icon: React.ReactNode; label: string; current: number; target: number; gradient: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="font-medium flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          <span className="font-bold text-foreground">{current.toLocaleString()}</span> / {target.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  )
}

function ReferralStatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#f59e0b1a', color: '#b45309', label: 'Pending' },
    active: { bg: '#3b82f61a', color: '#1d4ed8', label: 'Active' },
    paid: { bg: '#10b9811a', color: '#047857', label: 'Paid' },
    cancelled: { bg: '#ef44441a', color: '#b91c1c', label: 'Cancelled' },
  }
  const s = styles[status] || { bg: '#64748b1a', color: '#475569', label: status }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
