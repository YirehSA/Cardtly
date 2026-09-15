// Admin status is decided in ONE place, and the command palette is not it.
//
// WHAT THIS EXISTS BECAUSE OF. CommandPalette.tsx used to answer "is this an
// admin" by comparing the signed-in user against a hardcoded founder user id,
// under a comment claiming it was "the admin user ID from the existing admin
// gate". That was true when it was written and stopped being true the day
// profiles.is_admin arrived. The real gate, lib/admin-check.ts, grants admin
// to the founder id OR any profile flagged is_admin - so three genuine admins
// could open /admin and call every admin API while the palette quietly hid the
// admin command from them.
//
// Nothing failed. No type complained. The component looked correct in review,
// because a hardcoded uuid with a confident comment next to it reads exactly
// like a deliberate decision. That is the shape of drift this guard is for.
//
// DELIBERATELY NARROW. This is not static analysis of the whole codebase. It
// checks one file for one mistake: deciding admin locally instead of being
// told. lib/admin-check.ts is expected to contain the founder id - that is
// where it belongs - and is not checked here.
//
// Run: node scripts/check-admin-auth.mjs

import { readFileSync } from 'fs'

const PALETTE = 'components/CommandPalette.tsx'
const LAYOUT = 'app/dashboard/layout.tsx'
const CHECK = 'lib/admin-check.ts'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13, 10), 'g'), String.fromCharCode(10)) }
  catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so prose describing the old mistake cannot trip a check
 *  looking for the code that makes it. The explanation above this component
 *  names the founder id problem on purpose. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(String.fromCharCode(10)).map(l => l.replace(/\/\/.*$/, '')).join(String.fromCharCode(10))

const palette = code(read(PALETTE))
const layout = code(read(LAYOUT))
const checkModule = read(CHECK)

// The canonical rule still has to exist, or this guard is protecting nothing.
if (!/FOUNDER_ADMIN_USER_ID/.test(checkModule) || !/is_admin/.test(checkModule)) {
  bad(`${CHECK} no longer defines both the founder fallback and the is_admin lookup, so admin has stopped having one canonical rule`)
}

// 1. No admin identity decided inside the palette.
const UUID = /['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]/i
if (UUID.test(palette)) {
  bad(`${PALETTE} contains a hardcoded uuid. Admin status must be passed in from the dashboard layout, which resolves it through isAdminUser, not compared against an id here.`)
}
if (/user\??\.(id|email)\s*===/.test(palette)) {
  bad(`${PALETTE} compares the signed-in user against a literal. That is a second admin rule and it will drift from lib/admin-check.ts.`)
}
if (/is_admin/.test(palette)) {
  bad(`${PALETTE} reads is_admin directly. It should be told whether the user is an admin, not work it out.`)
}

// 2. It must actually accept the value, or someone could "fix" the above by
//    deleting the feature rather than by wiring it up.
if (!/isAdmin/.test(palette)) {
  bad(`${PALETTE} no longer references isAdmin at all, so the admin command is either gone or ungated.`)
}

// 3. And the layout must still hand it over, from the canonical helper.
if (!/<CommandPalette[^>]*isAdmin=\{isAdmin\}/.test(layout)) {
  bad(`${LAYOUT} does not pass isAdmin to CommandPalette, so the palette is back to guessing.`)
}
if (!/isAdminUser\(/.test(layout)) {
  bad(`${LAYOUT} no longer resolves admin through isAdminUser, so the value it passes around is no longer the canonical one.`)
}

if (fail) {
  console.error(`\ncheck-admin-auth: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-admin-auth: admin status is resolved once by isAdminUser in the dashboard layout and passed to the command palette, ' +
  'which decides nothing itself - no hardcoded id, no user comparison, no is_admin read.',
)
