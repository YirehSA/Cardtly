// Every email Cardtly sends on its own schedule can be unsubscribed from.
//
// POPIA section 69: a promotional electronic message must offer a way to opt
// out, in every message. The weekly summary and the trial reminders had none
// until 2026-11-03 (lib/email-optout). This holds, for each scheduled kind:
//   1. the kinds agree between lib/email-kinds and migration 103;
//   2. the email carries the unsubscribe footer AND the List-Unsubscribe
//      headers (Gmail's and Outlook's own button);
//   3. the job skips anyone who has opted out, and sends nothing of that kind
//      when it cannot tell;
//   4. opening the link changes nothing (scanners open every link): only a
//      POST with a valid token does, and the page itself never writes;
//   5. the token is compared in constant time and covers both the person and
//      the kind;
//   6. Settings offers the same switches, and the privacy policy says so.
//
// Run: node scripts/check-email-unsubscribe.mjs

import { readFileSync } from 'fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')

// 1
const kinds = read('lib/email-kinds.ts')
const declared = [...code(kinds).matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(m => m[1])
if (declared.join(',') !== 'weekly_summary,trial_reminders') bad(`lib/email-kinds declares ${declared.join(', ') || 'nothing'}; expected weekly_summary and trial_reminders. A new kind needs a migration for the check constraint, a footer, headers and a skip in its job.`)
const mig = code(read('supabase/migrations/103_email_opt_outs.sql'))
if (!mig) bad('supabase/migrations/103_email_opt_outs.sql is missing')
for (const k of declared) if (!new RegExp(`'${k}'`).test(mig)) bad(`migration 103's check constraint does not allow '${k}', so opting out of it would fail`)
if (!/references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i.test(mig)) bad('email_opt_outs no longer goes with the account (references auth.users on delete cascade)')

// 2 and 3
const jobs = [
  { file: 'app/api/cron/weekly-digest/route.ts', kind: 'weekly_summary', skip: /stopped\.has\(card\.user_id\)\)\s*continue/, closed: /if \(!stopped\) return NextResponse\.json/ },
  { file: 'app/api/cron/trial-reminders/route.ts', kind: 'trial_reminders', skip: /if \(unsubscribed\(userId\)\) continue/g, closed: /!stopped \|\| stopped\.has\(userId\)/ },
]
for (const j of jobs) {
  const src = code(read(j.file))
  if (!src) { bad(`${j.file} is missing`); continue }
  if (!new RegExp(`optedOut\\(admin, '${j.kind}'\\)`).test(src)) bad(`${j.file} does not read who has unsubscribed from ${j.kind}`)
  if (!j.closed.test(src)) bad(`${j.file} no longer sends nothing when the unsubscribe list cannot be read`)
  const skips = (src.match(j.skip) || []).length
  const want = j.kind === 'trial_reminders' ? 2 : 1
  if (skips < want) bad(`${j.file} skips unsubscribed people in ${skips} of the ${want} places it queues an email`)
  if (!new RegExp(`headers: listUnsubscribeHeaders\\([^,]+, '${j.kind}'\\)`).test(src)) bad(`${j.file} sends without List-Unsubscribe headers`)
  if (!new RegExp(`unsubscribeFooterHtml\\([^,]+, '${j.kind}'\\)`).test(src)) bad(`${j.file} sends without the unsubscribe line`)
}
const tpl = code(read('lib/trial-email-templates.ts'))
const wraps = (tpl.match(/wrap\(`/g) || []).length
const withFooter = (tpl.match(/`, unsubscribeHtml\)/g) || []).length
if (wraps === 0 || wraps !== withFooter) bad(`lib/trial-email-templates: ${wraps - withFooter} of ${wraps} trial emails are built without the unsubscribe line`)
if (!/\$\{unsubscribeHtml\}/.test(tpl)) bad('the trial email wrapper no longer prints the unsubscribe line')

// 4
const route = code(read('app/api/email/unsubscribe/route.ts'))
const getBody = (route.match(/export async function GET[\s\S]*?\n}\n/) || [''])[0]
if (!getBody) bad('the unsubscribe route has no GET forwarding to the page, so a mail client that opens the header link gets a 405')
if (/setOptOut/.test(getBody)) bad('opening the unsubscribe link (GET) changes the setting: email scanners open every link and would unsubscribe people')
const postBody = (route.match(/export async function POST[\s\S]*$/) || [''])[0]
const verifyAt = postBody.indexOf('verifyOptOutToken(')
const setAt = postBody.indexOf('setOptOut(')
if (verifyAt < 0 || setAt < 0 || verifyAt > setAt) bad('the unsubscribe POST no longer checks the token before changing anything')
const page = code(read('app/unsubscribe/page.tsx'))
if (/setOptOut/.test(page)) bad('the /unsubscribe page writes on opening; only its button may')
if (!/robots:\s*\{\s*index:\s*false/.test(page)) bad('the /unsubscribe page is indexable')
if (!/method="post" action="\/api\/email\/unsubscribe"/.test(page)) bad('the /unsubscribe page no longer posts its button to /api/email/unsubscribe')

// 5
const lib = code(read('lib/email-optout.ts'))
if (!/timingSafeEqual\(/.test(lib)) bad('the unsubscribe token is not compared in constant time')
if (!/update\(`\$\{userId\}\.\$\{kind\}`\)/.test(lib)) bad('the unsubscribe token no longer covers both the person and the kind, so one link could switch off another email or another person')
if (!/List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/.test(lib)) bad('List-Unsubscribe-Post is missing, so Gmail and Outlook will not offer one-click unsubscribe')

// 6
const settings = read('components/settings/SettingsTabs.tsx')
if (!/function EmailsTab\(/.test(settings) || !/tab === 'emails' && <EmailsTab \/>/.test(settings)) bad('Settings no longer has the Emails tab')
const prefs = code(read('app/api/account/email-preferences/route.ts'))
if (!/auth\.getUser\(\)/.test(prefs) || !/setOptOut\([^,]+, user\.id,/.test(prefs)) bad('the Settings switches no longer write for the signed-in user only')
const privacy = read('app/privacy/page.tsx')
if (!/carries an unsubscribe link/.test(privacy)) bad('the privacy policy no longer says the scheduled emails carry an unsubscribe link')

if (fail) {
  console.error(`\ncheck-email-unsubscribe: ${fail} failure(s).`)
  process.exit(1)
}
console.log(`check-email-unsubscribe: ${declared.length} scheduled emails each carry an unsubscribe link and List-Unsubscribe headers, skip anyone who opted out (and send nothing when that is unknown), opening a link changes nothing, and Settings offers the same switches.`)
