import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { sendInvoiceEmail } from '@/lib/send-invoice'

// Emailing an invoice by hand.
//
// The work lives in lib/send-invoice, shared with the chasing queue and the
// daily cron. Three callers producing three slightly different emails is how
// one of them ends up without the banking details.

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const result = await sendInvoiceEmail(adminDb(), {
    invoiceId: body.id,
    to: body.to,
    cc: body.cc,
    message: body.message,
    reminder: !!body.reminder,
    actor: gate.user.id,
  })

  if (!result.ok) {
    // A draft, a cancelled invoice or a missing address is the caller's problem
    // to fix; anything else came back from Resend.
    const status = /draft|cancelled|email address/i.test(result.error) ? 409 : 502
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true, to: result.to, messageId: result.messageId })
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const db = adminDb()
  const { data } = await db
    .from('document_events').select('*')
    .eq('doc_type', 'invoice').eq('doc_id', id)
    .in('event', ['sent', 'reminder_sent'])
    .order('created_at', { ascending: false })

  return NextResponse.json({ sends: data || [] })
}
