// A field the admin can lock is a field the member's editor disables.
//
// WHAT THIS EXISTS BECAUSE OF. Locks are enforced on the server: /api/team/card/save
// runs stripLocked over the payload, so a locked column cannot be written
// whatever the browser sends. That is the security half and it holds on its own.
//
// The other half is honesty. If a lock group is added and the matching input in
// TeamCardEditor is not disabled, the admin sees the field locked, the member
// sees an ordinary editable box, types into it, presses save, and the server
// silently drops it. No error, no warning, the value simply never existed. That
// is the same defect this codebase has already been bitten by twice - the card
// editor reporting success while saving nothing, and the team preview showing an
// answer the public card disagreed with - and it is worse here because the
// person losing work is not the person who chose the lock.
//
// Only checks columns the editor writes by hand. Links, gallery images and the
// socials are rendered from slot lists in loops, where there is no literal
// update('column') to find and the loop handles locking once for the whole set.
//
// Run: node scripts/check-lock-wiring.mjs

import { readFileSync } from 'fs'

const EDITOR = 'components/team/TeamCardEditor.tsx'
const LOCKS = 'lib/team-locks.ts'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { bad(`${p} is missing`); return '' }
}

const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

const locksSrc = code(read(LOCKS))
const editor = code(read(EDITOR))

// Every plain column named in a lock group. Anything built by .flatMap over a
// slot list is skipped: those are the looped fields.
const columns = new Set()
for (const m of locksSrc.matchAll(/columns:\s*\[([^\]]*)\]/g)) {
  for (const c of m[1].matchAll(/'([a-z0-9_]+)'/g)) columns.add(c[1])
}

if (columns.size === 0) {
  bad(`${LOCKS}: no lock group columns found, so this guard is checking nothing`)
}

for (const col of [...columns].sort()) {
  // Does the editor render a hand-written input for this column?
  const writes = new RegExp(`update\\('${col}'`).test(editor)
  if (!writes) continue

  // Then it must also disable that input from the same lock.
  if (!new RegExp(`isLocked\\('${col}'\\)`).test(editor)) {
    bad(
      `${EDITOR} writes ${col} with update('${col}') but never calls isLocked('${col}'). ` +
      `An admin can lock ${col}, the member's field stays editable, and the server drops what ` +
      `they typed without telling them.`,
    )
  }
}

// And the mechanism itself has to still be there.
if (!/const isLocked = /.test(editor)) {
  bad(`${EDITOR}: isLocked is gone, so no field is disabled by a lock any more`)
}
if (!/stripLocked/.test(read('app/api/team/card/save/route.ts'))) {
  bad(`app/api/team/card/save/route.ts no longer calls stripLocked, so locks are not enforced server-side at all and the editor is the only thing stopping a write`)
}

if (fail) {
  console.error(`${LF}check-lock-wiring: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-lock-wiring: every column an admin can lock and the editor writes by hand is also disabled by that lock, ' +
  'so a member never types into a field whose value the server is going to drop.',
)
