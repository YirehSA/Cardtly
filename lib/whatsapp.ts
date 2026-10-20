// Builds a wa.me click-to-chat link from a phone number. Used so a
// card owner can WhatsApp a lead in one tap - no WhatsApp Business
// API needed (that's only required to PUSH messages to people).

// Normalise a phone number to international digits (no +, no spaces)
// for wa.me. Best-effort: South African local numbers (0XXXXXXXXX)
// become 27XXXXXXXXX; 00-prefixed and +-prefixed international numbers
// are handled; anything already in country-code form is left as-is.
export function toIntlDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 10) d = '27' + d.slice(1) // SA local
  return d
}

// Returns a https://wa.me/... link, or null if the number is unusable.
export function waLink(phone: string | null | undefined, text?: string): string | null {
  const d = toIntlDigits(phone || '')
  if (d.length < 9) return null // too short to be a real number
  const base = `https://wa.me/${d}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

// THE APP ITSELF, NOT A WEB PAGE ABOUT IT.
//
// wa.me is a web address, and plenty of places treat it as one. Inside the
// Cardtly Android app it is not a Cardtly page, so Capacitor hands it to the
// phone's browser; tapped in Gmail or Outlook on a phone it opens in their
// built-in browser. Either way the card owner lands on WhatsApp's "Continue to
// chat" web page instead of in the chat (Andre, 2026-10-20). whatsapp://send
// is the app's own address: the phone opens WhatsApp, or WhatsApp Business,
// directly. Null when the number is unusable.
export function waAppLink(phone: string | null | undefined, text?: string): string | null {
  const d = toIntlDigits(phone || '')
  if (d.length < 9) return null
  return `whatsapp://send?phone=${d}${text ? `&text=${encodeURIComponent(text)}` : ''}`
}

// For an EMAIL. Most mail apps refuse to open a whatsapp:// link, so an email
// button goes to cardtly.com/wa, which opens the app from a tap (see
// app/wa). The number and the message ride in the # part of the address,
// which a browser never sends to a server, so neither Cardtly nor its host
// logs a lead's phone number. Null when the number is unusable.
export function waBridgeLink(phone: string | null | undefined, text?: string): string | null {
  const d = toIntlDigits(phone || '')
  if (d.length < 9) return null
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com').replace(/\/$/, '')
  const params = new URLSearchParams({ phone: d })
  if (text) params.set('text', text)
  return `${appUrl}/wa#${params.toString()}`
}

// Opens WhatsApp with a message pre-filled and NO recipient, so the person
// tapping picks who it goes to. Crucially, that includes themselves:
// WhatsApp's "Message yourself" chat is a normal contact in the picker.
//
// This is the only honest way to get a card into a stranger's WhatsApp. You
// cannot send TO someone who tapped an NFC card: a tap is just a URL opening
// in their browser, so there is no number, no identity, nothing. And pushing
// a WhatsApp to a number you were never given needs the Business API plus
// prior opt-in, which a stranger tapping a card has not granted.
//
// So instead of us messaging them, they message themselves, in one tap.
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
