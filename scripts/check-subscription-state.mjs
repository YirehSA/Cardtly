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

// paystackCancellation: what a Paystack cancellation webhook does to the row.
const PAID = { status: 'active', plan_id: 'paystack_monthly', billing_cycle: 'monthly',
  created_at: '2026-09-13T08:00:00Z', metadata: { paid_at: '2026-09-13T08:00:00Z' }, cancel_at: null }
const pc = (kind, ev, row, others = []) => {
  const d = M.paystackCancellation(kind, ev, row, others, NOW)
  return d.action === 'set' ? d.cancelAt : 'ignore'
}
const webhookCases = [
  ['not_renew arrives with no next date: ends a month after the last payment',
    pc('not_renew', { subscription_code: 'SUB_a', next_payment_date: null }, PAID), iso('2026-10-13T08:00:00Z')],
  ['not_renew after our own cancel route recorded the date: leaves it alone',
    pc('not_renew', { subscription_code: 'SUB_a' }, { ...PAID, cancel_at: '2026-10-10T00:00:00Z' }), 'ignore'],
  ['disable on the payment date: ends now',
    pc('disable', { subscription_code: 'SUB_a', next_payment_date: NOW.toISOString() }, PAID), NOW.toISOString()],
  ['disable when our date is later than Paystack\'s: brought in to Paystack\'s',
    pc('disable', { subscription_code: 'SUB_a', next_payment_date: NOW.toISOString() }, { ...PAID, cancel_at: '2026-10-13T08:00:00Z' }), NOW.toISOString()],
  ['disable never pushes an earlier date out',
    pc('disable', { subscription_code: 'SUB_a', next_payment_date: '2026-10-20T00:00:00Z' }, { ...PAID, cancel_at: '2026-10-01T00:00:00Z' }), 'ignore'],
  ['cancelled and subscribed again: the old subscription\'s event is ignored while Paystack bills the new one',
    pc('disable', { subscription_code: 'SUB_old', next_payment_date: NOW.toISOString() }, PAID, ['SUB_new']), 'ignore'],
  ['row stores a different subscription code: ignored',
    pc('not_renew', { subscription_code: 'SUB_old' }, { ...PAID, metadata: { ...PAID.metadata, paystack_subscription_code: 'SUB_new' } }), 'ignore'],
  ['comped row, even on a Paystack plan id: ignored',
    pc('not_renew', { subscription_code: 'SUB_a' }, { ...PAID, metadata: { ...PAID.metadata, comped: true } }), 'ignore'],
  ['comp billing cycle, even on a Paystack plan id: ignored',
    pc('not_renew', { subscription_code: 'SUB_a' }, { ...PAID, billing_cycle: 'comp' }), 'ignore'],
  ['team or invoiced row: ignored', pc('not_renew', { subscription_code: 'SUB_a' }, { ...PAID, plan_id: 'pro_team' }), 'ignore'],
  ['already cancelled row: ignored', pc('disable', { subscription_code: 'SUB_a' }, { ...PAID, status: 'cancelled' }), 'ignore'],
  ['no row: ignored', pc('not_renew', { subscription_code: 'SUB_a' }, null), 'ignore'],
]
for (const [what, got, want] of webhookCases) {
  if (got !== want) bad(`paystackCancellation - ${what}: got ${got}, expected ${want}`)
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
  // A bulk reader (the reminder cron reads every row at once) cannot use the
  // per-user helper; it passes if its own select carries cancel_at, which is
  // the thing this rule exists to protect.
  // '*' counts too: the cancel route reads the whole row, and tests for the
  // column itself before acting.
  const bulkWithCancelAt = /from\('whop_subscriptions'\)\s*\.select\('(\*|[^']*\bcancel_at\b[^']*)'\)/.test(src)
  if (!/latestSubscriptionFor\(/.test(src) && !bulkWithCancelAt) {
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
  // A failing subscription has no paid period left, only the grace window, so
  // its end date is the grace end - never Paystack's next retry a month out.
  if (!/grace\.isPastDue\s*\?\s*\(grace\.graceEndsAt/.test(route)) {
    bad('the cancel route no longer ends a past_due subscription at its grace end. Paystack\'s next_payment_date for a failing subscription is the next RETRY, so the confirmation would promise a card live for weeks after it goes offline.')
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

// ── 5. The Paystack webhook hears cancellations, and keeps the paid period ──
const hook = read('app/api/webhooks/paystack/route.ts') || ''
if (/event\.event === 'subscription\.disabled'/.test(hook)) {
  bad("the Paystack webhook listens for 'subscription.disabled' again. Paystack sends 'subscription.disable'; the misspelt name never fires, and a cancellation made at Paystack leaves the customer on Pro forever.")
}
for (const ev of ['subscription.not_renew', 'subscription.disable']) {
  if (!hook.includes(`event.event === '${ev}'`)) {
    bad(`the Paystack webhook no longer handles '${ev}', so a cancellation made in the Paystack dashboard or on Paystack's manage page never reaches Cardtly.`)
  }
}
if (!/paystackCancellation\(/.test(hook) || !/findActivePaystackSubs\(/.test(hook)) {
  bad('the Paystack webhook no longer decides cancellations with paystackCancellation and a live-subscription check. Without the check, the old subscription of a customer who cancelled and subscribed again cuts off the new one.')
}
if (/status: 'cancelled'/.test(hook)) {
  bad("the Paystack webhook sets status 'cancelled' directly. That ends access on the spot and takes back the rest of a period the customer paid for; record cancel_at and let the daily cron move the status.")
}
// A renewal records its payment date. cancellationEndsAt falls back to
// paid_at + one cycle, and a row that still says "last paid in May" after
// four monthly renewals would end a cancellation on the spot.
if (!/past_due_email_sent_at: null,[\s\S]{0,700}paid_at: paid_at/.test(hook)) {
  bad('the webhook no longer records paid_at when a renewal recovers the row by email, so the cancellation fallback counts from a stale payment date.')
}
// A failed Paystack charge may only put a Paystack-billed row on the clock. On
// 2026-09-22 an old subscription's failed retry matched a comped customer by
// email and would have taken the comp offline seven days later.
const failedAt = hook.indexOf("event.event === 'invoice.payment_failed'")
const failedBranch = failedAt < 0 ? '' : hook.slice(failedAt)
if (!/billedByPaystack/.test(failedBranch) || !/metadata\?\.comped/.test(failedBranch) || !/if \(sub && billedByPaystack\)/.test(failedBranch)) {
  bad("the webhook's invoice.payment_failed branch no longer checks that the matching row is billed by Paystack. A comped customer with a leftover Paystack subscription would be marked past_due and go offline after the grace window.")
}
if (!/\.eq\('created_at', row\.created_at\)/.test(hook)) {
  bad('the webhook\'s cancel_at write is no longer pinned to the row it reasoned about. A payment landing in between re-creates the row, and a customer who has just paid would be given an end date.')
}

if (fail) {
  console.error(`\ncheck-subscription-state: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-subscription-state: cancellationEndsAt passes ${cases.length} cases and paystackCancellation ${webhookCases.length}, both entitlement readers use the shared select with ` +
  'its missing-column fallback, the cancel route checks before it acts, a declined-card subscription still counts as billing, ' +
  'and the Paystack webhook hears real cancellation events without cutting a paid period short.',
)
