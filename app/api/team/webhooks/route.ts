import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { validateWebhookUrl, newWebhookSecret, LEAD_CREATED } from '@/lib/webhooks'
import { deliverPending } from '@/lib/webhook-dispatch'

// Where a team points its leads.
//
// Owner only. A department head runs people, not integrations, and a webhook
// carries every lead in the organisation including the ones from departments
// they do not manage.

export const maxDuration = 60

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

  const { data: hooks, error } = await admin
    .from('webhooks').select('*').eq('org_id', orgId).order('created_at', { ascending: true })
  if (error) {
    return NextResponse.json({ error: 'Integrations are not enabled on this database yet.' }, { status: 503 })
  }

  // The last few attempts per endpoint. This is the thing that makes a webhook
  // supportable: without it, "it is not working" is unanswerable from our side
  // and from theirs.
  const ids = (hooks || []).map((h: any) => h.id)
  const { data: deliveries } = ids.length
    ? await admin
        .from('webhook_deliveries')
        .select('id, webhook_id, event_type, response_status, response_body, attempt_count, delivered_at, failed_at, next_retry_at, created_at')
        .in('webhook_id', ids)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] }

  return NextResponse.json({
    // The secret is shown once, when it is created. After that it is ours to
    // sign with and theirs to have written down.
    webhooks: (hooks || []).map((h: any) => ({
      id: h.id, name: h.name, url: h.url, events: h.events, is_active: h.is_active,
      created_at: h.created_at, has_secret: !!h.secret_token,
    })),
    deliveries: deliveries || [],
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
  const org = org_id ? await ownerOf(admin, user.id, org_id) : null
  if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  if (action === 'create') {
    const checked = validateWebhookUrl(body.url)
    if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })

    const secret = newWebhookSecret()
    const { data, error } = await admin.from('webhooks').insert({
      org_id,
      name: String(body.name || '').trim() || 'Lead delivery',
      url: checked.url,
      events: [LEAD_CREATED],
      secret_token: secret,
      created_by: user.id,
    }).select('id').maybeSingle()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Integrations are not enabled on this database yet.' }, { status: 503 })
      }
      return NextResponse.json({ error: `Could not save it: ${error.message}` }, { status: 500 })
    }
    // Returned once and never again: after this the secret exists only to sign
    // with, and telling them later would mean being able to read it back.
    return NextResponse.json({ success: true, id: data?.id, secret })
  }

  if (action === 'toggle' || action === 'delete') {
    const { data: hook } = await admin.from('webhooks').select('id, org_id, is_active').eq('id', body.webhook_id).maybeSingle()
    if (!hook || hook.org_id !== org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'delete') {
      await admin.from('webhooks').delete().eq('id', hook.id)
      return NextResponse.json({ success: true })
    }
    await admin.from('webhooks').update({ is_active: !hook.is_active, updated_at: new Date().toISOString() }).eq('id', hook.id)
    return NextResponse.json({ success: true, is_active: !hook.is_active })
  }

  // Send one made-up lead, so the receiving end can be wired up before a real
  // person ever fills in a form. Queued and delivered in the same request
  // because somebody is sitting there waiting to see whether it worked.
  if (action === 'test') {
    const { data: hook } = await admin.from('webhooks').select('*').eq('id', body.webhook_id).maybeSingle()
    if (!hook || hook.org_id !== org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await admin.from('webhook_deliveries').insert({
      webhook_id: hook.id,
      event_type: LEAD_CREATED,
      payload: {
        event: LEAD_CREATED,
        sent_at: new Date().toISOString(),
        test: true,
        lead: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Test Lead', email: 'test@cardtly.com', phone: '+27 82 000 0000',
          work_phone: null, company: 'Cardtly', title: 'Sample', website: null,
          address: null, message: 'This is a test delivery from Cardtly.',
          source: 'test', answers: null, captured_at: new Date().toISOString(),
        },
        card: { id: null, name: 'Test Card', slug: null, url: null, type: 'team' },
        organization: { id: org.id, name: org.name },
      },
    })

    const run = await deliverPending(admin, 5)
    return NextResponse.json({ success: true, ...run })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
