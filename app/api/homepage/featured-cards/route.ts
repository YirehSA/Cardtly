import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET /api/homepage/featured-cards
// Returns up to 8 opted-in cards rotated daily. Same 8 for all
// visitors throughout the day (so the page caches cleanly at the
// edge), a different 8 tomorrow.
//
// Quality filter: must be opted-in (allow_homepage_feature = true),
// must have a profile photo, must have a name, must be a personal
// card with a slug, and must have been updated in the last 60 days
// (filters out abandoned test cards).

// Don't prerender at build time — the rotation depends on the
// current date and the DB state.
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // 60 days ago — lower bound on activity
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Pull a generous pool, we'll downsample in memory.
  const { data: cards, error } = await admin
    .from('cards')
    .select('id, slug, name, title, company, profile_image_url, updated_at')
    .eq('allow_homepage_feature', true)
    .not('profile_image_url', 'is', null)
    .not('name', 'is', null)
    .not('slug', 'is', null)
    .gte('updated_at', sixtyDaysAgo)
    .limit(200)

  if (error) {
    // 42703 = "column does not exist" — happens before the
    // migration is applied. Return empty silently so the homepage
    // section just hides instead of showing a broken state.
    if ((error as any).code === '42703') {
      return NextResponse.json({ cards: [], rotatedFor: dateKey(), notice: 'migration_pending' })
    }
    console.error('featured-cards: query error', error)
    return NextResponse.json({ cards: [], error: 'query_failed' }, { status: 500 })
  }

  if (!cards || cards.length === 0) {
    return NextResponse.json({ cards: [], rotatedFor: dateKey() })
  }

  // Daily rotation: sort by hash(slug + today) so the order is
  // deterministic within a day, fresh next day.
  const today = dateKey()
  const sorted = (cards as Array<{ slug: string; name: string; title: string | null; company: string | null; profile_image_url: string | null }>)
    .map((c) => ({ ...c, sortKey: hash(c.slug + today) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 8)

  return NextResponse.json({
    cards: sorted.map((c) => ({
      slug: c.slug,
      name: c.name,
      title: c.title || '',
      company: c.company || '',
      profile_image_url: c.profile_image_url,
    })),
    rotatedFor: today,
  })
}

// YYYY-MM-DD in SAST so the rotation feels right for the local audience.
function dateKey() {
  const now = new Date()
  // SAST is UTC+2, no DST
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().split('T')[0]
}

// Lightweight string -> 32-bit int hash. Used only as a sort seed,
// no security implications.
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h
}
