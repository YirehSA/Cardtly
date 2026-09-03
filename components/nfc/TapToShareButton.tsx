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
        // One accent, applied to the icon only. This used to carry a
        // cyan-to-purple-to-pink gradient on both the tile and its icon, which
        // made a secondary action the loudest thing on the dashboard and read
        // as a consumer app rather than a business tool.
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors group text-left"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accentHex + '14', color: accentHex }}>
          <Wifi className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Tap to share</p>
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border"
              style={{ borderColor: accentHex + '40', color: accentHex }}>
              New
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Hold your phone to theirs · Android app only</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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
