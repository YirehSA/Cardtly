// A meeting request: the form, the checks, the two emails, and the WhatsApp
// button in them.
//
// WHAT THIS PROTECTS (2026-10-20):
//   1. The browser's time box could not reach every time on some phones and
//      stopped the form with "invalid value". The form now offers every hour
//      and a quarter-hour from lists, and the server checks the date and time.
//   2. The emails printed 2026-10-20 and left details out. Both are rendered
//      here and every detail the visitor gave must be in them, escaped.
//   3. "Confirm on WhatsApp" opened WhatsApp's web page in the mail app's
//      browser. Email buttons now go through cardtly.com/wa, with the number
//      after the # so no server ever logs it, and that page opens the app.
//
// Run: node scripts/check-booking-request.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const out = mkdtempSync(join(tmpdir(), 'booking-'))
let F, E, W
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/booking-format.ts', 'lib/booking-email.ts', 'lib/whatsapp.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  F = await import(pathToFileURL(join(out, 'booking-format.mjs')).href)
  E = await import(pathToFileURL(join(out, 'booking-email.mjs')).href)
  W = await import(pathToFileURL(join(out, 'whatsapp.mjs')).href)
} catch (e) {
  console.error('check-booking-request: could not compile the booking libraries')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const eq = (got, want, what) => { if (got !== want) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

// ── 1. Checking what the form sent ──────────────────────────────────────────
if (!F.parseIsoDate('2026-10-20')) bad('a real date was refused')
for (const d of ['2026-02-30', '20/10/2026', '2026-13-01', '', 'tomorrow']) if (F.parseIsoDate(d)) bad(`"${d}" was accepted as a date`)
eq(F.parseHHMM('17:30'), '17:30', 'a 24-hour time')
eq(F.parseHHMM('00:00'), '00:00', 'midnight')
eq(F.parseHHMM('23:45'), '23:45', 'the last quarter of the day')
for (const t of ['24:00', '5:30 PM', '17:60', '1730', '17:30:00']) if (F.parseHHMM(t) !== null) bad(`"${t}" was accepted as a time`)
eq(F.cleanTimeZone('Africa/Johannesburg'), 'Africa/Johannesburg', 'a real time zone')
eq(F.cleanTimeZone('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires', 'a three-part time zone')
if (F.cleanTimeZone('<script>') !== null || F.cleanTimeZone('x'.repeat(80)) !== null) bad('a junk time zone was kept')
const now = new Date('2026-10-20T08:00:00Z')
if (F.isPastDate('2026-10-20', now) || F.isPastDate('2026-10-19', now)) bad('today, or yesterday on the other side of the world, was refused as past')
if (!F.isPastDate('2026-10-17', now)) bad('a date days ago was accepted')

// ── 2. Writing it out for people ────────────────────────────────────────────
eq(F.formatBookingDate('2026-10-20'), 'Tuesday 20 October 2026', 'the long date')
eq(F.formatBookingDate('2027-01-01'), 'Friday 1 January 2027', 'the long date in January')
eq(F.formatBookingDateShort('2026-10-20'), 'Tue 20 Oct', 'the subject-line date')
eq(F.formatBookingTime('17:30', 'Africa/Johannesburg'), '17:30 (South African time)', 'a South African time')
eq(F.formatBookingTime('09:00', 'Europe/London'), '09:00 (Europe/London time)', 'a time abroad')
eq(F.formatBookingTime('09:00', 'America/New_York'), '09:00 (America/New York time)', 'a zone with an underscore')
eq(F.formatBookingTime(null, 'Africa/Johannesburg'), 'Any time', 'no time chosen')
eq(F.formatSentAt(new Date('2026-10-20T12:05:00Z')), '20 October 2026, 14:05', 'when it was sent, in SAST')

// ── 3. The emails carry everything, escaped ─────────────────────────────────
const wa = W.waBridgeLink('082 552 3367', 'Hi Thandi, thanks for your meeting request')
const details = {
  requesterName: 'Thandi <b>Nkosi</b>',
  requesterEmail: 'thandi@example.co.za',
  requesterPhone: '082 552 3367',
  date: '2026-10-20',
  time: '17:30',
  timeZone: 'Africa/Johannesburg',
  notes: 'Fleet of 12 cards\n<script>alert(1)</script>',
  cardName: 'Lenny Govender',
  cardTitle: 'Sales Manager',
  cardCompany: 'Acme & Sons',
  cardUrl: 'https://cardtly.com/card/lenny-govender',
  isTeam: true,
  sentAt: new Date('2026-10-20T12:05:00Z'),
  whatsappUrl: wa,
}
const owner = E.ownerBookingEmail(details)
const asker = E.requesterBookingEmail(details)

const mustHave = (mail, who, list) => {
  for (const [what, s] of list) {
    if (!mail.html.includes(s)) bad(`${who} email (HTML) is missing ${what}: ${s}`)
  }
}
mustHave(owner, 'owner', [
  ['the name, escaped', 'Thandi &lt;b&gt;Nkosi&lt;/b&gt;'],
  ['the email as a link', 'href="mailto:thandi@example.co.za"'],
  ['the phone as a link', 'href="tel:0825523367"'],
  ['the phone as typed', '082 552 3367'],
  ['the long date', 'Tuesday 20 October 2026'],
  ['the time with its zone', '17:30 (South African time)'],
  ['the note, escaped', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['the card it came in on', 'Lenny Govender, Sales Manager, Acme &amp; Sons'],
  ['a link to the card', 'href="https://cardtly.com/card/lenny-govender"'],
  ['when it was sent', '20 October 2026, 14:05 (South African time)'],
  ['the WhatsApp button through cardtly.com/wa', 'href="https://cardtly.com/wa#phone=27825523367&amp;text='],
  ['the team note', 'Team Contacts'],
])
mustHave(asker, 'requester', [
  ['who they asked', 'Lenny Govender, Sales Manager, Acme &amp; Sons'],
  ['the long date', 'Tuesday 20 October 2026'],
  ['the time with its zone', '17:30 (South African time)'],
  ['their email', 'thandi@example.co.za'],
  ['their phone', '082 552 3367'],
  ['their note, escaped', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['that it is requested, not booked', 'requested rather than booked'],
])
for (const [who, mail] of [['owner', owner], ['requester', asker]]) {
  if (/<script>|<b>Nkosi/.test(mail.html)) bad(`${who} email lets a visitor's markup through unescaped`)
  for (const s of ['Tuesday 20 October 2026', '17:30 (South African time)', 'thandi@example.co.za', '082 552 3367', 'Fleet of 12 cards']) {
    if (!mail.text.includes(s)) bad(`${who} email (plain text) is missing ${s}`)
  }
}
eq(owner.subject, 'Meeting request from Thandi <b>Nkosi</b>: Tue 20 Oct, 17:30', 'the owner subject')
if (/[\r\n]/.test(E.ownerBookingEmail({ ...details, requesterName: 'A\r\nBcc: x@y.z' }).subject)) bad('a line break in a name reached the subject line')
const anyTime = E.ownerBookingEmail({ ...details, time: null, requesterPhone: null, whatsappUrl: null, notes: null })
if (!anyTime.html.includes('Any time') || !anyTime.html.includes('Not given') || !anyTime.html.includes('No note added')) bad('an optional detail left blank is not said to be blank')
if (anyTime.html.includes('wa#')) bad('a WhatsApp button appears with no phone number')

// ── 4. The WhatsApp links ───────────────────────────────────────────────────
eq(W.waAppLink('082 552 3367', 'Hi'), 'whatsapp://send?phone=27825523367&text=Hi', 'the app link')
if (W.waAppLink('123', 'x') !== null || W.waBridgeLink('', 'x') !== null) bad('a link was made for an unusable number')
if (!/^https:\/\/cardtly\.com\/wa#phone=27825523367&text=/.test(wa || '')) bad(`the email link must carry the number after the #, so no server logs it: ${wa}`)

// ── 5. Wiring ───────────────────────────────────────────────────────────────
const modal = read('components/card/BookingModal.tsx')
if (/type="time"/.test(modal)) bad('the booking form uses the browser time box again')
if (!/Array\.from\(\{ length: 24 \}/.test(modal) || !/BOOKING_MINUTES\.map/.test(modal)) bad('the booking form must offer every hour and the quarter-hours')
if (!/time_zone:/.test(modal)) bad('the booking form must send the visitor\'s time zone')
const route = read('app/api/bookings/request/route.ts')
if (!/parseIsoDate\(body\.preferred_date\)/.test(route) || !/parseHHMM\(rawTime\)/.test(route)) bad('the booking route must check the date and time itself')
if (!/ownerBookingEmail\(details\)/.test(route) || !/requesterBookingEmail\(details\)/.test(route)) bad('the booking route must send the emails from lib/booking-email')
if (!/whatsappUrl: waBridgeLink\(/.test(route)) bad('the meeting email\'s WhatsApp button must go through cardtly.com/wa')
const lead = read('lib/lead-notify.ts')
if (/waLink\(/.test(lead) || !/waBridgeLink\(/.test(lead)) bad('the lead email\'s WhatsApp button must go through cardtly.com/wa')
const bridge = read('app/wa/WhatsAppBridge.tsx')
if (!/window\.location\.hash/.test(bridge) || /searchParams|location\.search/.test(bridge)) bad('/wa must read the number from the #, never the query string')
if (!/whatsapp:\/\/send/.test(bridge) || !/scheme=whatsapp/.test(bridge)) bad('/wa must open the app (whatsapp://, or an intent on Android)')
if (!/robots: \{ index: false/.test(read('app/wa/page.tsx'))) bad('/wa must stay out of search results')
const contact = read('components/dashboard/ContactCard.tsx'), send = read('components/card/SendCardToPhone.tsx')
if (!/isNativeApp\(\) \? waAppLink\(/.test(contact)) bad('a contact\'s WhatsApp button must open the app inside the Cardtly app')
if (!/native \? waAppLink\(parsed\.digits, text\)/.test(send)) bad('Send card to a number must open the WhatsApp app inside the Cardtly app')

if (fail) {
  console.error(`check-booking-request: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-booking-request: ok (every hour and quarter-hour, date and time checked on the server, both emails carry every detail escaped, WhatsApp buttons open the app)')
