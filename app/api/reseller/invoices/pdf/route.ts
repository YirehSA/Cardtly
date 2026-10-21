import { NextResponse } from 'next/server'
import { requireReseller } from '@/lib/reseller'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromInvoice } from '@/lib/billing-view'

// A reseller's own issued invoice as a PDF. Built entirely from the frozen row,
// like the admin route, and only for invoices addressed to this reseller's
// billing client. Drafts are never served: until Cardtly approves one it is
// not an invoice.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireReseller()
  if ('error' in gate) return gate.error
  const { reseller, db } = gate

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !reseller.billing_client_id) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })

  const { data: invoice } = await db.from('invoices').select('*')
    .eq('id', id).eq('client_id', reseller.billing_client_id).maybeSingle()
  if (!invoice || invoice.status === 'draft' || !invoice.from_snapshot) {
    return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
  }

  const { data: lines } = await db.from('invoice_lines').select('*').eq('invoice_id', id).order('position')
  const view = docViewFromInvoice(invoice, lines || [], { settings: null, client: null })
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
