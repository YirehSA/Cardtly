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

  // The Cardtly link goes IN the contact.
  //
  // Without this, saving the contact captured a snapshot and nothing more:
  // the only URL was the person's own website, so once the visitor closed the
  // tab, the card itself was unreachable. That quietly undoes the whole point
  // of a card that updates itself, because the saved contact could never
  // reflect a change.
  //
  // Ordered after the personal website so a phone's "Website" field still
  // shows what the owner chose; the Cardtly link is labelled so it reads as
  // what it is.
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
    card.website ? `URL:${card.website}` : null,
    `URL;TYPE=Cardtly:${cardUrl}`,
    card.address ? `ADR;TYPE=WORK:;;${card.address};;;;` : null,
    // NOTE is the field every phone shows and none of them mangle, so the
    // link survives even on an OS that drops the second URL.
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
