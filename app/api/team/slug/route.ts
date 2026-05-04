import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function sanitizeSlug(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug: rawSlug, team_card_id, org_id } = await request.json()
    const slug = sanitizeSlug(rawSlug)

    if (!slug || slug.length < 3) {
      return NextResponse.json({ error: 'Slug must be at least 3 characters' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Verify org ownership
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Check not taken by personal card
    const { data: existingCard } = await admin.from('cards').select('id').eq('slug', slug).single()
    if (existingCard) return NextResponse.json({ error: 'That URL is already taken. Try another.' }, { status: 409 })

    // Check not taken by another team card
    const { data: existingTeam } = await admin.from('team_cards').select('id').eq('slug', slug).neq('id', team_card_id).single()
    if (existingTeam) return NextResponse.json({ error: 'That URL is already taken. Try another.' }, { status: 409 })

    // Update
    const { error } = await admin.from('team_cards').update({ slug, updated_at: new Date().toISOString() }).eq('id', team_card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, slug })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
