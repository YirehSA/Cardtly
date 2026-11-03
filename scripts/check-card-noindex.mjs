// Card pages stay out of search engines.
//
// Since 2026-11-03 every /card/ page is noindex (lib/card-robots). A card
// carries a person's name, photo, mobile and email, often put there by their
// employer, and it is meant for the people it is handed to. Four things keep
// it that way, and each is easy to undo without noticing:
//   1. next.config.js sends X-Robots-Tag: noindex for every /card/ address;
//   2. both card routes put CARD_ROBOTS in every metadata they return;
//   3. the sitemap lists no card;
//   4. robots.ts lets search engines FETCH /card/ (or they never read the
//      noindex and a known card stays in their results) and keeps AI crawlers
//      out of it.
//
// Run: node scripts/check-card-noindex.mjs

import { readFileSync } from 'fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')

// 1
const robotsLib = code(read('lib/card-robots.ts'))
if (!/index:\s*false/.test(robotsLib) || !/follow:\s*false/.test(robotsLib)) bad('lib/card-robots no longer says index: false and follow: false')
if (!/googleBot:\s*\{[^}]*index:\s*false/.test(robotsLib)) bad('lib/card-robots no longer gives googleBot index: false')
const config = code(read('next.config.js'))
const rule = config.match(/source:\s*'\/card\/:path\*'[\s\S]{0,300}?X-Robots-Tag'\s*,\s*value:\s*'([^']*)'/)
if (!rule) bad("next.config.js no longer sends an X-Robots-Tag header for '/card/:path*'")
else if (!/\bnoindex\b/.test(rule[1])) bad(`next.config.js sends X-Robots-Tag "${rule[1]}" for cards, without noindex`)

// 2
for (const f of ['app/card/[slug]/page.tsx', 'app/card/[slug]/[person]/page.tsx']) {
  const src = code(read(f))
  if (!src) { bad(`${f} is missing`); continue }
  if (!/import\s*\{\s*CARD_ROBOTS\s*\}\s*from\s*'@\/lib\/card-robots'/.test(src)) bad(`${f} does not import CARD_ROBOTS`)
  const meta = src.slice(src.indexOf('export async function generateMetadata'), src.indexOf('export default'))
  const returns = [...meta.matchAll(/return\s*\{/g)].length
  const robots = [...meta.matchAll(/robots:\s*CARD_ROBOTS/g)].length
  if (returns === 0) bad(`${f} has no generateMetadata returning an object`)
  if (robots < returns) bad(`${f}: ${returns - robots} of the ${returns} metadata returns carry no robots: CARD_ROBOTS`)
}

// 3
const sitemap = code(read('app/sitemap.ts'))
if (/\/card\//.test(sitemap) || /from\(\s*['"](cards|team_cards)['"]\s*\)/.test(sitemap)) bad('app/sitemap.ts lists card pages again, asking Google to crawl what it is told not to index')

// 4
const robots = code(read('app/robots.ts'))
const disallow = (robots.match(/const DISALLOW\s*=\s*\[([\s\S]*?)\]/) || [])[1] || ''
if (/'\/card/.test(disallow)) bad("robots.ts disallows /card for every crawler: search engines would then never read the cards' noindex")
if (!/userAgent:\s*AI_CRAWLERS[\s\S]{0,120}disallow:\s*\[\.\.\.DISALLOW,\s*'\/card\/'\]/.test(robots)) bad('robots.ts no longer keeps AI crawlers out of /card/')

if (fail) {
  console.error(`\ncheck-card-noindex: ${fail} failure(s).`)
  process.exit(1)
}
console.log('check-card-noindex: every card page is noindex by header and by meta on both routes, none is in the sitemap, search engines can still read the noindex, and AI crawlers stay out of /card/.')
