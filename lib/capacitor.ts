'use client'

// Capacitor native bridge helpers.
//
// On the web, isNativeApp() returns false and the native helpers throw
// or no-op so callers can fall back to web behavior (vCard download,
// navigator.share, etc.).
//
// On the Cardtly Android app, isNativeApp() returns true and the
// helpers invoke real device APIs via Capacitor plugins.

import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Contacts, PhoneType, EmailType, PostalAddressType } from '@capacitor-community/contacts'
import { NFC } from '@exxili/capacitor-nfc'

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getNativePlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  try {
    return Capacitor.getPlatform() as 'ios' | 'android' | 'web'
  } catch {
    return 'web'
  }
}

// ── Share ──────────────────────────────────────────────────────────────────

export interface ShareOpts {
  title?: string
  text?: string
  url: string
  dialogTitle?: string
}

export async function shareNative(opts: ShareOpts): Promise<void> {
  if (isNativeApp()) {
    try {
      await Share.share(opts)
      return
    } catch (err) {
      // User dismissed the share sheet, or plugin failed. Fall through to web.
      console.warn('Native share failed, falling back to web', err)
    }
  }
  // Web fallback
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareOpts) => Promise<void> }).share(opts)
      return
    } catch {
      // user dismissed
    }
  }
  // Final fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(opts.url)
  }
}

// ── Contacts ───────────────────────────────────────────────────────────────

export interface CardContactInput {
  name: string
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  workPhone?: string | null
  whatsapp?: string | null
  website?: string | null
  address?: string | null
  bio?: string | null
  /** The card's own URL. Saved first, so the contact keeps a way back to a card
   *  that updates itself - not just a snapshot of today's details. */
  cardUrl?: string | null
  /** Profile photo URL. Converted to a small JPEG and embedded as the contact
   *  picture; skipped silently if it cannot be fetched. */
  photoUrl?: string | null
}

function splitName(full: string): { given: string; family: string | null } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { given: parts[0], family: null }
  return { given: parts[0], family: parts.slice(1).join(' ') }
}

/**
 * Save the card as a contact on the device using the native Contacts API.
 * Caller should check isNativeApp() first; this throws on web.
 */
export async function saveContactNative(card: CardContactInput): Promise<void> {
  if (!isNativeApp()) {
    throw new Error('Native contact save is only available in the Cardtly app')
  }

  // Permission check
  const perm = await Contacts.checkPermissions()
  if (perm.contacts !== 'granted') {
    const requested = await Contacts.requestPermissions()
    if (requested.contacts !== 'granted') {
      throw new Error('Contacts permission denied')
    }
  }

  const { given, family } = splitName(card.name)

  // The office number was dropped here entirely, so a contact saved in the app
  // kept one number where the same contact saved from the web kept both. The
  // web vCard has carried workPhone for a while; this had not.
  const phones = [
    card.phone ? { type: PhoneType.Mobile, label: 'Mobile', number: card.phone } : null,
    card.workPhone && card.workPhone !== card.phone
      ? { type: PhoneType.Work, label: 'Work', number: card.workPhone }
      : null,
    card.whatsapp && card.whatsapp !== card.phone && card.whatsapp !== card.workPhone
      ? { type: PhoneType.Custom, label: 'WhatsApp', number: card.whatsapp }
      : null,
  ].filter(Boolean) as { type: PhoneType; label: string; number: string }[]

  const emails = card.email
    ? [{ type: EmailType.Work, label: 'Work', address: card.email }]
    : []

  const postalAddresses = card.address
    ? [{ type: PostalAddressType.Work, label: 'Work', street: card.address }]
    : []

  // Card URL first: the whole point of a digital card is that it stays current,
  // so the contact needs a way back to it. This used to save only the person's
  // own website, which meant a saved contact was frozen at the moment it was
  // saved - the same gap the web vCard already avoided.
  const urls = [card.cardUrl, card.website].filter(Boolean) as string[]

  const note = [
    card.bio || null,
    card.cardUrl ? `Digital business card: ${card.cardUrl}` : null,
  ].filter(Boolean).join('\n\n')

  // The contact picture. Routed through our converter because photos are stored
  // as WebP and the plugin wants base64 of something the OS can decode; JPEG is
  // the safe choice. Best effort - a contact without a picture is fine, a failed
  // save is not, so any problem here is swallowed.
  let image: string | undefined
  if (card.photoUrl) {
    try {
      const res = await fetch(`/api/email-image?url=${encodeURIComponent(card.photoUrl)}`)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        image = btoa(binary)
      }
    } catch {
      // no picture, carry on
    }
  }

  await Contacts.createContact({
    contact: {
      name: { given, family: family || undefined },
      organization: card.company || card.title
        ? { company: card.company || undefined, jobTitle: card.title || undefined }
        : undefined,
      phones: phones.length > 0 ? phones : undefined,
      emails: emails.length > 0 ? emails : undefined,
      postalAddresses: postalAddresses.length > 0 ? postalAddresses : undefined,
      urls: urls.length > 0 ? urls : undefined,
      note: note || undefined,
      image: image ? { base64String: image } : undefined,
    },
  })
}

// ── NFC ────────────────────────────────────────────────────────────────────

/**
 * Returns true if the device has an NFC chip and the plugin can use it.
 * Returns false on web, on Android without NFC hardware, on iOS without
 * core NFC entitlement, etc.
 */
export async function isNFCSupported(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { supported } = await NFC.isSupported()
    return supported
  } catch {
    return false
  }
}

/**
 * Write a URL to a blank or rewritable NFC tag. Caller is responsible for
 * showing UI that tells the user to hold a tag against the back of their
 * phone. The promise resolves when the write completes, or rejects on
 * error / cancel.
 */
export async function writeNFCTag(url: string, opts?: {
  onWaiting?: () => void
  signal?: AbortSignal
}): Promise<void> {
  if (!isNativeApp()) {
    throw new Error('NFC write is only available in the Cardtly app')
  }

  return new Promise((resolve, reject) => {
    let resolved = false
    let unsubscribeWrite: (() => void) | undefined
    let unsubscribeError: (() => void) | undefined

    const cleanup = () => {
      try { unsubscribeWrite?.() } catch {}
      try { unsubscribeError?.() } catch {}
      try { NFC.cancelWriteAndroid() } catch {}
    }

    unsubscribeWrite = NFC.onWrite(() => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve()
    })

    unsubscribeError = NFC.onError((err) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(new Error(err.error || 'NFC error'))
    })

    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => {
        if (resolved) return
        resolved = true
        cleanup()
        reject(new Error('Cancelled'))
      })
    }

    // Kick off the write. The plugin returns once it begins listening for
    // a tag; the actual write result comes via the onWrite / onError
    // listeners above.
    opts?.onWaiting?.()
    NFC.writeNDEF({
      records: [{ type: 'U', payload: url }],
    }).catch((err) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(err)
    })
  })
}
