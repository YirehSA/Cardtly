// The public lead forms stay protected (lib/lead-guard, 2026-11-03).
//
// /api/contact, /api/bookings/request and /api/questionnaire/submit are open
// to anyone and email the card owner. This holds, for each:
//   1. a filled hidden field is answered like success and goes no further;
//   2. the email is checked and every field has a length cap;
//   3. a rate-limit slot is taken before the card is even looked up;
//   4. the limit fails open, so our own fault never costs a lead;
//   5. migration 104's numbers are the ones lib/lead-guard documents, its
//      function is callable by the service role only, and it stores no IP;
//   6. all four forms carry the hidden field and send it, under a name nothing
//      autofills;
//   7. a booking's receipt to the typed address is capped per day;
//   8. the privacy policy says what is kept.
//
// Run: node scripts/check-lead-guard.mjs

import { readFileSync } from 'fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n')

// 1 to 3
const ROUTES = [
  { file: 'app/api/contact/route.ts', resolve: 'resolveCardOwner(' },
  { file: 'app/api/questionnaire/submit/route.ts', resolve: 'resolveCardOwner(' },
  { file: 'app/api/bookings/request/route.ts', resolve: 'resolveCardOwner(' },
]
for (const r of ROUTES) {
  const src = code(read(r.file))
  if (!src) { bad(`${r.file} is missing`); continue }
  const at = (s) => src.indexOf(s)
  const bot = at('if (isBotSubmission(body)) return botResponse()')
  const firstDb = Math.min(...['createAdminClient(', '.from(', '.insert('].map(s => { const i = src.indexOf(s, src.indexOf('export async function POST')); return i < 0 ? Infinity : i }))
  if (bot < 0) bad(`${r.file} no longer drops a filled hidden field`)
  else if (bot > firstDb) bad(`${r.file} checks the hidden field only after touching the database`)
  if (!/EMAIL_RE\.test\(/.test(src)) bad(`${r.file} no longer checks the email address`)
  if (!/const tooLong = overLong\(\{[^}]*name[^}]*email[^}]*phone[^}]*\}\)/.test(src) || !/if \(tooLong\) return NextResponse\.json\(\{ error: tooLong \}, \{ status: 400 \}\)/.test(src)) bad(`${r.file} no longer caps the length of name, email and phone`)
  const slot = at('await takeLeadSlot(admin, request,')
  const resolved = at(r.resolve)
  if (slot < 0 || !/if \(limited\) return limited/.test(src)) bad(`${r.file} no longer takes a rate-limit slot`)
  else if (resolved >= 0 && slot > resolved) bad(`${r.file} looks the card up before the rate limit, so made-up card ids are free to try`)
}

// 4
const guard = code(read('lib/lead-guard.ts'))
const take = (guard.match(/export async function takeLeadSlot[\s\S]*?\n}\n/) || [''])[0]
if (!take) bad('lib/lead-guard lost takeLeadSlot')
if (!/if \(error\) \{[^}]*return null\s*\}/.test(take) || !/catch \(e\) \{[^}]*return null\s*\}/.test(take)) bad('takeLeadSlot no longer fails open on a database error: a broken limit would start refusing real leads')
if (!/status: 429/.test(take)) bad('takeLeadSlot no longer answers 429 when a limit is hit')

// 5
const mig = code(read('supabase/migrations/104_lead_rate_limit.sql'))
if (!mig) bad('supabase/migrations/104_lead_rate_limit.sql is missing')
const limits = Object.fromEntries([...guard.matchAll(/^\s{2}(visitor10m|visitorDay|network10m|networkDay|cardHour): (\d+),/gm)].map(m => [m[1], Number(m[2])]))
const want = [
  ['visitor10m', /visitor = p_visitor and created_at > now\(\) - interval '10 minutes'\) >= (\d+)/],
  ['visitorDay', /visitor = p_visitor and created_at > now\(\) - interval '1 day'\) >= (\d+)/],
  ['network10m', /network = p_network and created_at > now\(\) - interval '10 minutes'\) >= (\d+)/],
  ['networkDay', /network = p_network and created_at > now\(\) - interval '1 day'\) >= (\d+)/],
  ['cardHour', /card = p_card and created_at > now\(\) - interval '1 hour'\) >= (\d+)/],
]
for (const [k, re] of want) {
  const m = mig.match(re)
  if (!m) bad(`migration 104 no longer checks ${k}`)
  else if (Number(m[1]) !== limits[k]) bad(`migration 104 limits ${k} at ${m[1]} but lib/lead-guard says ${limits[k]}`)
}
if (!/revoke all on function public\.lead_rate_take\(text, text, text\) from public, anon, authenticated;/.test(mig)) bad('lead_rate_take is not revoked from public, anon and authenticated: any visitor could call it, or fill the table')
if (!/grant execute on function public\.lead_rate_take\(text, text, text\) to service_role;/.test(mig)) bad('the service role is not granted lead_rate_take')
if (!/security definer\s+set search_path = public/.test(mig)) bad('lead_rate_take must be security definer with a fixed search_path')
if (/\bip\b|inet/i.test((mig.match(/create table[\s\S]*?\);/) || [''])[0])) bad('lead_rate_events has an IP column: the privacy policy says no IP address is kept')
if (!/delete from lead_rate_events where created_at < now\(\) - interval '2 days'/.test(mig)) bad('migration 104 no longer deletes rows older than two days')
if (!/createHmac\('sha256', secret\(\)\)/.test(guard) || !/day, 'lead-visitor'/.test(guard) || !/day, 'lead-network'/.test(guard)) bad('the rate-limit keys are no longer keyed, daily-changing hashes')

// 6
const FORMS = ['components/card/PublicCardView.tsx', 'components/card/ContactExchangeModal.tsx', 'components/card/QuestionnaireForm.tsx', 'components/card/BookingModal.tsx']
for (const f of FORMS) {
  const src = read(f)
  if (!/<Honeypot value=\{hp\} onChange=\{setHp\} \/>/.test(src)) bad(`${f} no longer renders the hidden field`)
  const start = src.indexOf('JSON.stringify({')
  const body = start < 0 ? '' : code(src.slice(start, start + 900))
  if (!/[\s,{]hp\s*[,}\n]/.test(body)) bad(`${f} no longer sends the hidden field`)
}
const hp = code(read('components/card/Honeypot.tsx'))
const hpName = (hp.match(/name="([^"]+)"/) || [])[1] || ''
if (!hpName || /^(name|email|phone|tel|website|url|company|address|message|first|last)/i.test(hpName)) bad(`the hidden field is named "${hpName}", which a browser may autofill and so drop a real lead`)
if (!/tabIndex=\{-1\}/.test(hp) || !/aria-hidden="true"/.test(hp) || !/autoComplete="off"/.test(hp)) bad('the hidden field can be reached by keyboard, screen reader or autofill')
if (/display:\s*'?none/.test(hp)) bad('the hidden field uses display:none, which many bots skip')
if ((guard.match(/export const HONEYPOT_FIELD = '([^']+)'/) || [])[1] !== 'hp') bad("HONEYPOT_FIELD is no longer 'hp', which is what the forms send")

// 7
const booking = code(read('app/api/bookings/request/route.ts'))
if (!/const receiptAllowed = \(todaysRequests \?\? 0\) <= RECEIPTS_PER_ADDRESS/.test(booking) || !/if \(process\.env\.RESEND_API_KEY && receiptAllowed\)/.test(booking)) bad('a booking emails its receipt to the typed address without the daily cap, so the form can mail a stranger repeatedly')

// 8
if (!/People who fill in a form on a card/.test(read('app/privacy/page.tsx'))) bad('the privacy policy no longer says what is kept to stop form abuse')

if (fail) {
  console.error(`\ncheck-lead-guard: ${fail} failure(s).`)
  process.exit(1)
}
console.log(`check-lead-guard: all three lead routes drop bots, cap fields and take a rate-limit slot before looking anything up, the limits fail open and match migration 104 (${Object.entries(limits).map(([k, v]) => `${k} ${v}`).join(', ')}), four forms carry the hidden field, and booking receipts are capped at ${(guard.match(/RECEIPTS_PER_ADDRESS = (\d+)/) || [])[1]} a day per address.`)
