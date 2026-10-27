'use client'

import { useState } from 'react'
import { Wifi } from 'lucide-react'
import NfcWriteSession, { useNfcSupport, type NfcCardItem } from '@/components/nfc/NfcWriteSession'
import { cardTagUrl, NFC_BLOCK_TEXT } from '@/lib/nfc-tag'

interface Props {
  cards: NfcCardItem[]
  heading: string
  blurb: string
  /** Where progress is remembered on this phone (NfcWriteSession). */
  memoryKey: string
  buttonLabel: string
  /** Say where writing works on a computer or iPhone, instead of hiding.
   *  A team owner is usually at a computer and would never find it otherwise. */
  explainWhenUnsupported?: boolean
}

// Dashboard section for writing Cardtly links onto blank NFC tags or cards:
// one's own card, or a whole team's (NfcWriteSession does the writing). Works
// in the Android app and in Chrome on Android (lib/nfc-tag). Never shown in
// the iOS app, which is built without NFC (ios/App/App/Info.plist).
export default function NFCWriteCard({ cards, heading, blurb, memoryKey, buttonLabel, explainWhenUnsupported }: Props) {
  const support = useNfcSupport()
  const [open, setOpen] = useState(false)
  const writable = cards.filter(c => c.slug)

  if (!writable.length) return null
  if (support === null) {
    return <div className="rounded-xl border border-border p-6 mb-6 animate-pulse h-32" />
  }
  if (!support.writer) {
    if (support.block === 'ios-app') return null
    if (!explainWhenUnsupported && support.block !== 'old-android-app') return null
  }

  return (
    <>
      <div className="rounded-xl border border-border p-6 mb-6"
        style={{ background: 'hsl(var(--accent) / 0.05)', borderColor: 'hsl(var(--accent) / 0.22)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'hsl(var(--accent) / 0.16)' }}>
            <Wifi className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1">{heading}</h3>
            <p className="text-sm text-muted-foreground mb-3">{blurb}</p>
            {writable.length === 1 && (
              <p className="text-xs font-mono break-all text-muted-foreground mb-4">{cardTagUrl(writable[0].slug)}</p>
            )}
            {support.writer ? (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
                style={{ background: 'hsl(var(--accent))' }}>
                <Wifi className="w-4 h-4" />
                {buttonLabel}
              </button>
            ) : (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'hsl(var(--accent) / 0.08)' }}>
                {NFC_BLOCK_TEXT[support.block]}
              </p>
            )}
          </div>
        </div>
      </div>

      {open && <NfcWriteSession cards={writable} memoryKey={memoryKey} heading={heading} onClose={() => setOpen(false)} />}
    </>
  )
}
