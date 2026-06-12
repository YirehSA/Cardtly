import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Teammates list for team members. A member (someone who claimed a
// team card) gets the other active cards in their org so they can
// share a colleague's card on the spot - "let me give you our sales
// director's card" at an expo, reception sharing a rep's card, etc.
//
// Service role is required: team_cards RLS only exposes a member's
// own row, and organizations is admin-scoped. We gate access by
// first proving the caller owns a claimed card in the org.
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

  // Caller must be a claimed team member.
  const { data: myCard } = await admin
    .from('team_cards')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myCard) {
    return NextResponse.json({ mates: [], org_name: null })
  }

  const [{ data: org }, { data: mates }] = await Promise.all([
    admin
      .from('organizations')
      .select('name')
      .eq('id', myCard.organization_id)
      .maybeSingle(),
    admin
      .from('team_cards')
      .select('id, name, title, slug, profile_image_url')
      .eq('organization_id', myCard.organization_id)
      .eq('is_active', true)
      .neq('id', myCard.id)
      .not('slug', 'is', null)
      .order('name', { ascending: true }),
  ])

  return NextResponse.json({
    org_name: org?.name || null,
    mates: (mates || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      title: m.title,
      slug: m.slug,
      profile_image_url: m.profile_image_url,
    })),
  })
}
