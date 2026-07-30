'use client'

import { useState } from 'react'
import { Check, Zap, ArrowRight, Loader2, ShieldCheck, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import UsdEstimate from '@/components/marketing/UsdEstimate'
import TrialCodeBox from './TrialCodeBox'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// The one place the price lives. Everything shown - the per-month figure, the
// saving, the percentage, the dollar estimate - is derived from these, because
// last time the price moved the discount badge and the dollar estimate were
// left behind on the old numbers and quietly understated the price by a third.
const MONTHLY = 97
const YEARLY = 970
const YEAR_OF_MONTHLY = MONTHLY * 12
const YEARLY_SAVING = YEAR_OF_MONTHLY - YEARLY
const YEARLY_PERCENT = Math.round((YEARLY_SAVING / YEAR_OF_MONTHLY) * 100)
const MONTHS_FREE = Math.round(YEARLY_SAVING / MONTHLY)
const YEARLY_PER_MONTH = Math.round(YEARLY / 12)

// Only things a Pro account can actually do. "Up to 14 custom links" was on
// this list while the editor has only ever offered five, and the gallery was
// undersold at five when it takes six.
const PRO_FEATURES = [
  '12 card templates',
  'Your own colours and fonts',
  'Bio, job title, address and WhatsApp',
  'Up to 5 custom link buttons',
  'Your social media profiles',
  'Up to 6 gallery photos',
  'Certifications and awards',
  'Analytics - opens, taps and leads',
  'Email signature generator',
  'Virtual background for Zoom and Teams',
  'Contact form and lead capture',
  'QR code with your own logo',
  'No Cardtly badge on your card',
]

interface Props {
  state: 'trial' | 'expired' | 'paid'
  trialDaysLeft: number
}

export default function UpgradeView({ state, trialDaysLeft }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)

  const price = billing === 'monthly' ? `R${MONTHLY}` : `R${YEARLY}`

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing }),
      })
      const data = await res.json()
      if (!res.ok || !data.authorization_url) {
        toast.error(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.authorization_url
    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Where this person actually stands. The page used to say the same
          thing to someone on day 2 of a trial, someone whose card had gone
          offline, and someone already paying. */}
      {state === 'expired' && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Your card is offline right now</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your trial has ended, so your link no longer opens for anyone. Subscribing puts it back
              on the same link, with everything exactly as you left it.
            </p>
          </div>
        </div>
      )}
      {state !== 'paid' && <TrialCodeBox />}

      {state === 'trial' && (
        <div className="rounded-2xl border p-4 flex items-start gap-3"
          style={trialDaysLeft <= 7
            ? { borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }
            : { borderColor: 'rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.08)' }}>
          <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: trialDaysLeft <= 7 ? '#f59e0b' : '#8b5cf6' }} />
          <div>
            <p className="font-semibold text-sm">
              {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your free trial
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You already have everything below, and you have not been charged. Subscribe before it
              ends and nothing changes - your card stays live on the same link.
            </p>
          </div>
        </div>
      )}
      {state === 'paid' && (
        <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4 flex items-start gap-3">
          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">You are already on Pro</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nothing to do here.{' '}
              <a href="/dashboard/settings" className="underline hover:text-foreground">Manage your subscription</a>{' '}
              in settings.
            </p>
          </div>
        </div>
      )}

      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>
          <Zap className="w-3 h-3" />Cardtly Pro
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">
          One card. <span style={gradText}>Everything on.</span>
        </h1>
        <p className="text-muted-foreground">
          Every feature, one price, cancel whenever you like.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-1 p-1 rounded-2xl bg-muted w-fit mx-auto">
        <button onClick={() => setBilling('monthly')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Monthly
        </button>
        <button onClick={() => setBilling('yearly')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Yearly
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            -{YEARLY_PERCENT}%
          </span>
        </button>
      </div>

      {/* Pricing card */}
      <div className="rounded-3xl overflow-hidden border border-border relative"
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.05), rgba(124,58,237,0.08), rgba(236,72,153,0.05))' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.12)', transform: 'translate(30%, -30%)' }} />

        <div className="relative p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-black" style={gradText}>{price}</span>
              <span className="text-muted-foreground pb-1">{billing === 'monthly' ? '/ month' : '/ year'}</span>
            </div>
            {/* Derived from the real price, not a copy of it left behind. */}
            <UsdEstimate zar={billing === 'monthly' ? MONTHLY : YEARLY}
              suffix={billing === 'monthly' ? '/mo' : '/yr'}
              className="block text-sm font-medium text-muted-foreground mb-1" />
            {billing === 'yearly' && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  That&apos;s about R{YEARLY_PER_MONTH} a month, paid once a year
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  Save R{YEARLY_SAVING} - {MONTHS_FREE} months free
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                <span className="text-foreground/80">{f}</span>
              </div>
            ))}
          </div>

          <button onClick={handleCheckout} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" />Taking you to payment...</>
              : <><Zap className="w-5 h-5" />
                  {state === 'expired' ? `Pay ${price} - bring my card back` : `Pay ${price} - go Pro`}
                  <ArrowRight className="w-5 h-5" /></>
            }
          </button>

          <div className="mt-4 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Paid securely through Paystack</span>
            <span>Cancel whenever</span>
            <span>Billed in rand</span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already paying?{' '}
        <a href="/dashboard/settings" className="underline hover:text-foreground transition">
          Manage your subscription
        </a>
      </p>
    </div>
  )
}
