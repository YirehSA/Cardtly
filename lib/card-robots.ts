import type { Metadata } from 'next'

// Every card page tells search engines to leave it out (2026-11-03).
//
// A card carries a person's name, photo, mobile number and email, often put
// there by their employer rather than by them, and it is meant for the people
// it is handed to, not for a search results page. Andre's decision, made for
// POPIA's sake as much as anything: a staff member never chose to be findable
// on Google by name.
//
// next.config.js sends the same as an X-Robots-Tag header for every /card/
// address; this is the page's own copy of it, on both card routes. The sitemap
// lists no cards, and robots.ts keeps AI crawlers out of /card/ but lets
// search engines fetch it, because a page a crawler may not fetch is a page
// whose noindex it never reads. scripts/check-card-noindex holds all four.
//
// Link previews (WhatsApp, LinkedIn, email) read the Open Graph tags and
// ignore this, so sharing a card looks exactly as before.
export const CARD_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  noimageindex: true,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
}
