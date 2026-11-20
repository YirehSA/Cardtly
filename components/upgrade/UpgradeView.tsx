'use client'

import { useState } from 'react'
import { Check, Zap, ArrowRight, Loader2, ShieldCheck, Clock, AlertCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import { useIosApp } from '@/components/dashboard/PlatformProvider'
import PriceEstimate, { RandChargeNote } from '@/components/marketing/PriceEstimate'
import TrialCodeBox from './TrialCodeBox'
import BundleCheckout from './BundleCheckout'
import { BUNDLE_PRICE_RAND, bundleRenewalRand } from '@/lib/pro-bundle'
import {
  PRO_PRICE_RAND, SOLO_PRICE_RAND, SOLO_MAX_IMAGES, SOLO_MAX_LINKS, SOLO_TEMPLATES,
  yearlySavingRand, type BillingCycle, type PaidTier,
} from '@/lib/solo'

const grad = 'hsl(var(--accent))'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// THE TWO PLANS, side by side (Andre, 2026-11-20: people choose between Solo
// and Pro). Every figure comes from lib/solo, so a price change moves the
// saving, the per-month figure and the currency estimate with it.
//
// Only things each plan can actually do (lib/solo has Solo's limits).
const SOLO_FEATURES = [
  `${SOLO_TEMPLATES.length} card templates`,
  'Your photo, logo, bio and job title',
  'Phone, email, WhatsApp, address and website',
  'Your social media profiles',
  `Up to ${SOLO_MAX_LINKS} link buttons`,
  `Up to ${SOLO_MAX_IMAGES} gallery photos`,
  'Your QR code, ready to share or print',
  'Contacts: people who share their details back',
  'Works with Cardtly NFC cards',
]

const PRO_FEATURES = [
  'All 16 card templates',
  'Up to 10 link buttons and 10 gallery photos',
  'Lead capture: contact form and your own questions',
  'Book a meeting, straight from your card',
  'Analytics: opens, taps and leads',
  'Email signature generator',
  'Virtual background for Zoom and Teams',
  'Scan paper business cards into contacts',
  'QR code with your own logo',
  'No Cardtly badge on your card',
]

const PLANS: Record<PaidTier, { name: string; tagline: string; prices: { monthly: number; yearly: number }; features: string[] }> = {
  solo: { name: 'Solo', tagline: 'Your own digital card, done properly.', prices: SOLO_PRICE_RAND, features: SOLO_FEATURES },
  pro: { name: 'Pro', tagline: 'Everything in Solo, and the tools that win you work.', prices: PRO_PRICE_RAND, features: PRO_FEATURES },
}

const percentOff = (tier: PaidTier) => Math.round((yearlySavingRand(tier) / (PLANS[tier].prices.monthly * 12)) * 100)
const BEST_PERCENT = Math.max(percentOff('solo'), percentOff('pro'))

interface Props {
  state: 'trial' | 'expired' | 'paid' | 'past_due'
  trialDaysLeft: number
  /** past_due only: days of the payment grace window left. */
  graceDaysLeft?: number
  /** The person's own card, to fill in the name and title for the NFC card. */
  card?: { name: string | null; title: string | null } | null
  /** Arrived from /dashboard/upgrade/bundle: show the bundle form open. */
  openBundle?: boolean
  /** The plan they are on now (paid or past due); null on a trial or expired. */
  currentTier?: PaidTier | null
  /** Both Solo plans exist in Paystack (lib/paid-plans soloOnSale). */
  soloAvailable?: boolean
}

export default function UpgradeView({ state, trialDaysLeft, graceDaysLeft = 0, card = null, openBundle = false, currentTier = null, soloAvailable = false }: Props) {
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [loading, setLoading] = useState<PaidTier | null>(null)
  const [bundleOpen, setBundleOpen] = useState(openBundle)
  // Never in the iOS app, which sells nothing (Guideline 3.1.1). UpgradeScreen
  // already sends the app away; this is the second lock.
  const iosApp = useIosApp()

  const onPro = state === 'paid' && currentTier === 'pro'
  if (iosApp) return null
  const onSolo = state === 'paid' && currentTier === 'solo'

  async function handleCheckout(tier: PaidTier) {
    setLoading(tier)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing, tier }),
      })
      const data = await res.json()
      if (!res.ok || !data.authorization_url) {
        toast.error(data.error || 'Something went wrong. Please try again.')
        setLoading(null)
        return
      }
      window.location.href = data.authorization_url
    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Where this person actually stands. */}
      {state === 'expired' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Your card is offline right now</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a plan below and it is back on the same link, with everything exactly as you left it.
            </p>
          </div>
        </div>
      )}
      {/* The payment-failed banner sends people here. Paying starts the
          subscription again today; the Paystack webhook then cancels the one
          that failed, so the customer is never charged twice. */}
      {state === 'past_due' && (
        <div className="rounded-lg border p-4 flex items-start gap-3"
          style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
          <div>
            <p className="font-semibold text-sm">Your last payment did not go through</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your card is still live for another {graceDaysLeft} {graceDaysLeft === 1 ? 'day' : 'days'}.
              Paying below starts your subscription again today, on the same link. Your previous
              subscription is cancelled once this payment goes through, so you are never charged twice.
            </p>
          </div>
        </div>
      )}
      {/* During a trial only: a code cannot be redeemed once it has ended. */}
      {state === 'trial' && <TrialCodeBox />}

      {state === 'trial' && (
        <div className="rounded-lg border p-4 flex items-start gap-3"
          style={trialDaysLeft <= 7
            ? { borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }
            : { borderColor: 'rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.08)' }}>
          <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: trialDaysLeft <= 7 ? '#f59e0b' : '#8b5cf6' }} />
          <div>
            <p className="font-semibold text-sm">
              {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your free trial
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a plan before it ends and nothing changes: your card stays live on the same link.
            </p>
          </div>
        </div>
      )}
      {(onPro || onSolo) && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 flex items-start gap-3">
          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">You are on {onPro ? 'Pro' : 'Solo'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {onPro ? 'Nothing to do here. ' : 'Upgrade to Pro below whenever you want more. '}
              <a href="/dashboard/settings" className="underline hover:text-foreground">Manage your subscription</a>{' '}
              in settings.
            </p>
          </div>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Choose your <span style={gradText}>plan</span>
        </h1>
        <p className="text-muted-foreground">
          One person, one card. Pay monthly or yearly, cancel whenever you like.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-muted w-fit mx-auto">
        <button onClick={() => setBilling('monthly')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Monthly
        </button>
        <button onClick={() => setBilling('yearly')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Yearly
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            Save up to {BEST_PERCENT}%
          </span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        {(['solo', 'pro'] as const).map(tier => {
          const p = PLANS[tier]
          const amount = p.prices[billing]
          const price = `R${amount}`
          const highlight = tier === 'pro'
          const mine = (tier === 'pro' && onPro) || (tier === 'solo' && onSolo)
          // Never two personal plans billing at once (the server refuses it
          // too): Solo waits until a Pro plan has ended.
          const blockedByPro = tier === 'solo' && onPro
          const unavailable = tier === 'solo' && !soloAvailable
          return (
            <div key={tier} className={`rounded-xl overflow-hidden border relative h-full ${highlight ? 'border-transparent' : 'border-border'}`}
              style={highlight
                ? { background: 'linear-gradient(135deg, rgba(0,212,255,0.05), hsl(var(--accent) / 0.08), rgba(236,72,153,0.05))', boxShadow: '0 0 0 2px hsl(var(--accent) / 0.55)' }
                : { background: 'hsl(var(--card))' }}>
              <div className="relative p-6 sm:p-7 flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                    {tier === 'pro' ? <Zap className="w-4 h-4" style={{ color: '#7c3aed' }} /> : <User className="w-4 h-4 text-muted-foreground" />}
                    Cardtly {p.name}
                  </span>
                  {highlight && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: grad }}>Everything</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{p.tagline}</p>

                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-bold" style={highlight ? gradText : undefined}>{price}</span>
                  <span className="text-muted-foreground pb-1">{billing === 'monthly' ? '/ month' : '/ year'}</span>
                </div>
                <PriceEstimate zar={amount} suffix={billing === 'monthly' ? '/mo' : '/yr'}
                  className="block text-sm font-medium text-muted-foreground mb-1" />
                {billing === 'yearly' && (
                  <p className="text-xs text-muted-foreground">
                    About R{Math.round(amount / 12)} a month, paid once a year.{' '}
                    <span className="font-bold" style={{ color: '#10b981' }}>Save R{yearlySavingRand(tier)}</span>
                  </p>
                )}

                <div className="space-y-2 my-6 flex-1">
                  {tier === 'pro' && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Everything in Solo, plus</p>}
                  {p.features.map(f => (
                    <div key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: highlight ? '#7c3aed' : '#10b981' }} />
                      <span className="text-foreground/80">{f}</span>
                    </div>
                  ))}
                </div>

                {mine ? (
                  <div className="rounded-lg border border-border py-3 text-center text-sm font-semibold text-muted-foreground">Your plan</div>
                ) : blockedByPro ? (
                  <p className="text-xs text-muted-foreground">
                    You are on Pro. To move to Solo, cancel Pro under Settings, then choose Solo once your paid Pro period ends.
                  </p>
                ) : unavailable ? (
                  <div className="rounded-lg border border-dashed border-border py-3 text-center text-sm font-semibold text-muted-foreground">Coming soon</div>
                ) : (
                  <>
                    {/* THE TERMS OF THE RECURRING CHARGE, next to the button that
                        agrees to them: amount, currency, how often, how to
                        cancel, and the merchant's country (card scheme rules). */}
                    <div className="rounded-lg border border-border bg-muted/40 p-3 mb-3 text-xs text-muted-foreground space-y-1">
                      <p>
                        You pay <strong className="text-foreground">{price} now</strong>, then {price} every{' '}
                        {billing === 'monthly' ? 'month' : 'year'} until you cancel, charged in South African rand (ZAR).{' '}
                        <RandChargeNote currencyStated />
                      </p>
                      <p>Cancel any time from Billing in your settings. You are not charged again, and your card stays live until the end of the period you have paid for.</p>
                      {tier === 'pro' && onSolo && (
                        <p>Your Solo subscription stops when Pro starts, so you are never charged for both.</p>
                      )}
                      <p>Sold by Cardtly (Pty) Ltd, a South African company.</p>
                    </div>
                    <button onClick={() => handleCheckout(tier)} disabled={loading !== null}
                      className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-bold transition hover:opacity-90 disabled:opacity-60 ${highlight ? 'text-white' : 'border border-border hover:bg-muted'}`}
                      style={highlight ? { background: grad, boxShadow: '0 8px 32px hsl(var(--accent) / 0.35)' } : undefined}>
                      {loading === tier
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Taking you to payment...</>
                        : <>{state === 'expired' ? `Pay ${price} · Bring my card back`
                            : state === 'past_due' ? `Pay ${price} · Keep my card live`
                            : tier === 'pro' && onSolo ? `Pay ${price} · Upgrade to Pro`
                            : `Pay ${price} · Choose ${p.name}`}
                          <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Paid securely through Paystack</span>
        <span>Cancel whenever</span>
        <span>Your card keeps its link if you change plan</span>
      </div>

      {/* The Pro year + NFC card bundle. Not offered to someone already
          paying: a second subscription would bill them twice (the server
          refuses it too, in lib/pro-bundle-server). */}
      {state !== 'paid' && (
        <div id="bundle" className="rounded-xl border border-border scroll-mt-24"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.04), rgba(236,72,153,0.04))' }}>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>
                  Pro for a year + NFC card
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">R{BUNDLE_PRICE_RAND}</span>
                  <span className="text-muted-foreground pb-1">today</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  12 months of Pro and a printed NFC card in either design, delivered to you. The card
                  and delivery are included. Then R{bundleRenewalRand()} a year, cancel whenever.
                </p>
              </div>
              {!bundleOpen && (
                <button onClick={() => setBundleOpen(true)}
                  className="flex items-center gap-2 px-5 min-h-11 rounded-lg text-sm font-semibold border border-border hover:bg-muted transition">
                  Choose this <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {bundleOpen && (
              <div className="mt-6">
                <BundleCheckout
                  defaultName={card?.name || ''}
                  defaultTitle={card?.title || ''}
                  ctaPrefix={state === 'expired' ? 'Bring my card back' : state === 'past_due' ? 'Keep my card live' : undefined} />
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already paying?{' '}
        <a href="/dashboard/settings" className="underline hover:text-foreground transition">
          Manage your subscription
        </a>
      </p>
    </div>
  )
}
