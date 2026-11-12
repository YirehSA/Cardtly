'use client'

import { useState } from 'react'
import { ArrowRight, Loader2, ShieldCheck, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import PriceEstimate, { RandChargeNote } from '@/components/marketing/PriceEstimate'
import { NFC_TIER_LIST, formatZAR, type NfcTier } from '@/lib/nfc-pricing'
import {
  BUNDLE_COLOURS, BUNDLE_PRICE_RAND, SA_PROVINCES, bundleRenewalRand, bundleSavingRand,
  bundleSeparateRand, parseBundleOrder, type BundleColour,
} from '@/lib/pro-bundle'

// The Pro year + NFC card bundle: the card and delivery details, the terms of
// the charge and the renewal, and the button that agrees to them. The details
// are checked here with the same function the server uses, so a mistake is
// shown before Paystack rather than after it.

const grad = 'hsl(var(--accent))'

const field = 'w-full h-11 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]'
const label = 'block text-xs font-semibold text-muted-foreground mb-1.5'

export default function BundleCheckout({ defaultName, defaultTitle, ctaPrefix }: {
  defaultName: string
  defaultTitle: string
  /** "Bring my card back" and the like, matching the plan button. */
  ctaPrefix?: string
}) {
  const [tier, setTier] = useState<NfcTier>('standard')
  const [colour, setColour] = useState<BundleColour>('black')
  const [nameOnCard, setNameOnCard] = useState(defaultName)
  const [titleOnCard, setTitleOnCard] = useState(defaultTitle)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const renewal = bundleRenewalRand()

  async function pay() {
    const body = { tier, colour, nameOnCard, titleOnCard, address, city, province, postalCode }
    const checked = parseBundleOrder(body)
    if (!checked.ok) { setError(checked.error); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/paystack/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.authorization_url) {
        setError(data.error || 'Something went wrong. Please try again.')
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
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold mb-2">Card design</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Card design">
          {NFC_TIER_LIST.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={tier === t.id}
              onClick={() => setTier(t.id)}
              className={`text-left p-3.5 rounded-lg border transition ${tier === t.id ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)]' : 'border-border hover:bg-muted/50'}`}>
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t.summary}</span>
              <span className="block text-xs font-semibold mt-1.5" style={{ color: '#10b981' }}>Included</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Card colour</p>
        <div className="inline-flex gap-1 p-1 rounded-lg bg-muted" role="radiogroup" aria-label="Card colour">
          {BUNDLE_COLOURS.map(c => (
            <button key={c} type="button" role="radio" aria-checked={colour === c}
              onClick={() => setColour(c)}
              className={`px-4 min-h-11 rounded-md text-sm font-semibold capitalize transition ${colour === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="b-name" className={label}>Name on the card</label>
          <input id="b-name" className={field} value={nameOnCard} maxLength={60}
            onChange={e => setNameOnCard(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="b-title" className={label}>Job title (optional)</label>
          <input id="b-title" className={field} value={titleOnCard} maxLength={80}
            onChange={e => setTitleOnCard(e.target.value)} autoComplete="organization-title" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Deliver to</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="b-address" className={label}>Street address</label>
            <input id="b-address" className={field} value={address} maxLength={200}
              onChange={e => setAddress(e.target.value)} autoComplete="street-address" />
          </div>
          <div>
            <label htmlFor="b-city" className={label}>City or town</label>
            <input id="b-city" className={field} value={city} maxLength={80}
              onChange={e => setCity(e.target.value)} autoComplete="address-level2" />
          </div>
          <div>
            <label htmlFor="b-province" className={label}>Province</label>
            <select id="b-province" className={field} value={province}
              onChange={e => setProvince(e.target.value)} autoComplete="address-level1">
              <option value="">Choose</option>
              {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-postal" className={label}>Postal code</label>
            <input id="b-postal" className={field} value={postalCode} maxLength={4} inputMode="numeric"
              onChange={e => setPostalCode(e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Delivery within South Africa only.</p>
      </div>

      {/* The terms of the charge and of the renewal, next to the button that
          agrees to them, as on the plan checkout above: the amount, the
          currency, how often, and how to cancel. */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1.5">
        <p>
          You pay <strong className="text-foreground">R{BUNDLE_PRICE_RAND} now</strong> for 12 months of Pro and
          one NFC card, printed and delivered. In 12 months your subscription renews at R{renewal} a year
          until you cancel, charged in South African rand (ZAR) to the card you pay with today.{' '}
          <RandChargeNote currencyStated />
        </p>
        <p>
          Cancel any time from Billing in your settings. You are not charged again, and your card stays live
          until the end of the year you have paid for.
        </p>
        <p>
          We send you a proof of the card before anything is printed, and deliver within 5 to 7 business days
          of your approval.
        </p>
        <p className="text-xs">Sold by Cardtly (Pty) Ltd, a South African company.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-500">{error}</p>
      )}

      <button onClick={pay} disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-lg text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: grad, boxShadow: '0 8px 32px hsl(var(--accent) / 0.35)' }}>
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />Taking you to payment...</>
          : <><CreditCard className="w-5 h-5" />
              Pay R{BUNDLE_PRICE_RAND}{ctaPrefix ? ` · ${ctaPrefix}` : ' · Pro and my NFC card'}
              <ArrowRight className="w-5 h-5" /></>}
      </button>

      <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Paid securely through Paystack</span>
        <span>Bought separately {formatZAR(bundleSeparateRand('standard'))}, you save R{bundleSavingRand()} or more</span>
      </div>
      <PriceEstimate zar={BUNDLE_PRICE_RAND} className="block text-center text-xs text-muted-foreground" />
    </div>
  )
}
