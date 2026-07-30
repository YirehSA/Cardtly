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
  | { ok: true; method: 'native' | 'vcard' }
  | { ok: false; reason: 'denied' | 'error' }

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

  // Web: download a vCard the OS opens into the contacts app.
  try {
    const vcard = buildVcard(contact)
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contact.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'contact'}.vcf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { ok: true, method: 'vcard' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
