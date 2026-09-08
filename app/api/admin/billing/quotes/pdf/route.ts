import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/admin-api'
import { requireQuoteAccess } from '@/lib/rep-check'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromQuote } from '@/lib/billing-view'

// An issued quote as a PDF, built entirely from the row. A draft renders
// against current settings and is marked DRAFT, which is a preview rather than
// a document.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireQuoteAccess()
  if ('error' in gate) return gate.error
  const actor = gate.actor

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which quote?' }, { status: 400 })

  const db = adminDb()
  // Scoped, not just gated: a rep with somebody else's quote id must get a 404
  // rather than a PDF of their pricing.
  let query = db.from('quotes').select('*').eq('id', id)
  if (!actor.isAdmin) query = query.eq('created_by', actor.userId)
  const { data: quote } = await query.maybeSingle()
  if (!quote) return NextResponse.json({ error: 'No such quote' }, { status: 404 })

  const { data: lines } = await db
    .from('quote_lines').select('*').eq('quote_id', id).order('position')

  let settings = null
  let client = null
  if (!quote.from_snapshot) {
    settings = (await db.from('billing_settings').select('*').eq('id', true).maybeSingle()).data
    if (quote.client_id) {
      client = (await db.from('billing_clients').select('*').eq('id', quote.client_id).maybeSingle()).data
    }
    // A draft preview should still show the terms the client would be agreeing
    // to, or it is a preview of a different document.
    const { data: terms } = await db.from('billing_terms').select('body').eq('is_active', true).limit(1)
    quote.terms_snapshot = terms?.[0]?.body || null
  }

  const view = docViewFromQuote(quote, lines || [], { settings, client })
  try {
    const pdf = await renderDocumentPdf(view)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFilename(view)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not render the PDF' }, { status: 500 })
  }
}
