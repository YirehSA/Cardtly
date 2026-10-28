// Team flows that were broken and are easy to break again.
//
// WHAT THIS PROTECTS (fixed 2026-10-28, found while mapping the app for the
// how-to videos):
//   1. getManagedDepartments passes the look columns through. They were
//      declared but left out of the copy it returns, so the departments page
//      showed every department as inheriting and unlocked, and never said
//      whose card a look follows.
//   2. Every team card insert sets slug_person. A card invited or created
//      from Departments had none, so /card/<company>/<person> was not found.
//   3. A head's Revoke works on a claimed card: it goes through the shared
//      revokeTeamCard (as the owner's does), not remove_member, which refuses
//      claimed cards. The head's page keeps revoked cards so they can be given
//      to somebody new.
//   4. A team member gets their own team card on the NFC page, to write and
//      to order.
//   5. Only a Paystack team is offered "Add seats"; an invoiced, comped or
//      trial team is not shown a price and a checkout it must not use.
//   6. Setup copy matches the app.
//
// Run: node scripts/check-team-flows.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// 1. The look columns reach the departments page.
const perms = read('lib/department-perms.ts')
const push = perms.slice(perms.indexOf('out.push({'), perms.indexOf('return out'))
for (const col of ['inherit_brand:', 'inherit_brand_locked:', 'brand_source:']) {
  if (!push.includes(col)) bad(`getManagedDepartments does not pass ${col.slice(0, -1)} through`)
}

// 2. Every insert into team_cards sets slug_person.
const walk = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []
})
let inserts = 0
for (const p of [...walk('app'), ...walk('lib')]) {
  const s = read(p)
  let i = 0
  const marker = ".from('team_cards').insert("
  while ((i = s.indexOf(marker, i)) >= 0) {
    inserts++
    const after = s.slice(i + marker.length)
    let obj
    const named = /^([A-Za-z_$][\w$]*)\)/.exec(after)
    if (named) {
      // Fields built in a variable first: read where it is declared.
      const decl = s.lastIndexOf(` ${named[1]}: Record<string, any> = {`, i) >= 0
        ? s.lastIndexOf(` ${named[1]}: Record<string, any> = {`, i)
        : s.lastIndexOf(` ${named[1]} = {`, i)
      obj = decl >= 0 ? s.slice(decl, i) : ''
    } else {
      const end = after.indexOf('})')
      obj = end > 0 ? after.slice(0, end) : after.slice(0, 1600)
    }
    if (!/slug_person/.test(obj)) {
      bad(`${p} inserts a team card without slug_person, so its /card/<company>/<person> address will not exist`)
    }
    i += marker.length
  }
}
if (inserts < 3) bad(`expected several team card inserts, found ${inserts}; this check has stopped seeing them`)

// 3. Revoke for heads.
const head = read('components/team/HeadTeamCard.tsx')
if (/action: 'remove_member'/.test(head.slice(head.indexOf('card.claimed ?'), head.indexOf(') : ('))) || !/action: 'revoke_member'/.test(head)) {
  bad('a head\'s Revoke does not call revoke_member (remove_member refuses claimed cards)')
}
if (/seat is freed|frees the seat/.test(head)) bad('the head\'s tile still says revoking frees the seat; the card keeps it for the next person')
const dept = read('app/api/department/route.ts')
const revokeBlock = dept.slice(dept.indexOf("action === 'revoke_member'"), dept.indexOf("action === 'invite_to_card'"))
if (!/canManageDepartment\(/.test(revokeBlock) || !/revokeTeamCard\(/.test(revokeBlock)) bad('revoke_member is not scoped to the head\'s departments or does not use revokeTeamCard')
if (!/revokeTeamCard\(/.test(read('app/api/team/revoke/route.ts'))) bad('the owner\'s revoke does not use the shared revokeTeamCard')
const invite = dept.slice(dept.indexOf("action === 'invite_to_card'"), dept.indexOf("action === 'remove_member'"))
if (!/canManageDepartment\(/.test(invite) || !/is_active: true/.test(invite)) bad('invite_to_card is missing the head check or does not bring a revoked card back online')
const teamPage = read('app/dashboard/team/page.tsx')
const headQuery = teamPage.slice(teamPage.indexOf("const { data: myCards } = await admin"), teamPage.indexOf('const counts = await leadCountsByCard'))
if (/is_active/.test(headQuery)) bad('the head\'s team page hides revoked cards again, so they cannot be given to anyone new')
if (!/isActive: c\.is_active !== false/.test(teamPage)) bad('the head\'s page does not tell a tile whether its card is offline')

// 4. A member's own team card on the NFC page.
const nfc = read('app/dashboard/nfc/page.tsx')
if (!/from\('team_cards'\)[\s\S]{0,120}\.eq\('user_id', user\.id\)/.test(nfc)) bad('the NFC page does not look up the person\'s own team card')
if (!/teamCards=\{orderable\}/.test(nfc)) bad('a member\'s own team card is not in the NFC order form')

// 5. Add seats only for Paystack teams.
const td = read('components/team/TeamDashboard.tsx')
if (!/const selfServe = /.test(td)) bad('TeamDashboard does not know whether a team is self-serve')
for (const m of td.matchAll(/\{tab === 'billing' && [^\n]*showAddSeats[^\n]*|\{tab === 'billing'[^\n]*\n\s*<button onClick=\{\(\) => setShowAddSeats/g)) {
  if (!/selfServe/.test(m[0])) bad('"Add seats" shows for teams that are not billed by Paystack')
}

// 6. Copy.
if (/scale to 50|Plans from', value: '5'/.test(td)) bad('team setup still says plans from 5 cards up to 50; the picker is 2 to 20')
if (/Copy one card.s look to the next/.test(td)) bad('team setup promises copying one card\'s look to the next, which Add card cannot do')
if (/it starts off/.test(read('components/team/TeamBrandPanel.tsx'))) bad('Team brand says a card\'s brand switch starts off; new cards start on')
if (!/unlink_brand_source/.test(read('components/team/TeamBrandPanel.tsx'))) bad('Team brand has no way to stop following a card')

if (fail) { console.error(`check-team-flows: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log(`check-team-flows: ok (${inserts} team card inserts set slug_person)`)
