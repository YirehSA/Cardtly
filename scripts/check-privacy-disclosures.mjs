// Every outside service that receives personal information is named in the
// privacy policy, and neither legal page can become an App Store problem.
//
// WHAT THIS EXISTS BECAUSE OF. On 2026-09-23 the privacy policy was audited
// against the code and three live services turned out to be undisclosed:
// OpenAI (paper card scanning and the bio writer - a photograph of a THIRD
// party's business card goes to it), ipapi.co (the IP address of every new
// signup), and Firebase Analytics (usage data from the Android app). Each one
// was added by somebody building a feature, and nobody's job at that moment
// was the privacy policy. A corporate legal team reads section 7 of that page
// as a representation of who gets their staff's data, so a missing name is
// not a documentation gap; it is a statement that is untrue.
//
// So the rule is mechanical: a service the code talks to is either named on
// the policy, or listed below as receiving no personal information, with the
// reason. There is no third option, and a new host fails the build until
// somebody makes the choice deliberately.
//
// Since 2026-10-22 the trust page (app/trust) and the PAIA manual (app/paia)
// repeat parts of the policy for procurement readers. They must name every
// provider the policy names, carry no claim the policy has retracted, and
// never say Cardtly holds a certification it does not.
//
// Run: node scripts/check-privacy-disclosures.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

const PRIVACY = 'app/privacy/page.tsx'
const TERMS = 'app/terms/page.tsx'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

/** The page with its code comments removed, so the checks read what a visitor
 *  reads. The privacy page opens with a comment recording what the OLD policy
 *  got wrong - "country level", "within 30 days" - and without this the guard
 *  failed on the explanation of the fix. Only whole-line // comments and block
 *  comments go; a // inside a URL on a line of markup is left alone, which a
 *  naive strip would have cut, taking the vendor's name with it. */
const visible = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).filter(l => !/^\s*\/\//.test(l)).join(LF)

const TRUST = 'app/trust/page.tsx'
const PAIA = 'app/paia/page.tsx'

const privacyRaw = read(PRIVACY)
const termsRaw = read(TERMS)
const trustRaw = read(TRUST)
const paiaRaw = read(PAIA)
if (!privacyRaw || !termsRaw || !trustRaw || !paiaRaw) { bad('a legal page is missing'); process.exit(1) }
const privacy = visible(privacyRaw)
const terms = visible(termsRaw)
const trust = visible(trustRaw)
const paia = visible(paiaRaw)

// ── 1. Known services: the code signal, and the name the policy must use ────
const pkg = JSON.parse(read('package.json') || '{}')
const deps = { ...(pkg.dependencies || {}) }
const androidGradle = read('android/app/build.gradle') || ''

const SERVICES = [
  { name: 'Supabase', present: '@supabase/supabase-js' in deps },
  { name: 'Vercel', present: true }, // the host; always true while we deploy there
  { name: 'Paystack', present: true, why: 'payments' },
  { name: 'Resend', present: 'resend' in deps },
  { name: 'OpenAI', present: 'openai' in deps },
  { name: 'ipapi.co', present: null /* decided by the host scan below */ },
  { name: 'Google Wallet', present: existsSync('app/api/wallet/google') },
  { name: 'Firebase Analytics', present: /firebase-analytics/.test(androidGradle) },
  // Sign-in providers. Microsoft is not a processor Cardtly sends data to, but
  // it is where a Microsoft sign-in happens and where the name and email come
  // from, and a corporate reader looks for it. Keyed on the component existing
  // rather than the NEXT_PUBLIC_MS_SSO flag, which lives in Vercel where this
  // script cannot see it - and a flag guessed from here is how the security
  // docs came to call a live button "switched off".
  { name: 'Microsoft', present: existsSync('components/auth/MicrosoftSignIn.tsx') },
  // Loaded as a script tag, not fetch(), so the host scan below cannot see it.
  { name: 'Google Analytics', present: existsSync('components/GoogleAnalytics.tsx') },
]

// ── 2. Every outbound host the server code calls ────────────────────────────
function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(p)) out.push(p)
  }
  return out
}
const hosts = new Map() // host -> first file
for (const f of walk('app').concat(walk('lib')).concat(walk('components'))) {
  const src = read(f) || ''
  for (const m of src.matchAll(/fetch\(\s*['`]https:\/\/([a-z0-9.-]+)/gi)) {
    if (!hosts.has(m[1])) hosts.set(m[1], f.split('\\').join('/'))
  }
}

// Hosts that belong to a service named above.
const HOST_OWNER = {
  'api.paystack.co': 'Paystack',
  'ipapi.co': 'ipapi.co',
}
// Hosts that receive NO personal information, and why. Adding to this list is
// a claim; the reason is there so the next person can check it.
const NON_PERSONAL = {
  // frankfurter.app now only redirects here; the request is the same.
  'api.frankfurter.dev': 'Currency rates for the ZAR price estimate in USD, EUR or GBP. Called server-side with no user data; the visitor\'s country is used on our side to pick a rate and is never sent.',
  'open.er-api.com': 'Same currency lookup, the primary provider. Server-side, no user data.',
}

for (const [host, file] of hosts) {
  if (NON_PERSONAL[host]) continue
  const owner = HOST_OWNER[host]
  if (!owner) {
    bad(`${file} calls https://${host}, which is neither named in ${PRIVACY} nor listed in NON_PERSONAL here. If it receives personal information - an IP address counts - name it in section 7 of the policy and add it to HOST_OWNER. If it genuinely receives none, add it to NON_PERSONAL with the reason.`)
    continue
  }
  const svc = SERVICES.find(s => s.name === owner)
  if (svc && svc.present === null) svc.present = true
}

for (const s of SERVICES) {
  if (!s.present) continue
  if (!privacy.includes(s.name) && !(s.name === 'Google Wallet' && /Google Wallet/.test(privacy))) {
    bad(`${PRIVACY} does not name ${s.name}, and the code uses it. Section 7 of the policy is read by corporate legal teams as the complete list of who processes their information.`)
  }
}

// ── 3. Statements the audit found untrue, kept from coming back ─────────────
const REGRESSIONS = [
  [/country level/i, 'describes signup location as "country level". It is city, region and country, looked up through ipapi.co.'],
  // Tied to deletion, not to the phrase: "we respond within 30 days" is the
  // response time for a request and is true.
  [/(delet|remov)[^.]{0,120}within 30 days/i, 'says deletion happens "within 30 days". It is immediate from live systems; only encrypted backups linger.'],
  [/data controller/i, 'uses "data controller", which is GDPR vocabulary. Under POPIA it is "responsible party", and the operator distinction depends on the term being right.'],
  [/password only|only (by|with) (email and )?password/i, 'says sign-in is by password only. There are three ways in: a password, an emailed one-time link, and Sign in with Microsoft.'],
  [/(sign in|sign-in|log in) with google|google sign-in/i, 'mentions Google sign-in. It does not exist; Google appears in the policy only for Wallet, Firebase and Play.'],
]
for (const [re, why] of REGRESSIONS) {
  for (const [file, src] of [[PRIVACY, privacy], [TRUST, trust], [PAIA, paia]]) {
    if (re.test(src)) bad(`${file} ${why}`)
  }
}

// ── 3a. No claim Cardtly cannot back ────────────────────────────────────────
//
// A competitor's trust page listed SOC 2 and ISO 27001 as "actively
// preparing", which a buyer skimming reads as certified. Cardtly holds none of
// these, our own security notes in this public repo say so, and a tender
// answer that contradicts them is found out. The platforms' certifications
// (Supabase, Vercel, Paystack) are described as theirs, which these allow.
const CLAIMS = [
  [/\b(cardtly is|we are)\s+(now\s+|fully\s+)?(iso|soc|pci|certified|audited)/i, 'says Cardtly is certified or audited. It is not; only the platforms it runs on are.'],
  [/preparing for (an? )?(soc|iso)/i, 'says Cardtly is preparing for SOC 2 or ISO 27001. Nothing is under way, so this reads as a claim of progress that does not exist.'],
  [/standard contractual clauses/i, 'mentions standard contractual clauses. Nothing on file shows Cardtly has signed them; the claim was removed from the policy on 2026-09-23.'],
  [/penetration test|pen test/i, 'mentions a penetration test. None has been done.'],
  [/(our own|we offer|we provide|cardtly offers)\s+(two-factor|2fa|multi-factor)/i, 'offers two-factor sign-in of our own. There is none; Microsoft sign-in carries the organisation\'s own MFA.'],
]
for (const [re, why] of CLAIMS) {
  for (const [file, src] of [[PRIVACY, privacy], [TERMS, terms], [TRUST, trust], [PAIA, paia]]) {
    if (re.test(src)) bad(`${file} ${why}`)
  }
}

// ── 3b. The trust page and the PAIA manual name every provider ─────────────
//
// Section 7 of the policy is the list; its provider cells are the only bold
// elements on that page with a key. A provider added there and not here makes
// the trust page's "complete list" untrue, and the PAIA manual's recipients
// section (PAIA s51(1)(c)) incomplete.
const providers = [...privacyRaw.matchAll(/<B key="[a-z]">([^<]+)<\/B>/g)].map(m => m[1])
if (providers.length < 5) bad(`could not read the provider list from section 7 of ${PRIVACY} (found ${providers.length}).`)
for (const name of providers) {
  if (!trust.includes(`'${name}'`)) bad(`${TRUST} does not list ${name}, which section 7 of the privacy policy names. The trust page calls its list complete.`)
  if (!paia.includes(name)) bad(`${PAIA} does not name ${name} among the recipients of personal information, which section 7 of the privacy policy does.`)
}

// ── 3b2. Google Analytics stays where the policy says it is ────────────────
//
// The policy promises that a card visitor cannot be followed between cards and
// that the iOS app has no third-party analytics. GA's client id on a card page,
// or the tag inside the app, would break both. So: an allowlist of marketing
// paths with no product route on it, the app check, advertising denied, page
// views sent by hand, the tag rendered only when switched on, and the policy's
// disclosure tied to the same switch.
if (existsSync('components/GoogleAnalytics.tsx')) {
  const ga = read('components/GoogleAnalytics.tsx') || ''
  const lib = read('lib/analytics.ts') || ''
  const layout = read('app/layout.tsx') || ''
  const paths = [...(lib.match(/ANALYTICS_PATHS\s*=\s*\[([\s\S]*?)\]/)?.[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1])
  if (!paths.length) bad('could not read ANALYTICS_PATHS from lib/analytics.ts.')
  for (const p of paths) {
    if (/^\/(card|dashboard|login|admin|po|quote|team|wa|api|invoice|r)(\/|$)/.test(p)) {
      bad(`lib/analytics.ts lets Google Analytics run on ${p}. It is for the marketing pages only: cards, the dashboard and signed documents are promised untracked.`)
    }
  }
  if (!/isNativePlatform/.test(ga) || !/IOS_APP_UA_TAG/.test(ga)) bad('components/GoogleAnalytics.tsx no longer refuses to load inside the Cardtly apps. The policy says the iOS app has no third-party analytics.')
  if (!/ga-disable-/.test(ga)) bad('components/GoogleAnalytics.tsx no longer switches GA off when a visitor moves from a marketing page to a card or the dashboard.')
  if (!/ad_storage: 'denied'/.test(ga) || /ad_storage: 'granted'/.test(ga)) bad('components/GoogleAnalytics.tsx no longer denies advertising storage. The policy says we do not use advertising cookies; change the policy first.')
  if (!/send_page_view: false/.test(ga)) bad('components/GoogleAnalytics.tsx lets the tag send its own page views, which can report a card or dashboard address before the component sees the navigation.')
  if (!/\{GA_ENABLED && <GoogleAnalytics \/>\}/.test(layout)) bad('app/layout.tsx renders GoogleAnalytics without the GA_ENABLED switch, so the tag could run while the policy says it does not.')
  for (const [file, raw] of [[PRIVACY, privacyRaw], [TRUST, trustRaw]]) {
    if (!/GA_ENABLED/.test(raw)) bad(`${file} no longer ties its Google Analytics wording to GA_ENABLED, so it can say the opposite of what the site does.`)
  }
  if (!/Google Analytics does not run on cards/.test(privacy)) bad(`${PRIVACY} no longer says Google Analytics does not run on cards, the dashboard or the apps.`)
}

// ── 3c. One set of company details ──────────────────────────────────────────
//
// The trust page and the PAIA manual read them from lib/company.ts; the policy
// and the terms spell them out. All four must agree with what the invoices
// print (billing_settings).
const company = read('lib/company.ts') || ''
for (const key of ['regNumber', 'address', 'phone', 'email']) {
  const value = company.match(new RegExp(`${key}: '([^']+)'`))?.[1]
  if (!value) { bad(`lib/company.ts has no ${key}.`); continue }
  if (key === 'email') continue // the policy names it; the terms need not
  for (const [file, src] of [[PRIVACY, privacy], [TERMS, terms]]) {
    if (!src.includes(value)) bad(`${file} does not show the company ${key} "${value}" from lib/company.ts. Change billing_settings, lib/company.ts and both legal pages together.`)
  }
}
if (!privacy.includes(company.match(/email: '([^']+)'/)?.[1] || '\u0000')) bad(`${PRIVACY} no longer names the Information Officer's email from lib/company.ts.`)
// The schema address, in parts, must be the same place as COMPANY.address.
const companyAddress = company.match(/address: '([^']+)'/)?.[1] || ''
const schemaSrc = read('lib/seo-schema.ts') || ''
for (const key of ['streetAddress', 'addressLocality', 'addressRegion']) {
  const part = schemaSrc.match(new RegExp(`${key}: '([^']+)'`))?.[1]
  if (!part || !companyAddress.includes(part)) bad(`lib/seo-schema.ts gives ${key} "${part}", which is not part of the company address "${companyAddress}" in lib/company.ts. Search results and the legal pages would name different places.`)
}
// The terms must describe cancellation the way the product actually does it.
// For months they said "cancel from your account settings" when Settings sent
// people to the contact page; self-service cancellation was then built
// (app/api/account/cancel-subscription). So the rule follows the code in BOTH
// directions: the terms may promise self-service cancel exactly when the
// endpoint exists, and must when it does.
const selfServiceCancel = existsSync('app/api/account/cancel-subscription/route.ts')
const termsPromisesIt = /cancel[^.]{0,80}(from )?Billing in your account settings|cancel[^.]{0,60}from your account settings/i.test(terms)
if (termsPromisesIt && !selfServiceCancel) {
  bad(`${TERMS} says a subscription can be cancelled from account settings, but app/api/account/cancel-subscription does not exist. Keep the terms saying how cancellation actually works.`)
}
if (selfServiceCancel && !termsPromisesIt) {
  bad(`${TERMS} does not tell people they can cancel from Billing in their account settings, which they can (app/api/account/cancel-subscription). A customer who cannot find the way out in the terms emails us instead, or disputes the charge.`)
}
if (selfServiceCancel && !/stays live until then/i.test(terms)) {
  bad(`${TERMS} no longer says a cancelled card stays live until the end of the paid period. That is what cancel_at and subscriptionState now guarantee, and it is the part a customer relies on.`)
}
// The operator contract the privacy policy points at by anchor.
if (!/id="data-protection"/.test(terms)) {
  bad(`${TERMS} has lost the #data-protection section. The privacy policy links to it as the POPIA section 21 operator agreement.`)
}
if (!/\/terms#data-protection/.test(privacy)) {
  bad(`${PRIVACY} no longer links to the operator terms at /terms#data-protection.`)
}

// ── 4. Neither page can put a price or a purchase route inside the iOS app ──
//
// Both pages are reachable in the iOS app - Apple requires them to be - so a
// price or a link to a blocked purchase route on either is a Guideline 3.1.1
// rejection waiting for the next review. The liability cap is a rand figure
// but not a price, so it is the one allowed.
const platform = read('lib/app-platform.ts') || ''
const blockedBlock = platform.match(/IOS_BLOCKED_ROUTES\s*=\s*\[([\s\S]*?)\]/)
const blocked = blockedBlock ? [...blockedBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(r => r !== '/') : []
if (blocked.length === 0) bad('could not read IOS_BLOCKED_ROUTES from lib/app-platform.ts, so the legal pages cannot be checked against it.')

for (const [file, src] of [[PRIVACY, privacy], [TERMS, terms], [TRUST, trust], [PAIA, paia]]) {
  const prices = [...src.matchAll(/R\s?\d[\d ]*(?:[.,]\d+)?/g)]
    .map(m => m[0])
    .filter(p => !/R1000/.test(p)) // the liability cap in terms section 12
  for (const p of prices) {
    bad(`${file} contains "${p}". This page is reachable inside the iOS app, where a price is a Guideline 3.1.1 rejection. Say "the fees published on our website" instead.`)
  }
  for (const r of blocked) {
    const re = new RegExp(`href=["']${r.replace(/[/]/g, '\\/')}(["'#/?])`)
    if (re.test(src)) {
      bad(`${file} links to ${r}, which is blocked in the iOS app. Inside the app that link either fails or lands somewhere Apple treats as a purchase surface.`)
    }
  }
}

if (fail) {
  console.error(`${LF}check-privacy-disclosures: ${fail} failure(s).`)
  process.exit(1)
}
const named = SERVICES.filter(s => s.present).map(s => s.name)
console.log(
  `check-privacy-disclosures: every service the code uses is named in the privacy policy (${named.join(', ')}), ` +
  `${hosts.size} outbound hosts accounted for, no retracted statement has come back, the trust page and PAIA manual name all ` +
  `${providers.length} providers and claim no certification, and no legal page carries a price or a link the iOS app blocks.`,
)
