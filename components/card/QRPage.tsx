'use client'

import { useEffect, useRef, useState } from 'react'
import { UserPlan } from '@/types/database'
import { isPro } from '@/lib/plan'
import { Download, Share2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface CardOption {
  id: string
  slug: string
  name: string
  profile_image_url: string | null
  color_theme: string | null
  _label?: string
}

interface Props {
  cards: CardOption[]
  defaultCardId: string
  plan: UserPlan
}

const THEME_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  pink: '#ec4899',
  teal: '#14b8a6',
  gray: '#374151',
}

const CARDTLY_LOGO_COLOR = '#3b82f6'

export default function QRPage({ cards, defaultCardId, plan }: Props) {
  const [selectedId, setSelectedId] = useState(defaultCardId)
  const card = cards.find(c => c.id === selectedId) || cards[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const [qrReady, setQrReady] = useState(false)
  const pro = isPro(plan)

  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://cardtly.com'}/card/${card.slug}`
  const accentColor = THEME_COLORS[card.color_theme || 'blue'] || THEME_COLORS.blue

  useEffect(() => {
    generateQR()
  }, [card.slug])

  async function generateQR() {
    const canvas = canvasRef.current
    if (!canvas) return

    // Dynamically import qrcode to avoid SSR issues
    const QRCode = (await import('qrcode')).default

    const size = 400
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Generate QR to a temporary canvas first
    const tempCanvas = document.createElement('canvas')
    await QRCode.toCanvas(tempCanvas, cardUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    // Draw QR onto main canvas
    ctx.drawImage(tempCanvas, 0, 0)

    // Draw center logo circle (Cardtly branding — always shown on free)
    const centerX = size / 2
    const centerY = size / 2
    const logoRadius = 32

    // White circle background
    ctx.beginPath()
    ctx.arc(centerX, centerY, logoRadius + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Coloured circle
    ctx.beginPath()
    ctx.arc(centerX, centerY, logoRadius, 0, Math.PI * 2)
    ctx.fillStyle = CARDTLY_LOGO_COLOR
    ctx.fill()

    // "C" letter for Cardtly
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${logoRadius}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('C', centerX, centerY + 2)

    setQrReady(true)
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

  function downloadSVGFrame() {
    // Download a print-ready version with card URL below
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
    if (navigator.share) {
      await navigator.share({
        title: `${card.name} — Digital Business Card`,
        text: `Connect with ${card.name} on Cardtly`,
        url: cardUrl,
      })
    } else {
      copyLink()
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">QR Code</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your QR code so anyone can scan and save your contact instantly.
        </p>
      </div>

      {/* QR display */}
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm">
          <canvas
            ref={canvasRef}
            className="w-64 h-64"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Card URL */}
        <div className="text-center">
          <p className="text-sm font-medium">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">cardtly.com/card/{card.slug}</p>
        </div>

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
            onClick={downloadSVGFrame}
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

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Free QR code</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your QR code includes the Cardtly logo in the centre. It is fully functional and can be printed, shared digitally, or added to email signatures.
          </p>
        </div>

        {!pro ? (
          <div className="bg-foreground text-background rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-1">Pro: Custom logo in QR</h3>
            <p className="text-xs text-background/70 leading-relaxed mb-3">
              Replace the Cardtly logo with your own company logo in the centre of the QR code.
            </p>
            <Link
              href="/dashboard/upgrade"
              className="text-xs font-semibold bg-background text-foreground px-3 py-1.5 rounded-lg hover:bg-background/90 transition inline-block"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-1">Pro: Custom logo active</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your company logo appears in the centre of your QR code. Update it in the Media tab of your card editor.
            </p>
          </div>
        )}
      </div>

      {/* Usage tips */}
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
