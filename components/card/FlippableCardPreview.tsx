'use client'

import { useEffect, useState } from 'react'
import { RotateCw, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import TemplatedCardPreview from './TemplatedCardPreview'
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
// hand. The front is the existing TemplatedCardPreview, the back is a
// large QR code with the card's URL plus a hint to tap to flip back.

export default function FlippableCardPreview({ form, isPro, design, cardUrl }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [qrSvg, setQrSvg] = useState<string>('')
  const accent = getAccentHex(design)

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
    <div className={`flip-card relative ${flipped ? 'flipped' : ''}`} style={{ minHeight: 500 }}>
      <div className="flip-card-inner" style={{ minHeight: 500 }}>
        {/* Front */}
        <div className="flip-card-face rounded-2xl overflow-hidden shadow-2xl border border-gray-800"
          style={{ maxHeight: '82vh', overflowY: flipped ? 'hidden' : 'auto' }}>
          <TemplatedCardPreview form={form} isPro={isPro} design={design} />
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

      {/* Flip toggle button */}
      <button
        type="button"
        onClick={() => setFlipped(f => !f)}
        aria-label={flipped ? 'Show card front' : 'Show QR on back'}
        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95 backdrop-blur-md shadow-lg"
        style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <RotateCw className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}
