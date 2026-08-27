import { readFileSync } from 'fs'
// Audits titles, descriptions, canonicals and h1s on every indexable page.
//
// Needs a running server, so it cannot be a build gate like check-facts. With
// no argument it audits production, which is the copy Google actually indexes:
//
//   npm run check:seo                              -> https://cardtly.com
//   npm run check:seo -- http://localhost:60617    -> a dev server
//
// It used to default to localhost:3000, and that is how it came to audit a
// different project entirely. The dev server had moved to an autoPort, another
// app was sitting on 3000, and the report came back "20 of 20 pages with
// issues" with every description belonging to something called Nova. It exited
// 0, so it read as a finding rather than a misconfiguration. The identity check
// below matters more than the default does.
//
// Thresholds are what Google will actually show: roughly 60 characters of title
// and 160 of description. Short titles are flagged for information, not as
// faults - "Privacy Policy | Cardtly" is correct at 24 characters and should
// stay that way.

const BASE = (process.argv[2] || 'https://cardtly.com').replace(/\/$/, '')

// Keep-alive sockets left open when the process exits trip a libuv assertion on
// Windows, which surfaces as exit code 127 instead of the intended 1.
const GET = url => fetch(url, { redirect: 'follow', headers: { connection: 'close' } })

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
const pad = (s, n) => String(s).padEnd(n).slice(0, n)

async function main() {
  // ── Is this even Cardtly? ─────────────────────────────────────────────────
  let home
  try {
    home = await (await GET(BASE + '/')).text()
  } catch (e) {
    console.error(`check-seo: cannot reach ${BASE}\n  ${e.message}\n\nStart the dev server and pass its URL, or omit the argument to audit production.`)
    return 1
  }
  if (!/Cardtly/i.test(home)) {
    const title = (home.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '(no title)').trim()
    console.error(`check-seo: ${BASE} is not Cardtly. Its home page is titled "${title}".\n\nAuditing it would produce a page of meaningless failures. Pass the right URL:\n  npm run check:seo -- http://localhost:<port>\n  npm run check:seo -- https://cardtly.com`)
    return 1
  }
  console.log(`check-seo: auditing ${BASE}\n`)

  const rows = []
  for (const p of PAGES) {
    const res = await GET(BASE + p)
    const html = await res.text()
    rows.push({ page: p, status: res.status,
      title: pick(html, /<title[^>]*>([^<]*)<\/title>/i),
      desc: pick(html, /<meta name="description" content="([^"]*)"/i),
      canonical: pick(html, /<link rel="canonical" href="([^"]*)"/i),
      h1: (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() })
  }

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

  // Soft flags (a short title, a long description) are judgement calls and stay
  // informational. A page that does not return 200 is not a judgement call, and
  // exiting 0 on a wall of them is what let the wrong-server run pass for a
  // report.
  const broken = rows.filter(r => r.status !== 200)
  if (broken.length) {
    console.error(`\ncheck-seo: ${broken.length} page(s) did not return 200: ${broken.map(r => `${r.page} (${r.status})`).join(', ')}`)
    return 1
  }
  return 0
}

process.exitCode = await main()
