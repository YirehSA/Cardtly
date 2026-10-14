// A team's monthly report, and resetting its analytics.
//
// WHAT THIS PROTECTS (built 2026-10-14 for a Cardtly rep who sets companies
// up): resetting must clear the opens, taps and scans made while testing - and
// nothing else - and the monthly report must count the month the customer
// means.
//
//   1. lib/team-analytics, RUN against an in-memory database:
//      - months run midnight to midnight South African time
//      - the report counts opens, distinct visitors, taps, saves, shares,
//        leads and arrivals by channel per card, past PostgREST's 1000 rows,
//        and only for this team's cards
//      - a reset deletes this team's events and zeroes its view counts, keeps
//        every contact, never touches another team, and can be one card only
//   2. Only the owner (or Cardtly admin) can reset or download, and every
//      reset is on the audit log.
//
// Run: node scripts/check-team-analytics.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const out = mkdtempSync(join(tmpdir(), 'team-analytics-'))
let A
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/team-analytics.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  A = await import(pathToFileURL(join(out, 'team-analytics.mjs')).href)
} catch (e) {
  console.error('check-team-analytics: could not compile lib/team-analytics.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── In-memory database: select / eq / in / gte / lt / order / range / count,
// update, delete. Capped at 1000 rows a page like PostgREST.
function makeDb(seed) {
  const tables = JSON.parse(JSON.stringify(seed))
  const test = (row, [op, c, v]) =>
    op === 'eq' ? row[c] === v : op === 'in' ? v.includes(row[c]) : op === 'gte' ? row[c] >= v : op === 'lt' ? row[c] < v : true
  function from(name) {
    const st = { op: 'select', filters: [], count: false, head: false, order: null, range: null, patch: null }
    const run = () => {
      const rows = tables[name] || (tables[name] = [])
      const hit = rows.filter(r => st.filters.every(f => test(r, f)))
      if (st.op === 'delete') { tables[name] = rows.filter(r => !hit.includes(r)); return { data: null, error: null } }
      if (st.op === 'update') { hit.forEach(r => Object.assign(r, st.patch)); return { data: null, error: null } }
      if (st.count) return { data: null, error: null, count: hit.length }
      let list = st.order ? [...hit].sort((a, b) => String(a[st.order]).localeCompare(String(b[st.order]))) : hit
      if (st.range) list = list.slice(st.range[0], st.range[1] + 1)
      return { data: list.slice(0, 1000).map(r => ({ ...r })), error: null }
    }
    const q = {
      select(_c, o) { if (o?.count) { st.count = true; st.head = !!o.head } return q },
      eq(c, v) { st.filters.push(['eq', c, v]); return q },
      in(c, v) { st.filters.push(['in', c, v]); return q },
      gte(c, v) { st.filters.push(['gte', c, v]); return q },
      lt(c, v) { st.filters.push(['lt', c, v]); return q },
      order(c) { st.order = c; return q },
      range(a, b) { st.range = [a, b]; return q },
      delete() { st.op = 'delete'; return q },
      update(p) { st.op = 'update'; st.patch = p; return q },
      maybeSingle() { return Promise.resolve(run()).then(r => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })) },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return q
  }
  return { from, tables: () => tables }
}

// ── 1a. Months in South African time ────────────────────────────────────────
const sep = A.monthBounds('2026-09')
if (!sep || sep.start.toISOString() !== '2026-08-31T22:00:00.000Z' || sep.end.toISOString() !== '2026-09-30T22:00:00.000Z') {
  bad(`September 2026 must run from 2026-08-31T22:00Z to 2026-09-30T22:00Z (midnight SAST), got ${sep?.start.toISOString()} to ${sep?.end.toISOString()}`)
}
if (sep?.label !== 'September 2026') bad(`month label is "${sep?.label}", expected "September 2026"`)
if (A.monthBounds('2026-13') || A.monthBounds('nonsense')) bad('an impossible month must be refused, not reported')
const rm = A.recentMonths(3, new Date('2026-10-14T10:00:00Z'))
if (rm.map(m => m.value).join() !== '2026-10,2026-09,2026-08' || !/so far/.test(rm[0].label)) bad(`recentMonths is wrong: ${JSON.stringify(rm)}`)
// 23:30 SAST on 30 September is still September; 00:30 SAST on 1 October is not.
if (A.recentMonths(1, new Date('2026-09-30T21:30:00Z'))[0].value !== '2026-09') bad('late on the last day of a month (SAST) was counted as the next month')
if (A.recentMonths(1, new Date('2026-09-30T22:30:00Z'))[0].value !== '2026-10') bad('just after midnight SAST on the 1st was counted as the previous month')

// ── 1b. The report ──────────────────────────────────────────────────────────
const ev = (id, card, type, at, hash = null) => ({ id, team_card_id: card, event_type: type, created_at: at, visitor_hash: hash })
const seed = () => {
  const events = [
    ev('e01', 'c1', 'view', '2026-08-31T21:59:00Z', 'v1'), // 23:59 SAST, 31 August: not September
    ev('e02', 'c1', 'view', '2026-08-31T22:00:00Z', 'v1'), // 00:00 SAST, 1 September
    ev('e03', 'c1', 'view', '2026-09-02T10:00:00Z', 'v1'),
    ev('e04', 'c1', 'view', '2026-09-02T11:00:00Z', 'v2'),
    ev('e05', 'c1', 'view', '2026-09-03T11:00:00Z', null),
    ev('e06', 'c1', 'link_click', '2026-09-03T11:01:00Z'),
    ev('e07', 'c1', 'contact_save', '2026-09-03T11:02:00Z'),
    ev('e08', 'c1', 'qr_scan', '2026-09-03T11:00:00Z'),
    ev('e09', 'c1', 'share', '2026-09-04T11:00:00Z'),
    ev('e10', 'c2', 'nfc_tap', '2026-09-05T11:00:00Z'),
    ev('e11', 'cX', 'view', '2026-09-05T11:00:00Z', 'vx'), // another team's card
  ]
  // 1 200 more opens on c2, to cross the 1000-row page.
  for (let i = 0; i < 1200; i++) events.push(ev(`p${String(i).padStart(5, '0')}`, 'c2', 'view', '2026-09-10T08:00:00Z', `h${i % 50}`))
  return {
    team_cards: [
      { id: 'c1', organization_id: 'org1', name: 'Ann', title: 'Rep', slug: 'a', department_id: 'd1', is_active: true, view_count: 40 },
      { id: 'c2', organization_id: 'org1', name: 'Ben', title: null, slug: 'b', department_id: null, is_active: true, view_count: 1300 },
      { id: 'c3', organization_id: 'org1', name: 'Old', title: null, slug: 'c', department_id: null, is_active: false, view_count: 0 },
      { id: 'cX', organization_id: 'org2', name: 'Other', title: null, slug: 'x', department_id: null, is_active: true, view_count: 9 },
    ],
    departments: [{ id: 'd1', organization_id: 'org1', name: 'Sales' }],
    team_card_events: events,
    contacts: [
      { id: 'k1', team_card_id: 'c1', created_at: '2026-09-03T12:00:00Z' },
      { id: 'k2', team_card_id: 'c1', created_at: '2026-10-01T12:00:00Z' }, // October
      { id: 'k3', team_card_id: 'cX', created_at: '2026-09-03T12:00:00Z' },
    ],
  }
}
{
  const db = makeDb(seed())
  const r = await A.buildTeamReport(db, { id: 'org1', name: 'Acme', max_seats: 5 }, '2026-09')
  const ann = r.rows.find(x => x.id === 'c1'), ben = r.rows.find(x => x.id === 'c2')
  if (!ann || !ben) bad('a team card is missing from the report')
  else {
    if (ann.opens !== 4) bad(`Ann's September opens are ${ann.opens}, expected 4 (the 23:59 SAST open on 31 August is August's)`)
    if (ann.people !== 3) bad(`Ann reached ${ann.people} people, expected 3 (two visitors plus one open that cannot be told apart)`)
    if (ann.taps !== 1 || ann.saves !== 1 || ann.shares !== 1 || ann.leads !== 1) bad(`Ann's taps/saves/shares/leads are ${[ann.taps, ann.saves, ann.shares, ann.leads]}, expected 1 each (the October lead is not September's)`)
    if (ann.department !== 'Sales') bad('the department name is missing')
    if (ann.sources['QR code scan'] !== 1) bad('a QR scan was not counted under "QR code scan"')
    if (ben.opens !== 1200) bad(`Ben's opens are ${ben.opens}, expected 1200: the report stopped at a 1000-row page`)
    if (ben.people !== 50) bad(`Ben reached ${ben.people} people, expected 50 distinct visitors`)
    if (ben.sources['NFC card tap'] !== 1) bad('an NFC tap was not counted')
  }
  if (r.rows.some(x => x.id === 'cX')) bad('another team\'s card is in this team\'s report')
  if (r.rows.some(x => x.id === 'c3')) bad('an inactive card with no activity is listed')
  if (r.totals.leads !== 1 || r.totals.activeCards !== 2) bad(`totals are wrong: ${JSON.stringify(r.totals)}`)
  if (r.byDay.length !== 30 || r.byDay[0].date !== '2026-09-01' || r.byDay[0].opens !== 1) bad(`by-day must cover the 30 days of September in SAST, with the 00:00 open on the 1st: ${JSON.stringify(r.byDay.slice(0, 2))}`)
}

// ── 1c. The reset ───────────────────────────────────────────────────────────
{
  const db = makeDb(seed())
  const res = await A.resetTeamAnalytics(db, 'org1')
  const t = db.tables()
  if (res.cards !== 3) bad(`reset reports ${res.cards} cards, expected 3`)
  if (t.team_card_events.some(e => ['c1', 'c2', 'c3'].includes(e.team_card_id))) bad('events were left on this team\'s cards after a reset')
  if (!t.team_card_events.some(e => e.team_card_id === 'cX')) bad('a reset deleted ANOTHER team\'s analytics')
  if (t.team_cards.filter(c => c.organization_id === 'org1').some(c => c.view_count !== 0)) bad('a reset left an all-time view count above zero')
  if (t.team_cards.find(c => c.id === 'cX').view_count !== 9) bad('a reset changed another team\'s view count')
  if (t.contacts.length !== 3) bad('a reset deleted contacts: leads are real people, not numbers')
}
{
  const db = makeDb(seed())
  const res = await A.resetTeamAnalytics(db, 'org1', 'c1')
  const t = db.tables()
  if (res.cards !== 1) bad('a one-card reset touched more than one card')
  if (t.team_card_events.some(e => e.team_card_id === 'c1')) bad('a one-card reset left that card\'s events')
  if (!t.team_card_events.some(e => e.team_card_id === 'c2')) bad('a one-card reset cleared the rest of the team')
  if (t.team_cards.find(c => c.id === 'c2').view_count !== 1300) bad('a one-card reset zeroed another card')
}
{
  const db = makeDb(seed())
  const res = await A.resetTeamAnalytics(db, 'org1', 'cX')
  if (res.cards !== 0 || !db.tables().team_card_events.some(e => e.team_card_id === 'cX')) bad('a reset reached a card in a different team by its id')
}

// ── 2. Who can, and the record ──────────────────────────────────────────────
const route = read('app/api/team/analytics/route.ts')
for (const verb of ['GET', 'POST']) {
  const body = route.slice(route.indexOf(`export async function ${verb}`))
  if (!/const org = await ownerOrg\(admin, user\.id\)\s*if \(!org\) return NextResponse\.json\([^)]*\{ status: 403 \}\)/.test(body)) bad(`app/api/team/analytics ${verb} must refuse anybody who does not own the team`)
}
if (!/\.eq\('admin_user_id', userId\)/.test(route)) bad('the owner check must look the team up by admin_user_id')
if (!/auditLog\(admin, \{[\s\S]{0,120}action: 'team_reset_analytics'/.test(route)) bad('an owner\'s reset must be written to the audit log')
const adminRoute = read('app/api/admin/route.ts')
if (!/action === 'reset_team_analytics'[\s\S]{0,400}resetTeamAnalytics\(admin, org_id, card_id \|\| null\)[\s\S]{0,200}action: 'admin_reset_team_analytics'/.test(adminRoute)) bad('the admin reset must call resetTeamAnalytics and write an audit entry')

if (fail) {
  console.error(`check-team-analytics: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-team-analytics: ok (months in SAST, report counts past 1000 rows for this team only, reset clears analytics and nothing else, owner and admin only, audited)')
