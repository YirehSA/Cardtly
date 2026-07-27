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
function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) out.push(' ' + line.slice(i, i + 74))
  return out.join('\r\n')
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

  // Apple item groups let a line carry a custom label. Numbered from 1 and
  // shared across every grouped line, hence one counter for the whole card.
  let item = 0
  const labelled = (line: string, label: string): string[] => {
    item += 1
    return [`item${item}.${line}`, `item${item}.X-ABLabel:${esc(label)}`]
  }

  const customLinks = [1, 2, 3, 4, 5]
    .map(i => ({ title: c[`link_${i}_title`], url: c[`link_${i}_url`] }))
    .filter(l => l.url)

  const socials = [
    { url: c.linkedin_url, service: 'linkedin', label: 'LinkedIn' },
    { url: c.twitter_url, service: 'twitter', label: 'X' },
    { url: c.instagram_url, service: 'instagram', label: 'Instagram' },
    { url: c.facebook_url, service: 'facebook', label: 'Facebook' },
  ].filter(s => s.url)

  // The note carries the things a contact record has nowhere else to put: the
  // bio, any certifications, and the card link in plain text. NOTE is the one
  // field every phone imports and none of them mangle, so the link survives
  // even where a second URL does not.
  const note = [
    c.bio ? esc(c.bio) : null,
    c.certifications ? `Certifications: ${esc(c.certifications)}` : null,
    `Digital business card: ${cardUrl}`,
  ].filter(Boolean).join('\\n\\n')

  const lines: (string | null)[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(c.name)}`,
    c.company ? `ORG:${esc(c.company)}` : null,
    c.title ? `TITLE:${esc(c.title)}` : null,
    c.email ? `EMAIL;TYPE=INTERNET,WORK:${esc(c.email)}` : null,
    c.phone ? `TEL;TYPE=CELL,VOICE:${esc(c.phone)}` : null,
    c.work_phone ? `TEL;TYPE=WORK,VOICE:${esc(c.work_phone)}` : null,
    // Only when it is a different number - otherwise the contact shows the same
    // digits twice.
    ...(c.whatsapp && c.whatsapp !== c.phone
      ? labelled(`TEL;TYPE=CELL,VOICE:${esc(c.whatsapp)}`, 'WhatsApp')
      : []),

    // The Cardtly link IS the first URL, deliberately.
    //
    // Without it the saved contact was a snapshot and nothing more: the only
    // URL was the person's own website, so once the visitor closed the tab the
    // card was unreachable, which quietly undoes the point of a card that
    // updates itself. First because the first URL is what a phone shows as
    // "Website", and the card is the better thing to land on: it is always
    // current and it already lists the personal website.
    //
    // Both are plain URL lines. An earlier attempt used `URL;TYPE=Cardtly:` to
    // label it, which is not valid vCard 3.0 (RFC 2426 defines no TYPE for URL
    // and would not accept that value), so parsers were free to drop the line
    // entirely, i.e. exactly the field this is here to add.
    `URL:${cardUrl}`,
    c.website ? `URL:${esc(c.website)}` : null,
    ...customLinks.flatMap(l =>
      l.title ? labelled(`URL:${esc(l.url)}`, String(l.title)) : [`URL:${esc(l.url)}`]
    ),

    c.address ? `ADR;TYPE=WORK:;;${esc(c.address)};;;;` : null,

    // X-SOCIALPROFILE is what iOS reads to show a tappable social row. Android
    // ignores it, so the same links also go in as labelled URLs above where a
    // title exists - and socials are added here as plain URL lines too, so
    // nothing is lost on a phone that understands neither.
    ...socials.map(s => `X-SOCIALPROFILE;TYPE=${s.service}:${esc(s.url)}`),
    ...socials.map(s => `URL:${esc(s.url)}`),

    photo ? `PHOTO;ENCODING=b;TYPE=JPEG:${photo.buffer.toString('base64')}` : null,
    `NOTE:${note}`,
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
