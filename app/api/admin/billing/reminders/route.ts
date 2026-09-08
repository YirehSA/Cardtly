import { NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { findOverdue } from '@/lib/overdue-chasing'
import { sendInvoiceReminder } from '@/lib/send-invoice'

// The chasing queue, and sending from it.
//
// Sending is a POST, never a side effect of looking. Opening this screen must
// not email anybody, which is why GET only reads.

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const { rows, ladder, autoSend, problems } = await findOverdue(db)
  return NextResponse.json({
    rows, ladder, autoSend, problems,
    totalCents: rows.reduce((n, r) => n + r.outstandingCents, 0),
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const db = adminDb()
  const { rows } = await findOverdue(db)

  // Re-derived from the queue rather than trusting what the browser sent: the
  // stage has to be the one that is actually due, or a stale page could send a
  // final notice to somebody on their first nudge.
  const wanted = Array.isArray(body?.ids) && body.ids.length
    ? rows.filter(r => body.ids.includes(r.id))
    : body?.id
      ? rows.filter(r => r.id === body.id)
      : []

  if (!wanted.length) {
    return NextResponse.json({
      error: 'Nothing to send. The queue may have moved on since this page loaded.',
    }, { status: 409 })
  }

  const sent: string[] = []
  const failed: Array<{ number: string | null; error: string }> = []
  for (const row of wanted) {
    const result = await sendInvoiceReminder(db, row, gate.user.id)
    if (result.ok) sent.push(row.number || row.id)
    else failed.push({ number: row.number, error: result.error })
  }

  return NextResponse.json({ sent: sent.length, sentNumbers: sent, failed })
}
