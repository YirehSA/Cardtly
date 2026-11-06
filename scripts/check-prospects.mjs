// Reseller prospects: the list that replaced a rep's Excel workbooks.
//
// Runs the real code against made-up rows (this repository is public, so no real
// contact is ever in here), then checks the routes hold their lines. It protects:
//   1. the reader opens workbooks ExcelJS cannot, including prefixed XML;
//   2. all four original layouts and our own export map to the right fields;
//   3. every status word from his dropdowns means the right thing;
//   4. importing never loses work: no status goes backwards, do not contact
//      sticks, and the same file twice changes nothing;
//   5. a rep's own call note is not read as somebody replying;
//   6. a mail merge leaves out who it must, and a tick can never override a bar;
//   7. marking someone writes the right log, and a rep only reaches their rows.
//
// Run: node scripts/check-prospects.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad(`${msg}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`) }

const out = mkdtempSync(join(tmpdir(), 'check-prospects-'))
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc',
    'lib/prospects.ts', 'lib/prospects-import.ts', 'lib/xlsx-read.ts', '--outDir', out,
    '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck', '--esModuleInterop', '--types', 'node'], { stdio: 'pipe' })
} catch { /* tsc reports unrelated type noise but still emits; a missing file fails below */ }
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(join(out, 'x.js'))
const P = require('./prospects.js')
const I = require('./prospects-import.js')
const X = require('./xlsx-read.js')
const TODAY = '2026-11-06'

// ── 1. The reader ───────────────────────────────────────────────────────────

/** A minimal zip, deflated, so the reader is tested on bytes it did not write. */
function zip(files) {
  const locals = []; const central = []; let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8')
    const packed = deflateRawSync(data)
    const n = Buffer.from(name)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26)
    locals.push(lh, n, packed)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10)
    ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42)
    central.push(ch, n)
    offset += 30 + n.length + packed.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}

// The shape that broke ExcelJS: every element carries an x: prefix.
const prefixed = zip({
  'xl/workbook.xml': '<?xml version="1.0"?><x:workbook xmlns:x="m"><x:sheets><x:sheet name="List &amp; more" sheetId="1" r:id="R1" xmlns:r="r"/></x:sheets></x:workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="R1" Target="/xl/worksheets/sheet1.xml" Type="t"/></Relationships>',
  'xl/sharedStrings.xml': '<x:sst xmlns:x="m"><x:si><x:t>Company</x:t></x:si><x:si><x:t>Email</x:t></x:si><x:si><x:r><x:t>Acme </x:t></x:r><x:r><x:t>Ltd</x:t></x:r></x:si></x:sst>',
  'xl/worksheets/sheet1.xml': '<x:worksheet xmlns:x="m"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="s"><x:v>1</x:v></x:c></x:row><x:row r="3"><x:c r="A3" t="s"><x:v>2</x:v></x:c><x:c r="C3" t="inlineStr"><x:is><x:t>a@acme.example</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>',
})
const sheets = X.readWorkbook(prefixed)
eq(sheets[0]?.name, 'List & more', 'a prefixed workbook lost its sheet name')
eq(sheets[0]?.rows?.[0]?.[2], 'Email', 'a cell after a gap landed in the wrong column')
eq(sheets[0]?.rows?.[2]?.[0], 'Acme Ltd', 'rich text in a shared string was not joined')
eq(sheets[0]?.rows?.[2]?.[2], 'a@acme.example', 'an inline string was not read')
let refused = false
try { X.readWorkbook(Buffer.from('not a spreadsheet at all, just some words')) } catch (e) { refused = e instanceof X.SpreadsheetError }
if (!refused) bad('a file that is not a workbook is not refused with a readable message')

// ── 2. Every layout he uses, and our own export ─────────────────────────────

const sheet = (rows, name = 'Sheet1') => ({ name, hidden: false, rows })
const one = (headers, row, today = TODAY) => {
  const parsed = I.parseSheet(sheet([headers, row]), today)
  if (!parsed || parsed.rows.length !== 1) { bad(`layout not recognised: ${headers.slice(0, 4).join(', ')}`); return {} }
  return parsed.rows[0]
}

const agency = one(
  ['No.', 'Company', 'First Name', 'Last Name', 'Contact Name', 'Role', 'Direct Email', 'Industry', 'Source Confidence', 'Evidence Detail', 'Contact Source Link', 'Secondary Source Link', 'Why a Cardtly Fit', 'Sent?', 'Date Sent', 'Reply Status', 'Feedback / Notes'],
  [1, 'Agency Co', 'Ann', 'Bee', 'Ann Bee', 'Director', 'ann@agency.example', 'PR', 'RECHECK - older', 'Website', 'https://a.example', 'https://b.example', 'Has clients', 'No', null, 'Not contacted', null])
eq([agency.company, agency.first_name, agency.contact_name, agency.email, agency.sector, agency.status, agency.fit, agency.source_url, agency.source_url_2],
  ['Agency Co', 'Ann', 'Ann Bee', 'ann@agency.example', 'PR', 'not_contacted', 'Has clients', 'https://a.example', 'https://b.example'], 'the agency layout mapped wrongly')

const tracker = one(
  ['Email', 'First Name', 'Last Name', 'Company', 'Role / title', 'Sector', 'Email Type', 'Public Direct Email', 'Direct Email Evidence', 'Contact Source URL', 'Business Email Source URL', 'Greeting', 'Status', 'Date Sent', 'Notes', 'Research Confidence', 'Sent', 'Comments / Feedback'],
  ['info@tracker.example', 'Cy', 'Dee', 'Tracker Co', 'Owner', 'IT', 'Shared business inbox', 'cy@tracker.example', 'Team page', 'https://c.example', 'https://d.example', 'Hello,', 'Sent', 46331, 'Name not verified', 'High', 'Yes', 'Please email me the info'])
eq([tracker.status, tracker.emailed_on, tracker.notes, tracker.source_confidence], ['replied', '2026-11-05', 'Please email me the info', 'High'], 'the tracker layout mapped wrongly')
if (!/Name not verified/.test(tracker.research_notes || '') || !/cy@tracker\.example/.test(tracker.research_notes || '')) bad("the tracker's research notes and second address were lost")

const next150 = one(
  ['No.', 'Company', 'First Name', 'Contact Name', 'Role', 'Direct Email', 'Sector', 'Priority', 'Record Type', 'Public Source URL', 'Region', 'Research Notes', 'Sent?', 'Date Sent', 'Reply Status', 'Feedback / Notes'],
  [2, 'Next Co', 'Eve', 'Eve Fox', 'MD', 'eve@next.example', 'Signage', 'Backup', 'Alternate (same company)', 'https://e.example', 'Cape Town', 'Gmail', 'No', null, 'Not contacted', null])
eq([next150.priority, next150.is_alternate, next150.region, next150.research_notes], ['backup', true, 'Cape Town', 'Gmail'], 'the next-150 layout mapped wrongly')

const calls = one(
  ['#', 'Priority', 'Company', 'Industry', 'Area', 'Contact Person', 'Position', 'Telephone', 'Number Type', 'Email Address', 'Why Cardtly Fits', 'Call Status', 'Last Contact', 'Next Follow-up', 'Call Notes', 'Source URL', 'Source Confidence'],
  [3, 'A', 'Call Co', 'Print', 'Durban', 'Gus Hay', 'Owner', '082 000 0000', 'Mobile', 'gus@call.example', 'Upsell', 'Email sent', '29/10/2026', '11 Nov 2026 - Meeting', 'Called, no answer, sent email', 'https://f.example', 'Direct'])
eq([calls.priority, calls.phone, calls.phone_type, calls.first_name, calls.status, calls.last_contact_on, calls.emailed_on, calls.follow_up_on, calls.follow_up_note],
  ['high', '082 000 0000', 'Mobile', 'Gus', 'email_sent', '2026-10-29', '2026-10-29', '2026-11-11', '11 Nov 2026 - Meeting'], 'the call-list layout mapped wrongly')
// 5. His own note is a diary entry. Promoting it made ten "Replied" that were not.
eq(calls.notes, 'Called, no answer, sent email', 'a call note was lost')

// The banner rows above the headings, as his sheet has them.
const banners = I.parseSheet(sheet([['CARDTLY | TITLE'], ['subtitle'], [], ['Company', 'Email'], ['Z Co', 'z@z.example'], ['No contact at all', null], [null, 'orphan@z.example']]), TODAY)
eq([banners?.rows.length, banners?.skipped], [1, 2], 'headings below a banner, or rows with nothing to go on, were handled wrongly')
if (I.parseSheet(sheet([['Measure', 'Count'], ['Total', 50]]), TODAY) !== null) bad('a summary sheet was taken for a contact list')
for (const n of ['Mail Merge - 50', 'Campaign Overview', 'Call Dashboard', 'Outreach Script', 'Named Contacts First']) {
  const parsed = I.parseSheet(sheet([['Company', 'Email'], ['Q', 'q@q.example']], n), TODAY)
  if (parsed?.isList) bad(`"${n}" repeats the real list and should not be ticked by default`)
}

// Dates, including his ambiguous one in a sheet full of November.
eq(I.parseDateCell(46328, TODAY), '2026-11-02', 'an Excel date number was misread')
eq(I.parseDateCell('29/10/2026', TODAY), '2026-10-29', 'a day-first date was misread')
eq(I.parseDateCell('Meeting Booked 11/03/2026 & 11:30', TODAY), '2026-11-03', 'his month-first date was misread')
eq(I.parseDateCell('2 Nov 2026 - Meeting booked', TODAY), '2026-11-02', 'a written-out date was misread')
eq(I.parseDateCell('Today at 4pm', TODAY), null, 'words with no date should stay words')

// ── 3. One vocabulary ───────────────────────────────────────────────────────

const WORDS = {
  'Not contacted': 'not_contacted', 'Not sent': 'not_contacted', Prepared: 'not_contacted',
  Sent: 'email_sent', 'Email sent': 'email_sent', Awaiting: 'email_sent', 'No response': 'email_sent',
  'Called - no answer': 'called_no_answer', Replied: 'replied', Interested: 'interested', 'Spoke - interested': 'interested',
  'Follow-up': 'follow_up', 'Follow up': 'follow_up', 'Meeting booked': 'meeting_booked', 'Meeting scheduled': 'meeting_booked',
  'Signed reseller': 'signed', 'Not interested': 'not_interested', 'No interest': 'not_interested', 'Not a fit': 'not_interested', 'Not suitable': 'not_interested',
  Bounced: 'bounced', 'Do not contact': 'do_not_contact', Unsubscribe: 'do_not_contact', Unsubscribed: 'do_not_contact',
}
for (const [word, id] of Object.entries(WORDS)) eq(P.statusFromSheet(word), id, `"${word}" from his dropdowns`)
for (const s of P.PROSPECT_STATUSES) eq(P.statusFromSheet(s.label), s.id, `our own label "${s.label}" must read back`)
const mig = read('supabase/migrations/105_rep_prospects.sql').split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
for (const s of P.PROSPECT_STATUSES) if (!mig.includes(`'${s.id}'`)) bad(`migration 105 does not allow the status ${s.id}`)

// ── 4. Importing never loses work ───────────────────────────────────────────

const row = (over) => ({
  id: 'x', rep_id: 'rep1', company: 'Co', contact_name: null, first_name: null, role: null, email: 'a@co.example', email_type: null,
  phone: null, phone_type: null, sector: null, region: null, priority: 'medium', is_alternate: false, lists: ['L1'], fit: null,
  research_notes: null, source_url: null, source_url_2: null, source_confidence: null, status: 'not_contacted', last_channel: null,
  emailed_on: null, last_contact_on: null, follow_up_on: null, follow_up_note: null, notes: null, created_at: '', updated_at: '', ...over,
})
const incoming = (over) => { const { id, rep_id, created_at, updated_at, ...rest } = row(over); return rest }

eq(I.patchFor(row({ status: 'meeting_booked' }), incoming({ status: 'email_sent' })).status, undefined, 'an old list moved a status backwards')
eq(I.patchFor(row({ status: 'do_not_contact' }), incoming({ status: 'interested' })).status, undefined, 'a list undid Do not contact')
eq(I.patchFor(row({ status: 'email_sent' }), incoming({ status: 'interested' })).status, 'interested', 'a list could not move a status forward')
eq(I.patchFor(row({ phone: '011' }), incoming({ phone: '999' })).phone, undefined, 'a list overwrote a number someone already had')
eq(I.patchFor(row(), incoming({ phone: '999' })).phone, '999', 'a list did not fill a blank')
eq(I.patchFor(row({ notes: 'first' }), incoming({ notes: 'second' })).notes, 'first\nsecond', 'notes were not kept together')
eq(Object.keys(I.patchFor(row({ notes: 'same' }), incoming({ notes: 'same' }))), [], 'a repeat note changed the row')
eq(I.patchFor(row(), incoming({ lists: ['L2'] })).lists, ['L1', 'L2'], 'a second list was not recorded')

const twice = I.planImport([incoming({})], [row()], 'rep1')
eq([twice.create.length, twice.update.length, twice.unchanged], [0, 0, 1], 'importing the same file twice changed something')
const theirs = I.planImport([incoming({ phone: '1' })], [row({ rep_id: 'rep2' })], 'rep1')
eq([theirs.update.length, theirs.otherRep], [0, 1], "an import touched another rep's contact")
eq(I.collapse([incoming({ email: 'A@Co.example' }), incoming({ email: 'a@co.example', lists: ['L2'] })].map(r => ({ ...r, email: r.email.toLowerCase() }))).length, 1, 'the same address twice in one file made two contacts')
eq(I.combine(incoming({ is_alternate: true, priority: 'backup' }), incoming({ is_alternate: false, priority: 'high' })).is_alternate, false, 'a primary on one list stayed an alternate')

// ── 6. Who a mail merge goes to ─────────────────────────────────────────────

const pool = [
  row({ id: 'ok', company: 'Good Ltd', email: 'jo@good.example', first_name: 'Jo' }),
  row({ id: 'dnc', company: 'Stop', email: 's@stop.example', status: 'do_not_contact' }),
  row({ id: 'bounce', company: 'Gone', email: 'g@gone.example', status: 'bounced' }),
  row({ id: 'sent', company: 'Sent', email: 'x@sent.example', status: 'email_sent' }),
  row({ id: 'alt', company: 'Alt', email: 'y@alt.example', is_alternate: true }),
  row({ id: 'gmail', company: 'Home', email: 'me@gmail.com' }),
  row({ id: 'old', company: 'Old', email: 'o@old.example', source_confidence: 'RECHECK - older source' }),
  row({ id: 'colleague', company: 'SENT (Pty) Ltd', email: 'z@sent.example' }),
  row({ id: 'dup1', company: 'Two', email: 'a@two.example' }),
  row({ id: 'dup2', company: 'Two', email: 'b@two.example' }),
  row({ id: 'none', company: 'No Mail', email: null, phone: '1' }),
]
const safe = P.mailMergeList(pool, pool, false)
eq(safe.send.map(p => p.id).sort(), ['dup1', 'ok'], 'the safe mail merge sent to the wrong people')
const picked = P.mailMergeList(pool, pool, true)
for (const id of ['dnc', 'bounce', 'none']) if (picked.send.some(p => p.id === id)) bad(`ticking ${id} let it onto a mail merge: that bar can never be overridden`)
if (!picked.send.some(p => p.id === 'gmail')) bad('a rep who ticks a row should be able to send to it, unless it is barred')
eq(P.greetingFor({ first_name: 'Lee', email: 'info@x.example', email_type: null }), 'Hello,', 'a shared inbox got a named greeting')
eq(P.greetingFor({ first_name: 'Lee', email: 'lee@x.example', email_type: 'Shared business inbox' }), 'Hello,', 'a shared inbox got a named greeting')
eq(P.greetingFor({ first_name: 'Lee', email: 'lee@x.example', email_type: null }), 'Hi Lee,', 'a direct address lost its greeting')

// ── 7. The log, and the boundary ────────────────────────────────────────────

eq(P.logEntryFor('email_sent', 'email'), { table: 'activity', status: 'email_sent' }, 'Email sent must write the Email log')
eq(P.logEntryFor('called_no_answer', 'email'), { table: 'call', outcome: 'no_answer' }, 'No answer must write the Call log')
eq(P.logEntryFor('interested', 'call'), { table: 'call', outcome: 'answered' }, 'Interested on a call must write the Call log')
eq(P.logEntryFor('do_not_contact', 'email'), null, 'Do not contact is not an activity')
eq(P.logEntryFor('not_contacted', 'call'), null, 'Not contacted is not an activity')
// Every log value must be one the log screens accept, or the save silently fails.
const callsLib = read('lib/rep-calls.ts'); const actLib = read('lib/rep-activities.ts')
for (const s of P.PROSPECT_STATUSES) for (const ch of ['email', 'call']) {
  const e = P.logEntryFor(s.id, ch)
  if (e?.table === 'call' && !callsLib.includes(`id: '${e.outcome}'`)) bad(`${e.outcome} is not a call outcome`)
  if (e?.table === 'activity' && !actLib.includes(`id: '${e.status}'`)) bad(`${e.status} is not an activity status`)
}

const server = read('lib/prospects-server.ts')
if (!/return actor\.isAdmin \? q : q\.eq\('rep_id', actor\.repId\)/.test(server)) bad('scoped() no longer limits a rep to their own rows')
for (const fn of ['updateProspect', 'setProspectStatus', 'deleteProspects', 'listProspects']) {
  const body = (server.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n}\\n`)) || [''])[0]
  if (!/scoped\(/.test(body)) bad(`${fn} does not go through scoped(), so a rep could reach another rep's prospects`)
}
if (!/if \(!actor\.isAdmin\) q = q\.neq\('status', 'do_not_contact'\)/.test(server)) bad('a rep can delete a do-not-contact record, so the address would be written to again from the next list')
if (!/if \(!actor\.isAdmin\) return \{ error: 'Only an admin/.test(server)) bad('a rep can move prospects between reps')
if (!/const repId = actor\.isAdmin \? /.test(server)) bad("a rep's new prospect must be theirs: rep_id is taken from the request")
if (!/status === 'email_sent' \? picked\.filter\(isBarred\)/.test(server)) bad('bulk Email sent no longer refuses bounced and do-not-contact rows')
if (!/withinSlip/.test(server) || !/removeLogs/.test(server)) bad('a corrected slip would count twice in the Activity log')

const route = read('app/api/prospects/route.ts')
if (!/if \(!actor\.canWrite\) return NextResponse\.json/.test(route)) bad('an inactive rep can change prospects')
const imp = read('app/api/prospects/import/route.ts')
if (!/const repId = actor\.isAdmin \? /.test(imp)) bad("a rep's import must be theirs")
if (/\bemails\.send\b/.test(route)) bad('/api/prospects sends email: marking a prospect must never mail anyone')
const exp = read('app/api/prospects/export/route.ts')
if (!/listProspects\(admin, actor\)/.test(exp) || !/all\.filter\(r => wanted\.has\(r\.id\)\)/.test(exp)) bad("an export must only narrow what this person may already see, or a made-up id reaches someone else's rows")
if (!/auditLog\(admin/.test(exp)) bad('exports of other people\'s contact details are not audited')
if (!/to\.length > 5/.test(exp)) bad('Mail it no longer limits how many people it can go to')
if (!/\/api\/prospects\/\*\*/.test(read('next.config.js'))) bad('the PDF fonts are not traced for /api/prospects, so the PDF would fail in production')

const migAll = read('supabase/migrations/105_rep_prospects.sql')
if (!/references public\.reps\(id\) on delete set null/.test(migAll)) bad("a rep leaving must not delete the company's prospects")
if (!/rep_prospects_email_key[\s\S]*?lower\(email\)/.test(migAll)) bad('one address can be on the list twice')
if (/grant[^;]*(anon|authenticated)/i.test(mig)) bad('prospects are server only: migration 105 grants a browser role')
if (!/Businesses we approach about reselling Cardtly/.test(read('app/privacy/page.tsx'))) bad('the privacy policy no longer covers the people on this list')
if (!/!iosApp/.test(read('components/rep/RepWorkspace.tsx')) || !/iosApp \? \[\]/.test(read('components/rep/RepWorkspace.tsx'))) bad('Prospects shows in the iOS app, which does not sell Cardtly to resellers')

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-prospects: ${fail} failure(s).`)
  process.exit(1)
}
console.log('check-prospects: the reader opens prefixed workbooks, all four layouts and our export map correctly, every status word reads right, importing never loses work, a mail merge cannot reach a barred address, and a rep only reaches their own rows.')
