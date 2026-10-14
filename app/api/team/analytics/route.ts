import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buildTeamReport, resetTeamAnalytics } from '@/lib/team-analytics'
import { auditLog } from '@/lib/admin-audit'

// The team owner's monthly report, and starting their numbers again.
//
// Owner only, like the Team analytics page it serves: a department head sees
// their own department elsewhere, and neither should be able to wipe or read
// the whole company's numbers.

export const dynamic = 'force-dynamic'

async function ownerOrg(admin: any, userId: string) {
  // The live org first, as the analytics page reads it: an abandoned checkout
  // can leave a second row against the same owner.
  const { data } = await admin
    .from('organizations')
    .select('id, name, max_seats')
    .eq('admin_user_id', userId)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data || null
}

function service() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = service()
  const org = await ownerOrg(admin, user.id)
  if (!org) return NextResponse.json({ error: 'Only the team owner can download the team report.' }, { status: 403 })

  const month = new URL(request.url).searchParams.get('month') || ''
  try {
    return NextResponse.json(await buildTeamReport(admin, org, month))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not build the report.' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { action?: string; card_id?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (body.action !== 'reset') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const admin = service()
  const org = await ownerOrg(admin, user.id)
  if (!org) return NextResponse.json({ error: 'Only the team owner can reset the analytics.' }, { status: 403 })

  try {
    const result = await resetTeamAnalytics(admin, org.id, body.card_id || null)
    if (body.card_id && result.cards === 0) {
      return NextResponse.json({ error: 'That card is not in your team.' }, { status: 404 })
    }
    // On the record, because it cannot be undone: who, which team, which card,
    // and how much went.
    await auditLog(admin, {
      actorUserId: user.id, actorEmail: user.email, action: 'team_reset_analytics',
      detail: { org_id: org.id, org_name: org.name, card_id: body.card_id || null, ...result },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not reset the analytics.' }, { status: 500 })
  }
}
