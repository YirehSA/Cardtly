import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import UsdEstimate from '@/components/marketing/UsdEstimate'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface GeoPricingProps {
  plan: string[]
}

// One plan, one price. This used to be a Free (R0 / forever) vs Pro
// comparison, which stopped being true when the free tier was dropped
// at R97 a card a month.
//
// Everyone is billed in ZAR via Paystack (international cards welcome,
// the bank converts at checkout). No region detection needed, the price
// is the same worldwide. /pricing is the canonical page; this is the
// short version for people reading how-it-works, so it links there
// rather than restating Teams and Enterprise.
export default function GeoPricing({ plan }: GeoPricingProps) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="p-8 rounded-3xl flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.14), rgba(236,72,153,0.08))', border: '1px solid rgba(124,58,237,0.35)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.2)', transform: 'translate(20%, -20%)' }} />

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>Pro</p>

          <div className="flex items-end gap-2 mb-1">
            <span className="text-5xl font-black" style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              R97
            </span>
            <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ month</span>
          </div>
          <UsdEstimate zar={97} suffix="/mo" className="block text-sm font-medium mb-1 text-white/70" />
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>ZAR · Billed monthly via Paystack. Cancel anytime.</p>
          <p className="text-sm mb-8 mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Free trial on request. Cancel anytime.
          </p>
        </div>

        <div className="relative space-y-3 flex-1">
          {plan.map(f => (
            <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
              {f}
            </div>
          ))}
        </div>

        <Link href="/signup"
          className="relative mt-8 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: grad, boxShadow: '0 6px 30px rgba(124,58,237,0.4)' }}>
          Sign up <ArrowRight className="w-4 h-4 inline ml-1" />
        </Link>
        <Link href="/pricing"
          className="relative mt-3 block text-center py-3 rounded-xl text-sm font-semibold transition hover:bg-white/10"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
          Teams and Enterprise pricing
        </Link>
      </div>
    </div>
  )
}
