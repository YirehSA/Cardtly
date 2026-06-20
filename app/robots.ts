import type { MetadataRoute } from 'next'

// Crawl rules. Public marketing + card pages are fair game; everything
// behind auth or transactional is blocked so crawl budget goes to
// pages that can actually rank.
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
      // Explicit welcome for AI crawlers (same access as everyone).
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: 'https://cardtly.com/sitemap.xml',
    host: 'https://cardtly.com',
  }
}
