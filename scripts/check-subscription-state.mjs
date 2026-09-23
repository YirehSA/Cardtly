// Self-service cancellation keeps its promise, and the dashboard and the public
// card agree about who is paid up.
//
// WHAT THIS PROTECTS. The Terms say a cancellation "takes effect at the end of
// the period you have paid for", and that the card "stays live until then".
// Three things make that true, and each fails silently if it drifts:
//
//   1. cancellationEndsAt finds the right date. Wrong one way and a customer
//      loses days they paid for; wrong the other way and they get Pro free.
//   2. Both readers of the entitlement - the dashboard (getUserPlan) and the
//      public card page - get their row from latestSubscriptionFor, so both see
//      cancel_at. One hand-written select without it and the public card keeps
//      serving a cancelled subscription forever while the dashboard says it
//      stopped - the exact drift subscriptionState was created to prevent.
//   3. The cancel route checks it can record the date BEFORE it stops the
//      billing. Reversed, a missing column turns into a subscription Paystack
//      no longer charges and Cardtly still serves, indefinitely.
//
// Run: node scripts/check-subscription-state.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

// ── 1. cancellationEndsAt, actually run ─────────────────────────────────────
//
// Compiled with the project's own tsc into a temp folder and imported, the same
// way check-billing-maths does it, so this runs on whatever Node the build has.
const out = mkdtempSync(join(tmpdir(), 'cancel-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/subscription-cancel.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' },
  )
  renameSync(join(out, 'subscription-cancel.js'), join(out, 'subscription-cancel.mjs'))
  M = await import(pathToFileURL(join(out, 'subscription-cancel.mjs')).href)
} catch (e) {
  console.error('check-subscription-state: could not compile lib/subscription-cancel.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const NOW = new Date('2026-09-23T10:00:00Z')
const iso = (s) => new Date(s).toISOString()
const cases = [
  ['Paystack next date wins',
    M.cancellationEndsAt({ billing_cycle: 'monthly', created_at: '2026-09-10T00:00:00Z' }, ['2026-10-10T00:00:00Z'], NOW),
    iso('2026-10-10T00:00:00Z')],
  ['several Paystack dates: the latest, so a data fault never costs the customer days',
    M.cancellationEndsAt({}, ['2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z'], NOW),
    iso('2026-10-15T00:00:00Z')],
  ['no Paystack date: last payment plus one month',
    M.cancellationEndsAt({ billing_cycle: 'monthly', metadata: { paid_at: '2026-09-13T08:00:00Z' } }, [], NOW),
    iso('2026-10-13T08:00:00Z')],
  ['annual cycle: plus twelve months',
    M.cancellationEndsAt({ billing_cycle: 'annually', metadata: { paid_at: '2026-03-01T00:00:00Z' } }, [], NOW),
    iso('2027-03-01T00:00:00Z')],
  ['no paid_at: created_at, because the row is re-created on every charge',
    M.cancellationEndsAt({ billing_cycle: 'monthly', created_at: '2026-09-20T00:00:00Z' }, [null], NOW),
    iso('2026-10-20T00:00:00Z')],
  ['declined renewal (next date in the past): ends now, never backdated',
    M.cancellationEndsAt({ billing_cycle: 'monthly' }, ['2026-09-01T00:00:00Z'], NOW),
    NOW.toISOString()],
  ['garbage dates are ignored rather than obeyed',
    M.cancellationEndsAt({ billing_cycle: 'monthly', metadata: { paid_at: '2026-09-13T08:00:00Z' } }, ['not a date', ''], NOW),
    iso('2026-10-13T08:00:00Z')],
]
for (const [what, got, want] of cases) {
  if (got !== want) bad(`cancellationEndsAt - ${what}: got ${got}, expected ${want}`)
}

// ── 2. Both readers of the entitlement use the shared select ────────────────
function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(p)) acc.push(p.split('\\').join('/'))
  }
  return acc
}
const callers = walk('app').concat(walk('lib')).concat(walk('components'))
  .filter(f => /\bsubscriptionState\(/.test(read(f) || '') && !/export function subscriptionState/.test(read(f) || ''))
  .concat(['lib/plan-server.ts']) // getUserPlan calls it from the defining file
if (callers.length < 2) bad('found fewer than two readers of subscriptionState; the dashboard and the public card page should both be here.')
for (const f of new Set(callers)) {
  const src = read(f) || ''
  if (!/latestSubscriptionFor\(/.test(src)) {
    bad(`${f} decides entitlement with subscriptionState but does not get its row from latestSubscriptionFor. A hand-written select that omits cancel_at makes this reader keep serving a cancelled subscription while the other one has stopped.`)
  }
}

const plan = read('lib/plan-server.ts') || ''
const latest = plan.match(/export async function latestSubscriptionFor[\s\S]*?\n\}/)?.[0] || ''
if (!latest) bad('lib/plan-server.ts no longer exports latestSubscriptionFor.')
else {
  if (!/cancel_at/.test(latest)) bad('latestSubscriptionFor no longer selects cancel_at, so no reader can see a cancellation.')
  if (!/isMissingColumn\(error\)/.test(latest)) bad('latestSubscriptionFor has lost its fallback for a missing cancel_at column. Without it, a deploy that lands before migration 090 reads every paying customer as unpaid and takes their cards offline.')
}
// Sliced to the NEXT DECLARATION, not the first "\n}": the parameter is a
// multi-line object type, and its closing "} | null)" sits in column zero, so
// a brace-based slice stops at the end of the signature and reports that the
// body does something it never looked at.
const stateStart = plan.indexOf('export function subscriptionState')
const stateEnd = plan.indexOf('\nfunction baseSubscriptionState', stateStart)
const state = stateStart < 0 ? '' : plan.slice(stateStart, stateEnd < 0 ? undefined : stateEnd)
if (!/cancel_at/.test(state) || !/endsMs > Date\.now\(\)/.test(state)) {
  bad('subscriptionState no longer stops serving once cancel_at has passed. A cancelled subscription would then serve forever.')
}

// ── 3. The cancel route checks before it acts ───────────────────────────────
const route = read('app/api/account/cancel-subscription/route.ts')
if (!route) bad('app/api/account/cancel-subscription/route.ts is missing, but the terms promise self-service cancellation.')
else {
  const at = (re) => { const m = route.match(re); return m ? m.index : -1 }
  const canRecord = at(/'cancel_at' in row/)
  const readDate = at(/findActivePaystackSubs\(/)
  const disable = at(/cancelSubscriptionsFor\(/)
  const write = at(/\.update\(\{ cancel_at/)
  if ([canRecord, readDate, disable, write].some(i => i < 0)) {
    bad('the cancel route is missing one of its four steps: check cancel_at can be recorded, read the paid-to date, disable at Paystack, record cancel_at.')
  } else if (!(canRecord < readDate && readDate < disable && disable < write)) {
    bad('the cancel route does its steps out of order. It must confirm it can record the date, then read the paid-to date while Paystack still has it, then disable, then record. Disabling first can leave a subscription that nobody bills and Cardtly serves forever.')
  }
  if (!/row\.seats && row\.seats > 1/.test(route)) {
    bad('the cancel route no longer refuses team-seat subscriptions. Those cover other people\'s cards and are cancelled by hand.')
  }
}

// ── 4. The loose ends ───────────────────────────────────────────────────────
const cron = read('app/api/cron/trial-reminders/route.ts') || ''
if (!/expireCancelledSubscriptions\(admin\)/.test(cron)) {
  bad('the daily cron no longer runs expireCancelledSubscriptions, so cancelled rows stay "active" for every reader except subscriptionState.')
}
const expiry = read('lib/subscription-expiry.ts') || ''
if ((expiry.match(/\.lte\('cancel_at', now\)/g) || []).length < 2) {
  bad('lib/subscription-expiry.ts no longer re-checks cancel_at in the UPDATE itself. A payment landing between the read and the write re-creates the row, and that customer - who has just paid - would be cancelled on a stale read.')
}
const paystack = read('lib/paystack.ts') || ''
if (!/STILL_BILLING = new Set\(\[[^\]]*'attention'/.test(paystack)) {
  bad("lib/paystack.ts no longer treats 'attention' as still billing. Paystack keeps retrying a declined charge, so a customer who cancels in that state would be charged - and silently re-subscribed - by the next retry.")
}

if (fail) {
  console.error(`\ncheck-subscription-state: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-subscription-state: cancellationEndsAt passes ${cases.length} cases, both entitlement readers use the shared select with ` +
  'its missing-column fallback, the cancel route checks before it acts, and a declined-card subscription still counts as billing.',
)
