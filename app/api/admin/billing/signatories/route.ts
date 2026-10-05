import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { isSignaturePng } from '@/lib/billing-docs'

// The people who sign Cardtly's documents, and their signatures.
//
// Admin only, and the images never leave the billing tables except inside a
// PDF. A signature that can be fetched by URL can be pasted onto anybody's
// document, which is why there is no storage bucket and no public route here.
//
// Changing or deleting a signature touches nothing already signed: invoices
// and purchase orders keep copies (migration 092).

export const runtime = 'nodejs'

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const { data, error } = await adminDb()
    .from('billing_signatories').select('*').order('position').order('created_at')
  if (error) return migrationMissing('Signatures')
  return NextResponse.json({ signatories: data || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const name = clean(body?.name, 120)
  if (!name) return NextResponse.json({ error: 'Whose signature is this? Add a name.' }, { status: 400 })
  if (!isSignaturePng(body?.signature_png)) {
    return NextResponse.json({ error: 'Draw or upload the signature first.' }, { status: 400 })
  }

  const { data, error } = await adminDb().from('billing_signatories').insert({
    name,
    title: clean(body?.title, 120),
    signature_png: body.signature_png,
    sign_invoices: body?.sign_invoices === true,
    position: Number.isFinite(Number(body?.position)) ? Number(body.position) : 0,
  }).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save the signature' }, { status: 500 })
  return NextResponse.json({ signatory: data })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which signature?' }, { status: 400 })

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if ('name' in body) {
    const name = clean(body.name, 120)
    if (!name) return NextResponse.json({ error: 'A signature needs a name.' }, { status: 400 })
    patch.name = name
  }
  if ('title' in body) patch.title = clean(body.title, 120)
  if ('sign_invoices' in body) patch.sign_invoices = body.sign_invoices === true
  if ('signature_png' in body) {
    if (!isSignaturePng(body.signature_png)) {
      return NextResponse.json({ error: 'That signature image could not be used.' }, { status: 400 })
    }
    patch.signature_png = body.signature_png
  }

  const { data, error } = await adminDb()
    .from('billing_signatories').update(patch).eq('id', body.id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ signatory: data })
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which signature?' }, { status: 400 })
  const { error } = await adminDb().from('billing_signatories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
