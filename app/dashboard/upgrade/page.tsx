'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import UsdEstimate from '@/components/marketing/UsdEstimate'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const PRO_FEATURES = [
  '12 card templates',
  'Custom accent colour and fonts',
  'Bio, title, address, WhatsApp',
  'Up to 14 custom links',
  'Social media profiles',
  'Gallery images (up to 5)',
  'Certifications and awards',
  'Analytics — views, clicks, saves',
  'Email signature generator',
  'Virtual background for Zoom & Teams',
  'Contact form and lead capture',
  'QR code with your own logo',
  'Remove Cardtly branding',
]

export default function UpgradePage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const price = billing === 'monthly' ? 'R97' : 'R970'
  const perMonth = billing === 'monthly' ? 'R97/month' : 'about R81/month'
  const saving = billing === 'yearly' ? 'Save R194, 2 months free' : null

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

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url
    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>
          <Zap className="w-3 h-3" />Upgrade to Pro
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">
          Unlock <span style={gradText}>everything.</span>
        </h1>
        <p className="text-muted-foreground">
          One card. Full power. Cancel anytime.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted w-fit mx-auto">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Monthly
        </button>
        <button
          onClick={() => setBilling('yearly')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Yearly
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            -23%
          </span>
        </button>
      </div>

      {/* Pricing card */}
      <div className="rounded-3xl overflow-hidden border border-border relative"
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.05), rgba(124,58,237,0.08), rgba(236,72,153,0.05))' }}>

        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.12)', transform: 'translate(30%, -30%)' }} />

        <div className="relative p-8">
          {/* Price */}
          <div className="mb-6">
            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-black" style={gradText}>{price}</span>
              <span className="text-muted-foreground pb-1">
                {billing === 'monthly' ? '/ month' : '/ year'}
              </span>
            </div>
            <UsdEstimate zar={billing === 'monthly' ? 65 : 600}
              suffix={billing === 'monthly' ? '/mo' : '/yr'}
              className="block text-sm font-medium text-muted-foreground mb-1" />
            {billing === 'yearly' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">That's {perMonth}, billed annually</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  {saving}
                </span>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                <span className="text-foreground/80">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" />Redirecting to payment...</>
              : <><Zap className="w-5 h-5" />Pay {price} — Upgrade to Pro<ArrowRight className="w-5 h-5" /></>
            }
          </button>

          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>🔒 Secure payment via Paystack</span>
            <span>✓ Cancel anytime</span>
            <span>🇿🇦 ZAR billing</span>
          </div>
        </div>
      </div>

      {/* Already on Pro? */}
      <p className="text-center text-sm text-muted-foreground">
        Already Pro?{' '}
        <a href="/dashboard/settings" className="underline hover:text-foreground transition">
          Manage your subscription
        </a>
      </p>
    </div>
  )
}
