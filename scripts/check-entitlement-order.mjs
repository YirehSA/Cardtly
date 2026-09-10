// Does a paying customer's subscription still beat their leftover trial date?
//
// THE FACT THIS PROTECTS. Subscribing does not clear the trial_ends_at an
// account was handed at signup, so every paying customer carries a stale date
// underneath. Right now ten of ten do, eight of them fall inside the next
// forty-five days, and seven share 15 September 2026 with the free batch.
//
// Nothing goes wrong because getUserPlan reads the SUBSCRIPTION FIRST and
// returns before it ever looks at the trial. That order is the only thing
// standing between those seven and a dark card on the same morning as everyone
// else, and it is an ordering inside one function: no type would catch its
// reversal, no page would look different in review, and the bill would still be
// collected while the card 404s.
//
// The same fact protects their inbox. The reminder cron excludes active
// subscribers before it decides who to email, which is why "your trial is
// ending" has never gone to somebody who is paying.
//
// Both are checked by POSITION, because both are true only in one order.
//
// Run: node scripts/check-entitlement-order.mjs

import { readFileSync } from 'fs'

const PLAN = 'lib/plan-server.ts'
const CRON = 'app/api/cron/trial-reminders/route.ts'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8') } catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so a sentence describing the rule can never satisfy a
 *  check looking for the code that implements it. That mistake has been made
 *  in this repo before. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

/** One function's body, so "before" and "after" mean something. Measuring
 *  positions across a whole file compares things in unrelated functions. */
function body(src, decl) {
  const at = src.indexOf(decl)
  if (at < 0) return null
  const rest = src.slice(at + decl.length)
  const next = rest.search(/\nexport (async )?function |\nexport const /)
  return rest.slice(0, next < 0 ? rest.length : next)
}

// ── getUserPlan: subscription before trial ────────────────────────────────
{
  const src = code(read(PLAN))
  const fn = body(src, 'export async function getUserPlan')

  if (!fn) {
    bad('getUserPlan is gone from lib/plan-server.ts, or was renamed')
  } else {
    const iSub = fn.indexOf("from('whop_subscriptions')")
    const iState = fn.indexOf('subscriptionState(')
    const iServes = fn.indexOf('state.serves')
    const iTrial = fn.indexOf('trial_ends_at')

    if (iSub < 0) bad('getUserPlan never reads whop_subscriptions')
    if (iState < 0) bad('getUserPlan does not go through subscriptionState, so the dashboard and the public card page can drift on who is paid up')
    if (iServes < 0) bad('getUserPlan never tests state.serves')

    // The early return itself: it has to BE a return, and it has to say the
    // account is not trialing. A branch that fell through, or one that returned
    // isTrial:true, would put trial warnings in front of a paying customer.
    const guard = fn.indexOf('if (state.serves)')
    if (guard < 0) {
      bad('there is no `if (state.serves)` branch in getUserPlan')
    } else {
      const block = fn.slice(guard, guard + 420)
      if (!/\breturn\b/.test(block)) bad('the state.serves branch does not return, so execution carries on into the trial')
      if (!/tier:\s*'pro'/.test(block)) bad('the state.serves branch does not return the pro tier')
      if (!/isTrial:\s*false/.test(block)) {
        bad('the state.serves branch does not set isTrial:false - a paying customer would be shown trial warnings')
      }
      const ret = guard + block.search(/\breturn\b/)

      // THE ORDER. The trial may be read, but only after the paid return.
      if (iTrial >= 0 && iTrial < ret) {
        bad('getUserPlan reads trial_ends_at BEFORE returning for an active subscription - a paying customer can be resolved as a trialist')
      }
      if (iSub >= 0 && iSub > ret) {
        bad('getUserPlan returns for a subscription it has not read yet')
      }
    }
  }
}

// ── subscriptionState: what actually counts as serving ────────────────────
{
  const src = code(read(PLAN))
  const fn = body(src, 'export function subscriptionState')
  if (!fn) {
    bad('subscriptionState is gone, or was renamed')
  } else {
    if (!/subscription_tier\s*!==\s*'pro'/.test(fn)) bad('subscriptionState no longer requires the pro tier')
    if (!/status\s*===\s*'active'/.test(fn)) bad('subscriptionState no longer treats an active subscription as serving')
    if (!/status\s*===\s*'past_due'/.test(fn)) {
      bad('subscriptionState no longer has a past_due branch, so one failed payment cuts a card off immediately')
    }
  }
}

// ── The reminder cron: never tell a payer their trial is ending ───────────
{
  const src = code(read(CRON))

  // The set has to be built from ACTIVE subscriptions. Built from all of them
  // it would also excuse cancelled accounts, which do need the warning.
  if (!/from\('whop_subscriptions'\)[\s\S]{0,120}eq\('status',\s*'active'\)/.test(src)) {
    bad('the cron does not build its paid set from active subscriptions')
  }

  // EVERY loop, not the first one. This file has two passes over profiles - the
  // trial reminders and the card-live note - and both send mail, so both need
  // the same two exclusions. Checking from the first loop to the end of the
  // file was not enough and this guard proved it: deleting the team-member skip
  // out of one pass still left the other pass's copy for a file-wide search to
  // find, and the mutation went through unnoticed.
  const starts = [...src.matchAll(/for \(const p of/g)].map(m => m.index)
  if (starts.length === 0) {
    bad('the cron no longer loops over profiles')
  }
  starts.forEach((start, n) => {
    const loop = src.slice(start, n + 1 < starts.length ? starts[n + 1] : src.length)
    const where = `the cron's ${n === 0 ? 'first' : `#${n + 1}`} pass over profiles`

    const iPaid = loop.search(/if\s*\(paid\.has\([^)]*\)\)\s*continue/)
    const iTeam = loop.search(/if\s*\(teamMembers\.has\([^)]*\)\)\s*continue/)
    const iQueue = loop.indexOf('queue.push')

    if (iQueue < 0) return // not a sending loop; nothing to exclude anyone from

    if (iPaid < 0) bad(`${where} does not skip paying users, so a customer who is paying can be emailed about their trial`)
    else if (iPaid > iQueue) bad(`${where} queues an email before it checks whether the user is paying`)

    if (iTeam < 0) bad(`${where} does not skip team members, whose card is served by their organisation`)
    else if (iTeam > iQueue) bad(`${where} queues an email before it checks whether the user is on a team`)

    // The trial pass also decides WHICH reminder to send. Skipping after that
    // decision is later than it looks, so it is checked separately.
    const iKind = loop.indexOf("kind = 'trial")
    if (iKind >= 0 && iPaid >= 0 && iPaid > iKind) {
      bad(`${where} chooses which reminder to send before it checks whether the user is paying`)
    }
  })
}

if (fail) {
  console.error(`\ncheck-entitlement-order: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-entitlement-order: getUserPlan reads the subscription and returns pro with isTrial:false ' +
  'before it ever looks at trial_ends_at, subscriptionState still honours active and past_due, and ' +
  'the reminder cron drops paying users and team members before it decides who to email.',
)
