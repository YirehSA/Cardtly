'use client'

import { useState } from 'react'
import PriceEstimate, { RandChargeNote } from './PriceEstimate'
import { PRO_PRICE_RAND, SOLO_PRICE_RAND } from '@/lib/plan-prices'

// A personal plan's price on the marketing pricing page, with a monthly/yearly
// toggle: Cardtly Solo or Pro. Display only: the choice is made on the plan
// page after signing up. Every figure is derived from lib/plan-prices, so a
// price change moves the yearly saving and the currency estimate with it.
//
// Derived inside the component, not at module scope: a 'use client' module's
// top level runs through the server bundle before its imports are live, which
// once threw "not defined" during SSR.

const COPY = {
  solo: { label: 'Solo', colour: '#34d399', note: 'One person, one card. Your QR code and the contacts who share their details back.' },
  pro: { label: 'Pro', colour: '#a78bfa', note: 'Everything Cardtly does, for one person.' },
} as const

export default function PlanPrice({ tier }: { tier: 'solo' | 'pro' }) {
  const prices = tier === 'solo' ? SOLO_PRICE_RAND : PRO_PRICE_RAND
  const MONTH = prices.monthly
  const YEAR = prices.yearly
  const SAVING = MONTH * 12 - YEAR
  const SAVING_PCT = Math.round((SAVING / (MONTH * 12)) * 100)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const isYearly = billing === 'yearly'
  const c = COPY[tier]

  return (
    <div className="relative">
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: c.colour }}>{c.label}</p>

      {/* min-h-11 is the 44px touch minimum, measured on the button. */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} role="group" aria-label="Billing period">
        <button onClick={() => setBilling('monthly')}
          aria-pressed={!isYearly}
          className="px-3.5 min-h-11 rounded-md text-xs font-semibold transition"
          style={!isYearly ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { color: 'rgba(255,255,255,0.68)' }}>
          Monthly
        </button>
        <button onClick={() => setBilling('yearly')}
          aria-pressed={isYearly}
          className="px-3.5 min-h-11 rounded-md text-xs font-semibold transition flex items-center gap-1"
          style={isYearly ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { color: 'rgba(255,255,255,0.68)' }}>
          Yearly
          <span className="text-[10px] font-bold px-1 py-0.5 rounded"
            style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>-{SAVING_PCT}%</span>
        </button>
      </div>

      <div className="flex items-end gap-2 mb-1">
        <span className="text-5xl font-black">R{isYearly ? YEAR : MONTH}</span>
        <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {isYearly ? '/ year' : '/ month'}
        </span>
      </div>

      <PriceEstimate zar={isYearly ? YEAR : MONTH} suffix={isYearly ? '/yr' : '/mo'} className="block text-sm font-medium mb-1 text-white/70" />
      <RandChargeNote className="block text-xs mb-1 text-white/60" />

      {isYearly && (
        <p className="text-xs mb-1" style={{ color: '#34d399' }}>
          That&apos;s about R{Math.round(YEAR / 12)}/month, R{SAVING} less than paying monthly
        </p>
      )}

      <p className="text-sm mb-8 mt-1" style={{ color: 'rgba(255,255,255,0.68)' }}>{c.note}</p>
    </div>
  )
}
