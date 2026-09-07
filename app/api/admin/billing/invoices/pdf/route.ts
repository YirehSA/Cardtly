import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromInvoice } from '@/lib/billing-view'

// An issued invoice as a PDF, built ENTIRELY from the row.
//
// Nothing here reads billing_settings. That is the whole point of snapshotting
// at issue: this must produce the same document in five years, after the bank
// details change and the address moves.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const db = adminDb()
  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })

  const { data: lines } = await db
    .from('invoice_lines').select('*').eq('invoice_id', id).order('position')

  // A draft has no snapshots yet, so it renders against current settings and
  // is marked DRAFT on the page. That is a preview, not a document.
  let settings = null
  let client = null
  if (!invoice.from_snapshot) {
    settings = (await db.from('billing_settings').select('*').eq('id', true).maybeSingle()).data
    if (invoice.client_id) {
      client = (await db.from('billing_clients').select('*').eq('id', invoice.client_id).maybeSingle()).data
    }
  }

  const view = docViewFromInvoice(invoice, lines || [], { settings, client })
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
