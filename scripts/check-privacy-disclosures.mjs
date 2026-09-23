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

const privacyRaw = read(PRIVACY)
const termsRaw = read(TERMS)
if (!privacyRaw || !termsRaw) { bad('a legal page is missing'); process.exit(1) }
const privacy = visible(privacyRaw)
const terms = visible(termsRaw)

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
  'api.frankfurter.app': 'Currency rate for the ZAR-to-USD price display. Called server-side with no user data.',
  'open.er-api.com': 'Same currency lookup, fallback provider. Server-side, no user data.',
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
  if (re.test(privacy)) bad(`${PRIVACY} ${why}`)
}
// There is no self-service cancel: Settings says "get in touch". The terms said
// otherwise for months.
if (/cancel[^.]{0,60}from your account settings/i.test(terms)) {
  bad(`${TERMS} says a subscription can be cancelled from account settings. It cannot - Settings sends people to the contact page. Either build self-service cancellation or keep the terms saying how it actually works.`)
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

for (const [file, src] of [[PRIVACY, privacy], [TERMS, terms]]) {
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
  `${hosts.size} outbound hosts accounted for, no retracted statement has come back, and neither legal page carries a price ` +
  'or a link the iOS app blocks.',
)
