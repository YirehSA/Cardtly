'use client'

import { useState } from 'react'
import UsdEstimate from './UsdEstimate'

// Pro price block on the marketing pricing page with a monthly/yearly
// toggle. Display-only - the actual billing choice happens at
// /dashboard/upgrade after signup - but it shows visitors the yearly
// option (R600/yr = 2 months free) exists. USD estimate reacts to the
// toggle for visitors outside the rand zone.

export default function ProPlanPrice() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const isYearly = billing === 'yearly'
  const zar = isYearly ? 600 : 65

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7c3aed' }}>Pro</p>

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <button onClick={() => setBilling('monthly')}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition"
            style={!isYearly
              ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.5)' }}>
            Monthly
          </button>
          <button onClick={() => setBilling('yearly')}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1"
            style={isYearly
              ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.5)' }}>
            Yearly
            <span className="text-[10px] font-bold px-1 py-0.5 rounded"
              style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>-23%</span>
          </button>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-1">
        <span className="text-5xl font-black">{isYearly ? 'R600' : 'R65'}</span>
        <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {isYearly ? '/ year' : '/ month'}
        </span>
      </div>

      {/* Live USD estimate for visitors outside the rand zone */}
      <UsdEstimate zar={zar} suffix={isYearly ? '/yr' : '/mo'} className="block text-sm font-medium mb-1 text-white/70" />

      {isYearly && (
        <p className="text-xs mb-1" style={{ color: '#34d399' }}>That&apos;s R50/month — 2 months free</p>
      )}

      <p className="text-sm mb-8 mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Unlock the full Cardtly experience.</p>
    </div>
  )
}
