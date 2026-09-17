// The visitor hash identifies a repeat view and nothing more.
//
// WHAT THIS EXISTS BECAUSE OF. card_events now carries a visitor_hash so that
// a duplicate view can be identified rather than guessed at. The guessing was
// the problem: device+browser+os was the only fingerprint available, and
// measured against its own background rate it could not tell 142 candidate
// duplicates from the roughly 20 real ones.
//
// But a per-visitor value on an analytics row is exactly the kind of thing
// that turns into tracking by accident, one reasonable-looking change at a
// time. The properties below are what keep it from becoming a user id, and
// none of them is visible by reading the call site - they live inside one
// function, so this tests the function rather than the shape of the code.
//
// Unlike the other guards here this one runs the real thing: it imports
// lib/visitor-hash.ts and checks behaviour. A regex cannot tell you whether a
// hash actually rotates.
//
// Run: node scripts/check-visitor-hash.mjs

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

// Importing a .ts module needs type stripping, so re-exec with it once.
if (!process.execArgv.includes('--experimental-strip-types')) {
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)],
    { stdio: 'inherit' },
  )
  process.exit(r.status ?? 1)
}

const LF = String.fromCharCode(10)
let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const ok = (cond, msg) => { if (!cond) bad(msg) }

process.env.ANALYTICS_VISITOR_SALT = 'salt-for-the-guard'
const { visitorHash, clientIp } = await import('../lib/visitor-hash.ts')

const IP = '102.65.14.9'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0'
const DAY1 = new Date('2026-09-17T08:00:00Z')
const DAY1_LATE = new Date('2026-09-17T23:59:00Z')
const DAY2 = new Date('2026-09-18T00:01:00Z')

const base = { ip: IP, userAgent: UA, scope: 'card-a', now: DAY1 }
const h = (o) => visitorHash({ ...base, ...o })

// 1. STABLE WITHIN A DAY, or it identifies nothing and every view is unique.
ok(h({}) === h({}), 'the same visitor does not produce the same hash twice, so a repeat view can never be recognised')
ok(h({ now: DAY1_LATE }) === h({}), 'the hash changes during the day, so a morning and an evening view of the same card look like two people')

// 2. ROTATES DAILY. This is the property that stops it following somebody.
ok(h({ now: DAY2 }) !== h({}), 'the hash does NOT rotate daily, so the same value follows a visitor indefinitely and becomes a tracking id')

// 3. SCOPED PER CARD. Two cards must not share a visitor's identity, or the
//    table can be joined into one person's browsing across the platform.
ok(h({ scope: 'card-b' }) !== h({}), 'the same visitor produces the same hash on two different cards, so their activity can be linked across the platform')

// 4. ACTUALLY DERIVED FROM THE VISITOR.
ok(h({ ip: '41.13.8.200' }) !== h({}), 'changing the IP does not change the hash')
ok(h({ userAgent: 'Mozilla/5.0 (iPhone) Safari/605' }) !== h({}), 'changing the user agent does not change the hash')

// 5. KEYED, NOT A BARE DIGEST. Without this the value is reversible: IPv4 is
//    2^32 and user agents are guessable, so anybody with the table could hash
//    candidates until one matched.
const withSalt = h({})
process.env.ANALYTICS_VISITOR_SALT = 'a-different-salt'
const withOther = h({})
ok(withSalt !== withOther, 'the secret does not affect the hash, which means it is not keyed and the IP can be recovered by brute force')

// 6. NO SECRET, NO HASH. Storing an unkeyed digest of an IP is worse than
//    storing nothing at all.
const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANALYTICS_VISITOR_SALT
delete process.env.SUPABASE_SERVICE_ROLE_KEY
ok(h({}) === null, 'with no secret configured the function still returns a hash, so it is emitting an unkeyed and therefore reversible digest of an IP address')
process.env.ANALYTICS_VISITOR_SALT = 'salt-for-the-guard'
if (savedService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedService

// 7. NULL RATHER THAN A SHARED FICTION. Nothing to identify with must not
//    collapse every anonymous visitor into one.
ok(h({ ip: null, userAgent: null }) === null, 'with no IP and no user agent it returns a hash, so every unidentifiable visitor collides into a single fictional person')
ok(h({ scope: '' }) === null, 'it returns a hash with no card scope, so the per-card guarantee does not hold')

// 8. THE RAW VALUES DO NOT SURVIVE INTO THE OUTPUT.
const out = h({}) || ''
ok(/^[0-9a-f]{32}$/.test(out), `the hash is not 32 hex characters (got ${JSON.stringify(out).slice(0, 40)})`)
ok(!out.includes(IP) && !out.includes('Chrome'), 'the hash contains the raw IP or user agent')

// 9. clientIp reads the visitor, not the proxy.
const headers = (o) => new Headers(o)
ok(clientIp(headers({ 'x-forwarded-for': '102.65.14.9, 10.0.0.1, 10.0.0.2' })) === '102.65.14.9',
  'clientIp does not take the left-most x-forwarded-for entry, so it hashes a proxy and every visitor behind it becomes the same person')
ok(clientIp(headers({ 'x-real-ip': '41.13.8.200' })) === '41.13.8.200', 'clientIp ignores x-real-ip when there is no forwarded header')
ok(clientIp(headers({})) === null, 'clientIp invents an address when there is no header')

// ── The referrer records where the visitor came FROM ────────────────────────
//
// It used to record where they went TO. /api/analytics filled the column from
// the Referer header of the tracking POST, and a POST made by the card page
// carries the card page - so across 5,325 stored events not one held a real
// traffic source. Every value was cardtly.com/card/... or localhost.
const { sourceOrigin } = await import('../lib/visitor-hash.ts')
const { readFileSync } = await import('fs')

// The path and query go, because the value is client-supplied and then stored,
// and a referring URL can carry tokens or search terms.
ok(sourceOrigin('https://www.linkedin.com/feed/update/123?token=secret') === 'https://www.linkedin.com',
  'sourceOrigin keeps the path or query of a referring URL, so a token or a search term in somebody else\'s URL gets stored')
ok(sourceOrigin('http://localhost:3000/') === 'http://localhost:3000', 'sourceOrigin does not handle a plain origin')

// Nothing untrusted is stored raw.
for (const [value, why] of [
  ['javascript:alert(1)', 'a javascript: URL'],
  ['data:text/html,<script>', 'a data: URL'],
  ['ftp://files.example.com/x', 'a non-http scheme'],
  ['not a url at all', 'an unparseable string'],
  ['https://x.example/' + 'a'.repeat(3000), 'an oversized string'],
  ['', 'an empty referrer'],
]) {
  ok(sourceOrigin(value) === null, `sourceOrigin returns something for ${why}, which then gets stored`)
}
ok(sourceOrigin(null) === null && sourceOrigin(undefined) === null && sourceOrigin(42) === null,
  'sourceOrigin does not handle a missing or non-string referrer')

// AND THE BUG ITSELF MUST NOT COME BACK. The header is the destination.
const routeSrc = readFileSync('app/api/analytics/route.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)
if (/referrer\s*=\s*.*headers?List\.get\(['"]referer['"]\)/i.test(routeSrc)) {
  bad('app/api/analytics/route.ts fills the referrer from the Referer header again. On a POST made by the card page that IS the card page, so the column records the destination and calls it the origin.')
}
if (!/sourceOrigin\(/.test(routeSrc)) {
  bad('app/api/analytics/route.ts no longer reduces the referrer through sourceOrigin, so a full untrusted URL is stored')
}
const trackSrc = readFileSync('lib/track.ts', 'utf8')
if (!/referrer:\s*typeof document/.test(trackSrc)) {
  bad('lib/track.ts no longer sends document.referrer, so the server has nothing to record and the column goes back to being empty or wrong')
}

if (fail) {
  console.error(`${LF}check-visitor-hash: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-visitor-hash: the visitor hash is stable for one day on one card, rotates the next day, differs per card, ' +
  'is keyed so it cannot be reversed, and is null rather than a shared fiction when there is nothing to identify.',
)
