import type { MetadataRoute } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    { url: `${BASE}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/nfc`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/how-it-works`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/promotions`, changeFrequency: 'weekly', priority: 0.6 },
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
      const [{ data: cards }, { data: teamCards }] = await Promise.all([
        admin.from('cards').select('slug, updated_at').not('slug', 'is', null),
        admin.from('team_cards').select('slug, updated_at').not('slug', 'is', null).eq('is_active', true),
      ])
      const all = [...(cards || []), ...(teamCards || [])]
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
