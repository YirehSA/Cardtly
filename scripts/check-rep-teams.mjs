// My Teams: a rep's after-sales view of the teams assigned to them.
//
// WHAT THIS PROTECTS (Andre, 2026-10-22: "I want the rep to be able to monitor
// the teams belonging to him... so if they are struggling, to reach out to
// them to see if they need help. Like an after service.")
//   1. "Needs a call" means something concrete: cards offline, nothing opened
//      in a month, a renewal date passed. A brand-new team is never flagged
//      for low numbers it has not had time to earn.
//   2. Invites, empty seats, quiet cards and an absent owner are each named,
//      with who, so the rep knows what to say.
//   3. A rep sees only their own teams (organizations.rep_id), an inactive
//      rep sees none, and every rep's teams at once is for admins only.
//   4. No prices: reps quote, they do not see the books.
//
// Run: node scripts/check-rep-teams.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const out = mkdtempSync(join(tmpdir(), 'rep-teams-'))
let H
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/rep-teams.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  H = await import(pathToFileURL(join(out, 'rep-teams.mjs')).href)
} catch (e) {
  console.error('check-rep-teams: could not compile lib/rep-teams')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const NOW = new Date('2026-10-22T10:00:00')
const ago = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const ahead = (d) => new Date(NOW.getTime() + d * 86_400_000).toISOString().slice(0, 10)
const card = (o = {}) => ({
  id: Math.random().toString(36).slice(2), name: 'Lee Smith', isActive: true, userId: 'u1', inviteEmail: null,
  inviteSentAt: ago(50), claimedAt: ago(48), createdAt: ago(55), hasPhoto: true, opens: 12, saves: 2, leads: 1,
  lastOpenAt: ago(1), ...o,
})
const team = (o = {}) => ({
  createdAt: ago(60), live: true, suspended: false, billingPeriod: 'prepaid', paidUntil: ahead(200), trialEndsAt: null,
  maxSeats: 3, ownerSignedInAt: ago(2), cards: [card(), card({ name: 'Sam Jones' }), card({ name: 'Pat Lee' })], ...o,
})
const run = (o) => H.teamHealth(team(o), NOW)
const has = (h, tone, re) => h.flags.some(f => f.tone === tone && re.test(f.text))

// ── 1. What earns a call ────────────────────────────────────────────────────
{
  const h = run({})
  if (h.tone !== 'green') bad(`a live team with every card taken up and opened is "${h.tone}", not doing well: ${JSON.stringify(h.flags)}`)
  if (h.numbers.opens !== 36 || h.numbers.accepted !== 3 || h.numbers.leads !== 3) bad(`the numbers are wrong: ${JSON.stringify(h.numbers)}`)
}
{
  const h = run({ live: false, paidUntil: null })
  if (h.tone !== 'red' || !has(h, 'red', /invoice has not been paid/)) bad('a prepaid team waiting for its first payment is not flagged as offline')
}
if (!has(run({ suspended: true }), 'red', /Suspended/)) bad('a suspended team is not flagged')
{
  const quiet = [card({ opens: 0, lastOpenAt: null }), card({ name: 'Sam Jones', opens: 0, lastOpenAt: null })]
  const h = run({ maxSeats: 2, cards: quiet })
  if (h.tone !== 'red' || !has(h, 'red', /None of their cards has been opened/)) bad('a settled team whose cards are never opened is not "needs a call"')
  const young = run({ createdAt: ago(5), maxSeats: 2, cards: quiet.map(c => ({ ...c, createdAt: ago(5) })) })
  if (young.flags.some(f => /opened/.test(f.text))) bad('a team set up 5 days ago is flagged for cards not being opened')
}
{
  const h = run({ cards: [card(), card({ name: 'New Starter', opens: 0, lastOpenAt: null, createdAt: ago(4) }), card({ name: 'Old Quiet', opens: 0, lastOpenAt: null })] })
  if (!has(h, 'amber', /1 of 2 cards not opened in 30 days: Old Quiet/)) bad(`a quiet card is not named, or a card made 4 days ago was judged: ${JSON.stringify(h.flags)}`)
}
if (!has(run({ paidUntil: ahead(-3) }), 'red', /which has passed/)) bad('a prepaid date that has passed is not flagged')
if (!has(run({ paidUntil: ahead(12) }), 'amber', /12 days away/)) bad('a prepaid date 12 days away is not flagged for renewal')
if (run({ paidUntil: ahead(90) }).flags.some(f => /Paid up to/.test(f.text))) bad('a prepaid date 90 days away is flagged')
if (!has(run({ billingPeriod: 'trial', paidUntil: null, trialEndsAt: ago(2) }), 'red', /trial ended/)) bad('a lapsed trial is not flagged')

// ── 2. Slipping, named ──────────────────────────────────────────────────────
{
  const h = run({ maxSeats: 4, cards: [card(), card({ name: 'Sam Jones' }), card({ name: 'Pat Lee' }),
    card({ name: 'Jo Late', userId: null, claimedAt: null, inviteSentAt: ago(10), opens: 0, lastOpenAt: null })] })
  if (!has(h, 'amber', /1 invite not accepted after a week: Jo Late/)) bad(`an invite waiting 10 days is not named: ${JSON.stringify(h.flags)}`)
  if (h.numbers.waiting !== 1 || h.numbers.accepted !== 3) bad('the invite counts are wrong')
}
{
  const h = run({ maxSeats: 4, cards: [card(), card({ name: 'Sam Jones' }), card({ name: 'Pat Lee' }),
    card({ name: 'Jo New', userId: null, claimedAt: null, inviteSentAt: ago(2), createdAt: ago(2), opens: 0, lastOpenAt: null })] })
  if (h.tone !== 'green' || !has(h, 'blue', /sent this week/)) bad('an invite sent 2 days ago is treated as a problem')
}
if (!has(run({ maxSeats: 10 }), 'amber', /7 of 10 seats not used yet/)) bad('empty seats are not flagged')
if (run({ createdAt: ago(3), maxSeats: 10, cards: [card({ createdAt: ago(3) })] }).flags.some(f => /seats not used/.test(f.text))) bad('a 3-day-old team is flagged for empty seats')
if (!has(run({ ownerSignedInAt: ago(45) }), 'amber', /last signed in 45 days ago/)) bad('an owner away 45 days is not flagged')
if (!has(run({ ownerSignedInAt: null }), 'amber', /never signed in/)) bad('an owner who never signed in is not flagged')
{
  const h = run({ maxSeats: 0, cards: [], createdAt: ago(6) })
  if (!has(h, 'red', /No cards made yet, 6 days/)) bad('a week-old team with no cards is not flagged')
  if (run({ maxSeats: 5, cards: [], createdAt: ago(1) }).tone !== 'green') bad('a team set up yesterday is flagged for having no cards yet')
}
if (!has(run({ cards: [card(), card({ name: 'Sam Jones' }), card({ name: 'No Face', hasPhoto: false })] }), 'blue', /without a photo: No Face/)) bad('a card without a photo is not mentioned')
{
  const h = run({ live: false, paidUntil: null, ownerSignedInAt: null, cards: [card({ hasPhoto: false })], maxSeats: 3 })
  const order = h.flags.map(f => f.tone)
  const rank = { red: 0, amber: 1, blue: 2 }
  if (order.some((t, i) => i && rank[order[i - 1]] > rank[t])) bad(`flags are not worst first: ${order.join(',')}`)
}
if (H.cardStatus({ userId: 'u', claimedAt: null, inviteSentAt: null }) !== 'accepted') bad('a card with a login is not accepted')
if (H.cardStatus({ userId: null, claimedAt: null, inviteSentAt: ago(1) }) !== 'waiting') bad('an invited card is not waiting')
if (H.cardStatus({ userId: null, claimedAt: null, inviteSentAt: null }) !== 'not_invited') bad('a card nobody was invited to is not "run by the owner"')

// ── 3. Who sees what ────────────────────────────────────────────────────────
const server = read('lib/rep-teams-server.ts')
if (!/repId \? q\.eq\('rep_id', repId\) : q\.not\('rep_id', 'is', null\)/.test(server)) bad('the teams query is no longer scoped to the rep')
if (/from\('(invoices|quotes|billing_payments|billing_receipts)'\)/.test(server)) bad('My Teams reads the books')
const page = read('app/dashboard/my-teams/page.tsx')
if (!/if \(!admin && !rep\) redirect\('\/dashboard'\)/.test(page)) bad('My Teams no longer sends a non-rep away')
if (!/if \(!rep\.active\)[\s\S]{0,120}teams=\{\[\]\}/.test(page)) bad('an inactive rep would still see client teams')
if (!/if \(admin && asked\)/.test(page)) bad('another rep\'s teams (?rep=) are no longer admin only')
if (/loadRepTeams\(db, null\)/.test(page)) bad('a call reads every rep\'s teams without checking for an admin')
const lastLoad = page.slice(page.lastIndexOf('loadRepTeams('))
if (!/repId\)/.test(lastLoad)) bad('My Teams does not load by the resolved rep id')

// ── 4. No prices ────────────────────────────────────────────────────────────
const screen = read('components/rep/RepTeams.tsx')
if (!screen) bad('components/rep/RepTeams.tsx is missing')
if (/randFmt|orgMonthlyRand|SEAT_PRICE|formatMoney|randCents/.test(screen)) bad('My Teams shows prices')
for (const f of ['components/dashboard/Sidebar.tsx', 'components/dashboard/MobileBottomNav.tsx']) {
  if (!/isRep \? \[MY_TEAMS_TAB, /.test(read(f))) bad(`${f} no longer offers My Teams to reps`)
}
if (!/\/dashboard\/my-teams\?rep=\$\{r\.id\}/.test(read('components/admin/RepsTab.tsx'))) bad('Admin, Reps no longer links to what each rep sees')

if (fail) {
  console.error(`check-rep-teams: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-rep-teams: ok (calls earned by concrete problems, new teams left alone, slipping named, own teams only, no prices)')
