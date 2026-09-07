import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { renderDocumentPdf } from '@/lib/pdf/render'
import { sampleDocument } from '@/lib/pdf/sample'
import type { DocKind } from '@/lib/billing-docs'

// A sample PDF from the current settings.
//
// @react-pdf needs Node streams, so this cannot run on the edge runtime. It
// fails there with a module resolution error that says nothing about why.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const kindParam = new URL(request.url).searchParams.get('kind')
  const kind: DocKind = kindParam === 'quote' ? 'quote' : kindParam === 'credit_note' ? 'credit_note' : 'invoice'

  const db = adminDb()
  const { data: settings, error } = await db
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  if (error) return migrationMissing()

  // Terms print on a quote, which is where they matter: it is the quote the
  // client accepts and signs.
  let termsBody: string | null = null
  if (kind === 'quote') {
    const { data: t } = await db
      .from('billing_terms').select('body').eq('is_active', true).limit(1)
    termsBody = t?.[0]?.body || null
  }

  try {
    const pdf = await renderDocumentPdf(sampleDocument(settings, kind, termsBody))
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        // inline so it opens in the browser's viewer rather than downloading.
        'Content-Disposition': `inline; filename="Cardtly-${kind}-sample.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not render the PDF' }, { status: 500 })
  }
}
