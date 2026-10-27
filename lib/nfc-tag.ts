// What goes on an NFC card, and where one can be written from.
//
// Built 2026-10-27 so cards can be written from Cardtly itself rather than the
// NFC Tools app, one at a time or a whole team in a row (lib/nfc-write,
// components/nfc/NfcWriteSession).
//
// THE LINK. A written tag is permanent: it goes out on a card and is tapped for
// years. The first writer put https://cardtly.com/<slug> on it, which is not a
// route at all (a 404), so every tag it wrote opened "not found". It is the
// same /card/<slug> link the QR code carries, on the www host the site is
// served from, so a tap opens the card with no redirect in between. ?s=nfc
// tells a tap apart from a scan in analytics (lib/card-sources).
//
// WHERE IT WORKS:
//   - the Cardtly Android app, through its NFC plugin. That plugin's write
//     uses an Android 13 call, so on an older phone it would take the app down
//     rather than fail; there the browser is offered instead.
//   - Chrome on Android, through Web NFC. No app needed.
//   - not iPhone (Safari has no Web NFC, and the iOS app is built without its
//     NFC plugin: see ios/App/App/Info.plist), and not a computer.
//
// Pure and relative-imported, so scripts/check-nfc-write can compile and run it.

import { SOURCE_NFC } from './card-sources'
import { IOS_APP_UA_TAG } from './app-platform'

export const NFC_TAG_ORIGIN = 'https://www.cardtly.com'

/** The link written onto a card's NFC tag. */
export function cardTagUrl(slug: string): string {
  return `${NFC_TAG_ORIGIN}/card/${encodeURIComponent(slug)}?s=${SOURCE_NFC}`
}

/** The oldest Android whose app can write a tag (the plugin needs API 33). */
export const APP_WRITE_MIN_ANDROID = 13

export function androidVersion(ua: string): number | null {
  const m = /Android (\d+)/.exec(ua || '')
  return m ? Number(m[1]) : null
}

export type NfcWriter = 'app' | 'browser'

/** Why writing is not possible here, in words for the person holding the phone. */
export type NfcBlock = 'ios-app' | 'old-android-app' | 'no-nfc' | 'iphone' | 'computer'

export interface NfcEnv {
  ua: string
  /** Running inside the Cardtly app (Capacitor). */
  inApp: boolean
  /** The app's NFC plugin reports NFC hardware. Only asked inside the app. */
  appHasNfc: boolean
  /** The browser has Web NFC (window.NDEFReader). */
  hasWebNfc: boolean
}

/** Which writer to use, or why there is none. */
export function pickNfcWriter(env: NfcEnv): { writer: NfcWriter } | { writer: null; block: NfcBlock } {
  if (env.ua.includes(IOS_APP_UA_TAG)) return { writer: null, block: 'ios-app' }
  if (env.inApp) {
    const v = androidVersion(env.ua)
    if (v !== null && v < APP_WRITE_MIN_ANDROID) return { writer: null, block: 'old-android-app' }
    return env.appHasNfc ? { writer: 'app' } : { writer: null, block: 'no-nfc' }
  }
  if (env.hasWebNfc) return { writer: 'browser' }
  if (/iPhone|iPad|iPod/.test(env.ua)) return { writer: null, block: 'iphone' }
  if (androidVersion(env.ua) !== null) return { writer: null, block: 'no-nfc' }
  return { writer: null, block: 'computer' }
}

export const NFC_BLOCK_TEXT: Record<NfcBlock, string> = {
  'ios-app': 'NFC cards cannot be written on iPhone.',
  'old-android-app': `Writing NFC cards in the app needs Android ${APP_WRITE_MIN_ANDROID} or newer. Open cardtly.com in Chrome on this phone and sign in: Chrome can write them.`,
  'no-nfc': 'This phone has no NFC, or it is switched off. Turn NFC on in the phone\'s settings and open this page again.',
  'iphone': 'iPhones cannot write NFC cards from a web page. Use an Android phone: the Cardtly app, or Chrome.',
  'computer': 'Writing NFC cards needs an Android phone. Open this page there, in the Cardtly app or in Chrome.',
}

/** A failed write, in words. Web NFC rejects with a DOMException name; the app's plugin with its own message. */
export function nfcErrorText(name: string | undefined, message: string | undefined): string {
  switch (name) {
    case 'AbortError': return 'Stopped.'
    case 'NotAllowedError': return 'Chrome was not allowed to use NFC. Allow NFC for cardtly.com when Chrome asks, and check NFC is on in the phone\'s settings.'
    case 'NotSupportedError': return 'This phone cannot write NFC cards.'
    case 'NotReadableError': return 'NFC is off or busy. Turn NFC on in the phone\'s settings and try again.'
    case 'NetworkError': return 'The card moved away before it finished. Hold it still against the phone and try again.'
  }
  const m = message || ''
  if (/not writable|read.?only/i.test(m)) return 'This card is locked and cannot be written. Use a blank card.'
  if (/too large/i.test(m)) return 'This card is too small for the link. Use an NTAG213 card or larger.'
  if (/does not support NDEF/i.test(m)) return 'This card is not an NFC card that can hold a link. Use an NTAG213, 215 or 216 card.'
  if (/I\/O|tag was lost|TagLost/i.test(m)) return 'The card moved away before it finished. Hold it still against the phone and try again.'
  return m || 'The card could not be written. Try again.'
}
