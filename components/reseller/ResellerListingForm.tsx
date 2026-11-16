'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Save } from 'lucide-react'
import { SA_PROVINCES } from '@/lib/pro-bundle'
import { levelFor, levelRank } from '@/lib/reseller-levels'
import {
  BLURB_MAX, LISTING_FROM, LISTING_PATH, LISTING_STATE_TEXT,
  type Listing, type ListingState,
} from '@/lib/reseller-listing'
import ResellerListingCard from '@/components/marketing/ResellerListingCard'

// The reseller's own listing on cardtly.com/find-a-reseller: switch it on,
// fill it in, and see it as the public will. Rules in lib/reseller-listing.

export interface OwnListing { listed: boolean; blocked: boolean; listing: Listing; state: ListingState }

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition'
const label = 'block text-xs font-semibold text-muted-foreground mb-1.5'

const TONE: Record<ListingState, string> = {
  live: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  waiting_level: 'bg-muted border-border text-foreground',
  incomplete: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  inactive: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  off: 'bg-muted border-border text-muted-foreground',
  blocked: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
}

export default function ResellerListingForm({ own, resellerName, cardsSold, onHold, reload }: {
  own: OwnListing | null | undefined
  resellerName: string
  cardsSold: number
  onHold: boolean
  reload: () => void
}) {
  const [listed, setListed] = useState(own?.listed ?? false)
  const [form, setForm] = useState<Listing>(own?.listing ?? { blurb: '', city: '', provinces: [], phone: '', email: '', website: '' })
  const [saving, setSaving] = useState(false)

  if (!own) {
    return <p className="text-sm text-muted-foreground">Your listing on cardtly.com is not switched on yet. Cardtly is setting it up.</p>
  }

  const set = (k: keyof Listing, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleProvince = (p: string) => set('provinces', form.provinces.includes(p)
    ? form.provinces.filter(x => x !== p)
    : SA_PROVINCES.filter(x => x === p || form.provinces.includes(x)))

  // The preview shows the level they will be listed at: their own, or Bronze
  // if they have not reached it yet (Starter is never listed).
  const level = levelFor(cardsSold)
  const shownLevel = levelRank(level.key) < levelRank(LISTING_FROM) ? LISTING_FROM : level.key
  const locked = onHold || own.blocked

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/reseller', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_listing', listed, listing: form }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d?.error) { toast.error(d?.error || 'Could not save your listing'); return }
      toast.success(listed ? 'Listing saved' : 'Listing saved and switched off')
      reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-5">
        <div className={`rounded-xl border px-4 py-3 text-sm ${TONE[own.state]}`}>
          {LISTING_STATE_TEXT[own.state]}
          {own.state === 'live' && (
            <a href={LISTING_PATH} target="_blank" rel="noopener" className="ml-1.5 inline-flex items-center gap-1 underline">
              See it <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={listed} disabled={locked} onChange={e => setListed(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[hsl(var(--accent))]" />
          <span>
            <span className="block text-sm font-semibold">Show my business on cardtly.com</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Listed from Bronze (100 cards sold). Everything on this tab is shown to anyone, with your business name
              ({resellerName}) and your level. Your clients, seats and prices never are.
            </span>
          </span>
        </label>

        <div>
          <label className={label} htmlFor="listing-blurb">What you do (optional)</label>
          <textarea id="listing-blurb" rows={3} maxLength={BLURB_MAX} value={form.blurb} disabled={locked}
            onChange={e => set('blurb', e.target.value)} className={inputClass}
            placeholder="Branding agency in Pretoria. We set up Cardtly cards and NFC cards for your whole team, and look after them." />
          <p className="text-[11px] text-muted-foreground mt-1 text-right tabular-nums">{form.blurb.length}/{BLURB_MAX}</p>
        </div>

        <div>
          <p className={label}>Provinces you work in</p>
          <div className="flex flex-wrap gap-2">
            {SA_PROVINCES.map(p => {
              const on = form.provinces.includes(p)
              return (
                <button key={p} type="button" disabled={locked} onClick={() => toggleProvince(p)} aria-pressed={on}
                  className={`min-h-10 px-3.5 rounded-full text-sm font-medium border transition ${on ? 'text-white border-transparent' : 'border-border text-foreground hover:bg-muted'}`}
                  style={on ? { background: 'hsl(var(--accent))' } : undefined}>
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="listing-city">City or town (optional)</label>
            <input id="listing-city" value={form.city} maxLength={60} disabled={locked} onChange={e => set('city', e.target.value)} className={inputClass} placeholder="Pretoria" />
          </div>
          <div>
            <label className={label} htmlFor="listing-phone">Phone</label>
            <input id="listing-phone" type="tel" value={form.phone} maxLength={30} disabled={locked} onChange={e => set('phone', e.target.value)} className={inputClass} placeholder="012 345 6789" />
          </div>
          <div>
            <label className={label} htmlFor="listing-email">Email</label>
            <input id="listing-email" type="email" value={form.email} maxLength={120} disabled={locked} onChange={e => set('email', e.target.value)} className={inputClass} placeholder="sales@youragency.co.za" />
          </div>
          <div>
            <label className={label} htmlFor="listing-website">Website (optional)</label>
            <input id="listing-website" type="url" value={form.website} maxLength={200} disabled={locked} onChange={e => set('website', e.target.value)} className={inputClass} placeholder="youragency.co.za" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">A phone number or an email address is needed, so people can reach you.</p>

        <button type="button" onClick={save} disabled={saving || locked}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'hsl(var(--accent))' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save listing
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How it looks on cardtly.com</p>
        <div className="rounded-2xl p-4" style={{ background: '#000', color: '#fff' }}>
          <ResellerListingCard r={{ name: resellerName, level: shownLevel, ...form, website: form.website.trim() ? (/^https?:\/\//i.test(form.website.trim()) ? form.website.trim() : `https://${form.website.trim()}`) : '' }} />
        </div>
      </div>
    </div>
  )
}
