import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchCardImage } from '@/lib/card-image'

// The .vcf a visitor gets when they tap Save Contact.
//
// The aim is that the saved contact carries as much of the card as a phone will
// hold: photo, both numbers, WhatsApp, company, title, address, every link, and
// the bio - so the contact is useful months later, not just a name and a number.
//
// Everything here is vCard 3.0, which is what phones import most reliably.
// Where a field has no standard 3.0 equivalent, Apple's item-grouping extension
// is used: other platforms ignore those lines rather than choking on them.

// Every column the vCard can use. Both tables carry all of these.
const COLS = [
  'name', 'email', 'phone', 'work_phone', 'whatsapp', 'company', 'title',
  'website', 'address', 'bio', 'certifications', 'profile_image_url',
  'linkedin_url', 'twitter_url', 'instagram_url', 'facebook_url',
  'link_1_title', 'link_1_url', 'link_2_title', 'link_2_url',
  'link_3_title', 'link_3_url', 'link_4_title', 'link_4_url',
  'link_5_title', 'link_5_url',
].join(', ')

// vCard escaping: comma, semicolon and backslash are structural, and a newline
// inside a value has to become a literal \n or it terminates the line.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .trim()
}

// RFC 2426 folding: no line over 75 octets. Continuations start with a single
// space. This matters most for the base64 photo, which is thousands of
// characters - unfolded, plenty of parsers drop it or import a broken contact.
// Octets, not characters: a bio with a curly apostrophe (three bytes in UTF-8)
// produced a 77-octet line while measuring only 75 characters. Folding also has
// to land on character boundaries, or a multi-byte character split across two
// lines is corrupt when rejoined.
function fold(line: string): string {
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

// "Andre Nel" -> N:Nel;Andre;;;  Phones use N for sorting and for showing a
// first name on its own; with only FN some clients file the contact oddly.
function nameParts(full: string): { given: string; family: string } {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { given: '', family: '' }
  if (parts.length === 1) return { given: parts[0], family: '' }
  return { given: parts[0], family: parts.slice(1).join(' ') }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  // Personal card first, then team card.
  //
  // This only ever queried `cards`, so Save Contact returned 404 on EVERY
  // team card: the public page serves them from `team_cards` and hands the
  // same /api/vcf/<slug> URL to the button, which then downloaded nothing.
  // Silent, because a failed download looks like nothing happening.
  let { data: card } = await supabase.from('cards').select(COLS).eq('slug', slug).maybeSingle()

  if (!card) {
    const { data: teamCard } = await supabase
      .from('team_cards').select(COLS).eq('slug', slug).eq('is_active', true).maybeSingle()
    card = teamCard
  }

  if (!card) {
    return new NextResponse('Not found', { status: 404 })
  }

  const c = card as Record<string, any>
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const cardUrl = `${appUrl}/card/${slug}`
  const { given, family } = nameParts(c.name)

  // The photo, embedded rather than linked, so it survives with no network and
  // shows up as the contact's picture. Kept to 256px JPEG: base64 inflates by a
  // third, and a heavy vCard is one phones refuse to import.
  const photo = await fetchCardImage(c.profile_image_url, { size: 256, forceJpeg: true })

  const customLinks = [1, 2, 3, 4, 5]
    .map(i => ({ title: c[`link_${i}_title`], url: c[`link_${i}_url`] }))
    .filter(l => l.url)

  const socials = [
    { url: c.linkedin_url, service: 'linkedin', label: 'LinkedIn' },
    { url: c.twitter_url, service: 'twitter', label: 'X' },
    { url: c.instagram_url, service: 'instagram', label: 'Instagram' },
    { url: c.facebook_url, service: 'facebook', label: 'Facebook' },
  ].filter(s => s.url)

  // The note is the safety net. NOTE is the one field every phone imports and
  // none of them mangle, so anything that a picky importer might drop is also
  // written here as plain text: the WhatsApp number, and every link with its
  // title. That way the information survives even on a phone that keeps only
  // the fields it recognises.
  const noteLinks = customLinks.map(l => `${l.title ? `${esc(l.title)}: ` : ''}${esc(l.url)}`)
  const note = [
    c.bio ? esc(c.bio) : null,
    c.certifications ? `Certifications: ${esc(c.certifications)}` : null,
    c.whatsapp ? `WhatsApp: ${esc(c.whatsapp)}` : null,
    noteLinks.length ? noteLinks.join('\\n') : null,
    `Digital business card: ${cardUrl}`,
  ].filter(Boolean).join('\\n\\n')

  const lines: (string | null)[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(c.name)}`,
    c.company ? `ORG:${esc(c.company)}` : null,
    c.title ? `TITLE:${esc(c.title)}` : null,
    // Photo early, before any non-standard property. A parser that gives up on
    // something it does not recognise has at least taken the picture by then.
    photo ? `PHOTO;ENCODING=b;TYPE=JPEG:${photo.buffer.toString('base64')}` : null,

    c.email ? `EMAIL;TYPE=INTERNET,WORK:${esc(c.email)}` : null,
    c.phone ? `TEL;TYPE=CELL,VOICE:${esc(c.phone)}` : null,
    c.work_phone ? `TEL;TYPE=WORK,VOICE:${esc(c.work_phone)}` : null,
    // A plain TEL line, only when WhatsApp is a different number - two
    // identical numbers in one contact is noise. When it IS the same number the
    // note says so, so "you can WhatsApp this person" is never lost.
    c.whatsapp && c.whatsapp !== c.phone ? `TEL;TYPE=CELL,VOICE:${esc(c.whatsapp)}` : null,

    // Every link is a plain, ungrouped URL line, and the card comes first.
    //
    // First, because the first URL is what a phone shows as "Website", and the
    // card is the better thing to land on: it is always current and it already
    // lists the personal website. Without it the saved contact would be a
    // snapshot, which undoes the point of a card that updates itself.
    //
    // Plain and ungrouped, because these were written with Apple's item
    // grouping so each could carry a label ("Features", "Pricing"). That turns
    // the property name into `item1.URL`, and Android's importer commonly keeps
    // only the properties it recognises - so the labels cost us the links
    // themselves on the platform most of our users are on. Presence beats
    // labelling; the titles live in the note, where nothing can drop them.
    `URL:${cardUrl}`,
    c.website ? `URL:${esc(c.website)}` : null,
    ...customLinks.map(l => `URL:${esc(l.url)}`),
    ...socials.map(s => `URL:${esc(s.url)}`),

    c.address ? `ADR;TYPE=WORK:;;${esc(c.address)};;;;` : null,
    `NOTE:${note}`,

    // Last on purpose. iOS reads this to show a tappable social row; everything
    // else has the plain URL lines above, so if a parser stops here it has
    // already taken every standard field.
    ...socials.map(s => `X-SOCIALPROFILE;TYPE=${s.service}:${esc(s.url)}`),
    'END:VCARD',
  ]

  const vcf = lines.filter(Boolean).map(l => fold(l as string)).join('\r\n')

  return new NextResponse(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${String(c.name).replace(/[^\w-]+/g, '-')}.vcf"`,
    },
  })
}
