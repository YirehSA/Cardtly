'use client'

import { useState } from 'react'
import { Wifi, ChevronRight } from 'lucide-react'
import TapToShareModal from './TapToShareModal'

interface Props {
  cardUrl: string
  cardName?: string
  accentHex?: string
}

// Standalone tile-styled button for the dashboard. Opens the
// TapToShareModal which arms HCE in the native app, or shows an
// explanatory screen on web / non-NFC devices.

export default function TapToShareButton({ cardUrl, cardName, accentHex = '#7c3aed' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border bg-card hover:shadow-md transition-all group text-left"
        style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(124,58,237,0.08) 50%, rgba(236,72,153,0.06) 100%)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          <Wifi className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Tap to Share</p>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
              style={{ background: accentHex }}>
              NEW
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Hold your phone to theirs · Android app only</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </button>

      <TapToShareModal
        open={open}
        onClose={() => setOpen(false)}
        cardUrl={cardUrl}
        cardName={cardName}
      />
    </>
  )
}
