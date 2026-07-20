import { readFileSync } from 'fs'
// Audits titles, descriptions, canonicals and h1s on every indexable page.
//
// Needs a running server, so it cannot be a build gate like check-facts. Run it
// against dev or against production:
//
//   npm run check:seo -- http://localhost:3000
//   npm run check:seo -- https://cardtly.com
//
// Thresholds are what Google will actually show: roughly 60 characters of title
// and 160 of description. Short titles are flagged for information, not as
// faults - "Privacy Policy | Cardtly" is correct at 24 characters and should
// stay that way.

const BASE = process.argv[2] || 'http://localhost:3000'
// Blog URLs are read out of app/blog/posts.ts rather than listed here. A
// hand-kept copy silently stops covering new posts, which is exactly when the
// check matters most - a post ships, its title is 70 characters, and nothing
// says so because the checker never knew the page existed.
const blogSlugs = [...readFileSync(new URL('../app/blog/posts.ts', import.meta.url), 'utf8')
  .matchAll(/slug: '([^']+)'/g)].map(m => '/blog/' + m[1])

const PAGES = ['/', '/features', '/network', '/pricing', '/nfc', '/how-it-works', '/blog',
  ...blogSlugs,
  '/about', '/contact', '/terms', '/privacy', '/signup']
const pick = (h, re) => (h.match(re)?.[1] || '').replace(/&amp;/g,'&').replace(/&#x27;|&apos;/g,"'").replace(/&quot;/g,'"').trim()

const rows = []
for (const p of PAGES) {
  const res = await fetch(BASE + p)
  const html = await res.text()
  rows.push({ page: p, status: res.status,
    title: pick(html, /<title[^>]*>([^<]*)<\/title>/i),
    desc: pick(html, /<meta name="description" content="([^"]*)"/i),
    canonical: pick(html, /<link rel="canonical" href="([^"]*)"/i),
    h1: (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() })
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n)
console.log(pad('PAGE', 44), 'ST'.padStart(3), 'TITLE'.padStart(6), 'DESC'.padStart(5), ' FLAGS')
console.log('-'.repeat(96))
const issues = []
for (const r of rows) {
  const f = []
  if (r.status !== 200) f.push('HTTP ' + r.status)
  if (!r.title) f.push('NO TITLE')
  else if (r.title.length > 60) f.push('title long')
  else if (r.title.length < 30) f.push('title short')
  if (!r.desc) f.push('NO DESC')
  else if (r.desc.length > 160) f.push('desc long')
  else if (r.desc.length < 120) f.push('desc short')
  if (!r.canonical) f.push('no canonical')
  if (!r.h1) f.push('NO H1')
  if (f.length) issues.push([r.page, f])
  console.log(pad(r.page, 44), String(r.status).padStart(3), String(r.title.length).padStart(6),
              String(r.desc.length).padStart(5), ' ' + (f.join(', ') || 'ok'))
}

// duplicates
const byTitle = {}, byDesc = {}
for (const r of rows) { (byTitle[r.title] ||= []).push(r.page); (byDesc[r.desc] ||= []).push(r.page) }
const dupT = Object.entries(byTitle).filter(([, v]) => v.length > 1)
const dupD = Object.entries(byDesc).filter(([, v]) => v.length > 1)
if (dupT.length) { console.log('\nDUPLICATE TITLES:'); dupT.forEach(([k, v]) => console.log('  "' + k.slice(0,60) + '" ->', v.join(', '))) }
if (dupD.length) { console.log('\nDUPLICATE DESCRIPTIONS:'); dupD.forEach(([k, v]) => console.log('  "' + k.slice(0,50) + '..." ->', v.join(', '))) }
console.log('\npages with issues:', issues.length, 'of', rows.length)
