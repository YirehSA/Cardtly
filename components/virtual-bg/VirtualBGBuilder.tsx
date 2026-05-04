'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { parseDesign, getAccentHex } from '@/types/design'
import { Download, Upload, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Card {
  id: string
  name: string
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  color_theme: string | null
  slug: string
}

type BGDesign = 'gradient' | 'dark' | 'mesh' | 'split' | 'minimal' | 'neon'
type StockImage = 'office' | 'sea' | 'mountain' | 'city'

// Unsplash stock photos — free to use, 1920x1080
const STOCK_IMAGES: { id: StockImage; label: string; desc: string; url: string }[] = [
  {
    id: 'office',
    label: 'Modern Office',
    desc: 'Clean workspace view',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop&q=80',
  },
  {
    id: 'sea',
    label: 'Ocean View',
    desc: 'Calm coastal horizon',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&q=80',
  },
  {
    id: 'mountain',
    label: 'Mountain Ridge',
    desc: 'Dramatic peak landscape',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop&q=80',
  },
  {
    id: 'city',
    label: 'City Skyline',
    desc: 'Urban evening view',
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&h=1080&fit=crop&q=80',
  },
]

const BG_DESIGNS: { id: BGDesign; label: string; desc: string }[] = [
  { id: 'gradient', label: 'Gradient', desc: 'Smooth colour fade' },
  { id: 'dark',     label: 'Corporate', desc: 'Dark professional' },
  { id: 'mesh',     label: 'Mesh',      desc: 'Gradient mesh pattern' },
  { id: 'split',    label: 'Split',     desc: 'Two-tone panel' },
  { id: 'minimal',  label: 'Minimal',   desc: 'Clean light background' },
  { id: 'neon',     label: 'Neon',      desc: 'Glowing dark theme' },
]

interface Props {
  cards: Card[]
  defaultCardId: string
}

export default function VirtualBGBuilder({ cards, defaultCardId }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string>(defaultCardId)
  const card = cards.find(c => c.id === selectedCardId) || cards[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const design = parseDesign(card.color_theme)
  const accentHex = getAccentHex(design)

  const [bgDesign, setBgDesign] = useState<BGDesign>('gradient')
  const [stockImage, setStockImage] = useState<StockImage | null>(null)
  const [showName, setShowName] = useState(true)
  const [showLogo, setShowLogo] = useState(!!card.company_logo_url)
  const [showQR, setShowQR] = useState(true)
  const [customBg, setCustomBg] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)

  const cardUrl = `https://cardtly.com/card/${card.slug}`

  // Parse accent hex to RGB components
  function hexToRGB(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return { r, g, b }
  }

  const rgb = hexToRGB(accentHex)

  // ── Draw background ───────────────────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (customBg) return // handled separately

    switch (bgDesign) {
      case 'gradient': {
        const grad = ctx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, `rgb(${rgb.r},${rgb.g},${rgb.b})`)
        grad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.7)`)
        grad.addColorStop(1, '#0f172a')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
        // Subtle grid overlay
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
        for (let y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
        break
      }
      case 'dark': {
        ctx.fillStyle = '#0a0a0f'
        ctx.fillRect(0, 0, w, h)
        // Accent bar on left
        const bar = ctx.createLinearGradient(0, 0, 0, h)
        bar.addColorStop(0, accentHex)
        bar.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`)
        ctx.fillStyle = bar
        ctx.fillRect(0, 0, 8, h)
        // Subtle dots
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        for (let x = 40; x < w; x += 40) {
          for (let y = 40; y < h; y += 40) {
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
          }
        }
        break
      }
      case 'mesh': {
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, w, h)
        // Mesh gradient circles
        const circles = [
          { x: 0.2, y: 0.2, r: 0.4, opacity: 0.5 },
          { x: 0.8, y: 0.3, r: 0.35, opacity: 0.4 },
          { x: 0.5, y: 0.8, r: 0.45, opacity: 0.35 },
          { x: 0.1, y: 0.8, r: 0.3, opacity: 0.25 },
        ]
        circles.forEach(c => {
          const radGrad = ctx.createRadialGradient(c.x * w, c.y * h, 0, c.x * w, c.y * h, c.r * w)
          radGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${c.opacity})`)
          radGrad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = radGrad
          ctx.fillRect(0, 0, w, h)
        })
        break
      }
      case 'split': {
        // Left panel — accent
        const leftGrad = ctx.createLinearGradient(0, 0, w * 0.42, 0)
        leftGrad.addColorStop(0, accentHex)
        leftGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.8)`)
        ctx.fillStyle = leftGrad
        ctx.fillRect(0, 0, w * 0.42, h)
        // Right panel — dark
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(w * 0.42, 0, w * 0.58, h)
        // Diagonal slice
        ctx.fillStyle = accentHex
        ctx.beginPath()
        ctx.moveTo(w * 0.42, 0)
        ctx.lineTo(w * 0.50, 0)
        ctx.lineTo(w * 0.40, h)
        ctx.lineTo(w * 0.32, h)
        ctx.closePath()
        ctx.fill()
        // Subtle lines on right
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        for (let y = 0; y < h; y += 48) {
          ctx.beginPath(); ctx.moveTo(w * 0.42, y); ctx.lineTo(w, y); ctx.stroke()
        }
        break
      }
      case 'minimal': {
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, w, h)
        // Bottom accent stripe
        ctx.fillStyle = accentHex
        ctx.fillRect(0, h - 6, w, 6)
        // Very subtle grid
        ctx.strokeStyle = 'rgba(0,0,0,0.04)'
        ctx.lineWidth = 1
        for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
        for (let y = 0; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
        break
      }
      case 'neon': {
        ctx.fillStyle = '#050510'
        ctx.fillRect(0, 0, w, h)
        // Glow circles
        const glow1 = ctx.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, w * 0.4)
        glow1.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`)
        glow1.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow1
        ctx.fillRect(0, 0, w, h)
        const glow2 = ctx.createRadialGradient(w * 0.2, h * 0.8, 0, w * 0.2, h * 0.8, w * 0.35)
        glow2.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`)
        glow2.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow2
        ctx.fillRect(0, 0, w, h)
        // Neon border lines
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`
        ctx.lineWidth = 2
        ctx.shadowBlur = 12
        ctx.shadowColor = accentHex
        ctx.strokeRect(16, 16, w - 32, h - 32)
        ctx.shadowBlur = 0
        break
      }
    }
  }

  // ── Main render function ──────────────────────────────────────────────────
  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendering(true)

    const W = 1920
    const H = 1080
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, W, H)

    // Determine what background to draw
    const activeStock = stockImage ? STOCK_IMAGES.find(s => s.id === stockImage) : null
    const bgImageUrl = customBg || (activeStock ? activeStock.url : null)

    if (bgImageUrl) {
      await new Promise<void>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve() }
        img.onerror = () => resolve()
        img.src = bgImageUrl
      })
      // Dark overlay so text is always readable
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, W, H)
    } else {
      drawBackground(ctx, W, H)
    }

    const isDark = bgDesign !== 'minimal' || bgImageUrl !== null
    const textColor = isDark ? '#ffffff' : '#0f172a'
    const subtextColor = isDark ? 'rgba(255,255,255,0.7)' : '#64748b'

    // ── Logo (top left) ───────────────────────────────────────────────────
    if (showLogo && card.company_logo_url) {
      await new Promise<void>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const maxH = 72
          const maxW = 240
          const scale = Math.min(maxH / img.naturalHeight, maxW / img.naturalWidth)
          const lw = img.naturalWidth * scale
          const lh = img.naturalHeight * scale
          ctx.drawImage(img, 72, 60, lw, lh)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = card.company_logo_url!
      })
    }

    // ── Name block (bottom left) ───────────────────────────────────────────
    if (showName) {
      const nameX = 72
      const bottomPad = 110
      const nameY = H - bottomPad

      ctx.font = 'bold 54px system-ui, Arial, sans-serif'
      ctx.fillStyle = textColor
      ctx.shadowBlur = isDark ? 14 : 0
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.fillText(card.name || '', nameX, nameY)
      ctx.shadowBlur = 0

      if (card.title) {
        ctx.font = '600 28px system-ui, Arial, sans-serif'
        ctx.fillStyle = accentHex
        ctx.fillText(card.title, nameX, nameY + 46)
      }

      if (card.company) {
        ctx.font = '24px system-ui, Arial, sans-serif'
        ctx.fillStyle = subtextColor
        const companyY = card.title ? nameY + 86 : nameY + 46
        ctx.fillText(card.company, nameX, companyY)
      }
    }

    // ── QR code (bottom right) ─────────────────────────────────────────────
    if (showQR) {
      const QRCode = (await import('qrcode')).default
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, cardUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: isDark ? '#ffffff' : '#000000',
          light: '#00000000',
        },
      })

      // White rounded background
      const qrX = W - 220
      const qrY = H - 220
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'
      roundRect(ctx, qrX - 10, qrY - 10, 180, 200, 12)
      ctx.fill()

      ctx.drawImage(qrCanvas, qrX, qrY, 160, 160)

      ctx.font = '18px system-ui, Arial, sans-serif'
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : '#64748b'
      ctx.textAlign = 'center'
      ctx.fillText('Scan to connect', qrX + 80, qrY + 178)
      ctx.textAlign = 'left'
    }

    setRendering(false)
  }, [bgDesign, stockImage, showName, showLogo, showQR, customBg, card, accentHex, cardUrl])

  useEffect(() => { render() }, [render])

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${card.name.replace(/\s+/g, '-')}-virtual-bg.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('Background downloaded — 1920×1080 PNG')
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setCustomBg(ev.target?.result as string)
      setStockImage(null) // clear stock selection when custom is uploaded
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Virtual Background</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a branded background for Zoom, Teams, Google Meet and more.
          </p>
        </div>
        {cards.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Card:</label>
            <select
              value={selectedCardId}
              onChange={e => setSelectedCardId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition min-w-[200px]">
              {cards.map(c => (
                <option key={c.id} value={c.id}>{(c as any)._label || c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Preview — full width */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border" style={{ aspectRatio: '16/9' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block', opacity: rendering ? 0.6 : 1, transition: 'opacity 0.2s' }}
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Preview scaled down — download is full 1920×1080
        </p>
      </div>

      {/* Controls — 4 column grid below preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Background designs */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="block text-sm font-semibold mb-3">Background design</label>
          <div className="grid grid-cols-2 gap-2">
            {BG_DESIGNS.map(d => (
              <button key={d.id}
                onClick={() => { setBgDesign(d.id); setCustomBg(null); setStockImage(null) }}
                className={`p-2 rounded-xl border-2 text-left transition ${bgDesign === d.id && !customBg && !stockImage ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-foreground/20'}`}>
                <p className="text-xs font-semibold">{d.label}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Scene backgrounds */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <label className="block text-sm font-semibold mb-3">Scene backgrounds</label>
          <div className="grid grid-cols-2 gap-2">
            {STOCK_IMAGES.map(s => (
              <button key={s.id}
                onClick={() => { setStockImage(stockImage === s.id ? null : s.id); setCustomBg(null) }}
                className={`relative rounded-xl overflow-hidden border-2 text-left transition ${stockImage === s.id ? 'border-blue-500' : 'border-border hover:border-foreground/20'}`}>
                <img src={s.url} alt={s.label} className="w-full h-12 object-cover" />
                {stockImage === s.id && (
                  <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow" />
                  </div>
                )}
                <div className="p-1.5 bg-card">
                  <p className="text-xs font-semibold truncate">{s.label}</p>
                </div>
              </button>
            ))}
          </div>
          {stockImage && (
            <button onClick={() => setStockImage(null)} className="text-xs text-muted-foreground underline mt-2 hover:text-foreground transition">
              Clear
            </button>
          )}
        </div>

        {/* Elements + Custom upload */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-3">Elements</label>
            <div className="space-y-3">
              {[
                { label: 'Name', sub: card.name, enabled: showName, set: setShowName, disabled: false },
                { label: 'Logo', sub: card.company_logo_url ? 'Top left' : 'No logo', enabled: showLogo, set: setShowLogo, disabled: !card.company_logo_url },
                { label: 'QR code', sub: 'Bottom right', enabled: showQR, set: setShowQR, disabled: false },
              ].map(({ label, sub, enabled, set, disabled }) => (
                <div key={label} className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub}</p>
                  </div>
                  <button
                    onClick={() => !disabled && set(!enabled)}
                    disabled={disabled}
                    className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${enabled && !disabled ? 'bg-blue-500' : 'bg-muted'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled && !disabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload + Download */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <label className="block text-sm font-semibold mb-1">Custom image</label>
            <p className="text-xs text-muted-foreground mb-3">Upload your own background</p>
            <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-medium cursor-pointer transition hover:border-foreground/30 ${customBg ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border text-muted-foreground'}`}>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              {customBg ? <><Check className="w-3.5 h-3.5" />Image loaded</> : <><Upload className="w-3.5 h-3.5" />Upload image</>}
            </label>
            {customBg && (
              <button onClick={() => setCustomBg(null)} className="text-xs text-muted-foreground underline mt-2 hover:text-foreground transition block">
                Remove
              </button>
            )}
          </div>

          <button onClick={download} disabled={rendering}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition disabled:opacity-50">
            <Download className="w-4 h-4" />
            {rendering ? 'Rendering...' : 'Download PNG'}
          </button>
          <p className="text-xs text-muted-foreground text-center">1920×1080 · Zoom, Teams, Meet</p>
        </div>
      </div>
    </div>
  )
}
