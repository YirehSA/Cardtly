// A reseller's own card is free for as long as they are a reseller.
//
// WHAT THIS PROTECTS (Andre, 2026-10-21):
//   1. The reseller's main login (its own email) gets a free Pro card; extra
//      staff logins do not.
//   2. It stops when the reseller ends, or moves when the main email changes.
//   3. It is never given on top of a Paystack subscription that is still
//      billing or retrying, and never touches a comp an admin gave by hand.
//   4. Syncing twice writes nothing new, and a report never writes at all.
//
// Run: node scripts/check-reseller-comp.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (got !== want) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

const out = mkdtempSync(join(tmpdir(), 'reseller-comp-'))
let C
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-comp.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  C = await import(pathToFileURL(join(out, 'reseller-comp.mjs')).href)
} catch (e) {
  console.error('check-reseller-comp: could not compile lib/reseller-comp')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// A small stand-in for the service-role client: enough of PostgREST's
// filters, including metadata->>key, for the queries lib/reseller-comp makes.
function fakeDb(users) {
  const t = { reseller_members: [], whop_subscriptions: [], resellers: [], admin_audit_log: [] }
  let seq = 0, clock = 0
  const get = (row, k) => k.includes('->>') ? (row[k.split('->>')[0]] || {})[k.split('->>')[1]] ?? null : row[k]
  const match = (row, f) => f.every(([op, k, v]) => op === 'eq' ? get(row, k) === v : op === 'in' ? v.includes(get(row, k)) : true)
  const writes = { n: 0 }
  const from = (table) => {
    const q = { op: 'select', f: [], p: null }
    const run = () => {
      if (q.op === 'insert') { if (table !== 'admin_audit_log') writes.n++; const r = { id: `s${++seq}`, created_at: String(++clock).padStart(6, '0'), ...q.p }; t[table].push(r); return { data: r, error: null } }
      if (q.op === 'update') { writes.n++; for (const r of t[table].filter(r => match(r, q.f))) Object.assign(r, q.p); return { data: null, error: null } }
      return { data: t[table].filter(r => match(r, q.f)), error: null }
    }
    const api = {
      select() { return api }, insert(p) { q.op = 'insert'; q.p = p; return api }, update(p) { q.op = 'update'; q.p = p; return api },
      eq(k, v) { q.f.push(['eq', k, v]); return api }, in(k, v) { q.f.push(['in', k, v]); return api },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return api
  }
  return {
    t, writes, from,
    auth: { admin: { getUserById: async (id) => ({ data: { user: users[id] ? { id, email: users[id] } : null } }) } },
    addSub(row) { t.whop_subscriptions.push({ id: `s${++seq}`, created_at: String(++clock).padStart(6, '0'), ...row }) },
  }
}

const reseller = { id: 'r1', name: 'Spark', email: 'jo@spark.example', status: 'active' }
const active = (db, uid) => db.t.whop_subscriptions.filter(s => s.user_id === uid && s.status === 'active')
const newest = (db, uid) => [...db.t.whop_subscriptions.filter(s => s.user_id === uid)].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

// 1. The main login gets the card, once.
{
  const db = fakeDb({ u1: 'Jo@Spark.example', u2: 'staff@spark.example' })
  db.t.reseller_members.push({ reseller_id: 'r1', user_id: 'u1' }, { reseller_id: 'r1', user_id: 'u2' })
  const dry = await C.syncResellerFreeCard(db, reseller, { dryRun: true })
  eq(dry.state, 'pending', 'a report before anything is written')
  eq(db.writes.n, 0, 'writes made by a report')
  const first = await C.syncResellerFreeCard(db, reseller)
  eq(first.state, 'free', 'the main login after a sync')
  const row = newest(db, 'u1')
  if (!(row && row.status === 'active' && row.subscription_tier === 'pro' && row.metadata?.comped && row.metadata?.reason === 'reseller' && row.metadata?.reseller_id === 'r1')) bad('the free card is not an active, comped, reseller-marked Pro row')
  if (active(db, 'u2').length) bad('a staff login was given a free card')
  if (!db.t.admin_audit_log.some(l => l.action === 'subscription_granted' && l.target_user_id === 'u1')) bad('giving the free card left no record in the audit log')
  const before = db.writes.n
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'free', 'syncing again')
  eq(db.writes.n, before, 'writes made by a second sync')

  // 2. The main email moves to the staff login.
  const moved = { ...reseller, email: 'staff@spark.example' }
  eq((await C.syncResellerFreeCard(db, moved)).state, 'free', 'the new main login')
  if (active(db, 'u1').some(s => s.metadata?.reason === 'reseller')) bad('the old main login kept its free card after the email moved')
  if (!active(db, 'u2').some(s => s.metadata?.reason === 'reseller')) bad('the new main login did not get the free card')

  // 3. The reseller ends.
  eq((await C.syncResellerFreeCard(db, { ...moved, status: 'ended' })).state, 'off', 'an ended reseller')
  if (db.t.whop_subscriptions.some(s => s.status === 'active' && s.metadata?.reason === 'reseller')) bad('an ended reseller still has a free card')
  if (!db.t.admin_audit_log.some(l => l.action === 'subscription_cancelled')) bad('taking the free card away left no record in the audit log')

  // On hold is still a reseller.
  eq((await C.syncResellerFreeCard(db, { ...moved, status: 'suspended' })).state, 'free', 'a reseller on hold')
}

// 4. Never on top of Paystack, and never touching a hand-given comp.
{
  const db = fakeDb({ u1: 'jo@spark.example' })
  db.t.reseller_members.push({ reseller_id: 'r1', user_id: 'u1' })
  db.addSub({ user_id: 'u1', plan_id: 'paystack_monthly', subscription_tier: 'pro', status: 'past_due', metadata: {} })
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'paying', 'a login Paystack is still retrying')
  if (db.t.whop_subscriptions.some(s => s.metadata?.reason === 'reseller')) bad('a free card was written on top of a past-due Paystack subscription')
  db.t.whop_subscriptions[0].status = 'cancelled'
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'free', 'the same login once Paystack is cancelled')
}
{
  const db = fakeDb({ u1: 'jo@spark.example' })
  db.t.reseller_members.push({ reseller_id: 'r1', user_id: 'u1' })
  db.addSub({ user_id: 'u1', plan_id: 'pro_admin', subscription_tier: 'pro', status: 'active', metadata: { comped: true, reason: 'admin_activated' } })
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'already_free', 'a login an admin comped by hand')
  eq(db.t.whop_subscriptions.length, 1, 'rows after syncing a hand-comped login')
  await C.syncResellerFreeCard(db, { ...reseller, status: 'ended' })
  eq(db.t.whop_subscriptions[0].status, 'active', 'a hand-given comp after the reseller ended')
}

// 5. A newer row on top of ours (an admin removed Pro): the next sync puts it back.
{
  const db = fakeDb({ u1: 'jo@spark.example' })
  db.t.reseller_members.push({ reseller_id: 'r1', user_id: 'u1' })
  await C.syncResellerFreeCard(db, reseller)
  db.addSub({ user_id: 'u1', plan_id: 'pro_admin', subscription_tier: 'pro', status: 'cancelled', metadata: {} })
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'free', 'a free card buried under a newer row')
  const top = newest(db, 'u1')
  if (!(top.status === 'active' && top.metadata?.reason === 'reseller')) bad('the free card is not the newest row again, so it would not serve')
  eq(db.t.whop_subscriptions.filter(s => s.status === 'active' && s.metadata?.reason === 'reseller').length, 1, 'active free cards after re-writing it')
}
{
  const db = fakeDb({})
  eq((await C.syncResellerFreeCard(db, reseller)).state, 'no_login', 'a reseller whose email has no login')
}

// ── Wiring ──────────────────────────────────────────────────────────────────
const route = read('app/api/admin/resellers/route.ts')
for (const [what, re] of [
  ['creating or approving a reseller', /const free = await syncResellerFreeCard\(db, reseller\)\.catch/],
  ['saving a reseller', /syncResellerFreeCard\(db, \{ \.\.\.reseller, \.\.\.patch \}\)/],
  ['ending a reseller', /syncResellerFreeCard\(db, \{ \.\.\.reseller, status: 'ended' \}\)/],
  ['restarting a reseller', /syncResellerFreeCard\(db, \{ \.\.\.reseller, status: 'active' \}\)/],
]) if (!re.test(route)) bad(`${what} must sync the free card`)
if (!/syncResellerFreeCard\(db, r, \{ dryRun: true \}\)/.test(route)) bad('the admin list must only report the free card, never write it')
if (!/filter\(c => !c\.offBill && c\.state !== 'cancelled'\)/.test(route)) bad('a reseller with clients still on their bill must not be ended')
const cron = read('app/api/cron/trial-reminders/route.ts')
if (!/syncAllResellerFreeCards\(admin\)/.test(cron)) bad('the daily cron must sync every reseller\'s free card')
if (!/syncResellerFreeCard\(db, reseller, \{ dryRun: true \}\)/.test(read('app/api/reseller/route.ts'))) bad('the reseller page must only report the free card')
const mig = read('supabase/migrations/096_reseller_ended.sql').split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
if (!/check \(status in \('active', 'suspended', 'ended'\)\)/.test(mig)) bad("migration 096 must allow 'ended' and keep active and suspended")

// A failed Paystack subscription can be cancelled on its own, without
// taking any comp or reseller card with it.
const adminRoute = read('app/api/admin/route.ts')
const failedBlock = (/action === 'cancel_failed_paystack'[\s\S]*?return NextResponse\.json\(\{ success: true \}\)/.exec(adminRoute) || [])[0] || ''
if (!failedBlock) bad('admin has no way to cancel a failed Paystack subscription')
else {
  if (!/\.eq\('status', 'past_due'\)/.test(failedBlock) || !/!s\.metadata\?\.comped && String\(s\.plan_id \|\| ''\)\.startsWith\('paystack'\)/.test(failedBlock)) bad('cancelling a failed Paystack subscription must touch only failed Paystack rows')
  if (failedBlock.indexOf('cancelSubscriptionsFor(') > failedBlock.indexOf(".update({ status: 'cancelled'")) bad('Paystack must confirm the cancellation before our rows change')
  if (!/logSubscriptionChange\(/.test(failedBlock)) bad('cancelling a failed Paystack subscription must be logged')
}
if (!/u\.paystackPastDue && \(/.test(read('components/admin/AdminDashboard.tsx'))) bad('the Users list must offer to cancel a failed Paystack subscription')

if (fail) {
  console.error(`check-reseller-comp: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-reseller-comp: ok (main login only, ends with the reseller, moves with the email, never over Paystack or a hand-given comp, idempotent)')
