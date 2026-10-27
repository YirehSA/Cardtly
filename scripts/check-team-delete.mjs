// Deleting a team from Admin, Teams: only an empty one that nothing bills.
//
// WHAT THIS PROTECTS (built 2026-10-27, for C-Office, a comped promo team with
// no cards whose owner is to become a reseller):
//   1. teamDeleteBlocker refuses a team with cards, a reseller's client team,
//      a self-serve team Paystack still charges, and a team a recurring invoice
//      schedule counts. An empty comped team is allowed.
//   2. The admin route checks before it deletes, fails closed when a check
//      cannot be read, logs the delete, and warns when the owner's own card
//      loses its cover.
//   3. The admin button is there, asks first, and is greyed for a team with
//      cards.
//
// Run: node scripts/check-team-delete.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The rules, run ───────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'team-delete-'))
let T
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/team-delete.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'team-delete.js'), join(out, 'team-delete.mjs'))
  T = await import(pathToFileURL(join(out, 'team-delete.mjs')).href)
} catch (e) {
  console.error('check-team-delete: could not compile lib/team-delete.ts')
  console.error(String(e?.stderr || e?.message || e))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const empty = { cards: 0, billingPeriod: 'comp', resellerId: null, paystackStillCharging: false, recurringSchedules: 0 }
const cases = [
  ['an empty comped team', empty, false],
  ['an empty invoiced team', { ...empty, billingPeriod: 'prepaid' }, false],
  ['a team with one card', { ...empty, cards: 1 }, true],
  ['a team with many cards', { ...empty, cards: 40 }, true],
  ['a reseller client by id', { ...empty, resellerId: 'r1' }, true],
  ['a reseller client by billing', { ...empty, billingPeriod: 'reseller' }, true],
  ['a self-serve team Paystack still charges', { ...empty, billingPeriod: 'monthly', paystackStillCharging: true }, true],
  ['a team a recurring schedule counts', { ...empty, billingPeriod: 'debit_order', recurringSchedules: 1 }, true],
]
for (const [label, facts, blocked] of cases) {
  const why = T.teamDeleteBlocker(facts)
  if (blocked && !why) bad(`${label} can be deleted, and must not be`)
  if (!blocked && why) bad(`${label} is refused: ${why}`)
}
if (!/move or delete the cards first/.test(T.teamDeleteBlocker({ ...empty, cards: 2 }) || '')) bad('a team with cards is not told how to get out of it')

// ── 2. The route ────────────────────────────────────────────────────────────
const route = read('app/api/admin/route.ts')
const start = route.indexOf("action === 'delete_org'")
const block = start < 0 ? '' : route.slice(start, route.indexOf('\n  if (action ===', start + 10))
if (!block) bad("app/api/admin/route.ts has no 'delete_org' action")
else {
  const blockerAt = block.indexOf('teamDeleteBlocker(')
  const deleteAt = block.indexOf(".from('organizations').delete()")
  if (blockerAt < 0) bad('delete_org does not ask teamDeleteBlocker')
  if (deleteAt < 0) bad('delete_org never deletes the team')
  if (blockerAt > deleteAt) bad('delete_org deletes before it checks')
  if (!/count\('team_cards'/.test(block)) bad('delete_org does not count the team cards')
  if (!/count\('recurring_schedules'/.test(block)) bad('delete_org does not count recurring schedules')
  if (!/whop_membership_id/.test(block) || !/subscriptionState\(/.test(block)) bad('delete_org does not check a self-serve team\'s Paystack subscription')
  if (!/Nothing was deleted/.test(block)) bad('delete_org does not fail closed when a check cannot be read')
  if (!/auditLog\(admin, \{[^}]*action: 'delete_org'/.test(block)) bad('delete_org is not in the audit log')
  if (!/getUserPlan\(/.test(block) || !/isPro\(/.test(block)) bad('delete_org does not warn when the owner\'s own card loses its cover')
  if (/\.from\('cards'\)\.delete\(/.test(block) || /deleteUser\(/.test(block)) bad('delete_org must never delete the owner\'s card or login')
}

// ── 3. The button ───────────────────────────────────────────────────────────
const tab = read('components/admin/TeamsTab.tsx')
if (!/function DeleteTeam\(/.test(tab)) bad('TeamsTab has no DeleteTeam control')
if (!/onDept\('delete_org'/.test(tab)) bad('the Delete team button does not call delete_org')
const del = tab.slice(tab.indexOf('function DeleteTeam('), tab.indexOf('function SuspendControl('))
if (!/confirm\(/.test(del)) bad('Delete team does not ask first')
if (!/disabled=\{busy \|\| !!reason\}/.test(del) || !/org\.cardsCreated > 0/.test(del)) bad('Delete team is not greyed for a team with cards')

if (fail) { console.error(`check-team-delete: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-team-delete: ok')
