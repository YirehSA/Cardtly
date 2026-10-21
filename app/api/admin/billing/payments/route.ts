import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { allocationPlan, statusAfterPayment, unallocatedCents, invoiceOutstanding, formatMoney } from '@/lib/billing-docs'
import { applyPrepaidPeriod } from '@/lib/prepaid'

// Money in, then money allocated.
//
// Loading a receipt records what landed in the bank. Allocating decides which
// invoices it settles. They are separate because both of the awkward cases are
// real: one EFT covering three invoices, and one EFT nobody can identify yet.
// A receipt with unallocated cents is unapplied cash, which is a normal state.
//
// invoices.paid_cents is NOT written here. A trigger keeps it as the sum of the
// allocations, so it is right no matter what wrote them. This route owns only
// the status wording, which comes from statusAfterPayment.

export const runtime = 'nodejs'

const METHODS = ['eft', 'paystack', 'cash', 'card', 'other']

/** What has been credited against each of these invoices. */
async function creditsFor(db: any, invoiceIds: string[]): Promise<Record<string, number>> {
  if (!invoiceIds.length) return {}
  const { data } = await db
    .from('credit_notes').select('invoice_id, total_cents')
    .in('invoice_id', invoiceIds).eq('status', 'issued')
  const out: Record<string, number> = {}
  for (const c of data || []) out[c.invoice_id] = (out[c.invoice_id] || 0) + (c.total_cents || 0)
  return out
}

/** Allocations as a request sends them, cleaned. */
function allocationsFrom(raw: unknown): Array<{ invoiceId: string; amountCents: number }> {
  return (Array.isArray(raw) ? raw : [])
    .map((a: any) => ({ invoiceId: String(a?.invoice_id || ''), amountCents: Math.round(Number(a?.amount_cents)) }))
    .filter(a => a.invoiceId && Number.isFinite(a.amountCents) && a.amountCents > 0)
}

/**
 * Can this money go on these invoices? A sentence saying why not, or null.
 *
 * Each invoice must be this client's, issued (a draft has no number and owes
 * nothing yet), and still owe at least what is put on it. Paying an invoice
 * more than it owes would read as paid while the extra vanished from the
 * client's account; the extra belongs on the receipt as unapplied cash.
 * When a receipt is being re-allocated, what it already put on an invoice
 * counts as owing again.
 */
async function allocationProblem(
  db: any,
  clientId: string | null,
  allocations: Array<{ invoiceId: string; amountCents: number }>,
  excludeReceiptId?: string,
): Promise<string | null> {
  if (!allocations.length) return null
  if (!clientId) return 'Say which client this payment is from before putting it on an invoice.'
  const ids = [...new Set(allocations.map(a => a.invoiceId))]
  const { data: invoices } = await db
    .from('invoices').select('id, number, client_id, status, total_cents, paid_cents').in('id', ids)
  const byId = Object.fromEntries((invoices || []).map((i: any) => [i.id, i]))

  const mine: Record<string, number> = {}
  if (excludeReceiptId) {
    const { data: rows } = await db
      .from('billing_payments').select('invoice_id, amount_cents').eq('receipt_id', excludeReceiptId)
    for (const r of rows || []) mine[r.invoice_id] = (mine[r.invoice_id] || 0) + (r.amount_cents || 0)
  }
  const credited = await creditsFor(db, ids)

  const asked: Record<string, number> = {}
  for (const a of allocations) asked[a.invoiceId] = (asked[a.invoiceId] || 0) + a.amountCents

  for (const id of ids) {
    const inv = byId[id]
    if (!inv) return 'One of those invoices no longer exists. Reload and choose again.'
    const name = inv.number || 'That draft'
    if (inv.client_id !== clientId) return `${name} belongs to a different client, so this payment cannot settle it.`
    if (inv.status === 'draft') return `${name} is still a draft. Issue it first, then put the payment on it.`
    if (['cancelled', 'written_off'].includes(inv.status)) return `${name} is ${inv.status.replace('_', ' ')}, so nothing can be paid on it.`
    const owing = invoiceOutstanding(inv.total_cents || 0, (inv.paid_cents || 0) - (mine[id] || 0), credited[id] || 0)
    if (asked[id] > owing) {
      return owing > 0
        ? `${name} only has ${formatMoney(owing)} left to pay, not ${formatMoney(asked[id])}. Put ${formatMoney(owing)} on it; the rest stays on the client's account as unapplied.`
        : `${name} has nothing left to pay.`
    }
  }
  return null
}

async function restatus(db: any, invoiceIds: string[]) {
  if (!invoiceIds.length) return
  // Re-read AFTER the trigger has recomputed paid_cents, or the status would be
  // decided from the figure as it was before the allocation landed.
  const { data: invoices } = await db
    .from('invoices').select('id, total_cents, paid_cents, due_at, status').in('id', invoiceIds)
  const credited = await creditsFor(db, invoiceIds)

  for (const i of invoices || []) {
    if (['draft', 'cancelled', 'written_off'].includes(i.status)) continue
    const next = statusAfterPayment(i.total_cents, i.paid_cents, i.due_at, new Date(), credited[i.id] || 0)
    if (next !== i.status) {
      await db.from('invoices').update({ status: next, updated_at: new Date().toISOString() }).eq('id', i.id)
    }
    // Fully paid: a prepaid invoice switches its team on for its months.
    // Called whenever the invoice reads as paid, not only on the change, so
    // a period set after the payment landed is still applied; applying is
    // idempotent (lib/prepaid claims the invoice first).
    if (next === 'paid') await applyPrepaidPeriod(db, i.id)
  }
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const url = new URL(request.url)
  const clientId = url.searchParams.get('client_id')
  const db = adminDb()

  let q = db.from('billing_receipts').select('*').order('received_on', { ascending: false }).limit(300)
  if (clientId) q = q.eq('client_id', clientId)
  const { data: receipts, error } = await q
  if (error) return migrationMissing('Payments')

  const ids = (receipts || []).map((r: any) => r.id)
  const { data: allocations } = ids.length
    ? await db.from('billing_payments').select('*').in('receipt_id', ids)
    : { data: [] }

  const { data: clients } = await db.from('billing_clients').select('id, name')
  const clientName = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))

  const invIds = [...new Set((allocations || []).map((a: any) => a.invoice_id))]
  const { data: invs } = invIds.length
    ? await db.from('invoices').select('id, number, total_cents, paid_cents, due_at, status').in('id', invIds)
    : { data: [] }
  const invById = Object.fromEntries((invs || []).map((i: any) => [i.id, i]))

  return NextResponse.json({
    receipts: (receipts || []).map((r: any) => {
      const mine = (allocations || []).filter((a: any) => a.receipt_id === r.id)
      return {
        ...r,
        client_name: r.client_id ? (clientName[r.client_id] || 'Unknown client') : null,
        allocations: mine.map((a: any) => ({
          ...a,
          invoice_number: invById[a.invoice_id]?.number || 'Draft',
        })),
        unallocated_cents: unallocatedCents(r.amount_cents, mine.map((a: any) => ({ amountCents: a.amount_cents }))),
      }
    }),
  })
}

/** Load a receipt: the money arrived. Optionally allocate it in the same call. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const amount = Math.round(Number(body?.amount_cents))
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A payment needs an amount.' }, { status: 400 })
  }
  const method = METHODS.includes(body?.method) ? body.method : 'eft'

  const db = adminDb()

  // THE INVOICES IT PAID, named. Checked before anything is written, so a
  // payment that cannot go where it was sent is refused whole rather than
  // recorded and left unallocated behind the error.
  const named = allocationsFrom(body?.allocations)
  if (named.length) {
    const sum = named.reduce((n, a) => n + a.amountCents, 0)
    if (sum > amount) {
      return NextResponse.json({ error: `That puts ${formatMoney(sum)} on invoices from a payment of ${formatMoney(amount)}.` }, { status: 400 })
    }
    const problem = await allocationProblem(db, body.client_id || null, named)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  }

  const { data: receipt, error } = await db.from('billing_receipts').insert({
    client_id: body.client_id || null,
    amount_cents: amount,
    received_on: body.received_on || new Date().toISOString().slice(0, 10),
    method,
    reference: typeof body.reference === 'string' ? body.reference.trim() || null : null,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    created_by: gate.user.id,
  }).select('*').maybeSingle()

  if (error) {
    if (/relation .* does not exist/i.test(error.message || '')) return migrationMissing('Payments')
    return NextResponse.json({ error: error.message || 'Could not record the payment' }, { status: 500 })
  }

  if (named.length) {
    const result: { error?: NextResponse } = await applyAllocations(db, receipt, named, gate.user.id)
    if (result.error) {
      // Recorded but not placed (two people allocating at once). Say so, and
      // hand back the receipt so the screen can place it instead of loading
      // the same bank line a second time.
      const reason = await result.error.json().catch(() => ({}))
      return NextResponse.json({
        error: `The payment was recorded, but could not be put on the invoice: ${reason?.error || 'unknown error'}. Allocate it from Payments.`,
        receipt,
      }, { status: 409 })
    }
    return NextResponse.json({ receipt, allocated: named.reduce((n, a) => n + a.amountCents, 0) })
  }

  // "Allocate the obvious way" is a convenience, never an assumption: it only
  // runs when asked for, and what it did is returned so it can be seen.
  if (body.auto_allocate && receipt.client_id) {
    const plan = await propose(db, receipt.client_id, amount)
    if (plan.allocations.length) {
      // propose() speaks the API's snake_case; applyAllocations speaks the
      // internal shape. Converted explicitly rather than passed through.
      await applyAllocations(db, receipt, plan.allocations.map(a => ({
        invoiceId: a.invoice_id, amountCents: a.amount_cents,
      })), gate.user.id)
    }
  }

  return NextResponse.json({ receipt })
}

/** What would this receipt settle? Proposes, writes nothing. */
export async function PUT(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const amount = Math.round(Number(body?.amount_cents))
  if (!body?.client_id || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Need a client and an amount to propose against.' }, { status: 400 })
  }

  const db = adminDb()
  const plan = await propose(db, body.client_id, amount, body.exclude_receipt_id)
  return NextResponse.json({ ...plan, open: await openFor(db, body.client_id, body.exclude_receipt_id) })
}

/**
 * Every invoice this client still owes on, so the person allocating can pick
 * the one that was actually paid. The suggestion above only reaches as far as
 * the money goes, oldest first, which hid the very invoice a client named in
 * their reference whenever an older one was still open.
 */
async function openFor(db: any, clientId: string, excludeReceiptId?: string) {
  const { data: invoices } = await db
    .from('invoices')
    .select('id, number, due_at, issued_at, total_cents, paid_cents, status')
    .eq('client_id', clientId)
    .in('status', ['issued', 'sent', 'part_paid', 'overdue', 'paid'])
    .order('issued_at', { ascending: true })

  const mine: Record<string, number> = {}
  if (excludeReceiptId) {
    const { data: rows } = await db
      .from('billing_payments').select('invoice_id, amount_cents').eq('receipt_id', excludeReceiptId)
    for (const r of rows || []) mine[r.invoice_id] = (mine[r.invoice_id] || 0) + (r.amount_cents || 0)
  }
  const credited = await creditsFor(db, (invoices || []).map((i: any) => i.id))
  return (invoices || [])
    .map((i: any) => ({
      invoice_id: i.id, invoice_number: i.number, due_at: i.due_at, status: i.status,
      total_cents: i.total_cents,
      outstanding_cents: invoiceOutstanding(i.total_cents || 0, (i.paid_cents || 0) - (mine[i.id] || 0), credited[i.id] || 0),
    }))
    // A paid invoice is listed only when it is this receipt that paid it.
    .filter((i: any) => i.outstanding_cents > 0)
}

/** Allocate an existing receipt across invoices. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.receipt_id) return NextResponse.json({ error: 'Which payment?' }, { status: 400 })

  const db = adminDb()
  let { data: receipt } = await db
    .from('billing_receipts').select('*').eq('id', body.receipt_id).maybeSingle()
  if (!receipt) return NextResponse.json({ error: 'No such payment' }, { status: 404 })

  const allocations = allocationsFrom(body.allocations)

  const sum = allocations.reduce((n: number, a: any) => n + a.amountCents, 0)
  if (sum > receipt.amount_cents) {
    return NextResponse.json({
      error: `That puts ${formatMoney(sum)} on invoices from a payment of ${formatMoney(receipt.amount_cents)}.`,
    }, { status: 400 })
  }

  // WHOSE IT IS, for a deposit recorded before anybody knew. Only ever filled
  // in, never changed: moving a receipt that already pays somebody's invoices
  // to another client would leave those invoices paid by a stranger.
  const namedClient = typeof body.client_id === 'string' && body.client_id ? body.client_id : null
  if (namedClient && receipt.client_id && namedClient !== receipt.client_id) {
    return NextResponse.json({ error: 'This payment is already on another client\'s account.' }, { status: 409 })
  }
  const clientId = receipt.client_id || namedClient
  const problem = await allocationProblem(db, clientId, allocations, receipt.id)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  if (namedClient && !receipt.client_id) {
    const { data: named, error: nErr } = await db.from('billing_receipts')
      .update({ client_id: namedClient }).eq('id', receipt.id).is('client_id', null).select('*').maybeSingle()
    if (nErr || !named) return NextResponse.json({ error: 'Could not put this payment on that client. Reload and try again.' }, { status: 409 })
    receipt = named
  }

  // Replaced wholesale: re-allocating a receipt is a correction, and leaving
  // the old rows behind would double-count it. The trigger recomputes each
  // affected invoice's paid figure from what is left.
  const { data: existing } = await db
    .from('billing_payments').select('invoice_id').eq('receipt_id', receipt.id)
  await db.from('billing_payments').delete().eq('receipt_id', receipt.id)

  const result = await applyAllocations(db, receipt, allocations, gate.user.id)
  if ('error' in result) return result.error

  // Both sides: an invoice this receipt used to pay and no longer does has to
  // go back to owing, not just the ones it now settles.
  const touched: string[] = [...new Set<string>([
    ...(existing || []).map((e: any) => String(e.invoice_id)),
    ...allocations.map((a: any) => String(a.invoiceId)),
  ])]
  await restatus(db, touched)

  return NextResponse.json({ ok: true, allocated: sum, unallocated: receipt.amount_cents - sum })
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which payment?' }, { status: 400 })

  const db = adminDb()
  const { data: allocations } = await db
    .from('billing_payments').select('invoice_id').eq('receipt_id', id)

  // The allocations cascade with the receipt; the trigger then puts every
  // affected invoice's paid figure back.
  const { error } = await db.from('billing_receipts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })

  await restatus(db, [...new Set<string>((allocations || []).map((a: any) => String(a.invoice_id)))])
  return NextResponse.json({ ok: true })
}

/** Oldest invoice first. Proposes only. */
async function propose(db: any, clientId: string, amountCents: number, excludeReceiptId?: string) {
  const { data: invoices } = await db
    .from('invoices')
    .select('id, number, due_at, total_cents, paid_cents, status')
    .eq('client_id', clientId)
    .in('status', ['issued', 'sent', 'part_paid', 'overdue'])

  let rows = (invoices || [])
  if (excludeReceiptId) {
    // When re-allocating, this receipt's own existing allocations must not
    // count against the invoices it is about to be spread over again.
    const { data: mine } = await db
      .from('billing_payments').select('invoice_id, amount_cents').eq('receipt_id', excludeReceiptId)
    const back: Record<string, number> = {}
    for (const m of mine || []) back[m.invoice_id] = (back[m.invoice_id] || 0) + m.amount_cents
    rows = rows.map((i: any) => ({ ...i, paid_cents: (i.paid_cents || 0) - (back[i.id] || 0) }))
  }

  // A credited invoice must drop out of what a payment can settle, or a client
  // paying a round figure has some of it allocated to a balance that is gone.
  const credited = await creditsFor(db, rows.map((i: any) => i.id))
  const plan = allocationPlan(amountCents, rows.map((i: any) => ({
    id: i.id, dueOn: i.due_at, totalCents: i.total_cents, paidCents: i.paid_cents,
    creditedCents: credited[i.id] || 0,
  })))

  const byId = Object.fromEntries(rows.map((i: any) => [i.id, i]))
  return {
    allocations: plan.allocations.map(a => ({
      invoice_id: a.invoiceId,
      amount_cents: a.amountCents,
      invoice_number: byId[a.invoiceId]?.number || null,
      due_at: byId[a.invoiceId]?.due_at || null,
      outstanding_cents: Math.max(0,
        (byId[a.invoiceId]?.total_cents || 0) - (byId[a.invoiceId]?.paid_cents || 0) - (credited[a.invoiceId] || 0)),
    })),
    unallocated_cents: plan.unallocatedCents,
  }
}

async function applyAllocations(
  db: any,
  receipt: any,
  allocations: Array<{ invoiceId: string; amountCents: number }>,
  actor: string,
) {
  if (!allocations.length) return {}

  const { error } = await db.from('billing_payments').insert(allocations.map(a => ({
    receipt_id: receipt.id,
    invoice_id: a.invoiceId,
    amount_cents: a.amountCents,
    paid_on: receipt.received_on,
    method: receipt.method,
    reference: receipt.reference,
    created_by: actor,
  })))

  if (error) {
    return {
      error: NextResponse.json({
        // The over-allocation trigger raises a readable message; pass it on
        // rather than replacing it with something vaguer.
        error: error.message || 'Could not allocate that payment',
      }, { status: 409 }),
    }
  }

  for (const a of allocations) {
    await db.from('document_events').insert({
      doc_type: 'invoice', doc_id: a.invoiceId, event: 'payment_allocated', actor,
      meta: { receipt_id: receipt.id, amount_cents: a.amountCents, reference: receipt.reference },
    })
  }
  await restatus(db, allocations.map(a => a.invoiceId))
  return {}
}
