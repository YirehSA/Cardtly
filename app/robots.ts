import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo-schema'

// Crawl rules. Public marketing pages are fair game; everything behind auth or
// transactional is blocked so crawl budget goes to pages that can actually
// rank.
//
// CARD PAGES (/card/) are noindex (lib/card-robots). Search engines may still
// fetch them, deliberately: a page a crawler is not allowed to fetch is a page
// whose noindex it never reads, so a card Google already knows about would
// stay in its results. AI crawlers are kept out of /card/ altogether, because
// a noindex tag does not stop a page being read into a model, and a card is
// somebody's name, photo, mobile and email.
//
// AI search crawlers (ChatGPT, Perplexity, Claude, Google AI Overviews)
// are EXPLICITLY allowed so Cardtly can be cited in AI answers - being
// quoted by an AI assistant is fast becoming as valuable as a Google
// rank. They get the same allow/disallow as everyone else.

const DISALLOW = [
  '/dashboard',
  '/admin',
  '/api/',
  '/team/claim/',
  '/upgrade/',
  '/reset-password',
  '/forgot-password',
  '/delete-account',
  '/delete-data',
]

// AI assistants' search/grounding crawlers we want citing us.
const AI_CRAWLERS = [
  'GPTBot',          // OpenAI - ChatGPT
  'OAI-SearchBot',   // OpenAI - search
  'ChatGPT-User',    // OpenAI - live browsing
  'ClaudeBot',       // Anthropic - Claude
  'Claude-Web',      // Anthropic - Claude browsing
  'PerplexityBot',   // Perplexity
  'Perplexity-User', // Perplexity live fetch
  'Google-Extended', // Google Gemini / AI Overviews grounding
  'Applebot-Extended', // Apple Intelligence
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      // Explicit welcome for AI crawlers, except to people's cards.
      { userAgent: AI_CRAWLERS, allow: '/', disallow: [...DISALLOW, '/card/'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
