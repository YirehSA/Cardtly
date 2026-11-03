import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { EMAIL_KINDS, isEmailKind, setOptOut, type EmailKind } from '@/lib/email-optout'

// The Settings, Emails switches: which scheduled emails the signed-in person
// gets (lib/email-optout). Read and written with the service role, scoped to
// the session's own user id; email_opt_outs has no browser grants.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { data, error } = await (createServiceClient() as any)
    .from('email_opt_outs').select('kind').eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Email preferences are not available yet.' }, { status: 503 })

  const off = new Set((data || []).map((r: any) => r.kind))
  const on = Object.fromEntries((Object.keys(EMAIL_KINDS) as EmailKind[]).map(k => [k, !off.has(k)]))
  return NextResponse.json({ on })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  let body: { kind?: unknown; on?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!isEmailKind(body.kind) || typeof body.on !== 'boolean') {
    return NextResponse.json({ error: 'Unknown email.' }, { status: 400 })
  }

  const { error } = await setOptOut(createServiceClient() as any, user.id, body.kind, !body.on)
  if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
