'use client'

import { isNativeApp, saveContactNative, type CardContactInput } from '@/lib/capacitor'

// Saves an arbitrary contact (e.g. a scanned card, or a lead in the
// Contacts list) to the user's phone. In the Cardtly app it writes
// straight to the native address book; on web it builds a vCard and
// triggers a download, which phones open into "Add contact".

function escapeVcard(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildVcard(c: CardContactInput): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  lines.push(`FN:${escapeVcard(c.name)}`)
  // N: family;given;;; - best-effort split
  const parts = c.name.trim().split(/\s+/)
  const given = parts[0] || ''
  const family = parts.slice(1).join(' ')
  lines.push(`N:${escapeVcard(family)};${escapeVcard(given)};;;`)
  if (c.company || c.title) lines.push(`ORG:${escapeVcard(c.company || '')}`)
  if (c.title) lines.push(`TITLE:${escapeVcard(c.title)}`)
  if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(c.phone)}`)
  // The office number was missing entirely, so a scanned card that had both
  // saved only one of them.
  if (c.workPhone && c.workPhone !== c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVcard(c.workPhone)}`)
  // TYPE=WhatsApp is not a valid vCard 3.0 type (RFC 2426 defines a fixed set),
  // so parsers were free to drop the line - the same mistake that once hid the
  // card URL in /api/vcf. A plain CELL line always imports.
  if (c.whatsapp && c.whatsapp !== c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(c.whatsapp)}`)
  if (c.email) lines.push(`EMAIL;TYPE=WORK:${escapeVcard(c.email)}`)
  if (c.website) lines.push(`URL:${escapeVcard(c.website)}`)
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(c.address)};;;;`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export type SaveToPhoneResult =
  | { ok: true; method: 'native' | 'share' | 'vcard' }
  | { ok: false; reason: 'denied' | 'cancelled' | 'error' }

/** The contact as a .vcf file, for the share sheet or a download. */
export function vcardFile(contact: CardContactInput): File {
  const name = contact.name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'contact'
  return new File([buildVcard(contact)], `${name}.vcf`, { type: 'text/vcard' })
}

export async function saveToPhone(contact: CardContactInput): Promise<SaveToPhoneResult> {
  // Native app: write straight to the address book.
  if (isNativeApp()) {
    try {
      await saveContactNative(contact)
      return { ok: true, method: 'native' }
    } catch (e: any) {
      if (/denied/i.test(e?.message || '')) return { ok: false, reason: 'denied' }
      return { ok: false, reason: 'error' }
    }
  }

  // Share sheet first, where the browser has one. A .vcf handed to the OS
  // opens straight into "Add contact", and it is the only route that works
  // inside an in-app browser - WhatsApp's and Instagram's have no download
  // manager, so the anchor click below does nothing at all there. It also does
  // not throw when it is ignored, which is why this used to report success and
  // save nothing.
  const file = vcardFile(contact)
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: contact.name })
      return { ok: true, method: 'share' }
    } catch (e: any) {
      // Dismissing the sheet is a choice, not a failure.
      if (e?.name === 'AbortError') return { ok: false, reason: 'cancelled' }
      // Anything else: fall through and try the download.
    }
  }

  // Otherwise download the vCard, which phones open into "Add contact".
  try {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { ok: true, method: 'vcard' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
