// Does the rep's activity log tell the truth about the rep?
//
// The four figures at the top of that page are what a rep is judged on, and
// every one of them is a small piece of arithmetic over a list of rows. None of
// it is visible: a response rate that counts bounces looks exactly like one
// that does not, right up until somebody is told they are underperforming
// against a number that was never real.
//
// Four things are checked.
//
//   THE VOCABULARY. A status belongs to particular kinds. The form offers what
//   fits and the API accepts what fits, both from statusesFor - so the guard
//   here is that the two agree and that every kind has something to offer.
//
//   THE FIGURES. A reply is not the same as a positive reply, a bounce is
//   neither, and a response rate over no emails is not zero percent - it is
//   nothing, and the card must say so.
//
//   THE WINDOW. "September" has to mean September. The same bug that once put
//   the 31st of August in a September call log is available here for free.
//
//   THE EXPORT. One unescaped comma in a company name shifts every column
//   after it and nobody notices until a report is wrong.
//
// Run: node scripts/check-rep-activities.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'repact-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/rep-activities.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
  M = await import(pathToFileURL(join(out, 'rep-activities.js')).href)
} catch (e) {
  console.error('check-rep-activities: could not compile lib/rep-activities.ts')
  console.error(String(e.stdout || e.message).slice(0, 900))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

// ── The vocabulary ────────────────────────────────────────────────────────
{
  for (const k of M.ACTIVITY_KINDS) {
    const opts = M.statusesFor(k.id)
    if (opts.length === 0) { bad(`"${k.id}" has no statuses to offer`); continue }
    // Whatever the form opens on must be something the API will accept.
    const def = M.defaultStatusFor(k.id)
    if (!M.statusFitsKind(def, k.id)) bad(`the default status for "${k.id}" does not belong to it`)
    // And it must be the START of the thing, not the end of it. Taking the
    // first matching status instead of a declared one opened a networking log
    // on "Not interested" and a LinkedIn one on "Replied" - both valid, both
    // wrong, and both the sort of pre-filled answer somebody just saves.
    const closing = ['not_interested', 'replied', 'meeting_booked', 'bounced', 'met_contacts', 'connected']
    if (closing.includes(def)) {
      bad(`logging a new "${k.id}" activity opens on "${M.statusMeta(def).label}", which is an outcome, not a start`)
    }
    for (const o of opts) {
      if (!M.statusFitsKind(o.id, k.id)) bad(`statusesFor("${k.id}") offered "${o.id}", which does not fit it`)
    }
  }
  // A status nothing can carry is a dead entry that will be offered nowhere and
  // accepted nowhere.
  for (const s of M.ACTIVITY_STATUSES) {
    if (!s.kinds || s.kinds.length === 0) bad(`status "${s.id}" belongs to no kind at all`)
  }
  // Every kind's statuses must be reachable from the union the DB check allows.
  const all = new Set(M.ACTIVITY_STATUSES.map(s => s.id))
  for (const k of M.ACTIVITY_KINDS) {
    for (const o of M.statusesFor(k.id)) {
      if (!all.has(o.id)) bad(`"${o.id}" is offered but is not in ACTIVITY_STATUSES`)
    }
  }
  // Meeting booked is the outcome every channel is aiming at, so every channel
  // has to be able to record it.
  for (const k of M.ACTIVITY_KINDS) {
    if (!M.statusFitsKind('meeting_booked', k.id)) {
      bad(`"${k.id}" cannot record a meeting booked, so those meetings vanish from the count`)
    }
  }
}

// ── Switching kind keeps what it can ──────────────────────────────────────
{
  // Fits both, so it must survive.
  if (M.nextStatusForKind('meeting_booked', 'linkedin') !== 'meeting_booked') {
    bad('switching kind threw away a "meeting booked" that the new kind allows')
  }
  if (M.nextStatusForKind('replied', 'linkedin') !== 'replied') {
    bad('switching from email to LinkedIn threw away "replied", which LinkedIn allows')
  }
  // Does not fit, so it must move to something that does.
  const moved = M.nextStatusForKind('bounced', 'networking')
  if (!M.statusFitsKind(moved, 'networking')) {
    bad(`switching to networking left "${moved}", which networking cannot carry`)
  }
  if (moved === 'bounced') bad('a networking activity was left marked as bounced')
  // Rubbish in must still come out valid rather than being passed through.
  const junk = M.nextStatusForKind('not_a_status', 'email')
  if (!M.statusFitsKind(junk, 'email')) bad('an unknown status was passed through unchanged')
}

// ── The figures ───────────────────────────────────────────────────────────
const act = (kind, status, at = '2026-09-08T10:00:00.000Z') => ({
  kind, status, happened_at: at, company: 'X', contact_name: null, email: null,
  subject: null, next_step: null, follow_up_on: null, notes: null,
})

{
  const rows = [
    act('email', 'email_sent'),
    act('email', 'email_sent'),
    act('email', 'replied'),         // answered and positive
    act('email', 'meeting_booked'),  // answered and positive
    act('email', 'not_interested'),  // answered, NOT positive
    act('email', 'bounced'),         // neither
    act('linkedin', 'connected'),
    act('linkedin', 'request_sent'),
    act('networking', 'attended'),
  ]
  const s = M.summariseActivities(rows, [{ outcome: 'meeting_booked' }, { outcome: 'no_answer' }])

  if (s.emailsSent !== 6) bad(`emails sent counted ${s.emailsSent}, not 6`)
  if (s.positive !== 2) bad(`positive replies counted ${s.positive}, not 2 - a bounce or a no is being counted as a win`)
  // 3 of 6 answered: replied, meeting_booked, not_interested. A "no" IS a
  // response; it is just not a good one.
  if (s.responseRate !== 50) bad(`response rate came out at ${s.responseRate}%, not 50%`)
  if (s.connections !== 1) bad(`new connections counted ${s.connections}, not 1`)
  // One from the emails, one from the phone.
  if (s.meetings !== 2) bad(`meetings booked counted ${s.meetings}, not 2 - calls are being left out`)
  if (s.total !== 9) bad(`total counted ${s.total}, not 9`)
}
{
  // Nothing sent. Zero percent would be a lie about effort.
  const s = M.summariseActivities([act('linkedin', 'connected')], [])
  if (s.responseRate !== null) bad(`a response rate of ${s.responseRate} was reported with no emails sent`)
  if (s.emailsSent !== 0) bad('a LinkedIn row was counted as an email')
}
{
  // A bounce is not a response.
  const s = M.summariseActivities([act('email', 'email_sent'), act('email', 'bounced')], [])
  if (s.responseRate !== 0) bad(`two sends and no replies came out at ${s.responseRate}%, not 0%`)
  if (s.positive !== 0) bad('a bounce was counted as a positive reply')
}

// ── The window ────────────────────────────────────────────────────────────
{
  const sept = new Date(2026, 8, 15)
  const r = M.activityRange('month', sept)
  const rows = [
    act('email', 'email_sent', new Date(2026, 7, 31, 12).toISOString()), // 31 Aug
    act('email', 'email_sent', new Date(2026, 8, 1, 0, 0).toISOString()), // 1 Sep 00:00
    act('email', 'email_sent', new Date(2026, 8, 30, 23, 30).toISOString()), // 30 Sep
    act('email', 'email_sent', new Date(2026, 9, 1, 0, 0).toISOString()), // 1 Oct 00:00
  ]
  const inSept = M.withinRange(rows, r.from, r.to)
  if (inSept.length !== 2) {
    bad(`September held ${inSept.length} of 4 rows, not 2 - the window is leaking into the months either side`)
  }
  if (M.activityRange('list', sept) !== null) bad('"All" produced a window instead of everything')
}

// ── Follow-ups ────────────────────────────────────────────────────────────
{
  const today = new Date(2026, 8, 8)
  const withDate = (status, on) => ({ ...act('email', status), follow_up_on: on })
  const due = M.dueFollowUps([
    withDate('email_sent', '2026-09-08'),   // today counts as due
    withDate('email_sent', '2026-09-01'),   // overdue
    withDate('email_sent', '2026-09-20'),   // not yet
    withDate('meeting_booked', '2026-09-01'), // finished business
    withDate('not_interested', '2026-09-01'), // finished business
    act('email', 'email_sent'),             // no date at all
  ], today)
  if (due.length !== 2) bad(`${due.length} follow-ups came back due, not 2`)
  if (due.some(d => d.status === 'meeting_booked' || d.status === 'not_interested')) {
    bad('a booked or declined activity is still being chased')
  }
  if (due[0]?.follow_up_on !== '2026-09-01') bad('the oldest follow-up is not first')
}

// ── Filtering ─────────────────────────────────────────────────────────────
{
  const rows = [
    { ...act('email', 'email_sent'), company: 'Growthpoint Properties', subject: 'Cardtly for Tenant Teams' },
    { ...act('linkedin', 'connected'), company: 'The Building Company', contact_name: 'Lyndon Isaacs' },
  ]
  // Words in any order, across fields.
  if (M.filterActivities(rows, 'tenant growthpoint', null, null).length !== 1) {
    bad('two words that are true of one row in different fields did not match it')
  }
  if (M.filterActivities(rows, 'lyndon building', null, null).length !== 1) {
    bad('a name and a company typed in either order did not match')
  }
  // The case that tells AND from OR. Each word is true of a DIFFERENT row, so
  // every row matches one of them and none matches both. Every other search
  // above returns the same count either way, which is why an OR crept through
  // the first version of this guard unnoticed.
  const split = M.filterActivities(rows, 'growthpoint building', null, null)
  if (split.length !== 0) {
    bad(`searching two words true of different rows returned ${split.length} rows, not 0 - the words are being ORed`)
  }
  if (M.filterActivities(rows, '', 'linkedin', null).length !== 1) bad('the kind filter did not narrow')
  if (M.filterActivities(rows, '', null, 'connected').length !== 1) bad('the status filter did not narrow')
  if (M.filterActivities(rows, '', 'email', 'connected').length !== 0) {
    bad('kind and status filters are not both applied')
  }
  if (M.filterActivities(rows, 'nothingmatchesthis', null, null).length !== 0) bad('a search that matches nothing returned rows')
}

// ── The export ────────────────────────────────────────────────────────────
{
  const rows = [{
    ...act('email', 'email_sent'),
    company: 'O\'Brien, Smith & Co',
    contact_name: 'Say "hello"',
    subject: 'Line one\nline two',
    notes: 'a, b, c',
  }]
  const csv = M.activitiesToCsv(rows)
  const [header, ...body] = csv.split('\r\n')
  if (!csv.includes('\r\n')) bad('the CSV does not use CRLF, which Excel needs')

  const cells = (line) => line.match(/"(?:[^"]|"")*"/g) || []
  if (cells(header).length !== 11) bad(`the header has ${cells(header).length} columns, not 11`)
  // The body is one row, but it contains a newline inside a quoted field, so
  // the naive split above may have cut it. Counting cells across the rejoined
  // remainder is what proves the quoting held.
  const rest = body.join('\r\n')
  if (cells(rest).length !== 11) {
    bad(`the exported row has ${cells(rest).length} cells, not 11 - a comma or a quote broke out of its field`)
  }
  if (!rest.includes('"O\'Brien, Smith & Co"')) bad('a comma in a company name was not quoted')
  if (!rest.includes('"Say ""hello"""')) bad('a double quote inside a field was not doubled')
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-rep-activities: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-rep-activities: every kind offers statuses it can actually carry and can record a booked ' +
  'meeting, switching kind keeps an answer that still fits, a bounce is neither a reply nor a win, ' +
  'a response rate over no emails is nothing rather than zero, September means September, booked ' +
  'and declined rows stop being chased, and the export survives a comma in a company name.',
)
