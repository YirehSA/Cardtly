import { PROMOS_ENABLED } from '@/lib/promos'
import type { MetadataRoute } from 'next'
import { POSTS } from './blog/posts'
import { SITE_URL } from '@/lib/seo-schema'

// Sitemap: the marketing pages only.
//
// Card pages are NOT listed, and never should be. Since 2026-11-03 every
// /card/ page is noindex (next.config.js X-Robots-Tag, and the cards'
// metadata): a card carries a person's name, photo, mobile number and email,
// often put there by their employer rather than by them, and a search engine
// is not who it was handed to. Listing them here as well would ask Google to
// crawl pages it is told not to index. scripts/check-card-noindex holds it.
//
// Regenerated at most once a day.
export const revalidate = 86400

// The served host. cardtly.com redirects to www, so listing it made every URL
// in this file a redirect for the crawler to follow.
const BASE = SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/features`, changeFrequency: 'monthly', priority: 0.9 },
    // The team and company page: the highest-value commercial query on the
    // site, so it sits with the other primary pages rather than below them.
    { url: `${BASE}/teams`, changeFrequency: 'monthly', priority: 0.9 },
    // The answer to "digital business cards for teams south africa".
    { url: `${BASE}/teams/south-africa`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/nfc`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/network`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/how-it-works`, changeFrequency: 'monthly', priority: 0.8 },
    // Dated by its newest guide, so a crawler sees the index change whenever
    // a post is added rather than an undated page it has no reason to revisit.
    { url: `${BASE}/blog`, lastModified: new Date(POSTS.map(p => p.date).sort().at(-1) + 'T00:00:00Z'), changeFrequency: 'weekly', priority: 0.7 },
    ...POSTS.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.date + 'T00:00:00Z'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/resellers`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.8 },
    // Only advertise /promotions to Google while it actually resolves;
    // it 404s when the programme is paused.
    ...(PROMOS_ENABLED
      ? [{ url: `${BASE}/promotions`, changeFrequency: 'weekly' as const, priority: 0.6 }]
      : []),
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    // Procurement teams search for a vendor's trust page by name.
    { url: `${BASE}/trust`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/paia`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  return staticPages
}
