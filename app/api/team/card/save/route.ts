import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { canManageDepartment, isOrgOwner } from '@/lib/department-perms'
import { resolveLocks, stripLocked } from '@/lib/team-locks'

// Saving a team card, with the field locks actually enforced.
//
// The editor used to write to team_cards straight from the browser and strip
// the locked fields client-side first. Its own comment admitted the gap: anyone
// who could open dev tools could send those fields anyway. A lock nobody can
// rely on is worse than no lock, because the admin believes it is holding.
//
// So the write happens here. The browser can send whatever it likes; what
// reaches the table is decided on this side.

// Structural columns nobody edits through here, whatever their role. Slug has
// its own endpoint (it writes a redirect too), and the rest are set by the
// invite, claim and analytics paths.
const NEVER_WRITABLE = new Set([
  'id', 'user_id', 'organization_id', 'department_id', 'slug', 'claimed_at',
  'invite_email', 'invite_sent_at', 'view_count', 'is_active', 'created_at',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { card_id?: string; fields?: Record<string, any> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const cardId = body.card_id
  const incoming = body.fields
  if (!cardId || !incoming || typeof incoming !== 'object') {
    return NextResponse.json({ error: 'card_id and fields are required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: card } = await admin
    .from('team_cards')
    .select('id, user_id, organization_id, department_id')
    .eq('id', cardId)
    .maybeSingle()
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  // Who is asking. An org admin or the head of this card's department set the
  // rules, so the rules do not apply to them. The person whose card it is edits
  // within them. Anyone else is not involved.
  const owner = card.organization_id
    ? await isOrgOwner(admin, user.id, card.organization_id)
    : false
  const head = !owner && card.department_id
    ? await canManageDepartment(admin, user.id, card.department_id)
    : false
  const isMember = !owner && !head && card.user_id === user.id

  if (!owner && !head && !isMember) {
    return NextResponse.json({ error: 'You cannot edit that card' }, { status: 403 })
  }

  // Start from what was sent, minus anything structural.
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (!NEVER_WRITABLE.has(key)) payload[key] = value
  }

  let removed: string[] = []
  if (isMember) {
    // locked_fields arrives with migration 035, which is applied by hand. If it
    // is not there yet this reads as "nothing locked", which is how the product
    // behaved before and self-heals the moment the migration lands. Failing the
    // other way would lock members out of their own cards over a missing column.
    const readLocks = async (table: string, id: string | null): Promise<unknown> => {
      if (!id) return []
      const { data, error } = await admin.from(table).select('locked_fields').eq('id', id).maybeSingle()
      if (error) return []
      return data?.locked_fields ?? []
    }
    const [orgLocks, deptLocks] = await Promise.all([
      readLocks('organizations', card.organization_id),
      readLocks('departments', card.department_id),
    ])
    const locks = resolveLocks(orgLocks, deptLocks)
    const result = stripLocked(payload, locks)
    removed = result.removed
    for (const key of Object.keys(payload)) delete payload[key]
    Object.assign(payload, result.cleaned)
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({
      success: true, saved: 0, removed,
      message: 'Nothing to save - everything you changed is managed by your company.',
    })
  }

  payload.updated_at = new Date().toISOString()

  // .select() so a write that matched nothing cannot report success.
  const { data: updated, error } = await admin
    .from('team_cards')
    .update(payload)
    .eq('id', cardId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Your changes were not saved. Please refresh and try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, saved: Object.keys(payload).length - 1, removed })
}
