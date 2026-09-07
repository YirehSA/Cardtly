import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'

// Who Cardtly bills.
//
// Deliberately not the same thing as an organization or a user: the party that
// pays is often not the party that uses the product - a finance department, a
// holding company, a client's client. organization_id links back when there
// happens to be one, and stays null when there is not.

export const runtime = 'nodejs'

const FIELDS = ['name', 'contact_person', 'email', 'phone', 'address', 'vat_number', 'notes', 'organization_id'] as const

function clean(body: any) {
  const patch: Record<string, any> = {}
  for (const f of FIELDS) {
    if (!(f in body)) continue
    const raw = body[f]
    const v = typeof raw === 'string' ? raw.trim() : raw
    patch[f] = v === '' || v === undefined ? null : v
  }
  return patch
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const q = new URL(request.url).searchParams.get('q')?.trim()

  let query = db.from('billing_clients').select('*').order('name')
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,contact_person.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return migrationMissing('Clients')

  // What each client owes, in one pass rather than a query per row.
  const { data: invoices } = await db
    .from('invoices').select('client_id, total_cents, paid_cents, status')
    .not('status', 'in', '("draft","cancelled","written_off")')

  const owing: Record<string, { outstandingCents: number; openCount: number }> = {}
  for (const i of invoices || []) {
    const bucket = owing[i.client_id] || (owing[i.client_id] = { outstandingCents: 0, openCount: 0 })
    const out = Math.max(0, (i.total_cents || 0) - (i.paid_cents || 0))
    if (out > 0) { bucket.outstandingCents += out; bucket.openCount += 1 }
  }

  return NextResponse.json({
    clients: (data || []).map((c: any) => ({ ...c, ...(owing[c.id] || { outstandingCents: 0, openCount: 0 }) })),
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const patch = clean(body)
  if (!patch.name) return NextResponse.json({ error: 'A client needs a name.' }, { status: 400 })

  const db = adminDb()
  const { data, error } = await db.from('billing_clients').insert(patch).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ client: data })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which client?' }, { status: 400 })

  const patch = clean(body)
  if ('name' in patch && !patch.name) {
    return NextResponse.json({ error: 'A client needs a name.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  patch.updated_at = new Date().toISOString()

  const db = adminDb()
  const { data, error } = await db
    .from('billing_clients').update(patch).eq('id', body.id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ client: data })
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which client?' }, { status: 400 })

  const db = adminDb()
  const { error } = await db.from('billing_clients').delete().eq('id', id)
  if (error) {
    // on delete restrict from invoices and quotes. Deleting a client with
    // history would orphan documents that must stay readable forever.
    return NextResponse.json({
      error: 'This client has quotes or invoices, so it cannot be deleted. Its documents have to stay on the books.',
    }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
