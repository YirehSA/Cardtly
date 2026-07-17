import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const COLS = 'name, email, phone, company, title, website, address'
  let { data: card } = await supabase.from('cards').select(COLS).eq('slug', slug).maybeSingle()

  if (!card) {
    const { data: teamCard } = await supabase
      .from('team_cards').select(COLS).eq('slug', slug).eq('is_active', true).maybeSingle()
    card = teamCard
  }

  if (!card) {
    return new NextResponse('Not found', { status: 404 })
  }

  // The Cardtly link IS the website field, deliberately.
  //
  // Without it the saved contact was a snapshot and nothing more: the only URL
  // was the person's own website, so once the visitor closed the tab the card
  // was unreachable, which quietly undoes the point of a card that updates
  // itself.
  //
  // It goes FIRST because the first URL is what a phone shows as "Website",
  // and the card is the better thing to land on: it is always current and it
  // already lists the personal website, whereas a saved website URL can never
  // reflect a change. The personal site follows as a second URL so nothing is
  // lost.
  //
  // Both are plain URL lines. An earlier attempt used `URL;TYPE=Cardtly:` to
  // label it, which is not valid vCard 3.0 (RFC 2426 defines no TYPE for URL
  // and would not accept that value), so parsers were free to drop the line
  // entirely, i.e. exactly the field this is here to add.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const cardUrl = `${appUrl}/card/${slug}`

  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.name}`,
    card.company ? `ORG:${card.company}` : null,
    card.title ? `TITLE:${card.title}` : null,
    card.email ? `EMAIL:${card.email}` : null,
    card.phone ? `TEL;TYPE=CELL:${card.phone}` : null,
    `URL:${cardUrl}`,
    card.website ? `URL:${card.website}` : null,
    card.address ? `ADR;TYPE=WORK:;;${card.address};;;;` : null,
    // Belt and braces: NOTE is the one field every phone imports and none of
    // them mangle, so the link survives even where a second URL does not.
    `NOTE:Digital business card: ${cardUrl}`,
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n')

  return new NextResponse(vcf, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': `attachment; filename="${card.name.replace(/\s+/g, '-')}.vcf"`,
    },
  })
}
