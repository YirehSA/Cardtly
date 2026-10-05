import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromPurchaseOrder } from '@/lib/billing-view'

// A purchase order as a PDF, built entirely from its row: the buyer and
// supplier copied when it was raised, the signatures as they were signed.
// Unsigned, the buyer's block prints empty lines so it can be signed by hand.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which purchase order?' }, { status: 400 })

  const db = adminDb()
  const { data: po } = await db.from('purchase_orders').select('*').eq('id', id).maybeSingle()
  if (!po) return NextResponse.json({ error: 'No such purchase order' }, { status: 404 })
  const { data: lines } = await db
    .from('purchase_order_lines').select('*').eq('purchase_order_id', id).order('position')

  const view = docViewFromPurchaseOrder(po, lines || [])
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
