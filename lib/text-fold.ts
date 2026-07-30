// Line folding for vCard (RFC 2426) and iCalendar (RFC 5545), which share the
// same rule: no line over 75 octets, continuations begin with a single space.
//
// It lives here rather than in either route because two copies of a function
// like this drift. The last time this codebase had two copies of one helper
// (slug generation) they disagreed for months and produced live URLs nobody
// could explain.
//
// Octets, not characters: a bio with a curly apostrophe (three bytes in UTF-8)
// produced a 77-octet line while measuring only 75 characters. The fold also
// has to land on a character boundary, or a multi-byte character split across
// two lines is corrupt when rejoined.

export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line
  const out: string[] = []
  let current = ''
  let limit = 75
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > limit) {
      out.push(current)
      current = ch
      limit = 74 // a continuation's leading space takes one octet
    } else {
      current += ch
    }
  }
  if (current) out.push(current)
  return out.map((seg, i) => (i === 0 ? seg : ' ' + seg)).join('\r\n')
}
