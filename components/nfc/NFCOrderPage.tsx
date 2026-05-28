'use client'

import { useState, useEffect } from 'react'
import { parseDesign, getAccentHex } from '@/types/design'
import { toast } from 'sonner'
import { Package, CreditCard, MapPin, CheckCircle, Loader2, ChevronRight, Wifi, Trash2, ChevronDown } from 'lucide-react'
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
  quantity: number
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

// Pricing — ZAR. Card price is fixed at R150 each; shipping is an
// up-front estimate of R100 anywhere in SA (actual depends on
// destination, finalised on the invoice).
const PRICE_PER_CARD = 150
const SHIPPING_ESTIMATE = 100
const formatZAR = (n: number) => 'R' + n.toLocaleString('en-ZA')

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

  // Build the master list of cards available for ordering (personal first, then team)
  const allCards = [
    ...(card ? [{ id: card.id, name: card.name, title: card.title, company: card.company, slug: card.slug, isPersonal: true }] : []),
    ...teamCards.map(tc => ({ ...tc, isPersonal: false })),
  ]

  // Each card gets a "line" record. included=false means it's not part of this order.
  type Line = {
    cardId: string
    name: string
    title: string
    color: Color
    quantity: number
    included: boolean
  }

  const [lines, setLines] = useState<Line[]>(() =>
    allCards.map((c, idx) => ({
      cardId: c.id,
      name: c.name || '',
      title: c.title || '',
      color: 'black',
      quantity: 1,
      included: idx === 0, // default: just the first card (personal)
    }))
  )

  const includedLines = lines.filter(l => l.included)
  const totalQty = includedLines.reduce((s, l) => s + l.quantity, 0)

  function updateLine(cardId: string, patch: Partial<Line>) {
    setLines(ls => ls.map(l => l.cardId === cardId ? { ...l, ...patch } : l))
  }

  function applyColorToAll(c: Color) {
    setLines(ls => ls.map(l => l.included ? { ...l, color: c } : l))
  }

  // Preview the first included line (for the card preview area)
  const previewLine = includedLines[0] || lines[0]
  const previewCard = allCards.find(c => c.id === previewLine?.cardId) || allCards[0]
  const color = previewLine?.color || 'black'
  const nameOnCard = previewLine?.name || ''
  const titleOnCard = previewLine?.title || ''

  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  async function cancelOrderGroup(items: Order[]) {
    if (!confirm(`Cancel this order? This will remove ${items.length} pending line${items.length !== 1 ? 's' : ''}.`)) return
    try {
      await Promise.all(items.map(item =>
        fetch(`/api/nfc/order/${item.id}`, { method: 'DELETE' })
      ))
      toast.success('Order cancelled')
      window.location.reload()
    } catch {
      toast.error('Could not cancel order')
    }
  }

  useEffect(() => {
    if (paymentStatus === 'success') toast.success('Payment received! Your NFC card order is confirmed.')
    if (paymentStatus === 'failed') toast.error('Payment failed. Please try again.')
    if (paymentStatus === 'error') toast.error('Something went wrong. Contact support if you were charged.')
  }, [paymentStatus])

  const cardUrl = previewCard?.slug ? `cardtly.com/card/${previewCard.slug}` : 'cardtly.com/card/yourname'

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
      const cardsPayload = includedLines.map(l => {
        const c = allCards.find(ac => ac.id === l.cardId)
        return {
          card_id: l.cardId,
          card_slug: c?.slug || null,
          color: l.color,
          nameOnCard: l.name,
          titleOnCard: l.title,
          quantity: l.quantity,
        }
      })

      const res = await fetch('/api/nfc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          city,
          province,
          postal_code: postalCode,
          cards: cardsPayload,
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
            {(() => {
              // Group orders that were placed together (same minute, same city)
              const groups: { key: string; items: Order[] }[] = []
              previousOrders.forEach(o => {
                const minute = new Date(o.created_at).toISOString().slice(0, 16)
                const key = minute + '|' + o.shipping_city
                const existing = groups.find(g => g.key === key)
                if (existing) existing.items.push(o)
                else groups.push({ key, items: [o] })
              })

              return groups.map(group => {
                const first = group.items[0]
                const totalCards = group.items.reduce((s, o) => s + (o.quantity || 1), 0)
                const s = STATUS_LABELS[first.status] || { label: first.status, color: '#6b7280' }
                const isPending = first.status === 'pending_invoice'
                const isExpanded = expandedOrderId === group.key
                const summary = group.items.length === 1
                  ? first.name_on_card
                  : group.items.length + ' people · ' + totalCards + ' cards'

                return (
                  <div key={group.key} className="border-b border-border last:border-0">
                    <div className="flex items-center justify-between gap-4 py-2">
                      <button onClick={() => setExpandedOrderId(isExpanded ? null : group.key)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition">
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${first.color === 'black' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                          {first.color === 'black' ? '⬛' : '⬜'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{summary}</p>
                          <p className="text-xs text-muted-foreground">{first.shipping_city} · {new Date(first.created_at).toLocaleDateString('en-ZA')}</p>
                        </div>
                        {group.items.length > 1 && (
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ background: s.color + '18', color: s.color }}>
                          {s.label}
                        </span>
                        {isPending && (
                          <button onClick={() => cancelOrderGroup(group.items)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                            title="Cancel order">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && group.items.length > 1 && (
                      <div className="ml-11 pb-3 space-y-1.5">
                        {group.items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                            <div className={`w-4 h-4 rounded flex-shrink-0 ${item.color === 'black' ? 'bg-gray-900' : 'bg-white border border-gray-300'}`} />
                            <span className="font-medium">{item.name_on_card}</span>
                            {item.title_on_card && <span className="text-muted-foreground">· {item.title_on_card}</span>}
                            <span className="ml-auto text-muted-foreground">x{item.quantity || 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left — preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card preview</p>
            {includedLines.length > 1 && (
              <p className="text-xs text-muted-foreground">Showing {previewCard?.name?.split(' ')[0] || 'first card'} (1 of {includedLines.length})</p>
            )}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold">Who needs an NFC card?</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatZAR(PRICE_PER_CARD)} per card · {formatZAR(SHIPPING_ESTIMATE)} estimated shipping
                  </p>
                </div>
                {includedLines.length > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: accentHex + '18', color: accentHex }}>
                    {includedLines.length} selected · {totalQty} card{totalQty !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {allCards.length > 1 && includedLines.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Apply colour to all:</span>
                  <button onClick={() => applyColorToAll('black')}
                    className="px-2.5 py-1 rounded-md border border-border hover:bg-muted transition flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-950 border border-gray-700" />Black
                  </button>
                  <button onClick={() => applyColorToAll('white')}
                    className="px-2.5 py-1 rounded-md border border-border hover:bg-muted transition flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-white border border-gray-300" />White
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {lines.map(line => {
                  const c = allCards.find(ac => ac.id === line.cardId)
                  if (!c) return null
                  return (
                    <div key={line.cardId} className={`rounded-xl border transition ${line.included ? 'border-blue-500 bg-blue-500/5' : 'border-border'}`}>
                      <label className="flex items-center gap-3 p-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={line.included}
                          onChange={e => updateLine(line.cardId, { included: e.target.checked })}
                          className="w-4 h-4 accent-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {c.isPersonal && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">You</span>
                            )}
                          </div>
                          {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                        </div>
                      </label>

                      {line.included && (
                        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name on card</label>
                              <input value={line.name} onChange={e => updateLine(line.cardId, { name: e.target.value })}
                                placeholder="Full name" className={inputClass + ' text-xs'} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Job title</label>
                              <input value={line.title} onChange={e => updateLine(line.cardId, { title: e.target.value })}
                                placeholder="Optional" className={inputClass + ' text-xs'} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateLine(line.cardId, { color: 'black' })}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition ${line.color === 'black' ? 'border-blue-500' : 'border-border'}`}>
                                <div className="w-3 h-3 rounded-full bg-gray-950 border border-gray-700" />Black
                              </button>
                              <button onClick={() => updateLine(line.cardId, { color: 'white' })}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition ${line.color === 'white' ? 'border-blue-500' : 'border-border'}`}>
                                <div className="w-3 h-3 rounded-full bg-white border border-gray-300" />White
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Qty</span>
                              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                                <button onClick={() => updateLine(line.cardId, { quantity: Math.max(1, line.quantity - 1) })}
                                  className="px-2.5 py-1 text-sm hover:bg-muted transition">−</button>
                                <span className="px-3 text-sm font-medium min-w-[2rem] text-center">{line.quantity}</span>
                                <button onClick={() => updateLine(line.cardId, { quantity: line.quantity + 1 })}
                                  className="px-2.5 py-1 text-sm hover:bg-muted transition">+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {allCards.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No cards available. Create a card first.</p>
              )}

              <div className="p-3 rounded-xl text-xs" style={{ background: accentHex + '10', color: accentHex }}>
                Each card's back will have a QR code linking to that person's Cardtly page.
              </div>

              <button onClick={() => setStep('shipping')}
                disabled={includedLines.length === 0 || includedLines.some(l => !l.name.trim())}
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

              {/* Line items */}
              <div className="space-y-2">
                {includedLines.map(line => {
                  const c = allCards.find(ac => ac.id === line.cardId)
                  return (
                    <div key={line.cardId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${line.color === 'black' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                        {line.color === 'black' ? '⬛' : '⬜'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{line.name}</p>
                        {line.title && <p className="text-xs text-muted-foreground truncate">{line.title}</p>}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">x{line.quantity}</span>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-2 text-sm pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deliver to</span>
                  <span className="font-medium text-right">{address}, {city}, {province}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{totalQty} card{totalQty !== 1 ? 's' : ''} × {formatZAR(PRICE_PER_CARD)}</span>
                  <span>{formatZAR(totalQty * PRICE_PER_CARD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping (estimate)</span>
                  <span>{formatZAR(SHIPPING_ESTIMATE)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
                  <span>Estimated total</span>
                  <span>{formatZAR(totalQty * PRICE_PER_CARD + SHIPPING_ESTIMATE)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  Final shipping cost confirmed on your invoice based on delivery address.
                </p>
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
                📧 We will send you an invoice · Delivered within 5-7 business days after payment
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
