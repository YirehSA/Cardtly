'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Share2, Loader2 } from 'lucide-react'
import { vcardFile } from '@/lib/save-to-phone'
import type { CardContactInput } from '@/lib/capacitor'

interface Props {
  contact: {
    name: string
    title?: string | null
    company?: string | null
    email?: string | null
    phone?: string | null
    work_phone?: string | null
    website?: string | null
    address?: string | null
  }
}

// Passes a contact on to someone else.
//
// The row already had a WhatsApp button, but it opens a chat *with* the
// contact - "Hi Tio, great to connect" - which is the opposite job. There was
// no way to forward someone's details to a colleague, which is most of what a
// sales team does with a lead.
//
// Two routes, in order of how well they carry the details:
//
//   1. The OS share sheet with the .vcf attached. The recipient gets a real
//      contact card they can tap once to save, and the sheet includes WhatsApp
//      along with mail, Signal, AirDrop and the rest.
//   2. A WhatsApp message with the details as text, for desktop browsers with
//      no share sheet. Plain text, because wa.me cannot carry an attachment.

function plainText(c: Props['contact']): string {
  return [
    c.name,
    [c.title, c.company].filter(Boolean).join(' at '),
    c.phone && `Mobile: ${c.phone}`,
    c.work_phone && `Office: ${c.work_phone}`,
    c.email && `Email: ${c.email}`,
    c.website && `Web: ${c.website}`,
    c.address && `Address: ${c.address}`,
  ].filter(Boolean).join('\n')
}

export default function ShareContactButton({ contact }: Props) {
  const [busy, setBusy] = useState(false)

  async function handle() {
    setBusy(true)
    const asInput: CardContactInput = {
      name: contact.name,
      title: contact.title,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      workPhone: contact.work_phone,
      website: contact.website,
      address: contact.address,
    }
    const text = plainText(contact)

    try {
      const file = vcardFile(asInput)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: contact.name, text })
        setBusy(false)
        return
      }
      // A share sheet without file support still beats leaving the page.
      if (navigator.canShare?.({ text })) {
        await navigator.share({ title: contact.name, text })
        setBusy(false)
        return
      }
    } catch (e: any) {
      // Closing the sheet is a choice, not a failure, and not a reason to then
      // throw them into WhatsApp.
      if (e?.name === 'AbortError') { setBusy(false); return }
    }

    // No share sheet: hand it to WhatsApp as text.
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      // Pop-up blocked. Copying is the one thing left that cannot fail
      // silently, and telling them beats a button that does nothing.
      try {
        await navigator.clipboard.writeText(text)
        toast.success('Details copied — paste them into any chat')
      } catch {
        toast.error('Could not open WhatsApp. Allow pop-ups and try again.')
      }
    }
    setBusy(false)
  }

  return (
    <button onClick={handle} disabled={busy}
      title="Send this contact to someone else"
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
      Share
    </button>
  )
}
