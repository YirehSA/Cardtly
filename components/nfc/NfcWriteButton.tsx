'use client'

import { useState, type CSSProperties } from 'react'
import { Wifi } from 'lucide-react'
import NfcWriteSession, { useNfcSupport, type NfcCardItem } from '@/components/nfc/NfcWriteSession'

// A button that opens NfcWriteSession, for the admin screens where Cardtly
// writes a customer's cards before posting them. Shown on any device except
// the iOS app (built without NFC): on a computer the window says to use an
// Android phone, which is better than a button that is simply missing.
export default function NfcWriteButton({ cards, memoryKey, heading, label, className, style }: {
  cards: NfcCardItem[]
  memoryKey: string
  heading: string
  label: string
  className?: string
  style?: CSSProperties
}) {
  const support = useNfcSupport()
  const [open, setOpen] = useState(false)
  if (!support || (!support.writer && support.block === 'ios-app')) return null
  if (!cards.some(c => c.slug)) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        <Wifi className="w-3 h-3" />
        {label}
      </button>
      {open && <NfcWriteSession cards={cards} memoryKey={memoryKey} heading={heading} onClose={() => setOpen(false)} />}
    </>
  )
}
