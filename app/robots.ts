import type { MetadataRoute } from 'next'

// Crawl rules. Public marketing pages and card pages are fair game;
// everything behind auth or transactional is blocked so crawl budget
// goes to pages that can actually rank.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/api/',
          '/team/claim/',
          '/upgrade/',
          '/reset-password',
          '/forgot-password',
          '/delete-account',
          '/delete-data',
        ],
      },
    ],
    sitemap: 'https://cardtly.com/sitemap.xml',
  }
}
