import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateApiKey, ALL_PERMISSIONS } from '@/lib/api-keys'

// Issuing and revoking a team's API keys. Owner only: a key reads every lead
// and every card in the organisation, across departments a head does not
// manage.

async function ownerOf(admin: any, userId: string, orgId: string) {
  const { data } = await admin
    .from('organizations').select('id, name').eq('id', orgId).eq('admin_user_id', userId).maybeSingle()
  return data || null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const orgId = new URL(request.url).searchParams.get('org_id') || ''
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
  if (!orgId || !(await ownerOf(admin, user.id, orgId))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('api_keys').select('*').eq('org_id', orgId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'The API is not enabled on this database yet.' }, { status: 503 })

  return NextResponse.json({
    // key_hash never leaves the server. There is no route that returns a key
    // after it has been issued, by design.
    keys: (data || []).map((k: any) => ({
      id: k.id, name: k.name, preview: k.key_preview, permissions: k.permissions,
      is_active: k.is_active, last_used_at: k.last_used_at, usage_count: k.usage_count,
      rate_limit_per_hour: k.rate_limit_per_hour, created_at: k.created_at,
    })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const { action, org_id } = body

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
  if (!org_id || !(await ownerOf(admin, user.id, org_id))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (action === 'create') {
    const { key, hash, preview } = generateApiKey()
    const { data, error } = await admin.from('api_keys').insert({
      org_id,
      name: String(body.name || '').trim() || 'API key',
      key_hash: hash,
      key_preview: preview,
      permissions: ALL_PERMISSIONS,
      created_by: user.id,
    }).select('id').maybeSingle()

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ error: 'The API is not enabled on this database yet.' }, { status: 503 })
      return NextResponse.json({ error: `Could not create it: ${error.message}` }, { status: 500 })
    }
    // The only time the key exists outside the caller's browser. Nothing
    // stores it and no route can return it again.
    return NextResponse.json({ success: true, id: data?.id, key })
  }

  if (action === 'revoke' || action === 'delete') {
    const { data: row } = await admin.from('api_keys').select('id, org_id').eq('id', body.key_id).maybeSingle()
    if (!row || row.org_id !== org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'delete') {
      await admin.from('api_keys').delete().eq('id', row.id)
      return NextResponse.json({ success: true })
    }
    // Revoked rather than deleted keeps the usage history attached to
    // something, so "what did that key do before we turned it off" still has
    // an answer.
    await admin.from('api_keys').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
