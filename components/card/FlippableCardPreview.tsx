'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCw, QrCode, Repeat2 } from 'lucide-react'
import QRCode from 'qrcode'
import CardPreview from './CardPreview'
import { CardDesign, getAccentHex } from '@/types/design'

interface PreviewData {
  name: string
  title: string
  company: string
  bio: string
  email: string
  phone: string
  whatsapp: string
  address: string
  website: string
  profile_image_url: string
  company_logo_url: string
  certifications: string
  link_1_title: string
  link_1_url: string
  link_2_title: string
  link_2_url: string
  link_3_title: string
  link_3_url: string
}

interface Props {
  form: PreviewData
  isPro: boolean
  design: CardDesign
  cardUrl?: string | null
}

// Live card preview that flips on click to reveal a QR code "back" of
// the card. Same metaphor as a real business card you can flip in your
// hand. The front is the real card scaled down by CardPreview, the back is a
// large QR code with the card's URL plus a hint to tap to flip back.

export default function FlippableCardPreview({ form, isPro, design, cardUrl }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [qrSvg, setQrSvg] = useState<string>('')
  const [spinning, setSpinning] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)
  const accent = getAccentHex(design)

  function spin() {
    if (spinning) return
    setSpinning(true)
    setTimeout(() => setSpinning(false), 1200)
  }

  useEffect(() => {
    if (!cardUrl) return
    const fullUrl = cardUrl.startsWith('http') ? cardUrl : `https://cardtly.com${cardUrl}`
    QRCode.toString(fullUrl, {
      type: 'svg',
      margin: 1,
      color: { dark: '#000000', light: '#00000000' },
      width: 240,
    }).then(setQrSvg).catch(() => {})
  }, [cardUrl])

  return (
    <div className="relative">
    {/* Tilt wrapper removed - the parallax hover effect was hijacking
        the pointer and breaking scroll on the live preview card */}
    <div className={`flip-card relative ${flipped ? 'flipped' : ''}`}>
      <div
        ref={innerRef}
        className={`flip-card-inner ${spinning ? 'animate-card-spin' : ''}`}
        style={{ minHeight: 500 }}>
        {/* Front */}
        <div className="flip-card-face rounded-2xl overflow-hidden shadow-2xl border border-gray-800"
          style={{ maxHeight: '82vh', overflowY: flipped ? 'hidden' : 'auto' }}>
          <CardPreview form={form} isPro={isPro} design={design} />
        </div>
        {/* Back */}
        <div className="flip-card-face flip-card-back rounded-2xl overflow-hidden shadow-2xl border flex flex-col items-center justify-center p-8 gap-6"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, #0a0a0a 100%)`,
            borderColor: 'rgba(255,255,255,0.1)',
            minHeight: 500,
          }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Scan to view card</p>
          <div className="bg-white rounded-2xl p-4 shadow-xl">
            {qrSvg ? (
              <div className="w-56 h-56 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-gray-400">
                <QrCode className="w-12 h-12" />
              </div>
            )}
          </div>
          {cardUrl && (
            <p className="text-xs font-mono text-white/60 break-all text-center">
              {cardUrl.replace(/^\//, 'cardtly.com')}
            </p>
          )}
        </div>
      </div>

    </div>

    {/* Control buttons rendered OUTSIDE the Tilt wrapper so they stay
        anchored to the card frame instead of moving with the tilt
        transform. That's what was eating the clicks before - the
        tilt was nudging the click target out from under the cursor. */}
    <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-none">
      <button
        type="button"
        onClick={spin}
        aria-label="Spin card"
        disabled={spinning}
        className="pointer-events-auto w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95 backdrop-blur-md shadow-lg disabled:opacity-50"
        style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <Repeat2 className="w-4 h-4 text-white" />
      </button>
      <button
        type="button"
        onClick={() => setFlipped(f => !f)}
        aria-label={flipped ? 'Show card front' : 'Show QR on back'}
        className="pointer-events-auto w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95 backdrop-blur-md shadow-lg"
        style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <RotateCw className="w-4 h-4 text-white" />
      </button>
    </div>
    </div>
  )
}
