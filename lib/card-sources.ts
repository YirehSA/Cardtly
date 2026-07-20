// How someone arrived at a card, and what each arrival is called everywhere.
//
// A QR scan, an NFC tap and a link someone pasted into WhatsApp all just open
// the same URL in a browser, so nothing in the request distinguishes them. The
// links Cardtly generates therefore carry an ?s= marker, read on the card page
// and logged as its own event type.
//
// One module because the marker is written in one place (the QR endpoint, the
// signature builder, the background builder, the NFC writer), read in another
// (CardTracker) and labelled in a third (the analytics page). Three hand-kept
// copies of the same string list is how "email signature scans" silently spent
// months being counted as plain QR scans.
//
// The ids are baked into printed codes and written NFC tags, so they must not
// change - a renamed id orphans every card already carrying it. Labels are free
// to be reworded.

export const CARD_SOURCES = [
  { id: 'qr',       eventType: 'qr_scan',       label: 'QR code scan' },
  { id: 'nfc',      eventType: 'nfc_tap',       label: 'NFC card tap' },
  { id: 'email',    eventType: 'email_click',   label: 'Email signature link' },
  { id: 'email-qr', eventType: 'email_qr_scan', label: 'Email signature QR' },
  { id: 'vbg',      eventType: 'vbg_scan',      label: 'Virtual background' },
] as const

// Derived from the list, not written out beside it. An earlier version
// declared the union by hand next to a reduce() that pretended to check the
// two agreed - it could not, because reduce into `{} as Record<...>` type
// checks whatever it is given. Deriving it means adding a source above is the
// only edit needed, and no drift is possible.
export type CardSource = (typeof CARD_SOURCES)[number]
export type CardSourceEventType = CardSource['eventType']

// The marker each surface writes. Referenced rather than typed inline so a
// surface cannot quietly drift onto another's id, which is exactly how the
// signature and the virtual background both ended up marked 'qr'.
export const SOURCE_QR = 'qr'
export const SOURCE_NFC = 'nfc'
export const SOURCE_EMAIL_LINK = 'email'
export const SOURCE_EMAIL_QR = 'email-qr'
export const SOURCE_VIRTUAL_BG = 'vbg'

const BY_ID = new Map<string, CardSource>(CARD_SOURCES.map(s => [s.id, s]))

export function sourceById(id: string | null | undefined): CardSource | null {
  return id ? BY_ID.get(id) ?? null : null
}

/** Every event type that represents an arrival, for the analytics split. */
export const SOURCE_EVENT_TYPES = CARD_SOURCES.map(s => s.eventType)

export function labelForEventType(eventType: string): string | null {
  return CARD_SOURCES.find(s => s.eventType === eventType)?.label ?? null
}

// Only ids we know are accepted, so a stray or hand-edited ?s= cannot invent an
// event type in the table.
export function isKnownSource(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id)
}
