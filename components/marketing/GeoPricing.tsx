import Link from 'next/link'
import { Check, ArrowRight, Zap } from 'lucide-react'
import UsdEstimate from '@/components/marketing/UsdEstimate'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface GeoPricingProps {
  freePlan: string[]
  proPlan: string[]
}

// Everyone is billed in ZAR via Paystack (international cards welcome,
// the bank converts at checkout). No region detection needed - the
// price is the same worldwide.
export default function GeoPricing({ freePlan, proPlan }: GeoPricingProps) {
  const price = 'R65'
  const currency = 'ZAR'
  const payNote = 'Billed monthly via Paystack. Cancel anytime.'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Free */}
      <div className="p-8 rounded-3xl flex flex-col"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Free</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black">R0</span>
            <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ forever</span>
          </div>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Everything you need to get started. No credit card required.</p>
        </div>
        <div className="space-y-3 flex-1">
          {freePlan.map(f => (
            <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
              {f}
            </div>
          ))}
        </div>
        <Link href="/signup"
          className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
          Get started free
        </Link>
      </div>

      {/* Pro */}
      <div className="p-8 rounded-3xl flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.14), rgba(236,72,153,0.08))', border: '1px solid rgba(124,58,237,0.35)' }}>
        <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <Zap className="w-3 h-3" />Most popular
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.2)', transform: 'translate(20%, -20%)' }} />

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>Pro</p>

          {/* Price — same in ZAR worldwide */}
          <div className="flex items-end gap-2 mb-1">
            <span className="text-5xl font-black" style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {price}
            </span>
            <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ month</span>
          </div>
          <UsdEstimate zar={65} suffix="/mo" className="block text-sm font-medium mb-1 text-white/70" />
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{currency} · {payNote}</p>
          <p className="text-sm mb-8 mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Unlock the full Cardtly experience.</p>
        </div>

        <div className="relative space-y-3 flex-1">
          {proPlan.map(f => (
            <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
              {f}
            </div>
          ))}
        </div>

        <Link href="/signup"
          className="relative mt-8 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: grad, boxShadow: '0 6px 30px rgba(124,58,237,0.4)' }}>
          Upgrade to Pro <ArrowRight className="w-4 h-4 inline ml-1" />
        </Link>
      </div>
    </div>
  )
}
