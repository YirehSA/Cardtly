'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlan } from '@/types/database'
import { toast } from 'sonner'
import { User, Lock, CreditCard, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  user: { id: string; email: string }
  profile: { fullName: string }
  card?: { id: string; slug: string } | null
  plan: UserPlan
  subscription: {
    subscription_tier: string
    status: string
    created_at: string
    whop_user_id: string | null
  } | null
}

type Tab = 'profile' | 'security' | 'billing' | 'danger'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',  label: 'Profile',    icon: <User className="w-4 h-4" /> },
  { id: 'security', label: 'Security',   icon: <Lock className="w-4 h-4" /> },
  { id: 'billing',  label: 'Billing',    icon: <CreditCard className="w-4 h-4" /> },
  { id: 'danger',   label: 'Danger zone', icon: <AlertTriangle className="w-4 h-4" /> },
]

export default function SettingsTabs({ user, profile, plan, subscription, card }: Props & { card?: Props['card'] }) {
  const [tab, setTab] = useState<Tab>('profile')
  const supabase = createClient()
  const router = useRouter()

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-1 justify-center ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-2xl p-6">
        {tab === 'profile' && <ProfileTab user={user} profile={profile} supabase={supabase} />}
        {tab === 'security' && <SecurityTab user={user} supabase={supabase} />}
        {tab === 'billing' && <BillingTab plan={plan} subscription={subscription} />}
        {tab === 'danger' && <DangerTab user={user} supabase={supabase} router={router} />}
      </div>
    </div>
  )
}

// ── Profile tab ────────────────────────────────────────────────────────────────

function ProfileTab({ user, profile, card, supabase }: { user: Props['user']; profile: Props['profile']; card?: Props['card']; supabase: any }) {
  const [fullName, setFullName] = useState(profile.fullName)
  const [slug, setSlug] = useState(card?.slug || '')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [slugSuccess, setSlugSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: fullName, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success('Profile updated')
    setSaving(false)
  }

  async function saveSlug() {
    if (!card?.id) return
    setSlugSaving(true)
    setSlugError('')
    setSlugSuccess(false)
    const res = await fetch('/api/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, card_id: card.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSlugError(data.error || 'Failed to update URL')
    } else {
      setSlugSuccess(true)
      toast.success('Card URL updated')
      setTimeout(() => setSlugSuccess(false), 3000)
    }
    setSlugSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-1">Profile information</h2>
        <p className="text-sm text-muted-foreground">Your account details</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Full name</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email address</label>
          <input
            value={user.email}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted text-sm text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1.5">Email cannot be changed here. Contact support if needed.</p>
        </div>

        {card && (
          <div>
            <label className="block text-sm font-medium mb-1.5">Card URL</label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 py-2.5 rounded-l-lg border border-r-0 border-border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                cardtly.com/card/
              </div>
              <input
                suppressHydrationWarning
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); setSlugSuccess(false) }}
                placeholder="your-name"
                className="flex-1 px-4 py-2.5 rounded-r-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
              <button onClick={saveSlug} disabled={slugSaving || !slug || slug === card.slug}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                {slugSaving ? 'Saving...' : slugSuccess ? '✓ Saved' : 'Update'}
              </button>
            </div>
            {slugError && <p className="text-xs text-destructive mt-1.5">{slugError}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">
              Use your name or company. e.g. <span className="font-mono">andre-nel</span> or <span className="font-mono">andre-yireh</span>. Old links still work.
            </p>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Security tab ───────────────────────────────────────────────────────────────

function SecurityTab({ user, supabase }: { user: Props['user']; supabase: any }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function changePassword() {
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error('Failed to update password: ' + error.message)
    else {
      toast.success('Password updated successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-1">Change password</h2>
        <p className="text-sm text-muted-foreground">Choose a strong password of at least 8 characters</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
            <button onClick={() => setShowNew(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Password strength indicator */}
          {newPw.length > 0 && (
            <div className="mt-2 flex gap-1">
              {[1,2,3,4].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                  newPw.length >= i * 3
                    ? newPw.length >= 12 ? 'bg-green-500'
                    : newPw.length >= 8 ? 'bg-yellow-500'
                    : 'bg-red-500'
                    : 'bg-muted'
                }`} />
              ))}
              <span className="text-xs text-muted-foreground ml-2">
                {newPw.length < 8 ? 'Too short' : newPw.length < 12 ? 'Good' : 'Strong'}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
            <button onClick={() => setShowCurrent(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPw.length > 0 && newPw !== confirmPw && (
            <p className="text-xs text-destructive mt-1.5">Passwords do not match</p>
          )}
          {confirmPw.length > 0 && newPw === confirmPw && (
            <p className="text-xs text-green-500 mt-1.5 flex items-center gap-1"><Check className="w-3 h-3" />Passwords match</p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button onClick={changePassword} disabled={saving || !newPw || !confirmPw}
          className="flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50">
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </div>
  )
}

// ── Billing tab ────────────────────────────────────────────────────────────────

function BillingTab({ plan, subscription }: { plan: UserPlan; subscription: Props['subscription'] }) {
  const isPro = plan.tier === 'pro' && plan.isActive

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-1">Billing & plan</h2>
        <p className="text-sm text-muted-foreground">Your current plan and subscription details</p>
      </div>

      {/* Plan badge */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isPro ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {isPro ? 'Pro' : 'Free'}
          </div>
          <div>
            <p className="font-semibold">{isPro ? 'Pro plan' : 'Free plan'}</p>
            <p className="text-xs text-muted-foreground">
              {isPro
                ? subscription?.created_at ? `Active since ${formatDate(subscription.created_at)}` : 'Active'
                : 'Limited features'}
            </p>
          </div>
        </div>
        {isPro && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/15 text-green-600">
            Active
          </span>
        )}
      </div>

      {/* Plan features */}
      <div className="space-y-2">
        {isPro ? (
          [
            '9 card templates', 'Custom accent colour', 'Custom links and social profiles',
            'Gallery and media', 'Analytics dashboard', 'Email signature generator',
            'Virtual background generator', 'Contact form and leads', 'QR code with your logo',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              {f}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border p-5 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Upgrade to Pro to unlock all features</p>
            <a href="/dashboard/upgrade"
              className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition">
              Upgrade to Pro
            </a>
          </div>
        )}
      </div>

      {isPro && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            To manage or cancel your subscription, visit the billing portal.
          </p>
          <a href="https://whop.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition">
            <CreditCard className="w-4 h-4" />
            Manage subscription
          </a>
        </div>
      )}
    </div>
  )
}

// ── Danger zone tab ────────────────────────────────────────────────────────────

function DangerTab({ user, supabase, router }: { user: Props['user']; supabase: any; router: any }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function deleteAccount() {
    if (confirm !== user.email) {
      toast.error('Email does not match')
      return
    }
    setDeleting(true)
    // Sign out first, then the account would need a server action to fully delete
    // For now sign out and show a message — full deletion requires admin API
    await supabase.auth.signOut()
    toast.success('Signed out. Contact support to fully delete your account.')
    router.push('/')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-1 text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">These actions are permanent and cannot be undone</p>
      </div>

      {/* Sign out all devices */}
      <div className="p-4 rounded-xl border border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Sign out everywhere</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sign out of all devices and sessions</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut({ scope: 'global' })
              router.push('/login')
            }}
            className="flex-shrink-0 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition">
            Sign out all
          </button>
        </div>
      </div>

      {/* Delete account */}
      <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-medium text-sm text-destructive">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all card data. This cannot be undone.
            </p>
          </div>
          {!showConfirm && (
            <button onClick={() => setShowConfirm(true)}
              className="flex-shrink-0 border border-destructive/40 text-destructive px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/10 transition">
              Delete account
            </button>
          )}
        </div>

        {showConfirm && (
          <div className="space-y-3 pt-3 border-t border-destructive/20">
            <p className="text-xs text-muted-foreground">
              Type your email address <span className="font-mono font-semibold text-foreground">{user.email}</span> to confirm
            </p>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={user.email}
              className="w-full px-4 py-2.5 rounded-lg border border-destructive/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive transition"
            />
            <div className="flex gap-3">
              <button onClick={deleteAccount} disabled={deleting || confirm !== user.email}
                className="flex items-center gap-2 bg-destructive text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-destructive/90 transition disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button onClick={() => { setShowConfirm(false); setConfirm('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
