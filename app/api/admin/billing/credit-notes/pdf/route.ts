import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromCreditNote } from '@/lib/billing-view'

// A credit note as a PDF. Headed CREDIT NOTE, or TAX CREDIT NOTE when the
// invoice it corrects carried a VAT number - documentTitle decides that from
// the snapshot, so it matches the original rather than today's settings.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which credit note?' }, { status: 400 })

  const db = adminDb()
  const { data: note } = await db.from('credit_notes').select('*').eq('id', id).maybeSingle()
  if (!note) return NextResponse.json({ error: 'No such credit note' }, { status: 404 })

  const { data: invoice } = await db
    .from('invoices').select('*').eq('id', note.invoice_id).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'The invoice has gone.' }, { status: 404 })

  let settings = null
  if (!note.from_snapshot && !invoice.from_snapshot) {
    settings = (await db.from('billing_settings').select('*').eq('id', true).maybeSingle()).data
  }

  const view = docViewFromCreditNote(note, invoice, { settings })
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
