// Fails the build if the iOS app could reach a way to pay.
//
// Apple rejected 1.0 (7) twice under Guideline 3.1.1: once for reaching a
// Paystack card form inside the app, once for the trial code box. Getting that
// back is not a bug that shows up in testing - the web keeps working perfectly,
// and the only person who finds out is App Review, weeks later.
//
// Three things are checked, in order of how quietly they fail.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const fail = []
const read = (f) => readFileSync(f, 'utf8')

// 1. The user-agent tag, which is the single point of failure for the lot.
//
// Everything else keys off recognising the app. If capacitor.config.ts and
// lib/app-platform ever disagree by one character, detection returns false for
// every request, every purchase surface comes back, and nothing looks wrong.
const platform = read('lib/app-platform.ts')
const capConfig = read('capacitor.config.ts')
const tagMatch = platform.match(/IOS_APP_UA_TAG\s*=\s*'([^']+)'/)
if (!tagMatch) {
  fail.push('lib/app-platform.ts no longer declares IOS_APP_UA_TAG, so this guard cannot check anything.')
} else {
  const tag = tagMatch[1]
  const appended = capConfig.match(/appendUserAgent:\s*'([^']+)'/)
  if (!appended) {
    fail.push(`capacitor.config.ts has no ios.appendUserAgent. Without it the app is indistinguishable from Safari and every purchase surface returns. Expected '${tag}'.`)
  } else if (!appended[1].includes(tag)) {
    fail.push(`The iOS user-agent tag has drifted: capacitor.config.ts appends '${appended[1]}' but lib/app-platform looks for '${tag}'. Detection would silently fail everywhere.`)
  }
}

// 2. The routes that sell must stay blocked.
const middleware = read('middleware.ts')
for (const route of ['/dashboard/upgrade', '/pricing']) {
  if (!new RegExp(`BLOCKED_IN_IOS_APP[\\s\\S]{0,200}'${route}'`).test(middleware)) {
    fail.push(`${route} is not in BLOCKED_IN_IOS_APP in middleware.ts. It has to be unreachable in the iOS app, not merely unlinked.`)
  }
}

// 3. Nothing on the signed-in surface may offer to sell without knowing about
//    the iOS app.
//
// Scoped to links to /dashboard/upgrade specifically. A marketing page linking
// to /pricing is navigation into a route that rule 2 already blocks, and the
// reviewer was signed in when they found the checkout - the dashboard is where
// a new "Upgrade to Pro" button would actually do damage.
//
// A heuristic, not a proof: it cannot tell a correct gate from a careless one.
// It catches the real mistake, which is adding the button and never thinking
// about iOS at all.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next') continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

const SELLS = /["'`]\/dashboard\/upgrade["'`]/
const KNOWS = /iosApp|useIosApp|isIosApp|IOS_APP_UA_TAG/
// Pages that live AT a blocked route cannot render in the iOS app at all, so
// what they link to is moot.
const AT_BLOCKED_ROUTE = /^app[\\/](dashboard[\\/]upgrade|upgrade|pricing)[\\/]/

for (const file of [...walk('app'), ...walk('components')]) {
  if (AT_BLOCKED_ROUTE.test(file)) continue
  const src = read(file)
  if (!SELLS.test(src)) continue
  if (!KNOWS.test(src)) {
    fail.push(`${file.replace(/\\/g, '/')} links to /dashboard/upgrade but never checks for the iOS app. Gate it with useIosApp() (client) or isIosApp() (server).`)
  }
}

if (fail.length) {
  console.error('\ncheck-iap: the iOS app could reach a way to pay.\n')
  for (const f of fail) console.error('  - ' + f)
  console.error('\nApple rejected 1.0 (7) under Guideline 3.1.1 for exactly this. See lib/app-platform.\n')
  process.exit(1)
}

console.log('check-iap: no purchase route, price or unlock reachable from the iOS app.')
