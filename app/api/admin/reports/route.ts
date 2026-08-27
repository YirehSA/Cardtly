import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/admin-check'
import { isReportStatus } from '@/lib/moderation'

// The moderation queue. Cardtly staff only, through the same admin check every
// other /api/admin route uses.

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  if (!(await isAdminUser(user.id))) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  }
  return { user }
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const status = new URL(request.url).searchParams.get('status') || 'open'
  const db = admin()

  let q = db.from('card_reports').select('*').order('created_at', { ascending: true })
  if (status !== 'all') q = q.eq('status', 'open')

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: 'Reports are not enabled on this database yet. Run migration 056.' }, { status: 503 })
  }
  return NextResponse.json({ reports: data || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const { report_id, status, take_down } = body

  if (!report_id || !isReportStatus(status) || status === 'open') {
    return NextResponse.json({ error: 'Say what to do with the report.' }, { status: 400 })
  }

  const db = admin()
  const { data: report } = await db.from('card_reports').select('*').eq('id', report_id).maybeSingle()
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  // Taking a card down means removing it from the DIRECTORY, not deleting it.
  //
  // The card keeps working on its own link, because the person carrying it has
  // handed that link out and may have it printed on plastic. What stops is
  // being listed to strangers, which is the part a report is actually about.
  // Deleting somebody's card on one report would be a far bigger act than the
  // complaint warrants, and it is not reversible.
  if (take_down) {
    const table = report.card_id ? 'cards' : 'team_cards'
    const id = report.card_id || report.team_card_id
    if (id) {
      const { error } = await db.from(table).update({ hide_from_network: true }).eq('id', id)
      if (error) {
        return NextResponse.json({ error: `Could not remove it: ${error.message}` }, { status: 500 })
      }
    }
  }

  const { error } = await db.from('card_reports').update({
    status,
    resolved_at: new Date().toISOString(),
    resolved_by: gate.user.id,
    resolution_note: take_down ? 'Removed from the Network' : 'No action needed',
  }).eq('id', report_id)

  if (error) return NextResponse.json({ error: 'Could not close the report.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
