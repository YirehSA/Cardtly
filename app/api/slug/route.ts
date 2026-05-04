import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .slice(0, 50)                   // max 50 chars
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug: rawSlug, card_id } = await request.json()
    const slug = sanitizeSlug(rawSlug)

    if (!slug || slug.length < 3) {
      return NextResponse.json({ error: 'Slug must be at least 3 characters' }, { status: 400 })
    }

    // Check it's not taken by another card
    const { data: existing } = await supabase
      .from('cards')
      .select('id')
      .eq('slug', slug)
      .neq('id', card_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'That URL is already taken. Try another.' }, { status: 409 })
    }

    // Also check team_cards
    const { data: existingTeam } = await supabase
      .from('team_cards')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingTeam) {
      return NextResponse.json({ error: 'That URL is already taken. Try another.' }, { status: 409 })
    }

    // Save old slug for redirect
    const { data: currentCard } = await supabase
      .from('cards')
      .select('slug')
      .eq('id', card_id)
      .single()

    // Insert redirect from old slug
    if (currentCard?.slug && currentCard.slug !== slug) {
      await supabase
        .from('slug_redirects')
        .upsert({ old_slug: currentCard.slug, new_slug: slug })
        .select()
    }

    // Update the card slug
    const { error } = await supabase
      .from('cards')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', card_id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, slug })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
