'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlan } from '@/types/database'
import { isPro } from '@/lib/plan'
import { Download, Share2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

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

const STORAGE_KEY = 'cardtly:qr-prefs'

interface QrPrefs {
  selectedId?: string
  logoChoice?: LogoChoice
  logoShape?: LogoShape
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

export default function QRPage({ cards, defaultCardId, plan }: Props) {
  // Restore the last-used card + logo choice + shape from localStorage so
  // returning to the QR page picks up where the user left off. Falls
  // back to defaults if no prefs are stored yet or the saved card ID
  // is no longer valid (e.g. card was deleted).
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
  const [generating, setGenerating] = useState(false)
  const pro = isPro(plan)
  const hasOwnLogo = !!card.company_logo_url

  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://cardtly.com'}/card/${card.slug}`

  // Persist prefs to localStorage whenever any of the saved fields change
  useEffect(() => {
    savePrefs({ selectedId, logoChoice, logoShape })
  }, [selectedId, logoChoice, logoShape])

  // Regenerate QR whenever logo choice changes
  useEffect(() => {
    generateQR(logoChoice, logoShape)
  }, [card.slug, logoChoice, logoShape])

  async function generateQR(choice: LogoChoice, shape: LogoShape = 'square') {
    const canvas = canvasRef.current
    if (!canvas) return
    setGenerating(true)
    setQrReady(false)

    const QRCode = (await import('qrcode')).default

    const size = 800
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Generate base QR
    const tempCanvas = document.createElement('canvas')
    await QRCode.toCanvas(tempCanvas, cardUrl, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    ctx.drawImage(tempCanvas, 0, 0)

    const centerX = size / 2
    const centerY = size / 2
    const logoRadius = 68

    if (choice === 'none') {
      // No centre logo — just the plain QR
      setQrReady(true)
      setGenerating(false)
      return
    }

    if (choice === 'own' && card.company_logo_url) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject()
          img.src = card.company_logo_url!
        })

        const padding = 10
        if (shape === 'circle') {
          const r = logoRadius + padding
          // White circle bg
          ctx.beginPath()
          ctx.arc(centerX, centerY, r + 6, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          // Clip to circle and draw logo
          const logoSize = r * 1.7
          ctx.save()
          ctx.beginPath()
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, centerX - logoSize / 2, centerY - logoSize / 2, logoSize, logoSize)
          ctx.restore()
        } else if (shape === 'square') {
          const s = (logoRadius + padding) * 2
          const x = centerX - s / 2
          const y = centerY - s / 2
          // White rounded square bg
          const r = 12
          ctx.beginPath()
          ctx.moveTo(x - 6 + r, y - 6)
          ctx.lineTo(x - 6 + s + 12 - r, y - 6)
          ctx.quadraticCurveTo(x - 6 + s + 12, y - 6, x - 6 + s + 12, y - 6 + r)
          ctx.lineTo(x - 6 + s + 12, y - 6 + s + 12 - r)
          ctx.quadraticCurveTo(x - 6 + s + 12, y - 6 + s + 12, x - 6 + s + 12 - r, y - 6 + s + 12)
          ctx.lineTo(x - 6 + r, y - 6 + s + 12)
          ctx.quadraticCurveTo(x - 6, y - 6 + s + 12, x - 6, y - 6 + s + 12 - r)
          ctx.lineTo(x - 6, y - 6 + r)
          ctx.quadraticCurveTo(x - 6, y - 6, x - 6 + r, y - 6)
          ctx.closePath()
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          // Draw logo inside square
          ctx.drawImage(img, x, y, s, s)
        } else {
          // Rectangle — wider than tall
          const w = (logoRadius + padding) * 3
          const h = (logoRadius + padding) * 1.5
          const x = centerX - w / 2
          const y = centerY - h / 2
          const r = 10
          ctx.beginPath()
          ctx.moveTo(x - 6 + r, y - 6)
          ctx.lineTo(x - 6 + w + 12 - r, y - 6)
          ctx.quadraticCurveTo(x - 6 + w + 12, y - 6, x - 6 + w + 12, y - 6 + r)
          ctx.lineTo(x - 6 + w + 12, y - 6 + h + 12 - r)
          ctx.quadraticCurveTo(x - 6 + w + 12, y - 6 + h + 12, x - 6 + w + 12 - r, y - 6 + h + 12)
          ctx.lineTo(x - 6 + r, y - 6 + h + 12)
          ctx.quadraticCurveTo(x - 6, y - 6 + h + 12, x - 6, y - 6 + h + 12 - r)
          ctx.lineTo(x - 6, y - 6 + r)
          ctx.quadraticCurveTo(x - 6, y - 6, x - 6 + r, y - 6)
          ctx.closePath()
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.drawImage(img, x, y, w, h)
        }
      } catch {
        drawCardtlyLogo(ctx, centerX, centerY, logoRadius)
      }
    } else {
      // Cardtly "C" logo
      drawCardtlyLogo(ctx, centerX, centerY, logoRadius)
    }

    setQrReady(true)
    setGenerating(false)
  }

  function drawCardtlyLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    // White background circle
    ctx.beginPath()
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Blue circle
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()

    // "C" letter
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('C', cx, cy + 2)
  }

  function downloadQR() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${card.name.replace(/\s+/g, '-')}-qr.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('QR code downloaded')
  }

  function downloadPrintCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="580">
  <rect width="500" height="580" rx="20" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  <image href="${dataUrl}" x="50" y="40" width="400" height="400"/>
  <text x="250" y="480" font-family="system-ui" font-size="16" fill="#6b7280" text-anchor="middle">Scan to connect with</text>
  <text x="250" y="508" font-family="system-ui" font-size="20" font-weight="bold" fill="#111827" text-anchor="middle">${card.name}</text>
  <text x="250" y="535" font-family="system-ui" font-size="13" fill="#9ca3af" text-anchor="middle">cardtly.com/card/${card.slug}</text>
</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const link = document.createElement('a')
    link.download = `${card.name.replace(/\s+/g, '-')}-qr-card.svg`
    link.href = URL.createObjectURL(blob)
    link.click()
    toast.success('Print card downloaded')
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

    // Try to share the QR image itself first. Most modern mobile
    // browsers and the Cardtly Android app's WebView support Web Share
    // API Level 2 which accepts a `files` array. WhatsApp, Messages,
    // Gmail etc. show the image alongside the link.
    if (canvas && typeof navigator !== 'undefined' && 'canShare' in navigator) {
      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png')
        })
        if (blob) {
          const file = new File([blob], `${card.name.replace(/\s+/g, '-')}-qr.png`, { type: 'image/png' })
          const sharePayload = { title, text, url: cardUrl, files: [file] }
          // canShare returns true only when files are actually shareable
          // on this device. If false, fall through to URL-only.
          if ((navigator as Navigator & { canShare?: (d: ShareData & { files?: File[] }) => boolean }).canShare?.(sharePayload)) {
            await navigator.share(sharePayload)
            return
          }
        }
      } catch (err) {
        // Sharing failed or was cancelled. Fall through to URL-only.
        console.warn('Image share failed, falling back to URL', err)
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: cardUrl })
        return
      } catch {
        // User cancelled, do nothing
      }
    }
    copyLink()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {cards.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-muted-foreground">Card:</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition min-w-[200px]">
            {cards.map(c => (
              <option key={c.id} value={c.id}>{c._label || c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl font-bold">QR Code</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your QR code so anyone can scan and save your contact instantly.
        </p>
      </div>

      {/* QR display */}
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm relative">
          <canvas
            ref={canvasRef}
            className="w-72 h-72"
            style={{ opacity: generating ? 0.5 : 1, transition: 'opacity 0.2s' }}
          />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Card URL */}
        <div className="text-center">
          <p className="text-sm font-medium">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">cardtly.com/card/{card.slug}</p>
        </div>

        {/* Logo choice */}
        <div className="w-full">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
            Centre logo
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setLogoChoice('cardtly')}
              className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center ${logoChoice === 'cardtly' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}
            >
              Cardtly logo
            </button>
            <button
              onClick={() => {
                if (!pro) {
                  toast.error('Upgrade to Pro to use your own logo')
                  return
                }
                if (!hasOwnLogo) {
                  toast.error('Upload a company logo in the Media tab first')
                  return
                }
                setLogoChoice('own')
              }}
              className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center relative ${logoChoice === 'own' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'} ${!pro || !hasOwnLogo ? 'opacity-50' : ''}`}
            >
              My logo
              {!pro && <span className="block text-xs font-normal text-muted-foreground">Pro</span>}
              {pro && !hasOwnLogo && <span className="block text-xs font-normal text-muted-foreground">No logo</span>}
            </button>
            <button
              onClick={() => setLogoChoice('none')}
              className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center ${logoChoice === 'none' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}
            >
              No logo
            </button>
          </div>
        </div>

        {/* Logo shape — only shown when own logo is selected */}
        {logoChoice === 'own' && pro && hasOwnLogo && (
          <div className="w-full">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
              Logo shape
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'rectangle' as LogoShape, label: 'Rectangle', desc: 'Best for wide logos' },
                { id: 'square'    as LogoShape, label: 'Square',    desc: 'Equal sides' },
                { id: 'circle'    as LogoShape, label: 'Circle',    desc: 'Round crop' },
              ]).map(({ id, label, desc }) => (
                <button key={id}
                  onClick={() => setLogoShape(id)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center ${logoShape === id ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
                  {label}
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={downloadQR}
            disabled={!qrReady}
            className="flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            onClick={downloadPrintCard}
            disabled={!qrReady}
            className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Print card
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            Copy link
          </button>
          <button
            onClick={shareCard}
            className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3">Where to use your QR code</h3>
        <ul className="space-y-2">
          {[
            'Print it on your physical business cards',
            'Add it to your email signature',
            'Display it on your laptop or desk',
            'Include it in presentations and proposals',
            'Add it to your WhatsApp profile or status',
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
