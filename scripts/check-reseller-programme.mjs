// The reseller programme: a rep runs it, the admins keep the final say.
//
// WHAT THIS PROTECTS (built 2026-11-02, for Anthony; Andre chose: invoices
// only Andre and Tio, his price and seat changes straight away and logged, and
// an admin may approve without his recommendation):
//   1. Who is a manager: an active rep with manages_resellers on, admins above
//      him, and a fail-closed lookup. He may only 'update' and 'nfc_status'.
//   2. The routes: creating a reseller (the final approval) and every invoice
//      route stay admin only; PATCH refuses him anything else before it reads
//      or writes; an ended reseller comes back only through restart; the
//      applications route recommends but never approves.
//   3. Only an admin switches it on, in admin, Reps, and it is logged.
//   4. The screen hides what is not his, and his page, nav and iOS block exist.
//
// Run: node scripts/check-reseller-programme.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const fn = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\nexport async function ', at + 10)
  return src.slice(at, next < 0 ? undefined : next)
}
const count = (src, s) => src.split(s).length - 1

// ── 1. Who is a manager ─────────────────────────────────────────────────────
const lib = read('lib/reseller-programme.ts')
if (!lib) bad('lib/reseller-programme.ts is missing')
const allow = /MANAGER_RESELLER_ACTIONS = \[([^\]]*)\] as const/.exec(lib)
if (!allow) bad('MANAGER_RESELLER_ACTIONS is not a literal list')
else {
  const list = allow[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean).sort().join(',')
  if (list !== 'nfc_status,update') bad(`a manager may take ${list}; only update and nfc_status are his`)
}
if (!/if \(await isAdminUser\(userId\)\) return 'admin'/.test(lib)) bad('resellerProgrammeRole does not put admins first')
if (!/rep\.active !== false && rep\.manages_resellers === true \? 'manager' : null/.test(lib)) bad('resellerProgrammeRole does not need an active rep with manages_resellers on')
const roleFn = lib.slice(lib.indexOf('export async function resellerProgrammeRole'), lib.indexOf('export async function requireResellerProgramme'))
if (!/if \(error \|\| !data\?\.length\) return null/.test(roleFn) || !/catch \{\s*return null/.test(roleFn)) bad('resellerProgrammeRole does not fail closed')
if (!/manages_resellers boolean not null default false/.test(read('supabase/migrations/098_reseller_programme.sql'))) bad('migration 098 does not add manages_resellers, off by default')
if (!/'pending', 'recommended', 'approved', 'declined'/.test(read('supabase/migrations/098_reseller_programme.sql'))) bad("migration 098 does not allow the 'recommended' status")
if (!/managesResellers: row\.manages_resellers === true/.test(read('lib/rep-access.ts'))) bad('lib/rep-access does not read manages_resellers strictly')

// ── 2. The routes ───────────────────────────────────────────────────────────
const resellers = read('app/api/admin/resellers/route.ts')
const post = fn(resellers, 'POST')
const patch = fn(resellers, 'PATCH')
if (!/const gate = await requireAdmin\(\)/.test(post) || /requireResellerProgramme/.test(post)) bad('creating a reseller (the final approval) is not admin only')
if (!/data\.status !== 'pending' && data\.status !== 'recommended'/.test(post)) bad('an admin cannot approve a recommended application')
if (!/const gate = await requireResellerProgramme\(\)/.test(fn(resellers, 'GET'))) bad('the manager cannot list the resellers')
if (!/const gate = await requireResellerProgramme\(\)/.test(patch)) bad('the manager cannot change a reseller')
{
  const check = patch.indexOf("gate.role === 'manager' && !managerMay(body.action)")
  const firstDb = patch.indexOf('db.from(')
  if (check < 0) bad('PATCH does not refuse a manager the actions that are not his')
  else if (firstDb >= 0 && firstDb < check) bad('PATCH reads or writes before it refuses a manager')
  if (!/return adminOnly\(/.test(patch.slice(check, check + 600))) bad('PATCH does not answer a refused manager with adminOnly')
}
if (!/reseller\.status === 'ended' && body\.status !== reseller\.status/.test(patch)) bad("'update' can bring an ended reseller back, around restart")
if (!/before, by_role: gate\.role/.test(patch)) bad('a price or pool change is not logged with what it was before')

for (const p of ['app/api/admin/billing/invoices/route.ts', 'app/api/admin/billing/invoices/send/route.ts', 'app/api/admin/billing/invoices/pdf/route.ts']) {
  const src = read(p)
  if (!src) { bad(`${p} is missing`); continue }
  if (/requireResellerProgramme/.test(src)) bad(`${p} lets the manager near invoices`)
  for (const m of ['GET', 'POST', 'PATCH']) {
    const body = fn(src, m)
    if (body && !/const gate = await requireAdmin\(\)/.test(body)) bad(`${p} ${m} is not admin only`)
  }
}

const apps = read('app/api/admin/reseller-applications/route.ts')
if (!/const gate = await requireResellerProgramme\(\)/.test(fn(apps, 'PATCH'))) bad('the manager cannot recommend or decline applications')
if (/status: 'approved'/.test(apps)) bad('the applications route approves; only creating the reseller (admin) may')
{
  const rec = apps.slice(apps.indexOf("body.action === 'recommend'"), apps.indexOf("body.action === 'unrecommend'"))
  if (!rec) bad('there is no recommend step')
  else {
    if (!/status: 'recommended'/.test(rec) || !/\.eq\('status', 'pending'\)/.test(rec)) bad('recommend does not move pending to recommended only')
    if (!/adminEmails\(db\)/.test(rec)) bad('recommending does not email the admins')
    if (!/action: 'recommend_reseller_application'/.test(rec)) bad('recommending is not logged')
  }
  const dec = apps.slice(apps.indexOf("body.action === 'decline'"))
  if (!/app\.status !== 'pending' && app\.status !== 'recommended'/.test(dec) || !/\.eq\('status', app\.status\)/.test(dec)) bad('declining can overrule an application someone else just decided')
}

// ── 3. Switching it on ──────────────────────────────────────────────────────
const adminRoute = read('app/api/admin/route.ts')
{
  const gateAt = adminRoute.indexOf('if (!await isAdminUser(user?.id))')
  const at = adminRoute.indexOf("action === 'set_reseller_manager'")
  if (at < 0) bad("admin has no 'set_reseller_manager' action")
  else {
    if (gateAt < 0 || gateAt > at) bad('set_reseller_manager is not behind the admin check')
    const block = adminRoute.slice(at, adminRoute.indexOf('\n  if (action ===', at + 10))
    if (!/body\.on === true/.test(block)) bad('set_reseller_manager switches on for anything but true')
    if (!/action: 'set_reseller_manager'/.test(block)) bad('set_reseller_manager is not logged')
  }
}
if (!/onSetResellerManager\(r, !r\.manages_resellers\)/.test(read('components/admin/RepsTab.tsx'))) bad('admin, Reps has no reseller programme switch')

// ── 4. The screen, the page, the nav ────────────────────────────────────────
const tab = read('components/admin/ResellersTab.tsx')
const guarded = [
  // [the guard, what it must cover, how far after it]
  ["{isAdmin && (\n      <div className=\"flex justify-end\">", '<Plus className="w-4 h-4" />New reseller', 400],
  ['{isAdmin && adding && (', '<button onClick={create}', 3000],
  ["{isAdmin && <button onClick={() => patch('draft'", "action: 'draft_month', month: r.lastMonth.month", 200],
  ["{m.invoice.status === 'draft' && isAdmin && <>", "action: 'draft_month', month: m.month, rebuild: true", 200],
  ["{m.invoice.status === 'draft' && isAdmin && <>", '/api/admin/billing/invoices/pdf', 800],
  ["{m.invoice.status === 'draft' && isAdmin && <>", 'approveAndSend(m.invoice.id', 1200],
  ["{o.invoice?.status === 'draft' && isAdmin && (", 'approveAndSend(o.invoice.id', 200],
  ['{ended ? (isAdmin && (', "action: 'restart'", 400],
  ['{isAdmin && <button onClick={() => {\n                if (!confirm(`End ', "action: 'end'", 700],
  ['{isAdmin && (r.freeCard.state', "action: 'sync_free_card'", 300],
  ['{isAdmin && <button onClick={() => { if (confirm(`Remove ', "action: 'remove_login'", 300],
  ['{isAdmin && <div className="flex items-center gap-2 mt-2">', "action: 'add_login'", 700],
  ['{isAdmin && (\n                  <button onClick={() => onApprove(a)}', 'onApprove(a)', 200],
]
for (const [guard, what, within] of guarded) {
  const g = tab.indexOf(guard)
  const w = tab.indexOf(what, g < 0 ? 0 : g)
  if (count(tab, what) !== 1) bad(`ResellersTab has ${count(tab, what)} of ${what}; one, behind its guard, is the rule`)
  else if (g < 0 || w < 0 || w - g > within) bad(`ResellersTab offers ${what} to the manager`)
}
if (!/role = 'admin'/.test(tab)) bad("ResellersTab does not default to the admin view, which admin, Resellers relies on")
if (!/action: 'recommend', note: recNote/.test(tab)) bad('the manager has no Recommend button')
if (!/action: 'unrecommend'/.test(tab)) bad('a recommendation cannot be taken back')
if (!/a\.status === 'pending' \|\| a\.status === 'recommended'/.test(tab)) bad('recommended applications drop out of the open list')

const page = read('app/dashboard/reseller-programme/page.tsx')
if (!page) bad('app/dashboard/reseller-programme/page.tsx is missing')
else {
  if (!/const role = await resellerProgrammeRole\(/.test(page) || !/if \(!role\) redirect\('\/dashboard'\)/.test(page)) bad('the Resellers page does not send everyone else away')
  if (!/<ResellersTab role="manager" \/>/.test(page)) bad('the Resellers page does not show the manager view')
}
const layout = read('app/dashboard/layout.tsx')
if (!/const isResellerManager = !!rep && rep\.active && rep\.managesResellers && !iosApp/.test(layout)) bad('the layout offers the Resellers page to the wrong people, or in the iOS app')
for (const p of ['components/dashboard/Sidebar.tsx', 'components/dashboard/MobileBottomNav.tsx']) {
  const src = read(p)
  if (!/\.\.\.\(isResellerManager \? \[RESELLER_PROGRAMME_TAB\] : \[\]\)/.test(src)) bad(`${p} has no Resellers tab behind isResellerManager`)
  if (!/href: '\/dashboard\/reseller-programme'/.test(src)) bad(`${p}'s Resellers tab goes somewhere else`)
}
if (!/startsWith\(href \+ '\/'\)/.test(read('components/dashboard/Sidebar.tsx'))) bad('the sidebar lights Reseller up on the Resellers page too')
if (!/'\/dashboard\/reseller-programme',/.test(read('lib/app-platform.ts'))) bad('the Resellers page is not blocked in the iOS app')

if (fail) { console.error(`check-reseller-programme: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-reseller-programme: ok')
