'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlan } from '@/types/database'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { User, Lock, CreditCard, AlertTriangle, Check, Eye, EyeOff, Fingerprint } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getBiometricStatus, hasBiometricEnabled, enableBiometric, disableBiometric } from '@/lib/biometric'

interface Props {
  user: { id: string; email: string }
  profile: { fullName: string }
  card?: { id: string; slug: string; allow_homepage_feature?: boolean | null } | null
  plan: UserPlan
  subscription: {
    subscription_tier: string
    status: string
    created_at: string
    billing_cycle: string | null
    seats: number | null
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
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.14), transparent 65%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">Your account</h1>
              <p className="text-muted-foreground text-sm">Your details, your password, your plan.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar — 2 columns on mobile so every tab including Danger is
          visible without scrolling, 4 columns on desktop. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-muted p-1 rounded-2xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition justify-center ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-3xl p-6">
        {tab === 'profile' && <ProfileTab user={user} profile={profile} card={card || undefined} supabase={supabase} />}
        {tab === 'security' && <SecurityTab user={user} supabase={supabase} />}
        {tab === 'billing' && <BillingTab plan={plan} subscription={subscription} />}
        {tab === 'danger' && (
          <DangerTab user={user} supabase={supabase} router={router}
            isPaying={billingState(plan, subscription) === 'paid'} />
        )}
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
  const [allowFeature, setAllowFeature] = useState(!!card?.allow_homepage_feature)
  const [featureSaving, setFeatureSaving] = useState(false)

  async function toggleFeature(next: boolean) {
    if (!card?.id) return
    setFeatureSaving(true)
    const prev = allowFeature
    setAllowFeature(next) // optimistic
    const res = await fetch('/api/cards/visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, allow_homepage_feature: next }),
    })
    if (!res.ok) {
      setAllowFeature(prev)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not save')
    } else {
      toast.success(next ? 'Your card may now be featured on the homepage' : 'Your card will no longer be featured')
    }
    setFeatureSaving(false)
  }

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

        {/* Homepage feature opt-in */}
        {card && (
          <div className="pt-2">
            <div className="rounded-xl border border-border p-4 bg-background">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-1">Feature my card on cardtly.com</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When this is on, your card may appear in the rotating &ldquo;Real cards, real people&rdquo; section on the public Cardtly homepage. Eight cards are shown at a time and refresh daily. You can turn this off any time.
                  </p>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowFeature}
                  onClick={() => !featureSaving && toggleFeature(!allowFeature)}
                  disabled={featureSaving}
                  className="relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition disabled:opacity-50"
                  style={{
                    background: allowFeature
                      ? 'linear-gradient(135deg, #00d4ff, #7c3aed)'
                      : 'rgba(120, 120, 120, 0.3)',
                  }}
                >
                  <span
                    className="inline-block h-5 w-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: allowFeature ? 'translateX(22px)' : 'translateX(4px)' }}
                  />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 italic">
                Note: your card is already publicly viewable at its own URL. This setting only controls whether we may include it in our homepage showcase.
              </p>
            </div>
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

      <BiometricSection user={user} supabase={supabase} />
    </div>
  )
}

// Biometric login toggle. Only renders if the device supports biometric
// hardware. Hidden entirely on the web build and on phones without
// fingerprint or face unlock enrolled.
function BiometricSection({ user, supabase }: { user: Props['user']; supabase: any }) {
  const [available, setAvailable] = useState(false)
  const [label, setLabel] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const status = await getBiometricStatus()
      if (cancelled) return
      setAvailable(status.available)
      setLabel(status.label)
      setEnabled(hasBiometricEnabled())
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (!available) return null

  async function handleToggle() {
    setBusy(true)
    try {
      if (enabled) {
        await disableBiometric()
        setEnabled(false)
        toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} sign in disabled`)
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.refresh_token) {
          toast.error('Session not found. Please sign in again.')
          setBusy(false)
          return
        }
        await enableBiometric(user.email, session.refresh_token)
        setEnabled(true)
        toast.success(`Sign in with ${label} next time`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update biometric setting'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-8 border-t border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))' }}>
            <Fingerprint className="w-4 h-4" style={{ color: '#00d4ff' }} />
          </div>
          <div>
            <p className="font-semibold text-sm">Sign in with {label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Use your {label} to sign in without typing your password. Your session token is encrypted and stored only on this device.
            </p>
          </div>
        </div>
        <button onClick={handleToggle} disabled={busy}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${enabled ? '' : 'bg-muted'} disabled:opacity-50`}
          style={enabled ? { background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' } : {}}>
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}

// ── Billing tab ────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  '12 card templates', 'Custom accent colour', 'Custom links and social profiles',
  'Gallery and media', 'Analytics dashboard', 'Email signature generator',
  'Virtual background generator', 'Contact form and leads', 'QR code with your logo',
]

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

// An account is in exactly one of four states, and they used to collapse into
// two. A trial reports tier 'pro' and isActive true - by design, so the trial
// is the real product - which meant this tab told someone on a free trial that
// they had an active subscription "billed in ZAR via Paystack". They had never
// paid, and their card was days from going offline. Comped accounts were told
// the same thing, and an expired account was called a "Free plan" rather than
// what it is: a card that has stopped serving.
function billingState(plan: UserPlan, subscription: Props['subscription']) {
  if (plan.tier === 'expired') return 'expired' as const
  if (plan.isTrial) return 'trial' as const
  if (subscription?.billing_cycle === 'comp') return 'comped' as const
  return 'paid' as const
}

function BillingTab({ plan, subscription }: { plan: UserPlan; subscription: Props['subscription'] }) {
  const state = billingState(plan, subscription)
  const daysLeft = plan.trialDaysLeft ?? 0

  const HEADER = {
    trial:  { badge: 'Trial', title: 'Free trial', tone: daysLeft <= 7 ? '#f59e0b' : '#8b5cf6',
              sub: plan.trialEndsAt ? `Ends ${formatDay(plan.trialEndsAt)}` : 'Every Pro feature included' },
    paid:   { badge: 'Pro', title: 'Pro plan', tone: '#22c55e',
              sub: subscription?.created_at ? `Paying since ${formatDay(subscription.created_at)}` : 'Active' },
    comped: { badge: 'Pro', title: 'Pro, on the house', tone: '#22c55e',
              sub: subscription?.created_at ? `Active since ${formatDay(subscription.created_at)}` : 'Active' },
    expired:{ badge: 'Off', title: 'Your card is offline', tone: '#ef4444',
              sub: 'Your trial has ended, so your card link no longer opens' },
  }[state]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-1">Billing and plan</h2>
        <p className="text-sm text-muted-foreground">Where your account stands right now</p>
      </div>

      {/* Where you stand */}
      <div className="rounded-2xl border p-5" style={{ borderColor: HEADER.tone + '55', background: HEADER.tone + '0f' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl grid place-items-center font-bold text-sm text-white"
              style={{ background: HEADER.tone }}>
              {HEADER.badge}
            </div>
            <div>
              <p className="font-semibold">{HEADER.title}</p>
              <p className="text-xs text-muted-foreground">{HEADER.sub}</p>
            </div>
          </div>
          {state === 'trial' && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: HEADER.tone + '22', color: HEADER.tone }}>
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </span>
          )}
        </div>

        {state === 'trial' && (
          <p className="text-sm text-muted-foreground mt-4">
            You have every Pro feature until then, and you have not been charged anything.
            To keep your card live after your trial, subscribe for R97 a month.
          </p>
        )}
        {state === 'expired' && (
          <p className="text-sm text-muted-foreground mt-4">
            Subscribe for R97 a month and your card goes straight back live on the same link, with nothing lost.
          </p>
        )}
        {state === 'comped' && (
          <p className="text-sm text-muted-foreground mt-4">
            This account is on Cardtly at no charge. There is no subscription and no card on file, so nothing will ever be billed.
          </p>
        )}

        {(state === 'trial' || state === 'expired') && (
          <a href="/dashboard/upgrade"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: HEADER.tone }}>
            {state === 'expired' ? 'Bring my card back' : 'Subscribe now'}
          </a>
        )}
      </div>

      {/* What is included */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {state === 'expired' ? 'What you get back' : "What's included"}
        </p>
        {PRO_FEATURES.map(f => (
          <div key={f} className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            {f}
          </div>
        ))}
      </div>

      {/* Only a real payer is told they are being billed. */}
      {state === 'paid' && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Billed {subscription?.billing_cycle === 'monthly' ? 'monthly' : subscription?.billing_cycle || 'monthly'} in ZAR via Paystack
            {subscription?.seats && subscription.seats > 1 ? `, for ${subscription.seats} seats` : ''}.
            To cancel or change it, get in touch and we&apos;ll sort it out right away.
          </p>
          <a href="/contact"
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

function DangerTab({ user, supabase, router, isPaying }: { user: Props['user']; supabase: any; router: any; isPaying?: boolean }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function deleteAccount() {
    if (confirm !== user.email) {
      toast.error('Email does not match')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Deletion failed')
      }
      await supabase.auth.signOut()
      toast.success('Your account and all associated data have been deleted.')
      router.push('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not delete account. Please try again or email andre@cardtly.com.'
      toast.error(message)
      setDeleting(false)
    }
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

      {/* Deleting the account removes our record of the subscription but does
          not cancel it at Paystack, so an active subscriber who deletes could
          keep being charged for an account that no longer exists. Say so
          before they do it, not after. */}
      {isPaying && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Cancel your subscription first</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deleting your account here does not stop your Paystack subscription, so you could keep
              being charged. <a href="/contact" className="underline hover:text-foreground">Get in touch</a> to
              cancel it, then come back and delete.
            </p>
          </div>
        </div>
      )}

      {/* Delete account */}
      <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-medium text-sm text-destructive">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently deletes your account, your card and everyone who left their details.
              Your card link stops working. This cannot be undone.
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
