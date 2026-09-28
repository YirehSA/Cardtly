// One trial per account.
//
// WHY. Until 2026-09-28 the only limit on trial codes was one CODE per
// account, so an account whose ordinary 7-day trial had run out could enter a
// code and start 30 fresh days. The upgrade page - the screen every account
// lands on when its card goes offline - offered a code box whose placeholder
// was CARDTLY30, a live, unlimited 30-day code. A founder-offer customer used
// it the morning their free period ended.
//
// WHAT THIS HOLDS:
//   1. The claim endpoint refuses an account whose trial has ended, and one
//      that has ever had a subscription row, BEFORE it grants anything, and
//      fails closed if it cannot check.
//   2. The code box never shows something that looks like a real code.
//   3. The upgrade page only offers the box during a running trial.
//
// Run: node scripts/check-trial-codes.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The claim endpoint ───────────────────────────────────────────────────
const claim = read('app/api/trial-code/claim/route.ts')
const iGrant = claim.indexOf(".update({ trial_ends_at: endsAt")
const iEnded = claim.search(/trialEndsMs <= Date\.now\(\)/)
const iSubs = claim.search(/from\('whop_subscriptions'\)/)
if (iGrant < 0) bad('could not find where the claim endpoint grants the trial; update this guard.')
if (iEnded < 0) bad('the claim endpoint no longer refuses an account whose trial has already ended, so a code starts a second trial.')
else if (iEnded > iGrant) bad('the claim endpoint grants the trial before checking whether the account\'s trial has ended.')
if (iSubs < 0) bad('the claim endpoint no longer refuses an account that has had a subscription, so a lapsed payer can take a free trial.')
else if (iSubs > iGrant) bad('the claim endpoint grants the trial before checking for a past subscription.')
if (!/if \(subErr\)\s*\{[\s\S]{0,300}status: 500/.test(claim)) {
  bad('the claim endpoint no longer fails closed when it cannot read subscriptions, so a read error would grant a trial.')
}

// ── 2. The box never shows a code ───────────────────────────────────────────
const box = read('components/upgrade/TrialCodeBox.tsx')
const placeholder = box.match(/placeholder="([^"]*)"/)?.[1]
if (placeholder === undefined) bad('could not find the code box placeholder; update this guard.')
else if (/^[A-Z0-9-]{3,}$/.test(placeholder)) {
  bad(`the trial code box placeholder is "${placeholder}", which looks like a code - and CARDTLY30, the last one, was a live one. Use words ("Enter your code").`)
}

// ── 3. Only during a trial ──────────────────────────────────────────────────
const view = read('components/upgrade/UpgradeView.tsx')
const boxAt = [...view.matchAll(/<TrialCodeBox\b/g)].map(m => m.index)
if (boxAt.length === 0) {
  // Not offered at all is also fine; nothing to check.
} else if (boxAt.some(i => !/state === 'trial' &&\s*$/.test(view.slice(Math.max(0, i - 40), i)))) {
  bad('the upgrade page offers the trial code box outside a running trial. Once the trial has ended a code cannot be used, and offering one is how a second trial got handed out.')
}

if (fail) {
  console.error(`\ncheck-trial-codes: ${fail} failure(s).`)
  process.exit(1)
}
console.log('check-trial-codes: a code cannot start a second trial (ended trial or past subscription, checked before the grant, failing closed), the code box shows no real code, and it is only offered during a trial.')
