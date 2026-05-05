'use client'

import { useState, useEffect } from 'react'
import { parseDesign, getAccentHex } from '@/types/design'
import { toast } from 'sonner'
import { Package, CreditCard, MapPin, CheckCircle, Loader2, ChevronRight, Wifi } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

interface Card {
  id: string
  name: string
  title: string | null
  company: string | null
  slug: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  color_theme: string | null
}

interface Order {
  id: string
  color: string
  name_on_card: string
  title_on_card: string | null
  status: string
  created_at: string
  shipping_city: string
}

interface TeamCard {
  id: string
  name: string
  title: string | null
  company: string | null
  slug: string | null
}

interface Props {
  card: Card | null
  user: { id: string; email: string }
  previousOrders: Order[]
  teamCards?: TeamCard[]
}

type Color = 'black' | 'white'
type Step = 'design' | 'shipping' | 'confirm'

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_invoice: { label: 'Invoice pending',   color: '#f59e0b' },
  pending_payment: { label: 'Awaiting payment',  color: '#f97316' },
  paid:            { label: 'Order received',    color: '#3b82f6' },
  in_production:   { label: 'In production',     color: '#8b5cf6' },
  shipped:         { label: 'Shipped',           color: '#06b6d4' },
  delivered:       { label: 'Delivered',         color: '#10b981' },
}

export default function NFCOrderPage({ card, user, previousOrders, teamCards = [] }: Props) {
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('status')

  const design = card ? parseDesign(card.color_theme) : null
  const accentHex = design ? getAccentHex(design) : '#3b82f6'

  const [step, setStep] = useState<Step>('design')
  const [color, setColor] = useState<Color>('black')
  const [quantity, setQuantity] = useState(1)
  const [selectedCardId, setSelectedCardId] = useState<string>(card?.id || '')
  const allCards = [
    ...(card ? [{ id: card.id, name: card.name, title: card.title, company: card.company, slug: card.slug }] : []),
    ...teamCards,
  ]
  const selectedCard = allCards.find(c => c.id === selectedCardId) || allCards[0]
  const [nameOnCard, setNameOnCard] = useState(selectedCard?.name || '')
  const [titleOnCard, setTitleOnCard] = useState(selectedCard?.title || '')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (paymentStatus === 'success') toast.success('Payment received! Your NFC card order is confirmed.')
    if (paymentStatus === 'failed') toast.error('Payment failed. Please try again.')
    if (paymentStatus === 'error') toast.error('Something went wrong. Contact support if you were charged.')
  }, [paymentStatus])

  const cardUrl = card?.slug ? `cardtly.com/card/${card.slug}` : 'cardtly.com/card/yourname'

  // ── Card preview (front) ────────────────────────────────────────────────────
  function CardFront() {
    const bg = color === 'black' ? '#050505' : '#ffffff'
    const text = color === 'black' ? '#ffffff' : '#111827'
    const subtext = color === 'black' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'
    return (
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: '100%',
          aspectRatio: '1.586',
          background: bg,
          border: color === 'white' ? '1px solid #e5e7eb' : 'none',
        }}
      >
        {/* NFC chip indicator */}
        <div className="absolute top-4 right-4 opacity-30">
          <Wifi className="w-5 h-5 rotate-90" style={{ color: text }} />
        </div>

        {/* Logo — full colour, no filter */}
        {card?.company_logo_url ? (
          <div className="absolute top-5 left-5">
            <img src={card.company_logo_url}
              style={{ height: 32, width: 'auto', maxWidth: 120, objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="absolute top-5 left-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: accentHex }}>
              C
            </div>
          </div>
        )}

        {/* Name and title — bottom left */}
        <div className="absolute bottom-5 left-5">
          <p className="font-black text-base leading-tight" style={{ color: text }}>
            {nameOnCard || 'Your Name'}
          </p>
          {titleOnCard && (
            <p className="text-xs mt-0.5" style={{ color: accentHex }}>
              {titleOnCard}
            </p>
          )}
        </div>

        {/* Cardtly branding — bottom right */}
        <div className="absolute bottom-5 right-5">
          <p className="text-xs font-bold" style={{ color: subtext }}>Cardtly</p>
        </div>
      </div>
    )
  }

  // ── Card back ──────────────────────────────────────────────────────────────
  function CardBack() {
    const bg = color === 'black' ? '#0a0a0a' : '#ffffff'
    const text = color === 'black' ? '#ffffff' : '#111827'
    const subtext = color === 'black' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://${cardUrl}`)}&bgcolor=${color === 'black' ? '0a0a0a' : 'ffffff'}&color=${color === 'black' ? 'ffffff' : '111827'}&margin=2`

    return (
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center gap-3"
        style={{
          width: '100%',
          aspectRatio: '1.586',
          background: bg,
          border: color === 'white' ? '1px solid #e5e7eb' : 'none',
        }}
      >


        <img src={qrUrl} style={{ width: 100, height: 100, borderRadius: 8 }} alt="QR Code" />
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: text }}>Scan to connect</p>
          <p className="text-xs mt-0.5" style={{ color: subtext }}>{cardUrl}</p>
        </div>
      </div>
    )
  }

  async function handleOrder() {
    setLoading(true)
    try {
      const res = await fetch('/api/nfc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color,
          nameOnCard,
          titleOnCard,
          address,
          city,
          province,
          postal_code: postalCode,
          quantity,
          card_id: selectedCard?.id,
          card_slug: selectedCard?.slug,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      toast.success('Order placed! We will send you an invoice shortly.')
      window.location.reload()
    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Wifi className="w-6 h-6" style={{ color: accentHex }} />
            NFC Business Cards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tap to share. One card. Lasts forever.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: accentHex + '18', color: accentHex }}>
            🇿🇦 South Africa only
          </div>
        </div>
      </div>

      {/* Previous orders */}
      {previousOrders.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold mb-3">Your orders</p>
          <div className="space-y-2">
            {previousOrders.map(order => {
              const s = STATUS_LABELS[order.status] || { label: order.status, color: '#6b7280' }
              return (
                <div key={order.id} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${order.color === 'black' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                      {order.color === 'black' ? '⬛' : '⬜'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{order.name_on_card}</p>
                      <p className="text-xs text-muted-foreground">{order.shipping_city} · {new Date(order.created_at).toLocaleDateString('en-ZA')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: s.color + '18', color: s.color }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left — preview */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card preview</p>

          {/* Colour picker */}
          <div className="flex gap-3 mb-4">
            {(['black', 'white'] as Color[]).map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition ${color === c ? 'border-blue-500' : 'border-border hover:border-foreground/20'}`}>
                <div className={`w-5 h-5 rounded-full border ${c === 'white' ? 'bg-white border-gray-300' : 'bg-gray-950 border-gray-700'}`} />
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          {/* Front */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Front</p>
            <CardFront />
          </div>

          {/* Back */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Back</p>
            <CardBack />
          </div>

          {/* Specs */}
          <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm mb-2">Card specs</p>
            <p>📏 Standard credit card size (85.6 × 54mm)</p>
            <p>📶 NFC chip — tap to open your card on any phone</p>
            <p>🖨️ Premium PVC print — matte or gloss finish</p>
            <p>🚚 Delivered within 5–7 business days</p>
            <p>🇿🇦 Shipped within South Africa only</p>
          </div>
        </div>

        {/* Right — order form */}
        <div className="space-y-6">

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {(['design', 'shipping', 'confirm'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? 'text-white' : steps.indexOf(step) > i ? 'text-white' : 'bg-muted text-muted-foreground'}`}
                  style={step === s || ['design', 'shipping', 'confirm'].indexOf(step) > i ? { background: accentHex } : {}}>
                  {['design', 'shipping', 'confirm'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium capitalize ${step === s ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* Step 1 — Design details */}
          {step === 'design' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold">Card details</h2>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full name (printed on card)</label>
                <input value={nameOnCard} onChange={e => setNameOnCard(e.target.value)}
                  placeholder="Your full name" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Job title (optional)</label>
                <input value={titleOnCard} onChange={e => setTitleOnCard(e.target.value)}
                  placeholder="e.g. Founder & CEO" className={inputClass} />
              </div>
              <div className="p-3 rounded-xl text-xs" style={{ background: accentHex + '10', color: accentHex }}>
                The back of your card will have your QR code linking to{' '}
                <span className="font-bold">{cardUrl}</span>
              </div>
              <button onClick={() => setStep('shipping')} disabled={!nameOnCard}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: accentHex }}>
                Continue to shipping
              </button>
            </div>
          )}

          {/* Step 2 — Shipping */}
          {step === 'shipping' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />Shipping address
              </h2>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Street address</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main Street, Unit 4" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">City / Town</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Johannesburg" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Postal code</label>
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value)}
                    placeholder="2000" className={inputClass} maxLength={4} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Province</label>
                <select value={province} onChange={e => setProvince(e.target.value)} className={inputClass}>
                  <option value="">Select province...</option>
                  {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep('design')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition">
                  Back
                </button>
                <button onClick={() => setStep('confirm')}
                  disabled={!address || !city || !province || !postalCode}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: accentHex }}>
                  Review order
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm & pay */}
          {step === 'confirm' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <h2 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" />Order summary
              </h2>

              {/* Order details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card colour</span>
                  <span className="font-medium capitalize">{color}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name on card</span>
                  <span className="font-medium">{nameOnCard}</span>
                </div>
                {titleOnCard && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job title</span>
                    <span className="font-medium">{titleOnCard}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deliver to</span>
                  <span className="font-medium text-right">{address}, {city}, {province}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity</span>
                  <span>{quantity} card{quantity !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
                  <span>Total</span>
                  <span>Invoice to follow</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('shipping')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition">
                  Back
                </button>
                <button onClick={handleOrder} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: accentHex }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Placing order...</>
                    : 'Place order'}
                </button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                📧 We will send you an invoice · Delivered within 5–7 business days after payment
              </p>
            </div>
          )}

          {/* What you get */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />What you get
            </p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              {[
                'Premium NFC-enabled PVC card',
                'Front: Logo, full name, job title',
                'Back: QR code linking to your Cardtly card',
                'Works with any iPhone or Android — no app needed',
                'Tap once to share your full digital card',
                'One card, unlimited taps — lasts for years',
              ].map(item => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentHex }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const steps: Step[] = ['design', 'shipping', 'confirm']
