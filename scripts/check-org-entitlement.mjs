// The dashboard and the public card answer "is this team entitled" the same way.
//
// WHAT THIS EXISTS BECAUSE OF. Both sides used to ask only whether the
// organisation was suspended. That was a deliberate choice and it was right
// about the case it was chosen for - enterprise orgs are comped, so
// business_plan_active is not a reliable signal of a real customer - but it
// could not tell a comped customer apart from an organisation that was created
// and never paid for.
//
// create_org inserts the organisation BEFORE the Paystack step, and add_card
// never checks payment. So somebody could take twenty seats, abandon the
// checkout, add twenty cards, and run the lot for nothing until a human
// noticed and suspended them. Nobody had; every organisation in the database
// at the time was business_plan_active, so the fix changed no live card.
//
// THE RULE THAT MATTERS MOST IS NOT THE LOGIC, IT IS THAT THERE IS ONE COPY.
// plan-server's own comment names the failure: "the dashboard disagreeing with
// the public page about who is entitled is precisely the drift subscriptionState
// exists to prevent." Two copies of a four-condition rule drift the first time
// one condition changes. This checks that both call orgEntitlesMembers and that
// neither has quietly gone back to deciding for itself.
//
// Run: node scripts/check-org-entitlement.mjs

import { readFileSync } from 'fs'

const RULE = 'lib/org-billing.ts'
const PLAN = 'lib/plan-server.ts'
const PUBLIC = 'components/card/TeamCardPublic.tsx'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so the explanation of the old rule cannot satisfy a
 *  check looking for the old rule. All three files describe it on purpose. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

const rule = code(read(RULE))
const plan = code(read(PLAN))
const pub = code(read(PUBLIC))

// 1. The single rule exists, and still knows all four states. Losing any one
//    of them quietly changes who is entitled.
const ruleBody = (() => {
  // SCOPED TO THE FUNCTION, not the file. Testing the whole of org-billing let
  // two mutations through: 'comp' also appears in ORG_BILLING_MODES, and
  // trial_ends_at in orgTrialDaysLeft, so deleting either line from the rule
  // still matched somewhere else in the file.
  // Sliced to the NEXT top-level function, not to the first column-zero
  // closing brace. This rule's parameter is an inline object type, so its
  // signature contains a line beginning "} | null | undefined", and the naive
  // version stopped there - capturing the signature and none of the body, so
  // every check below failed on correct source.
  const at = rule.indexOf('export function orgEntitlesMembers')
  if (at < 0) return ''
  // And started AFTER the signature. The parameter is an inline object type
  // naming all four columns, so a body-plus-signature slice matched every
  // check even with the logic deleted - three mutations walked through it.
  // What is tested has to be the statements, not the shape of the argument.
  const rest = rule.slice(at)
  const bodyAt = rest.indexOf('): boolean {')
  if (bodyAt < 0) return ''
  const body = rest.slice(bodyAt + '): boolean {'.length)
  const end = body.indexOf(LF + 'export ')
  return end < 0 ? body : body.slice(0, end)
})()

if (!ruleBody) {
  bad(`${RULE}: orgEntitlesMembers is gone, so there is no shared rule and the two callers are deciding for themselves again`)
} else {
  for (const [what, re] of [
    ['suspension', /suspended_at/],
    ['a paid plan', /business_plan_active/],
    ['comped organisations', /'comp'/],
    ['an unexpired trial', /trial_ends_at/],
  ]) {
    if (!re.test(ruleBody)) {
      bad(`${RULE}: orgEntitlesMembers no longer considers ${what}. All four states have to be told apart, or a comped customer, a trialing team and an abandoned checkout look the same again.`)
    }
  }
}

// 2. Both callers delegate.
for (const [file, src] of [[PLAN, plan], [PUBLIC, pub]]) {
  if (!/orgEntitlesMembers\(/.test(src)) {
    bad(`${file} does not call orgEntitlesMembers, so it is answering the entitlement question on its own and will drift from the other side`)
  }
}

// 3. AND NEITHER DECIDES FOR ITSELF. This is the check with teeth: a caller
//    that returns a bare suspension test has reimplemented the old rule,
//    whether or not it also imports the shared one.
if (/return\s+!!org\s*&&\s*!org\.suspended_at/.test(plan)) {
  bad(`${PLAN} decides entitlement from suspended_at alone again. That treats an organisation that never paid as a customer.`)
}
if (/isPro=\{!.*suspended_at\}/.test(pub)) {
  bad(`${PUBLIC} decides entitlement from suspended_at alone again.`)
}

// 4. The public card must still act on the answer, or the rule is decoration.
if (!/orgEntitlesMembers\(org\)\)\s*notFound\(\)/.test(pub.replace(/\s+/g, ' ').replace(/ \)/g, ')'))
    && !/!orgEntitlesMembers\(org\)/.test(pub)) {
  bad(`${PUBLIC} reads the rule but does nothing with it, so an unpaid organisation's cards would still serve`)
}

if (fail) {
  console.error(`${LF}check-org-entitlement: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-org-entitlement: one rule in lib/org-billing decides whether an organisation entitles its people, and both ' +
  'the dashboard and the public team card ask it rather than deciding for themselves - so a comped customer, a ' +
  'trialing team and an abandoned checkout stay three different things.',
)
