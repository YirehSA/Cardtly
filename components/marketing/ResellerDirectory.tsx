'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SA_PROVINCES } from '@/lib/pro-bundle'
import type { PublicReseller } from '@/lib/reseller-listing'
import ResellerListingCard from './ResellerListingCard'

// The listed resellers with a province filter. Only provinces somebody covers
// are offered, so no choice leads to an empty page.

export default function ResellerDirectory({ resellers }: { resellers: PublicReseller[] }) {
  const [province, setProvince] = useState<string>('all')
  const covered = SA_PROVINCES.filter(p => resellers.some(r => r.provinces.includes(p)))
  const shown = province === 'all' ? resellers : resellers.filter(r => r.provinces.includes(province))

  const chip = (value: string, label: string) => {
    const on = province === value
    return (
      <button key={value} type="button" onClick={() => setProvince(value)} aria-pressed={on}
        className="min-h-11 px-4 rounded-full text-sm font-semibold transition"
        style={on
          ? { background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', color: '#fff' }
          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}>
        {label}
      </button>
    )
  }

  return (
    <div>
      {covered.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter by province">
          {chip('all', 'All provinces')}
          {covered.map(p => chip(p, p))}
        </div>
      )}
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(r => <ResellerListingCard key={`${r.level}:${r.name}`} r={r} />)}
        </div>
      ) : (
        <p className="text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
          No reseller lists {province} yet. Try another province, or{' '}
          <Link href="/contact" className="underline hover:text-white">talk to Cardtly directly</Link>.
        </p>
      )}
    </div>
  )
}
