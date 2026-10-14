// Filing a team card under a department keeps its link.
//
// WHAT THIS PROTECTS (2026-10-14): RTB Project Enterprises had three cards at
// the top of the team, NFC cards already printed, and needed them under their
// company Life 360 Health. Moving a card must change which department it sits
// in and nothing else, because /card/<slug> is printed on NFC cards and in QR
// codes. Re-inviting them from the company page would have made new cards on
// new links.
//
//   1. Every move writes department_id and only department_id: no slug, no
//      slug_person, no claim, no brand.
//   2. The owner's move refuses a company and another team's department.
//   3. The Team Cards picker offers departments only and goes through that
//      move.
//
// Run: node scripts/check-card-placement.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const block = (src, start, len = 3000) => { const i = src.indexOf(start); return i < 0 ? '' : src.slice(i, i + len) }

// ── 1. A move writes department_id alone ────────────────────────────────────
const dept = read('app/api/department/route.ts')
const owner = block(dept, "if (action === 'move_card')", 2600)
if (!owner) bad("app/api/department has no move_card action")
const adminRoute = read('app/api/admin/route.ts')
const admin = block(adminRoute, "if (action === 'move_card_to_department')", 900)
if (!admin) bad("app/api/admin has no move_card_to_department action")
for (const [where, src] of [['the owner move', owner], ['the admin move', admin]]) {
  const updates = [...src.matchAll(/\.from\('team_cards'\)[\s\S]{0,40}?\.update\(\{([^}]*)\}\)/g)].map(m => m[1].trim())
  if (updates.length !== 1) bad(`${where} should write team_cards exactly once, found ${updates.length}`)
  for (const u of updates) {
    const keys = u.split(',').map(s => s.split(':')[0].trim()).filter(Boolean)
    if (keys.join() !== 'department_id') bad(`${where} writes ${keys.join(', ')}: a move may change department_id only, or a printed link breaks`)
  }
}

// ── 2. The owner's move refuses a company and another team ──────────────────
if (!/target\.organization_id !== loc\.organizationId/.test(owner)) bad('move_card must refuse a department from another team')
if (!/target\.kind === 'company'/.test(owner)) bad('move_card must refuse a company: a card lives in a department')
if (!/canManageDepartment\(admin, user\.id, to_department_id\)/.test(owner)) bad('move_card must check the caller manages the target department')
if (!/isOrgOwner\(admin, user\.id, loc\.organizationId\)/.test(owner)) bad('only the owner may move a card that sits at the top of the team')

// ── 3. The Team Cards picker ────────────────────────────────────────────────
const dash = read('components/team/TeamDashboard.tsx')
if (!/const placeTargets = importTargets\.filter\(d => d\.kind !== 'company'\)/.test(dash)) bad('the Team Cards picker must offer departments only, never a company')
const move = block(dash, 'async function moveCard(', 1400)
if (!/action: 'move_card', team_card_id: card\.id, to_department_id: toDept/.test(move)) bad('the Team Cards picker must move through /api/department move_card')
if (!/onChange=\{e => moveCard\(card, e\.target\.value \|\| null\)\}/.test(dash)) bad('the department select is not wired to moveCard')

if (fail) {
  console.error(`check-card-placement: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-card-placement: ok (a move writes department_id only so printed links survive; owner move refuses companies and other teams; Team Cards picker offers departments only)')
