// Can one rep read or rewrite another's outreach log?
//
// There are two routes over the same table and they have opposite rules.
//
//   THE REP ROUTE resolves rep_id from the session and must NEVER take it from
//   the request. If it did, any rep could read or edit anyone's log by sending
//   somebody else's id - the table has RLS with no policies, so the service
//   role behind these routes is the only thing standing there.
//
//   THE ADMIN ROUTE is the opposite: an admin is looking at everyone, so
//   rep_id has to come from the request. That is safe for exactly one reason,
//   an isAdminUser check, and the id must be verified against the reps table
//   before a write so a typo cannot orphan a row.
//
// Both of those are invisible in the UI and neither shows up in a type error.
// This reads the two route files and checks the shape holds.
//
// Run: node scripts/check-rep-activity-access.mjs

import { readFileSync } from 'fs'

const REP = 'app/api/rep/activities/route.ts'
const ADMIN = 'app/api/admin/activities/route.ts'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8') } catch { bad(`${p} is missing`); return '' }
}
const rep = read(REP)
const admin = read(ADMIN)
if (!rep || !admin) { console.error('\ncheck-rep-activity-access: could not read both routes.'); process.exit(1) }

/** Source with comments removed, so a sentence in a comment cannot satisfy a
 *  check that is looking for code. This is the mistake that made an earlier
 *  guard pass while the code it described had been deleted. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const repCode = code(rep)
const adminCode = code(admin)

/**
 * Each exported handler on its own.
 *
 * Checking the FILE for getRepForUser was not enough and this guard proved it:
 * deleting the call from GET left POST's copy behind, the file still matched,
 * and a handler that resolved its rep from the request body sailed through. A
 * route is only as scoped as its least scoped handler.
 */
function handlers(src) {
  const out = {}
  const re = /export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\s*\(/g
  const starts = [...src.matchAll(re)].map(m => ({ name: m[1], at: m.index }))
  starts.forEach((h, i) => {
    out[h.name] = src.slice(h.at, i + 1 < starts.length ? starts[i + 1].at : src.length)
  })
  return out
}

// ── The rep route ─────────────────────────────────────────────────────────
{
  const hs = handlers(repCode)
  const names = Object.keys(hs)
  if (names.length === 0) bad('the rep route exports no handlers')

  for (const [name, body] of Object.entries(hs)) {
    // rep_id must come from the session, in THIS handler, before the table is
    // touched. Not somewhere else in the file.
    const resolvedAt = body.search(/getRepForUser\(/)
    if (resolvedAt < 0) {
      bad(`${name} on the rep route does not resolve the caller to a rep`)
      continue
    }
    const touchedAt = body.search(/listActivities\(|saveActivity\(|deleteActivity\(/)
    if (touchedAt >= 0 && touchedAt < resolvedAt) {
      bad(`${name} on the rep route touches the table before it knows who is asking`)
    }
  }
  if (!/repId:\s*rep\.id/.test(repCode)) bad('the rep route does not scope its writes to rep.id')

  // The one thing that must never appear: taking the rep from the request.
  const fromBody = repCode.match(/body\??\.\s*rep_id|body\[['"]rep_id['"]\]/g)
  if (fromBody) bad(`the rep route reads rep_id from the request (${fromBody.length} time(s)) - one rep could edit another's log`)

  // Reassignment is an admin power. A rep moving a row to another rep is the
  // same hole by a different name.
  if (/allowReassign/.test(repCode)) bad('the rep route can reassign rows to another rep')

  // Every read must be narrowed. listActivities with no repId returns everyone.
  const reads = [...repCode.matchAll(/listActivities\(([^)]*)\)/g)].map(m => m[1])
  if (reads.length === 0) bad('the rep route never reads the log at all')
  for (const args of reads) {
    if (!/repId:\s*rep\.id/.test(args)) bad(`a rep route read is not narrowed to their own rep: listActivities(${args.trim()})`)
  }

  // An inactive rep keeps their log but stops adding to it.
  if (!/rep\.active/.test(repCode)) bad('the rep route lets an inactive rep keep writing')
}

// ── The admin route ───────────────────────────────────────────────────────
{
  if (!/isAdminUser\(/.test(adminCode)) bad('the admin route does not check isAdminUser')

  // The gate has to run BEFORE anything is read or written, not somewhere below
  // it. Position is the check, because a gate after the work is not a gate.
  const gateAt = adminCode.search(/requireAdmin\(\)/)
  const serviceAt = adminCode.search(/serviceClient\(\)/)
  if (gateAt < 0) bad('the admin route has no admin gate')
  else if (serviceAt >= 0 && serviceAt < gateAt) {
    bad('the admin route reaches for the service client before checking it is an admin')
  }

  // rep_id comes from the request here, which is correct - but it must be
  // looked up before a write, so an unknown id is refused rather than stored.
  if (!/rep_id/.test(adminCode)) bad('the admin route never takes a rep_id, so it cannot file against a rep')
  if (!/from\(['"]reps['"]\)[\s\S]{0,120}eq\(['"]id['"],\s*repId\)/.test(adminCode)) {
    bad('the admin route does not verify the rep exists before writing')
  }
  if (!/That rep does not exist/.test(adminCode)) bad('an unknown rep id is not refused in words')

  // Every write is traceable. A rep's log is their record of their own work.
  for (const action of ['rep_activity_create', 'rep_activity_update', 'rep_activity_delete']) {
    if (!adminCode.includes(action)) bad(`admin writes are not audited as ${action}`)
  }
  const audits = (adminCode.match(/auditLog\(/g) || []).length
  if (audits < 2) bad(`only ${audits} auditLog call(s) on the admin route; a write is going unrecorded`)

  // Reassignment must be switched ON here, or an admin changing the Rep
  // dropdown silently updates nothing: the row does not carry the new id, so
  // the filter matches nothing and Postgres reports no error for that.
  if (!/allowReassign:\s*true/.test(adminCode)) {
    bad('the admin route cannot move an entry between reps, so the Rep dropdown would fail silently')
  }
}

// ── The two must not have swapped ─────────────────────────────────────────
{
  if (/isAdminUser/.test(repCode)) bad('the rep route is checking for an admin')
  if (/getRepForUser\(/.test(adminCode)) bad('the admin route resolves a single rep from the session')
}

if (fail) {
  console.error(`\ncheck-rep-activity-access: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-rep-activity-access: the rep route takes rep_id from the session and never from the ' +
  'request, narrows every read to their own rows and cannot reassign; the admin route gates on ' +
  'isAdminUser before touching the service client, verifies the rep exists before writing, audits ' +
  'every write, and can reassign.',
)
