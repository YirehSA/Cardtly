// Reseller levels (Andre, 2026-11-16).
//
// WHAT THIS PROTECTS:
//   1. Starter until 100 cards sold, Bronze at 100, Silver at 250, Gold at 500,
//      Platinum at 1000.
//   2. Every card ever sold counts (Andre's choice): each client at the most
//      seats it ever had, added up, never another reseller's rows.
//   3. The rewards Andre chose: a listing and the badge from Bronze, leads and
//      exclusive card themes from Gold, and no promise about prices.
//   4. A level is announced once (compare-and-set), the progress email goes
//      once a month to active resellers only, and nothing is sent before
//      migration 107.
//   5. It shows on the Reseller page and in admin, and the daily cron runs it.
//
// Run: node scripts/check-reseller-levels.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync, readdirSync, existsSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

const out = mkdtempSync(join(tmpdir(), 'reseller-levels-'))
let L, B
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-levels.ts', 'lib/reseller-badge.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  L = await import(pathToFileURL(join(out, 'reseller-levels.mjs')).href)
  B = await import(pathToFileURL(join(out, 'reseller-badge.mjs')).href)
} catch (e) {
  console.error('check-reseller-levels: could not compile lib/reseller-levels.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. The levels ───────────────────────────────────────────────────────────
eq(L.RESELLER_LEVELS.map(l => [l.key, l.from]),
  [['starter', 0], ['bronze', 100], ['silver', 250], ['gold', 500], ['platinum', 1000]], 'the levels and where they start')
for (const [n, key] of [[0, 'starter'], [99, 'starter'], [100, 'bronze'], [249, 'bronze'], [250, 'silver'], [499, 'silver'],
  [500, 'gold'], [999, 'gold'], [1000, 'platinum'], [5000, 'platinum'], [-5, 'starter'], ['abc', 'starter'], [99.9, 'starter']]) {
  eq(L.levelFor(n).key, key, `the level for ${n} cards`)
}
{
  const p = L.levelProgress(64)
  eq([p.level.key, p.next?.key, p.toNext, p.percent], ['starter', 'bronze', 36, 64], 'progress at 64 cards')
  const q = L.levelProgress(175)
  eq([q.level.key, q.next?.key, q.toNext, q.percent], ['bronze', 'silver', 75, 50], 'progress at 175 cards')
  const t = L.levelProgress(1200)
  eq([t.level.key, t.next, t.toNext, t.percent], ['platinum', null, 0, 100], 'progress at the top')
  eq(L.progressLine(L.levelProgress(99)), '99 cards sold. 1 card more to Bronze.', 'the progress line says one card, not one cards')
}

// ── 2. Every card ever sold ─────────────────────────────────────────────────
eq(L.cardsEverSoldFrom([
  { reseller_id: 'r1', organization_id: 'a', peak_seats: 10 },
  { reseller_id: 'r1', organization_id: 'a', peak_seats: 15 },
  { reseller_id: 'r1', organization_id: 'a', peak_seats: 12 },
  { reseller_id: 'r1', organization_id: 'b', peak_seats: 5 },
  { reseller_id: 'r2', organization_id: 'a', peak_seats: 7 },
  { reseller_id: 'r2', organization_id: 'c', peak_seats: '3' },
  { reseller_id: null, organization_id: 'x', peak_seats: 99 },
]), { r1: 20, r2: 10 }, 'cards ever sold: each client at its highest, per reseller')
eq(L.cardsEverSoldFrom([]), {}, 'no rows, no cards')

// ── 3. The rewards ──────────────────────────────────────────────────────────
const by = Object.fromEntries(L.RESELLER_LEVELS.map(l => [l.key, l.rewards.join(' | ')]))
// No price promise of any kind (Andre, 2026-11-16: "we don't want to say
// better pricing on seats and nfc cards"). The emails and the Reseller page
// both read these lines, so this covers them.
for (const l of L.RESELLER_LEVELS) {
  if (/pric|discount|cheaper|\bR\s?\d|%|percent|coming soon|saving/i.test(l.rewards.join(' '))) bad(`${l.name} promises something about prices, and Andre does not want that said`)
}
for (const k of ['bronze', 'silver', 'gold', 'platinum']) {
  if (!/badge/i.test(by[k])) bad(`${k} must offer its badge to download`)
}
for (const f of ['components/reseller/ResellerLevelCard.tsx', 'lib/reseller-levels-server.ts']) {
  if (/coming soon|better pric/i.test(read(f))) bad(`${f} still talks about better prices`)
}
if (!/cardtly\.com/i.test(by.bronze)) bad('Bronze must list the reseller on cardtly.com')
if (!/lead/i.test(by.gold) || !/theme/i.test(by.gold)) bad('Gold must give leads and exclusive card themes')

// ── 4. Announcing ───────────────────────────────────────────────────────────
const srv = read('lib/reseller-levels-server.ts')
if (!/\.eq\('level', r\.level \|\| 'starter'\)\.select\('id'\)/.test(srv)) bad('a level-up must be claimed compare-and-set before it is emailed')
if (!/levelRank\(p\.level\.key\) > levelRank\(r\.level\)/.test(srv)) bad('only a higher level is announced')
if (!/r\.status === 'active' && \(!r\.level_nudged_month \|\| String\(r\.level_nudged_month\) < month\)/.test(srv)) bad('the monthly email goes to active resellers once a month')
if (!/q\.eq\('level_nudged_month', r\.level_nudged_month\)/.test(srv)) bad('the monthly email must be claimed compare-and-set')
if (!/filter\(\(r: any\) => r\.status !== 'ended'\)/.test(srv)) bad('an ended reseller is never emailed')
if (!/Reseller levels need migration 107/.test(srv)) bad('before migration 107 nothing is sent')
if (!/\.order\('reseller_id'[\s\S]*\.order\('organization_id'[\s\S]*\.order\('month'[\s\S]*\.range\(/.test(srv)) bad('cards ever sold must page past 1000 rows in a fixed order')
const mig = read('supabase/migrations/107_reseller_levels.sql')
if (!mig) bad('migration 107 is missing')
if (!/add column if not exists level text not null default 'starter'/.test(mig)) bad('107 must start every reseller at starter')
if (!/level_nudged_month date\s+default \(date_trunc\('month', now\(\) at time zone 'Africa\/Johannesburg'\)\)::date/.test(mig)) bad('107 must not email anybody the day it runs: level_nudged_month starts at this month')

// ── 5. Wiring ───────────────────────────────────────────────────────────────
if (!/checkResellerLevels\(admin\)/.test(read('app/api/cron/trial-reminders/route.ts'))) bad('the daily cron must run checkResellerLevels')
if (!/cardsEverSold: everSold \? everSold\[reseller\.id\] \?\? 0 : null/.test(read('app/api/reseller/route.ts'))) bad('/api/reseller must return cards ever sold')
if (!/<ResellerLevelCard cardsSold=\{data\.cardsEverSold\} \/>/.test(read('components/reseller/ResellerPanel.tsx'))) bad('the Reseller page must show the level')
if (!/cardsEverSold: everSold \? everSold\[r\.id\] \?\? 0 : null/.test(read('app/api/admin/resellers/route.ts'))) bad('admin must get cards ever sold')
if (!/levelProgress\(r\.cardsEverSold\)/.test(read('components/admin/ResellersTab.tsx'))) bad('admin must show each reseller\'s level')
if (!/check-reseller-levels\.mjs/.test(read('package.json'))) bad('prebuild must run this check')

// ── 6. The badges (lib/reseller-badge) ──────────────────────────────────────
// Andre's artwork (2026-11-19), made into files by make-reseller-badges. Read
// from the file headers only, so the check needs no image library.
const pngSize = (buf) => buf.length > 26 && buf.toString('ascii', 1, 4) === 'PNG'
  ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: buf[25] } : null
// A PNG with real transparency: RGBA (6), grey-alpha (4), or a palette (3)
// with a tRNS chunk.
const pngClear = (buf, t) => t === 6 || t === 4 || (t === 3 && buf.includes(Buffer.from('tRNS')))
const webpSize = (buf) => {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const kind = buf.toString('ascii', 12, 16)
  if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), alpha: !!(buf[20] & 0x10) }
  return { w: 0, h: 0, alpha: false }
}
for (const l of L.RESELLER_LEVELS) {
  if (!existsSync(`design/reseller-badges/${l.key}.webp`)) bad(`design/reseller-badges/${l.key}.webp (the artwork) is missing`)
  const png = existsSync(join('public', B.badgePngPath(l.key))) ? readFileSync(join('public', B.badgePngPath(l.key))) : null
  const p = png && pngSize(png)
  if (!p) bad(`public${B.badgePngPath(l.key)} is missing: run node scripts/make-reseller-badges.mjs`)
  else {
    if (p.w !== p.h || p.w < 512) bad(`the ${l.name} PNG must be square and at least 512px, not ${p.w} x ${p.h}`)
    if (!pngClear(png, p.type)) bad(`the ${l.name} PNG must have a transparent background`)
  }
  const webp = existsSync(join('public', B.badgeWebpPath(l.key))) ? readFileSync(join('public', B.badgeWebpPath(l.key))) : null
  const w = webp && webpSize(webp)
  if (!w) bad(`public${B.badgeWebpPath(l.key)} is missing: run node scripts/make-reseller-badges.mjs`)
  else if (w.w !== w.h || w.w < 256 || !w.alpha) bad(`the ${l.name} WebP must be square, 256px or more, with transparency`)
}
if (!/<img src=\{badgeWebpPath\(level\.key\)\}/.test(read('components/reseller/ResellerLevelCard.tsx'))) bad('LevelBadge must show the badge artwork (lib/reseller-badge)')
if (!/download=\{`cardtly-\$\{p\.level\.key\}-reseller\.png`\}/.test(read('components/reseller/ResellerLevelCard.tsx'))) bad('the Reseller page must offer the badge to download')
if ((read('lib/reseller-levels-server.ts').match(/\$\{badgeImg\(p\.level, \d+\)\}/g) || []).length < 3) bad('every level email must show the badge')

for (const f of ['lib/reseller-levels.ts', 'lib/reseller-levels-server.ts', 'components/reseller/ResellerLevelCard.tsx', 'supabase/migrations/107_reseller_levels.sql', 'lib/reseller-badge.ts', 'scripts/make-reseller-badges.mjs']) {
  if (read(f).includes('—')) bad(`${f} has an em dash`)
}

if (fail) { console.error(`check-reseller-levels: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-reseller-levels: ok (Starter, Bronze 100, Silver 250, Gold 500, Platinum 1000; every card ever sold; no price promises; announced once; monthly to active resellers)')
