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
