// The public reseller listing, cardtly.com/find-a-reseller (Andre, 2026-11-16).
//
// WHAT THIS PROTECTS:
//   1. Nobody is listed without switching it on, below Bronze, while not
//      active, or after Cardtly took the listing down.
//   2. What people type is checked: provinces from the list, a way to reach
//      them, links that are only http or https, no javascript: or login tricks.
//   3. Only the listing fields leave the server: never prices, pools, clients
//      or cards sold.
//   4. Platinum first, then Gold, Silver, Bronze, as the level ladder promises.
//   5. Out of the iOS app, out of search and the sitemap while empty, no
//      prices on the page, and wired into the Reseller page and admin.
//
// Run: node scripts/check-reseller-listing.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

const out = mkdtempSync(join(tmpdir(), 'reseller-listing-'))
let L
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-listing.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  L = await import(pathToFileURL(join(out, 'reseller-listing.mjs')).href)
} catch (e) {
  console.error('check-reseller-listing: could not compile lib/reseller-listing.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. Who is listed ────────────────────────────────────────────────────────
const full = { blurb: 'x', city: 'Pretoria', provinces: ['Gauteng'], phone: '012 345 6789', email: '', website: '' }
const st = (o) => L.listingState({ listed: true, blocked: false, status: 'active', cardsSold: 100, listing: full, ...o })
eq(st({}), 'live', 'switched on, complete, active, at Bronze')
eq(st({ cardsSold: 99 }), 'waiting_level', 'one card short of Bronze')
eq(st({ listed: false }), 'off', 'not switched on')
eq(st({ listed: 'true' }), 'off', 'only a real true switches it on')
eq(st({ blocked: true }), 'blocked', 'taken down by Cardtly')
eq(st({ blocked: true, listed: false }), 'blocked', 'taken down wins over everything')
eq(st({ status: 'suspended' }), 'inactive', 'on hold')
eq(st({ status: 'ended' }), 'inactive', 'ended')
eq(st({ listing: { ...full, provinces: [] } }), 'incomplete', 'no province')
eq(st({ listing: { ...full, phone: '', email: '' } }), 'incomplete', 'no way to reach them')
eq(L.LISTING_FROM, 'bronze', 'the listing starts at Bronze')

// ── 2. What people type ─────────────────────────────────────────────────────
const ok = (raw) => { const r = L.cleanListing(raw); return r.ok ? r.listing : r.error }
eq(ok({ provinces: ['Gauteng'] }), 'Give a phone number or an email address, so people can reach you.', 'a listing needs a way to reach them')
eq(ok({ phone: '0123456789', provinces: [] }), 'Choose at least one province you work in.', 'a listing needs a province')
eq(ok({ phone: '0123456789', provinces: ['Atlantis'] }), 'Choose at least one province you work in.', 'only real provinces count')
eq(ok({ phone: '0123456789', provinces: ['Western Cape', 'Gauteng', 'Gauteng'] }).provinces, ['Gauteng', 'Western Cape'], 'provinces de-duplicated, in the usual order')
eq(ok({ phone: 'call me', provinces: ['Gauteng'] }), 'That phone number does not look right.', 'a phone number is digits')
eq(ok({ email: 'not-an-email', provinces: ['Gauteng'] }), 'That email address does not look right.', 'an email is an email')
eq(ok({ email: 'a@b.co', provinces: ['Gauteng'], blurb: 'x'.repeat(L.BLURB_MAX + 1) }), `Keep the description to ${L.BLURB_MAX} characters.`, 'the description has a limit')
eq(L.cleanWebsite('acme.co.za'), 'https://acme.co.za/', 'a bare website gets https')
eq(L.cleanWebsite('http://acme.co.za/team'), 'http://acme.co.za/team', 'http is allowed')
for (const evil of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://acme.co.za', 'https://user:pw@acme.co.za', 'https://localhost', 'https://a b.com']) {
  if (L.cleanWebsite(evil) !== null) bad(`the website "${evil}" must be refused`)
}
eq(L.cleanWebsite(''), '', 'no website is fine')
eq(L.telHref('012 345 6789'), 'tel:+27123456789', 'a local number dials as +27')
eq(L.telHref('+27 82 123 4567'), 'tel:+27821234567', 'an international number dials as written')
eq(L.listingFromRow({ provinces: ['Gauteng'], website: 'javascript:alert(1)', phone: 'x' }).website, '', 'a bad stored website is never shown')
eq(L.listingFromRow(null), { blurb: '', city: '', provinces: [], phone: '', email: '', website: '' }, 'nothing stored reads as empty')

// ── 3. Only the listing leaves the server ───────────────────────────────────
const srv = read('lib/reseller-listing-server.ts')
const sel = /PUBLIC_SELECT = '([^']+)'/.exec(srv)
if (!sel) bad('the public select must be one literal list of columns')
else eq(sel[1], 'id, name, status, listed, listing, listing_blocked', 'the public page reads only the listing columns')
const pushed = /out\.push\(\{([\s\S]*?)\}\)/.exec(srv)
if (!pushed) bad('the public read must build each reseller in one out.push({...})')
else {
  const keys = [...pushed[1].matchAll(/(\w+):/g)].map(m => m[1]).sort().join(',')
  eq(keys, 'blurb,city,email,level,name,phone,provinces,website', 'a public reseller carries only its listing fields')
  if (/r\.email|r\.phone|r\.contact/.test(pushed[1])) bad('a public reseller must show the contact details from its listing, not its account')
}
if (!/\.eq\('listed', true\)\.eq\('listing_blocked', false\)\.eq\('status', 'active'\)/.test(srv)) bad('the public read must ask only for listed, allowed, active resellers')
if (!/listingState\(\{[^}]*\}\) !== 'live'\) continue/.test(srv)) bad('the public read must keep only live listings (Bronze and up)')
if (!/if \(!sold\) return \[\]/.test(srv)) bad('when cards sold cannot be counted, nobody is listed')
if (!/listed && reseller\.listing_blocked === true/.test(srv)) bad('a reseller cannot switch on a listing Cardtly took down')
if (!/if \(listed\) \{\s*const checked = cleanListing/.test(srv)) bad('switching a listing on must check it')

// ── 4. Order ────────────────────────────────────────────────────────────────
eq(L.sortListings([
  { name: 'Beta', level: 'bronze' }, { name: 'Alpha', level: 'bronze' }, { name: 'Zed', level: 'platinum' },
  { name: 'Mid', level: 'silver' }, { name: 'Gee', level: 'gold' },
]).map(r => r.name), ['Zed', 'Gee', 'Mid', 'Alpha', 'Beta'], 'Platinum first, then Gold, Silver, Bronze, alphabetical within')

// ── 5. Wiring ───────────────────────────────────────────────────────────────
if (!/'\/find-a-reseller'/.test(read('lib/app-platform.ts'))) bad('/find-a-reseller must be out of the iOS app')
if (!/'\/find-a-reseller'/.test(read('middleware.ts'))) bad('the middleware must see /find-a-reseller, or the iOS block never runs')
if (L.LISTING_PATH !== '/find-a-reseller') bad('LISTING_PATH moved without the iOS block and middleware')
const page = read('app/find-a-reseller/page.tsx')
if (!/listed\.length \? \{\} : \{ robots: \{ index: false, follow: true \} \}/.test(page)) bad('the page must be noindex while nobody is listed')
if (!/\(await publicListings\(\)\)\.length/.test(read('app/sitemap.ts'))) bad('the sitemap must list the page only once somebody is listed')
for (const f of ['app/find-a-reseller/page.tsx', 'components/marketing/ResellerDirectory.tsx', 'components/marketing/ResellerListingCard.tsx']) {
  const src = read(f).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  if (!src) { bad(`${f} is missing`); continue }
  if (/\bR\s?\d|R\{|PRICE|formatZAR|PriceEstimate/.test(src)) bad(`${f} names a price, and resellers set their own`)
  if (/certif|accredit/i.test(src)) bad(`${f} claims a certification Cardtly does not run`)
}
if (!/rel="nofollow noopener noreferrer"/.test(read('components/marketing/ResellerListingCard.tsx'))) bad('a reseller\'s website must open with nofollow noopener noreferrer')
if (!/case 'save_listing':/.test(read('app/api/reseller/route.ts'))) bad('a reseller cannot save its listing')
if (!/case 'save_listing': \{[\s\S]*?writable\(reseller\)/.test(read('app/api/reseller/route.ts'))) bad('saving a listing must be refused on hold')
if (!/\['listing', 'Listing', Globe, null\]/.test(read('components/reseller/ResellerPanel.tsx'))) bad('the Reseller page has no Listing tab')
if (!/if \('listing_blocked' in body\) patch\.listing_blocked = body\.listing_blocked === true/.test(read('app/api/admin/resellers/route.ts'))) bad('admin cannot take a listing down')
if (!/listing_blocked: block/.test(read('components/admin/ResellersTab.tsx'))) bad('admin has no Take listing down button')
const mig = read('supabase/migrations/108_reseller_listing.sql')
if (!/add column if not exists listed boolean not null default false/.test(mig)) bad('108 must start everybody unlisted')
if (!/add column if not exists listing_blocked boolean not null default false/.test(mig)) bad('108 must add listing_blocked')
if (!/check-reseller-listing\.mjs/.test(read('package.json'))) bad('prebuild must run this check')
for (const f of ['lib/reseller-listing.ts', 'lib/reseller-listing-server.ts', 'app/find-a-reseller/page.tsx', 'components/marketing/ResellerDirectory.tsx',
  'components/marketing/ResellerListingCard.tsx', 'components/reseller/ResellerListingForm.tsx', 'supabase/migrations/108_reseller_listing.sql']) {
  if (read(f).includes('—')) bad(`${f} has an em dash`)
}

if (fail) { console.error(`check-reseller-listing: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-reseller-listing: ok (their choice, Bronze up, active, takedown wins; safe links; listing fields only; Platinum first; out of the app and of search while empty)')
