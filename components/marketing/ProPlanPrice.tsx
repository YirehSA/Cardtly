'use client'

import { useState } from 'react'
import UsdEstimate from './UsdEstimate'
import { SEAT_PRICE_RAND } from '@/lib/org-billing'

// Pro price block on the marketing pricing page with a monthly/yearly
// toggle. Display-only - the actual billing choice happens at
// /dashboard/upgrade after signup - but it shows visitors the yearly
// option (R970/yr = 2 months free) exists. USD estimate reacts to the
// toggle for visitors outside the rand zone.

export default function ProPlanPrice() {
  // Prices come from the billing constants, not from literals. Both numbers
  // were typed out here and on the pricing page, so changing what Cardtly
  // costs meant finding eight separate copies of it.
  //
  // DERIVED INSIDE THE COMPONENT, NOT AT MODULE SCOPE. At module scope this
  // threw "SEAT_PRICE_RAND is not defined" during SSR: the imported binding is
  // not initialised yet when a 'use client' module's top level runs through
  // the server bundle. Inside the function it evaluates at render, by which
  // point the import is live. It is three multiplications per render.
  const MONTH = SEAT_PRICE_RAND
  const YEAR = SEAT_PRICE_RAND * 10
  // Ten months for twelve, expressed as the discount the toggle advertises.
  const SAVING_PCT = Math.round((1 - YEAR / (MONTH * 12)) * 100)

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const isYearly = billing === 'yearly'
  const zar = isYearly ? YEAR : MONTH

  return (
    <div className="relative">
      {/* #7c3aed measures 3.5:1 as text on this card and fails AA. The light
          variant is the same brand purple at a readable weight. */}
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>Pro</p>

      {/* Monthly / Yearly toggle — its own row, left-aligned so it
          clears the absolutely-positioned "Most popular" badge. */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} role="group" aria-label="Billing period">
        {/* min-h-11 is the 44px touch minimum, measured on the BUTTON rather
            than the track: min-h-10 made the track 44 but left each button at
            40, and the button is what you tap. These were 24px and 28px. */}
        <button onClick={() => setBilling('monthly')}
          aria-pressed={!isYearly}
          className="px-3.5 min-h-11 rounded-md text-xs font-semibold transition"
          style={!isYearly
            ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
            : { color: 'rgba(255,255,255,0.68)' }}>
          Monthly
        </button>
        <button onClick={() => setBilling('yearly')}
          aria-pressed={isYearly}
          className="px-3.5 min-h-11 rounded-md text-xs font-semibold transition flex items-center gap-1"
          style={isYearly
            ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
            : { color: 'rgba(255,255,255,0.68)' }}>
          Yearly
          <span className="text-[10px] font-bold px-1 py-0.5 rounded"
            style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>-{SAVING_PCT}%</span>
        </button>
      </div>

      <div className="flex items-end gap-2 mb-1">
        <span className="text-5xl font-black">R{isYearly ? YEAR : MONTH}</span>
        {/* The suffix says what you are buying and was the least readable text
            in the block at 3.1:1. */}
        <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {isYearly ? '/ year' : '/ month'}
        </span>
      </div>

      {/* Live USD estimate for visitors outside the rand zone */}
      <UsdEstimate zar={zar} suffix={isYearly ? '/yr' : '/mo'} className="block text-sm font-medium mb-1 text-white/70" />

      {isYearly && (
        <p className="text-xs mb-1" style={{ color: '#34d399' }}>
          That&apos;s about R{Math.round(YEAR / 12)}/month, 2 months free
        </p>
      )}

      <p className="text-sm mb-8 mt-1" style={{ color: 'rgba(255,255,255,0.68)' }}>
        Free for 7 days, then unlock the full Cardtly experience.
      </p>
    </div>
  )
}
