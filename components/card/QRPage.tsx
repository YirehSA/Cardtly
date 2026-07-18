'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlan } from '@/types/database'
import { isPro } from '@/lib/plan'
import { parseDesign, getAccentHex } from '@/types/design'
import { CARDTLY_MARK } from '@/lib/og-cardtly-mark'
import {
  Download, Share2, Copy, Check, Printer, ShieldCheck, AlertTriangle,
  Palette, Ban, QrCode, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

interface CardOption {
  id: string
  slug: string
  name: string
  profile_image_url?: string | null
  company_logo_url?: string | null
  color_theme?: string | null
  _label?: string
}

interface Props {
  cards: CardOption[]
  defaultCardId: string
  plan: UserPlan
}

type LogoChoice = 'cardtly' | 'own' | 'none'
type LogoShape = 'circle' | 'square' | 'rectangle'
type ColourId = 'classic' | 'brand' | 'midnight' | 'ink'

const STORAGE_KEY = 'cardtly:qr-prefs'

interface QrPrefs {
  selectedId?: string
  logoChoice?: LogoChoice
  logoShape?: LogoShape
  colour?: ColourId
  size?: number
}

function loadPrefs(): QrPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(p: QrPrefs) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

// ── Scannability ────────────────────────────────────────────────────────────
// A QR only reads reliably when the dark modules genuinely contrast with the
// light ones. A brand colour is often too pale for that (gold, mint, sky), so
// we mix it toward black until it clears the bar. The code still looks like
// their colour, it just always scans - which matters most in print, where a
// bad code cannot be fixed after the fact.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return {
    r: parseInt(s.slice(0, 2), 16) || 0,
    g: parseInt(s.slice(2, 4), 16) || 0,
    b: parseInt(s.slice(4, 6), 16) || 0,
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const p = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Contrast of a colour against the white QR background.
function contrastOnWhite(hex: string): number {
  return 1.05 / (relLuminance(hex) + 0.05)
}

function mixToBlack(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex)
  return toHex({ r: r * (1 - t), g: g * (1 - t), b: b * (1 - t) })
}

// Scanners want a lot more separation than text does. 7:1 keeps a colour
// readable to cheap phone cameras in poor light, which is where printed codes
// actually get used.
const SCAN_MIN_CONTRAST = 7

function makeScannable(hex: string): { colour: string; adjusted: boolean } {
  let out = hex
  let adjusted = false
  let guard = 0
  while (contrastOnWhite(out) < SCAN_MIN_CONTRAST && guard++ < 24) {
    out = mixToBlack(out, 0.1)
    adjusted = true
  }
  return { colour: out, adjusted }
}

function loadImage(src: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed'))
    img.src = src
  })
}

const SIZES = [
  { px: 512,  label: 'Web',   hint: 'email, slides' },
  { px: 1024, label: 'Large', hint: 'posters, PDFs' },
  { px: 2048, label: 'Print', hint: 'signage, banners' },
]

export default function QRPage({ cards, defaultCardId, plan }: Props) {
  const initial = useMemo(() => loadPrefs(), [])
  const [selectedId, setSelectedId] = useState(() => {
    if (initial.selectedId && cards.find(c => c.id === initial.selectedId)) return initial.selectedId
    return defaultCardId
  })
  const card = cards.find(c => c.id === selectedId) || cards[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const [qrReady, setQrReady] = useState(false)
  const [logoChoice, setLogoChoice] = useState<LogoChoice>(initial.logoChoice || 'cardtly')
  const [logoShape, setLogoShape] = useState<LogoShape>(initial.logoShape || 'square')
  const [colour, setColour] = useState<ColourId>(initial.colour || 'classic')
  const [size, setSize] = useState<number>(initial.size || 1024)
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const pro = isPro(plan)
  const hasOwnLogo = !!card.company_logo_url

  const brandAccent = useMemo(() => getAccentHex(parseDesign(card.color_theme || null)), [card.color_theme])

  const swatches: { id: ColourId; label: string; hint: string; base: string }[] = [
    { id: 'classic',  label: 'Classic',  hint: 'Reads anywhere',   base: '#000000' },
    { id: 'brand',    label: 'My colour', hint: 'From your card',  base: brandAccent },
    { id: 'midnight', label: 'Midnight', hint: 'Deep navy',        base: '#0f172a' },
    { id: 'ink',      label: 'Ink',      hint: 'Soft charcoal',    base: '#1f2937' },
  ]

  const chosen = swatches.find(s => s.id === colour) || swatches[0]
  const { colour: fg, adjusted } = useMemo(() => makeScannable(chosen.base), [chosen.base])

  // A logo punches a hole in the middle of the code, so the highest error
  // correction level is what makes it still readable. Without this a printed
  // code with a logo can simply fail to scan.
  const usesLogo = logoChoice !== 'none' && !(logoChoice === 'own' && !hasOwnLogo)
  const ecLevel: 'H' | 'M' = usesLogo ? 'H' : 'M'

  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://cardtly.com'}/card/${card.slug}`

  useEffect(() => {
    savePrefs({ selectedId, logoChoice, logoShape, colour, size })
  }, [selectedId, logoChoice, logoShape, colour, size])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    ;(async () => {
      setGenerating(true)
      setQrReady(false)
      try {
        await drawQR(canvas, 900)
        if (!cancelled) setQrReady(true)
      } catch {
        if (!cancelled) toast.error('Could not build the QR code')
      } finally {
        if (!cancelled) setGenerating(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.slug, logoChoice, logoShape, fg, ecLevel])

  // Renders the whole code at any size, so a 2048px print export is identical
  // to the preview rather than an upscaled copy of it.
  async function drawQR(canvas: HTMLCanvasElement, px: number) {
    const QRCode = (await import('qrcode')).default
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const temp = document.createElement('canvas')
    await QRCode.toCanvas(temp, cardUrl, {
      width: px,
      margin: 2,
      errorCorrectionLevel: ecLevel,
      color: { dark: fg, light: '#ffffff' },
    })
    ctx.drawImage(temp, 0, 0)

    if (!usesLogo) return

    // Proportional to the canvas so every export size matches the preview.
    const k = px / 800
    const cx = px / 2
    const cy = px / 2
    const logoRadius = 68 * k
    const pad = 10 * k
    const inset = 6 * k

    let img: HTMLImageElement
    try {
      img = logoChoice === 'own' && card.company_logo_url
        ? await loadImage(card.company_logo_url, 'anonymous')
        : await loadImage(CARDTLY_MARK)
    } catch {
      img = await loadImage(CARDTLY_MARK)
    }

    const plate = (x: number, y: number, w: number, h: number, r: number) => {
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
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    const shape = logoChoice === 'own' ? logoShape : 'circle'

    if (shape === 'circle') {
      const r = logoRadius + pad
      ctx.beginPath()
      ctx.arc(cx, cy, r + inset, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      const s = r * 1.7
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s)
      ctx.restore()
    } else if (shape === 'square') {
      const s = (logoRadius + pad) * 2
      plate(cx - s / 2 - inset, cy - s / 2 - inset, s + inset * 2, s + inset * 2, 12 * k)
      ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s)
    } else {
      const w = (logoRadius + pad) * 3
      const h = (logoRadius + pad) * 1.5
      plate(cx - w / 2 - inset, cy - h / 2 - inset, w + inset * 2, h + inset * 2, 10 * k)
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
    }
  }

  // The centre logo as a self-contained data URL, so vector exports carry it
  // with them instead of pointing at a URL that may not resolve on a printer.
  async function centreLogoHref(): Promise<{ href: string; aspect: number } | null> {
    if (!usesLogo) return null
    if (logoChoice === 'cardtly') return { href: CARDTLY_MARK, aspect: 1 }
    try {
      const img = await loadImage(card.company_logo_url!, 'anonymous')
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      return { href: c.toDataURL('image/png'), aspect: img.naturalWidth / (img.naturalHeight || 1) }
    } catch {
      return { href: CARDTLY_MARK, aspect: 1 }
    }
  }

  // True vector QR: the modules stay crisp at any print size, unlike a PNG.
  async function qrSvg(px: number): Promise<string> {
    const QRCode = (await import('qrcode')).default
    return QRCode.toString(cardUrl, {
      type: 'svg',
      width: px,
      margin: 2,
      errorCorrectionLevel: ecLevel,
      color: { dark: fg, light: '#ffffff' },
    })
  }

  function logoSvgMarkup(logo: { href: string; aspect: number } | null, px: number): string {
    if (!logo) return ''
    const shape = logoChoice === 'own' ? logoShape : 'circle'
    const k = px / 800
    const cx = px / 2
    const cy = px / 2
    const base = (68 + 10) * k
    if (shape === 'circle') {
      const r = base
      const s = r * 1.7
      return `<circle cx="${cx}" cy="${cy}" r="${r + 6 * k}" fill="#ffffff"/>
        <clipPath id="qrLogoClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
        <image href="${logo.href}" x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" clip-path="url(#qrLogoClip)" preserveAspectRatio="xMidYMid slice"/>`
    }
    const w = shape === 'rectangle' ? base * 3 : base * 2
    const h = shape === 'rectangle' ? base * 1.5 : base * 2
    const r = (shape === 'rectangle' ? 10 : 12) * k
    return `<rect x="${cx - w / 2 - 6 * k}" y="${cy - h / 2 - 6 * k}" width="${w + 12 * k}" height="${h + 12 * k}" rx="${r}" fill="#ffffff"/>
      <image href="${logo.href}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement('a')
    a.download = filename
    a.href = href
    a.click()
  }

  const fileBase = (card.name || 'cardtly').replace(/\s+/g, '-')

  async function downloadPNG() {
    setBusy(true)
    try {
      const off = document.createElement('canvas')
      await drawQR(off, size)
      triggerDownload(off.toDataURL('image/png'), `${fileBase}-qr-${size}.png`)
      toast.success(`PNG downloaded at ${size}px`)
    } catch {
      toast.error('Could not export the PNG')
    } finally {
      setBusy(false)
    }
  }

  async function downloadSVG() {
    setBusy(true)
    try {
      const px = 800
      const [svg, logo] = await Promise.all([qrSvg(px), centreLogoHref()])
      // Nest the vector QR, then lay the logo plate over it.
      const inner = svg
        .replace(/^<\?xml[^>]*\?>/, '')
        .replace('<svg ', `<svg x="0" y="0" width="${px}" height="${px}" `)
      const out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">${inner}${logoSvgMarkup(logo, px)}</svg>`
      const blob = new Blob([out], { type: 'image/svg+xml' })
      triggerDownload(URL.createObjectURL(blob), `${fileBase}-qr.svg`)
      toast.success('Vector SVG downloaded')
    } catch {
      toast.error('Could not export the SVG')
    } finally {
      setBusy(false)
    }
  }

  async function downloadPrintCard() {
    setBusy(true)
    try {
      const px = 400
      const [svg, logo] = await Promise.all([qrSvg(px), centreLogoHref()])
      const inner = svg
        .replace(/^<\?xml[^>]*\?>/, '')
        .replace('<svg ', `<svg x="50" y="40" width="${px}" height="${px}" `)
      // The logo sits in the card's coordinate space, so shift it by the QR's
      // offset rather than re-deriving it.
      const logoLayer = logo
        ? `<g transform="translate(50,40)">${logoSvgMarkup(logo, px)}</g>`
        : ''
      const out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" height="580" viewBox="0 0 500 580">
  <rect width="500" height="580" rx="20" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  ${inner}
  ${logoLayer}
  <text x="250" y="480" font-family="system-ui,sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">Scan to connect with</text>
  <text x="250" y="508" font-family="system-ui,sans-serif" font-size="20" font-weight="bold" fill="#111827" text-anchor="middle">${(card.name || '').replace(/[<&]/g, '')}</text>
  <text x="250" y="535" font-family="system-ui,sans-serif" font-size="13" fill="#9ca3af" text-anchor="middle">cardtly.com/card/${card.slug}</text>
</svg>`
      const blob = new Blob([out], { type: 'image/svg+xml' })
      triggerDownload(URL.createObjectURL(blob), `${fileBase}-qr-card.svg`)
      toast.success('Print card downloaded')
    } catch {
      toast.error('Could not export the print card')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(cardUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareCard() {
    const canvas = canvasRef.current
    const title = `${card.name} - Digital Business Card`
    const text = `Connect with ${card.name} on Cardtly`

    if (canvas && typeof navigator !== 'undefined' && 'canShare' in navigator) {
      try {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/png'))
        if (blob) {
          const file = new File([blob], `${fileBase}-qr.png`, { type: 'image/png' })
          const payload = { title, text, url: cardUrl, files: [file] }
          if ((navigator as Navigator & { canShare?: (d: ShareData & { files?: File[] }) => boolean }).canShare?.(payload)) {
            await navigator.share(payload)
            return
          }
        }
      } catch {
        // Fall through to URL-only sharing.
      }
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: cardUrl })
        return
      } catch {
        return // cancelled
      }
    }
    copyLink()
  }

  const initials = (card.name || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${fg}18, transparent 70%)` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">Your QR code</h1>
              <p className="text-muted-foreground text-sm">
                Anyone who scans it lands on your card. Print it, share it, stick it anywhere.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card picker */}
      {cards.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold mb-1">1. Pick a card</h2>
          <p className="text-xs text-muted-foreground mb-3">The QR points at whichever card you choose.</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {cards.map(c => {
              const on = c.id === selectedId
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-left transition-all shrink-0 ${on ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20 hover:-translate-y-0.5'}`}>
                  {c.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.profile_image_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
                      {(c.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-medium whitespace-nowrap">{c._label || c.name}</span>
                  {on && <Check className="w-4 h-4 text-primary" />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-6 items-start">
        {/* Preview */}
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="rounded-3xl border border-border bg-card p-5 flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm relative">
              <canvas ref={canvasRef} className="w-64 h-64 block"
                style={{ opacity: generating ? 0.45 : 1, transition: 'opacity .2s' }} />
              {generating && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="text-center">
              {card.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover mx-auto mb-2" />
              ) : (
                <span className="w-10 h-10 rounded-full grid place-items-center text-sm font-bold text-white mx-auto mb-2"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>{initials}</span>
              )}
              <p className="text-sm font-semibold">{card.name}</p>
              <p className="text-xs text-muted-foreground">cardtly.com/card/{card.slug}</p>
            </div>

            {/* Scannability reassurance - the thing people actually worry about */}
            <div className="w-full rounded-2xl bg-muted/60 px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Ready to scan.</span>{' '}
                {usesLogo
                  ? 'Extra error correction is on, so the centre logo cannot stop it reading.'
                  : 'Maximum contrast, reads fast even in poor light.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyLink}
              className="flex items-center justify-center gap-2 border border-border px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button onClick={shareCard}
              className="flex items-center justify-center gap-2 border border-border px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Colour */}
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{cards.length > 1 ? '2. ' : '1. '}Colour</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Any of these will scan. Pick what suits your brand.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {swatches.map(s => {
                const on = s.id === colour
                const preview = makeScannable(s.base).colour
                return (
                  <button key={s.id} onClick={() => setColour(s.id)}
                    className={`rounded-2xl border-2 p-3 text-left transition-all ${on ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20 hover:-translate-y-0.5'}`}>
                    <span className="w-full h-8 rounded-lg block mb-2 border border-border/50" style={{ background: preview }} />
                    <span className="text-xs font-semibold block">{s.label}</span>
                    <span className="text-[11px] text-muted-foreground block">{s.hint}</span>
                  </button>
                )
              })}
            </div>
            {colour === 'brand' && adjusted && (
              <p className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                Your card colour was too light to scan reliably, so we deepened it. It still reads as your colour.
              </p>
            )}
          </section>

          {/* Centre logo */}
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{cards.length > 1 ? '3. ' : '2. '}Middle of the code</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">A logo in the middle makes it look deliberate, not generic.</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'cardtly' as LogoChoice, label: 'Cardtly', node: <img src={CARDTLY_MARK} alt="" className="w-7 h-7 object-contain" /> },
                { id: 'own' as LogoChoice, label: 'My logo', node: hasOwnLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={card.company_logo_url!} alt="" className="w-7 h-7 object-contain" />
                  : <Ban className="w-6 h-6 text-muted-foreground" /> },
                { id: 'none' as LogoChoice, label: 'Nothing', node: <Ban className="w-6 h-6 text-muted-foreground" /> },
              ]).map(opt => {
                const locked = opt.id === 'own' && (!pro || !hasOwnLogo)
                const on = logoChoice === opt.id
                return (
                  <button key={opt.id}
                    onClick={() => {
                      if (opt.id === 'own') {
                        if (!pro) return toast.error('Upgrade to Pro to use your own logo')
                        if (!hasOwnLogo) return toast.error('Upload a company logo in the Media tab first')
                      }
                      setLogoChoice(opt.id)
                    }}
                    className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 transition-all ${on ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20 hover:-translate-y-0.5'} ${locked ? 'opacity-60' : ''}`}>
                    <span className="w-11 h-11 rounded-xl bg-white border border-border grid place-items-center overflow-hidden">
                      {opt.node}
                    </span>
                    <span className="text-xs font-semibold">{opt.label}</span>
                    {opt.id === 'own' && !pro && <span className="text-[11px] text-muted-foreground -mt-1">Pro</span>}
                    {opt.id === 'own' && pro && !hasOwnLogo && <span className="text-[11px] text-muted-foreground -mt-1">Add one first</span>}
                  </button>
                )
              })}
            </div>

            {logoChoice === 'own' && pro && hasOwnLogo && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-2">How should your logo be cropped?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'rectangle' as LogoShape, label: 'Wide', desc: 'Long logos' },
                    { id: 'square' as LogoShape, label: 'Square', desc: 'Equal sides' },
                    { id: 'circle' as LogoShape, label: 'Round', desc: 'Circle crop' },
                  ]).map(s => (
                    <button key={s.id} onClick={() => setLogoShape(s.id)}
                      className={`rounded-xl border-2 py-2 px-2 text-center transition ${logoShape === s.id ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20'}`}>
                      <span className="text-xs font-semibold block">{s.label}</span>
                      <span className="text-[11px] text-muted-foreground block">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Download */}
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{cards.length > 1 ? '4. ' : '3. '}Download it</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Bigger is better for print. Not sure? Large is a safe bet.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SIZES.map(s => (
                <button key={s.px} onClick={() => setSize(s.px)}
                  className={`rounded-xl border-2 py-2 px-2 text-center transition ${size === s.px ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20'}`}>
                  <span className="text-xs font-semibold block">{s.label}</span>
                  <span className="text-[11px] text-muted-foreground block">{s.hint}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <button onClick={downloadPNG} disabled={!qrReady || busy}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-5 py-3 rounded-xl text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50">
                <Download className="w-4 h-4" />
                Download image ({size}px)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={downloadSVG} disabled={!qrReady || busy}
                  className="flex items-center justify-center gap-2 border border-border px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />
                  Vector (SVG)
                </button>
                <button onClick={downloadPrintCard} disabled={!qrReady || busy}
                  className="flex items-center justify-center gap-2 border border-border px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition disabled:opacity-50">
                  <Printer className="w-4 h-4" />
                  Print card
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Give the vector file to a printer - it stays sharp at any size, even on a banner.
              </p>
            </div>
          </section>

          {/* Tips */}
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Where to put it</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                ['Business cards', 'The classic. Print it on the back.'],
                ['Email signature', 'Every email becomes a way to connect.'],
                ['Shop window or desk', 'Walk-ins can scan without asking.'],
                ['Proposals and slides', 'Let people save you mid-meeting.'],
                ['Van or signage', 'Use the vector file so it stays sharp.'],
                ['WhatsApp status', 'Reaches everyone who has your number.'],
              ].map(([title, blurb]) => (
                <div key={title} className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{blurb}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
