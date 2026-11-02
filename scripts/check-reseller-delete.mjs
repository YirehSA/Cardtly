// Deleting a reseller from admin, Resellers: only one that never had books.
//
// WHAT THIS PROTECTS (built 2026-11-02, to remove the C-Office, Yireh and
// Tinderbox test resellers):
//   1. resellerDeleteBlocker refuses a reseller with an issued invoice, any
//      money record, an NFC order paid for, or cards or a recurring schedule
//      in a client team. A never-issued invoice is one with no number that is
//      a draft or cancelled.
//   2. The route checks before it deletes and fails closed; withdraws the free
//      card and confirms it is gone before anything is deleted; deletes only
//      the client teams on the reseller's bill; deletes the reseller before
//      its paperwork; never deletes a login's account; logs it.
//   3. It is admin only: not something the programme manager can do, and the
//      button sits behind isAdmin (scripts/check-reseller-programme).
//
// Run: node scripts/check-reseller-delete.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The rules, run ───────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'reseller-delete-'))
let D
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-delete.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'reseller-delete.js'), join(out, 'reseller-delete.mjs'))
  D = await import(pathToFileURL(join(out, 'reseller-delete.mjs')).href)
} catch (e) {
  console.error('check-reseller-delete: could not compile lib/reseller-delete.ts')
  console.error(String(e?.stderr || e?.message || e))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const clean = { teamsWithCards: 0, teamsWithSchedules: 0, issuedInvoices: 0, moneyRecords: 0, liveNfcOrders: 0 }
const cases = [
  ['a reseller with nothing', clean, false],
  ['one issued invoice', { ...clean, issuedInvoices: 1 }, true],
  ['a payment or other money record', { ...clean, moneyRecords: 1 }, true],
  ['an NFC order paid for', { ...clean, liveNfcOrders: 1 }, true],
  ['a client team with cards', { ...clean, teamsWithCards: 1 }, true],
  ['a client team on a recurring schedule', { ...clean, teamsWithSchedules: 1 }, true],
]
for (const [label, facts, blocked] of cases) {
  const why = D.resellerDeleteBlocker(facts)
  if (blocked && !why) bad(`${label}: deleted, and must not be`)
  if (!blocked && why) bad(`${label}: refused (${why})`)
}
if (!/End it instead/.test(D.resellerDeleteBlocker({ ...clean, issuedInvoices: 2 }) || '')) bad('a reseller with books is not pointed at End')
const issued = [
  [{ number: null, status: 'draft' }, true], [{ number: null, status: 'cancelled' }, true],
  [{ number: 'INV-1', status: 'cancelled' }, false], [{ number: null, status: 'sent' }, false],
  [{ number: null, status: 'paid' }, false], [{ number: null, status: 'issued' }, false],
  [{ number: null, status: 'written_off' }, false],
]
for (const [inv, never] of issued) {
  if (D.neverIssued(inv) !== never) bad(`an invoice ${JSON.stringify(inv)} counts as ${never ? 'issued' : 'never issued'}`)
}
if ([...D.LIVE_NFC_STATUSES].sort().join(',') !== 'delivered,in_production,paid,shipped') bad('the NFC order states that block a delete changed')

// ── 2. The route ────────────────────────────────────────────────────────────
const route = read('app/api/admin/resellers/route.ts')
const start = route.indexOf("body.action === 'delete'")
const block = start < 0 ? '' : route.slice(start, route.indexOf("\n  if (body.action === '", start + 10))
if (!block) bad("app/api/admin/resellers/route.ts has no 'delete' action")
else {
  const at = (s) => block.indexOf(s)
  const blocker = at('resellerDeleteBlocker(facts)')
  const sync = at('syncResellerFreeCard(')
  const leftover = at('leftOver?.length')
  const teamsDel = at(".from('organizations').delete()")
  const resellerDel = at(".from('resellers').delete()")
  const invDel = at(".from('invoices').delete()")
  const clientDel = at(".from('billing_clients').delete()")
  if (blocker < 0) bad('delete does not ask resellerDeleteBlocker')
  if (!/Nothing was deleted/.test(block)) bad('delete does not fail closed when a check cannot be read')
  if (sync < 0 || leftover < 0) bad('delete does not withdraw the free card and confirm it is gone')
  for (const [name, i] of [['a client team', teamsDel], ['the reseller', resellerDel], ['the invoices', invDel], ['the billing client', clientDel]]) {
    if (i < 0) bad(`delete never removes ${name}`)
    else if (i < blocker || i < leftover) bad(`delete removes ${name} before it has checked, or before the free card is withdrawn`)
  }
  if (resellerDel > invDel) bad('delete removes the invoices before the reseller, so a failure leaves a reseller with holes in its books')
  if (!/teams\.filter\(t => t\.billing_period === 'reseller'\)/.test(block.slice(teamsDel - 600, teamsDel))) bad("delete must only delete the client teams on the reseller's bill")
  if (!/neverIssued\(i\)/.test(block)) bad('delete does not count issued invoices')
  if (!/'billing_payments'/.test(block) || !/'credit_notes'/.test(block) || !/'billing_receipts'/.test(block)) bad('delete does not check payments, credit notes and receipts')
  if (/deleteUser\(|\.from\('cards'\)\.delete|\.from\('team_cards'\)\.delete/.test(block)) bad('delete must never remove an account or a card')
  if (!/audit\('delete_reseller'/.test(block)) bad('delete is not in the audit log')
}
if (/'delete'/.test(/MANAGER_RESELLER_ACTIONS = \[([^\]]*)\]/.exec(read('lib/reseller-programme.ts'))?.[1] || '')) bad('the programme manager can delete a reseller')

// ── 3. The button ───────────────────────────────────────────────────────────
const tab = read('components/admin/ResellersTab.tsx')
const btn = tab.indexOf("patch('delete', { action: 'delete' }")
if (btn < 0) bad('admin, Resellers has no Delete reseller button')
else {
  const before = tab.slice(Math.max(0, btn - 700), btn)
  if (!/\{isAdmin && <button onClick=\{\(\) => \{\n\s*if \(!confirm\(`Delete /.test(before)) bad('Delete reseller is not admin only, or does not ask first')
}

if (fail) { console.error(`check-reseller-delete: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-reseller-delete: ok')
