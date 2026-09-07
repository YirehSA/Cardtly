import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'

// Terms and conditions, versioned rather than edited.
//
// A signed quote records WHICH version was accepted. Editing the text in place
// would retroactively change what every past client agreed to, which is worth
// nothing in a dispute, so saving always writes a new version and makes it the
// active one. Old versions stay readable forever.

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const { data, error } = await db
    .from('billing_terms').select('*').order('version', { ascending: false })
  if (error) return migrationMissing('Terms')

  return NextResponse.json({ terms: data || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'Terms cannot be empty.' }, { status: 400 })

  const db = adminDb()

  const { data: latest, error: readErr } = await db
    .from('billing_terms').select('version, body').order('version', { ascending: false }).limit(1)
  if (readErr) return migrationMissing('Terms')

  // Saving without changing anything must not burn a version number. A quote
  // that cites "terms v7" is easier to defend when v7 is genuinely different
  // from v6.
  if (latest?.[0] && latest[0].body === text) {
    return NextResponse.json({ terms: latest[0], unchanged: true })
  }

  const version = (latest?.[0]?.version || 0) + 1

  const { data, error } = await db
    .from('billing_terms')
    .insert({ version, body: text, is_active: true, created_by: gate.user.id })
    .select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save terms' }, { status: 500 })

  // Only after the new version exists. Deactivating first would leave no active
  // terms at all if the insert then failed, and a quote issued in that window
  // would carry none.
  await db.from('billing_terms').update({ is_active: false }).neq('version', version)

  return NextResponse.json({ terms: data })
}
