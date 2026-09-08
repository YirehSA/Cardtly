// Sending your card to somebody's phone, from your own phone.
//
// WHY THERE IS NO SMS GATEWAY HERE.
//
// The obvious build is a bulk SMS account: a provider, a registered sender ID,
// a server route, and roughly 20 to 35 cents a message on Cardtly's bill. This
// does none of that, and cost is the smallest of the reasons.
//
// A gateway sends from a shortcode. The prospect gets a link from a number
// they have never seen and cannot reply to, which is exactly what a scam looks
// like and exactly what people do not open. A deep link sends from the rep's
// OWN number: it lands in a thread the prospect can answer, under a name that
// is already in their phone if they swapped numbers an hour ago. It also needs
// no Meta Business approval, and it cannot be turned into a machine for
// blasting strangers on our account, which a server-side sender always can.
//
// The trade is that the rep taps send in their own messaging app. That is one
// tap, and it is the tap that makes the message theirs rather than ours.

export type SendChannel = 'whatsapp' | 'sms'

export interface Msisdn {
  /** International digits, no plus sign: 27833454649 */
  digits: string
  /** Grouped for reading back: +27 83 345 4649 */
  pretty: string
}

/**
 * Turns whatever somebody typed into an international number.
 *
 * Handles the four shapes a South African actually types - 083 345 4649,
 * 83 345 4649, +27 83 345 4649, 0027 83 345 4649 - and leaves a number that
 * already carries a country code alone.
 *
 * The default country is an assumption, and an assumption about a phone number
 * is how a card gets sent to a stranger. That is why this returns `pretty` and
 * why the UI prints it back before either button will send: a UK number typed
 * as 07700 900123 resolves to +27 77 009 0012 here, which is wrong, and the
 * only thing that catches it is the sender reading it.
 */
export function normaliseMsisdn(input: string, defaultCc = '27'): Msisdn | null {
  const raw = (input || '').trim()
  if (!raw) return null

  const plus = raw.startsWith('+')
  let d = raw.replace(/\D/g, '')
  if (!d) return null

  if (plus) {
    // Already international. Nothing to add.
  } else if (d.startsWith('00')) {
    d = d.slice(2)
  } else if (d.startsWith('0')) {
    d = defaultCc + d.replace(/^0+/, '')
  } else if (d.length === 9) {
    // A local number with the trunk zero left off: 83 345 4649. Exactly nine,
    // which is what a South African subscriber number is. Accepting "up to
    // nine" here instead let 1234567 through as +27 12 345 67, a number that
    // is not a number - short input has to fail, not get a country code.
    d = defaultCc + d
  }
  // Anything else is assumed to already carry its country code.

  // E.164 allows 15 digits at most. The floor is the length of a complete
  // South African number minus its country code, which is the shortest thing
  // anyone using this will legitimately type.
  if (d.length < 9 || d.length > 15) return null

  return { digits: d, pretty: prettyMsisdn(d, defaultCc) }
}

function prettyMsisdn(digits: string, defaultCc: string): string {
  // Only the local format we can actually claim to know. Everything else is
  // printed as plain international digits rather than grouped wrongly, which
  // would read as confidence we do not have.
  if (defaultCc === '27' && digits.startsWith('27') && digits.length === 11) {
    const n = digits.slice(2)
    return `+27 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
  }
  return `+${digits}`
}

/** Opens WhatsApp with the chat already on that number and the text ready. */
export function whatsappHref(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * Opens the phone's messaging app with the number and body filled in.
 *
 * iOS puts the body after '&', everything else after '?'. The widely copied
 * trick is `sms:+27...?&body=`, which relies on iOS tolerating an empty first
 * parameter - true today, and precisely the kind of thing that stops being
 * true in a point release. Asking which platform we are on is duller and does
 * not depend on a browser quirk holding.
 */
export function smsHref(digits: string, body: string, isIOS: boolean): string {
  const sep = isIOS ? '&' : '?'
  return `sms:+${digits}${sep}body=${encodeURIComponent(body)}`
}

export function isIOSDevice(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  // iPadOS 13+ reports itself as a Mac, so the touch-point count is what
  // separates an iPad from a desktop that has no messaging app at all.
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return ua.includes('Mac') && typeof document !== 'undefined' && navigator.maxTouchPoints > 1
}

export function isPhone(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)
}

// ── What an SMS actually costs the person sending it ────────────────────────
//
// An SMS is billed per 160-character segment, and one character outside the
// GSM-7 alphabet drops the whole message to UCS-2 at 70. A curly apostrophe
// pasted from Word turns a one-message send into two, which nobody would ever
// guess from looking at it - so the composer counts, and says so.

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXTENDED = '^{}\\[~]|€'

const BASIC = new Set(GSM7_BASIC.split(''))
const EXTENDED = new Set(GSM7_EXTENDED.split(''))

export interface SmsCost {
  /** True when a character forced the whole message to the 70-char alphabet. */
  unicode: boolean
  /** Billable length, counting extended GSM characters as the two they are. */
  units: number
  segments: number
}

export function smsCost(body: string): SmsCost {
  let units = 0
  let unicode = false
  for (const ch of body) {
    if (BASIC.has(ch)) units += 1
    else if (EXTENDED.has(ch)) units += 2
    else { unicode = true; break }
  }

  if (unicode) {
    const len = [...body].length
    return { unicode: true, units: len, segments: len <= 70 ? 1 : Math.ceil(len / 67) }
  }
  return { unicode: false, units, segments: units <= 160 ? 1 : Math.ceil(units / 153) }
}

/**
 * The default note, in plain ASCII on purpose.
 *
 * An em dash or a curly quote here would halve every rep's SMS capacity for
 * the life of the feature, because the default is what almost nobody edits.
 */
export function defaultNote(name: string, company?: string | null): string {
  const who = (name || '').trim().split(/\s+/)[0] || 'me'
  return company?.trim()
    ? `Hi, it was good meeting you. This is ${who} from ${company.trim()}. Here is my card:`
    : `Hi, it was good meeting you. This is ${who}. Here is my card:`
}

/**
 * The whole message: the note the rep wrote, then the link.
 *
 * The link is appended rather than sitting inside the editable text, so it
 * cannot be half-deleted while somebody rewrites the sentence in front of it.
 * A card send with no card in it is the one failure this feature can have.
 */
export function composeMessage(note: string, cardUrl: string, channel: SendChannel): string {
  const marked = markUrl(cardUrl, channel)
  const n = note.trim()
  return n ? `${n} ${marked}` : marked
}

/** Tags the link so the owner can see, later, which channel brought them in. */
export function markUrl(cardUrl: string, channel: SendChannel): string {
  const marker = channel === 'whatsapp' ? 'wa' : 'sms'
  return cardUrl.includes('?') ? `${cardUrl}&s=${marker}` : `${cardUrl}?s=${marker}`
}
