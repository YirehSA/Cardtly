import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Teammates list for the dashboard "Share a teammate's card" panel.
// Two kinds of caller qualify:
//   - Team members (claimed a team card): get the OTHER active
//     cards in their org, so they can share a colleague's card.
//   - Org admins (organizations.admin_user_id): get ALL active
//     cards in their org - they have no team card of their own.
// Everyone else gets an empty list and the panel hides itself.
//
// Service role is required: team_cards RLS only exposes a member's
// own row, and organizations is admin-scoped. Access is gated by
// proving the caller is a member or the admin first.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Member path: caller claimed a team card.
  const { data: myCard } = await admin
    .from('team_cards')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let orgId: string | null = myCard?.organization_id || null
  let orgName: string | null = null
  let excludeCardId: string | null = myCard?.id || null

  if (orgId) {
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()
    orgName = org?.name || null
  } else {
    // Admin path: caller owns an organization.
    const { data: org } = await admin
      .from('organizations')
      .select('id, name')
      .eq('admin_user_id', user.id)
      .maybeSingle()
    if (!org) {
      return NextResponse.json({ mates: [], org_name: null })
    }
    orgId = org.id
    orgName = org.name || null
  }

  let query = admin
    .from('team_cards')
    .select('id, name, title, slug, profile_image_url')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('name', { ascending: true })
  if (excludeCardId) {
    query = query.neq('id', excludeCardId)
  }
  const { data: mates } = await query

  return NextResponse.json({
    org_name: orgName,
    mates: (mates || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      title: m.title,
      slug: m.slug,
      profile_image_url: m.profile_image_url,
    })),
  })
}
