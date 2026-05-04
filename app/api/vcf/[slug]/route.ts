import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: card } = await supabase
    .from('cards')
    .select('name, email, phone, company, title, website, address')
    .eq('slug', slug)
    .single()

  if (!card) {
    return new NextResponse('Not found', { status: 404 })
  }

  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.name}`,
    card.company ? `ORG:${card.company}` : null,
    card.title ? `TITLE:${card.title}` : null,
    card.email ? `EMAIL:${card.email}` : null,
    card.phone ? `TEL;TYPE=CELL:${card.phone}` : null,
    card.website ? `URL:${card.website}` : null,
    card.address ? `ADR;TYPE=WORK:;;${card.address};;;;` : null,
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
