'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Smartphone, Loader2 } from 'lucide-react'
import { saveToPhone } from '@/lib/save-to-phone'

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

// Adds a contact to the user's phone - native address book in the
// Cardtly app, vCard download on web. Used on every row in the
// Contacts list (leads and scanned cards alike).
export default function AddToPhoneButton({ contact }: Props) {
  const [busy, setBusy] = useState(false)

  async function handle() {
    setBusy(true)
    const r = await saveToPhone({
      name: contact.name,
      title: contact.title,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      workPhone: contact.work_phone,
      website: contact.website,
      address: contact.address,
    })
    if (r.ok) {
      toast.success(r.method === 'native' ? 'Added to your phone contacts' : 'Contact downloaded — open it to add')
    } else if (r.reason === 'denied') {
      toast.error('Contacts permission denied')
    } else {
      toast.error('Could not add to phone')
    }
    setBusy(false)
  }

  return (
    <button onClick={handle} disabled={busy}
      title="Add to your phone contacts"
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Smartphone className="w-3 h-3" />}
      Add to phone
    </button>
  )
}
