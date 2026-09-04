import { PROMOS_ENABLED } from '@/lib/promos'
import type { MetadataRoute } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { POSTS } from './blog/posts'
import { planFromTrial } from '@/lib/plan-server'

// Sitemap: static marketing pages + every public card page.
// Card pages are included deliberately - each one is an indexable
// page with real content and an OG image, the same long-tail play
// profile platforms like Linktree use. When someone googles a
// Cardtly user's name, their card page can rank, which is both a
// user feature and brand exposure.
//
// Regenerated at most once a day; new cards appear on the next pass.
export const revalidate = 86400

const BASE = 'https://cardtly.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/features`, changeFrequency: 'monthly', priority: 0.9 },
    // The team and company page: the highest-value commercial query on the
    // site, so it sits with the other primary pages rather than below them.
    { url: `${BASE}/teams`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/nfc`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/network`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/how-it-works`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    ...POSTS.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.date + 'T00:00:00Z'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.8 },
    // Only advertise /promotions to Google while it actually resolves;
    // it 404s when the programme is paused.
    ...(PROMOS_ENABLED
      ? [{ url: `${BASE}/promotions`, changeFrequency: 'weekly' as const, priority: 0.6 }]
      : []),
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Pull public card slugs with the service-role client - RLS blocks
  // anon list queries on these tables. If env vars are missing (local
  // builds) or the query fails, fall back to static pages only rather
  // than breaking the sitemap.
  let cardPages: MetadataRoute.Sitemap = []
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const admin = createAdminClient(url, key) as any
      const [{ data: cards }, { data: teamCards }, { data: profiles }, { data: subs }] = await Promise.all([
        admin.from('cards').select('slug, updated_at, user_id').not('slug', 'is', null),
        admin.from('team_cards').select('slug, updated_at').not('slug', 'is', null).eq('is_active', true),
        admin.from('profiles').select('user_id, trial_ends_at'),
        admin.from('whop_subscriptions').select('user_id, subscription_tier, status').eq('status', 'active'),
      ])

      // A personal card 404s once its owner's trial ends without a
      // subscription - /card/[slug] calls notFound() in exactly that case. The
      // sitemap listed every card with a slug regardless, so the first lapsed
      // trial would have started advertising a dead URL to Google. Apply the
      // same gate here, including its fail-open behaviour: a missing or
      // unreadable trial date keeps the card listed rather than dropping it.
      const trialByUser = new Map<string, string | null>(
        (profiles || []).map((p: any) => [p.user_id, p.trial_ends_at ?? null])
      )
      const paidUsers = new Set(
        (subs || [])
          .filter((x: any) => x.subscription_tier === 'pro')
          .map((x: any) => x.user_id)
      )
      const servesPublicly = (c: any) => {
        if (paidUsers.has(c.user_id)) return true
        if (!trialByUser.has(c.user_id)) return true      // no profile row: fail open
        return planFromTrial(trialByUser.get(c.user_id) ?? null).tier !== 'expired'
      }

      const all = [...(cards || []).filter(servesPublicly), ...(teamCards || [])]
      cardPages = all
        .filter((c: any) => c.slug)
        .map((c: any) => ({
          url: `${BASE}/card/${c.slug}`,
          lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }))
    }
  } catch {
    // Sitemap must never 500 - serve static pages on any failure.
  }

  return [...staticPages, ...cardPages]
}
