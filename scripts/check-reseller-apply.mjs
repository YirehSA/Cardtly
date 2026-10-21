// Applying to become a reseller, from cardtly.com/resellers.
//
// WHAT THIS PROTECTS (Andre, 2026-10-21):
//   1. The form asks for everything needed to set a reseller up and invoice
//      it, and the server refuses anything incomplete with the same words the
//      page shows.
//   2. Bots get a quiet success and nothing is stored: a hidden field and a
//      minimum time to fill the form in.
//   3. The page quotes no price (reseller pricing is agreed after approval),
//      and it is out of the iOS app.
//   4. Approving claims the application first, so it can only make one
//      reseller; declining never emails the internal note.
//   5. The privacy policy says what is collected and why.
//
// Run: node scripts/check-reseller-apply.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const out = mkdtempSync(join(tmpdir(), 'reseller-apply-'))
let A
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-application.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  A = await import(pathToFileURL(join(out, 'reseller-application.mjs')).href)
} catch (e) {
  console.error('check-reseller-apply: could not compile lib/reseller-application')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. The check ────────────────────────────────────────────────────────────
const good = {
  trading_name: 'Spark Marketing', registered_name: 'Spark Marketing (Pty) Ltd', registration_number: '2021/123456/07',
  vat_number: '', business_type: 'Marketing or design agency', website: 'spark.example',
  address: '12 Main Road', city: 'Durban', province: 'KwaZulu-Natal', postal_code: '4001',
  contact_name: 'Jo Naidoo', contact_role: 'Director', email: 'Jo@Spark.example', phone: '082 123 4567',
  expected_clients: '6 to 20', expected_seats: '50 to 200', printing: 'Cardtly should print them',
  pitch: 'We look after about forty small businesses in Durban and would bundle cards with their branding work.',
  heard_about: 'LinkedIn', consent: true,
}
const ok = A.checkApplication(good)
if (!ok.ok) bad(`a complete application was refused: ${ok.error}`)
else {
  if (ok.data.email !== 'jo@spark.example') bad('the email is not stored in lower case, so a second application from the same person would not be spotted')
  if (ok.data.vat_number !== null) bad('an empty optional field is stored as an empty string instead of nothing')
}
const refusedFor = (patch, field, what) => {
  const r = A.checkApplication({ ...good, ...patch })
  if (r.ok) bad(`${what} was accepted`)
  else if (r.field !== field) bad(`${what} was refused against the wrong field (${r.field}, expected ${field})`)
}
for (const f of ['trading_name', 'business_type', 'address', 'city', 'province', 'postal_code', 'contact_name', 'email', 'phone', 'expected_clients', 'printing', 'pitch']) {
  refusedFor({ [f]: '' }, f, `an application with no ${f}`)
}
refusedFor({ email: 'jo@spark' }, 'email', 'an email address with no domain')
refusedFor({ phone: '12345' }, 'phone', 'a five-digit phone number')
refusedFor({ pitch: 'Sell cards.' }, 'pitch', 'a one-line pitch')
refusedFor({ consent: false }, 'consent', 'an application without consent')
refusedFor({ consent: 'yes' }, 'consent', 'consent sent as text instead of a tick')
refusedFor({ business_type: 'Cardtly HQ' }, 'business_type', 'a business type that is not on the list')
refusedFor({ province: 'Atlantis' }, 'province', 'a province that is not on the list')
const long = A.checkApplication({ ...good, trading_name: 'x'.repeat(500), pitch: 'y'.repeat(9000) })
if (!long.ok || long.data.trading_name.length > 160 || long.data.pitch.length > 3000) bad('over-long fields are not cut to length')
if (A.addressLine(good) !== '12 Main Road, Durban, KwaZulu-Natal, 4001') bad('the address line for invoices is not built right')
if (!(A.MIN_FILL_MS >= 3000)) bad('the minimum fill time is too short to stop a script')

// ── 2. The route ────────────────────────────────────────────────────────────
const api = read('app/api/reseller-apply/route.ts')
if (!/body\.website_url \|\| !Number\.isFinite\(fillMs\) \|\| fillMs < MIN_FILL_MS/.test(api)) bad('the application route must quietly drop bots: hidden field and minimum fill time')
if (!/const checked = checkApplication\(body\)/.test(api)) bad('the application route must run the same check as the page')
if (!/\.eq\('status', 'pending'\)\.eq\('email', a\.email\)/.test(api)) bad('a second pending application from the same email must not be stored again')
if (!/SUPABASE_SERVICE_ROLE_KEY/.test(api)) bad('applications must be written with the service role: the table is closed to the browser')
if (!/checkApplication\(\{ \.\.\.f, consent \}\)/.test(read('components/marketing/ResellerApplyForm.tsx'))) bad('the form must check with the same function before sending')

// ── 3. The page ─────────────────────────────────────────────────────────────
for (const p of ['app/resellers/page.tsx', 'components/marketing/ResellerApplyForm.tsx']) {
  const src = read(p).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
  if (!src) { bad(`${p} is missing`); continue }
  const price = /\bR\s?\d[\d\s,.]*/.exec(src)
  if (price) bad(`${p} quotes a price (${price[0].trim()}). Reseller pricing is agreed after approval, and this page must not show one.`)
}
if (!/'\/resellers'/.test(read('lib/app-platform.ts'))) bad('/resellers must be on IOS_BLOCKED_ROUTES')
if (!/'\/resellers',/.test(read('middleware.ts'))) bad('/resellers needs a middleware matcher entry, or the iOS block never runs')
if (!/href: '\/resellers'/.test(read('components/marketing/Footer.tsx'))) bad('the footer must link to /resellers')
if (!/\/resellers`/.test(read('app/sitemap.ts'))) bad('/resellers must be in the sitemap')
if (!/Reseller applications\.<\/B>/.test(read('app/privacy/page.tsx'))) bad('the privacy policy must say what a reseller application collects and why')

// ── 4. Approving and declining ──────────────────────────────────────────────
const resellers = read('app/api/admin/resellers/route.ts')
if (!/\.eq\('id', data\.id\)\.eq\('status', 'pending'\)\.select\('id'\)/.test(resellers) || !/if \(!claimed\?\.length\)/.test(resellers)) bad('approving must claim the application while it is pending, so it makes one reseller')
if ((resellers.match(/await release\(\)/g) || []).length < 2) bad('a failed approval must put the application back to pending')
const apps = read('app/api/admin/reseller-applications/route.ts')
const declineHtml = (/html: `([\s\S]*?)`,/.exec(apps) || [])[1] || ''
if (!declineHtml) bad('could not find the decline email')
if (/note|decision_note/.test(declineHtml)) bad('the decline email must never include the internal note')
if (!/requireAdmin\(\)/.test(apps)) bad('the applications route must be admin only')

const mig = read('supabase/migrations/095_reseller_applications.sql').split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
if (!/alter table public\.reseller_applications enable row level security/.test(mig)) bad('reseller_applications must have row level security on')
if (/grant [^;]*on public\.reseller_applications to (anon|authenticated)/.test(mig)) bad('reseller_applications must not be readable or writable from the browser')

if (fail) {
  console.error(`check-reseller-apply: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-reseller-apply: ok (complete applications only, bots dropped quietly, no price on the page, out of the iOS app, one reseller per approval, the note stays internal)')
