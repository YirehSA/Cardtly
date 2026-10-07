// A team owner's own card lives in their team, as one of its seats.
//
// WHAT THIS PROTECTS (built 2026-10-07, after JETOUR Bryanston's administrator
// ended up with a personal card outside his six-seat team: a seventh card on a
// six-seat invoice, served by a 7-day signup trial instead of the team his
// company had paid for):
//   1. movePersonalCardIntoTeam, RUN against an in-memory database:
//      - the team card takes the SAME link, and the personal card is off that
//        link before the team card exists (the public route resolves personal
//        cards first, so a personal card left on it would shadow the team card)
//      - the card's contents go across; identity and personal bookkeeping do
//        not; a value the team table has no column for is reported, not lost
//      - contacts and bookings go with it; view history and redirects go
//      - it refuses someone else's card, a full team, an owner who already
//        holds a team card, and a card another move has already parked
//      - a failed insert puts the link back, so nothing has changed
//      - if anything the card collected could not be moved, the personal card
//        is kept rather than deleted
//   2. The rule is applied where the situation arises, not only from an admin
//      button: a team going live (admin create_org, a paid prepaid invoice),
//      the owner's Card page, and a first sign-in.
//   3. An owner whose own subscription serves their card is left alone, and an
//      unreadable subscription counts as paying (doing nothing is the safe
//      failure for something that rebuilds a card).
//
// Run: node scripts/check-owner-card.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The move, run ────────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'owner-card-'))
let M
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/move-card-to-team.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'move-card-to-team.js'), join(out, 'move-card-to-team.mjs'))
  M = await import(pathToFileURL(join(out, 'move-card-to-team.mjs')).href)
} catch (e) {
  console.error('check-owner-card: could not compile lib/move-card-to-team.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// The columns team_cards really has, as far as this test cares. Anything else
// offered to it is refused the way PostgREST refuses it.
const TEAM_COLUMNS = new Set([
  'id', 'organization_id', 'user_id', 'claimed_at', 'is_active', 'slug', 'slug_person',
  'name', 'title', 'email', 'phone', 'company', 'bio', 'color_theme', 'avatar_url',
  'created_at', 'updated_at',
])

// A small in-memory stand-in for the supabase-js query builder: from / select /
// eq / update / insert / delete / order / maybeSingle, thenable like the real
// one. `fail(state)` may return an error to simulate the database refusing.
function makeDb(seed, { fail: failHook } = {}) {
  const tables = JSON.parse(JSON.stringify(seed))
  const log = { personalOnSlugAtInsert: null }
  let n = 0
  const matches = (row, filters) => filters.every(([c, v]) => row[c] === v)

  function run(st) {
    const rows = tables[st.name] || (tables[st.name] = [])
    const injected = failHook?.(st, tables)
    if (injected) return { data: null, error: injected, count: null }

    if (st.op === 'select') {
      const hit = rows.filter(r => matches(r, st.filters))
      if (st.count) return { data: st.head ? null : hit, error: null, count: hit.length }
      return { data: hit.map(r => ({ ...r })), error: null }
    }
    if (st.op === 'update') {
      const hit = rows.filter(r => matches(r, st.filters))
      for (const r of hit) Object.assign(r, st.patch)
      return { data: hit.map(r => ({ ...r })), error: null }
    }
    if (st.op === 'delete') {
      tables[st.name] = rows.filter(r => !matches(r, st.filters))
      return { data: null, error: null }
    }
    if (st.op === 'insert') {
      if (st.name === 'team_cards') {
        const unknown = Object.keys(st.patch).find(k => !TEAM_COLUMNS.has(k))
        if (unknown) {
          return { data: null, error: { message: `Could not find the '${unknown}' column of 'team_cards' in the schema cache` } }
        }
        log.personalOnSlugAtInsert = (tables.cards || []).some(c => c.slug === st.patch.slug)
      }
      const row = { id: `new-${++n}`, ...st.patch }
      rows.push(row)
      return { data: [{ ...row }], error: null }
    }
    return { data: null, error: { message: 'mock: unknown op' } }
  }

  function from(name) {
    const st = { name, op: 'select', filters: [], patch: null, count: false, head: false }
    const q = {
      select(_cols, o) { if (st.op === 'select' && o?.count) { st.count = true; st.head = !!o.head } return q },
      eq(c, v) { st.filters.push([c, v]); return q },
      order() { return q },
      update(p) { st.op = 'update'; st.patch = p; return q },
      insert(p) { st.op = 'insert'; st.patch = { ...p }; return q },
      delete() { st.op = 'delete'; return q },
      maybeSingle() {
        return Promise.resolve(run(st)).then(r => ({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data }))
      },
      then(res, rej) { return Promise.resolve(run(st)).then(res, rej) },
    }
    return q
  }
  return { from, tables: () => tables, log }
}

const OWNER = 'owner-1'
const SLUG = 'acme-jo-owner'
const seed = () => ({
  organizations: [{ id: 'org-1', name: 'Acme', admin_user_id: OWNER, max_seats: 6 }],
  cards: [
    {
      id: 'card-1', user_id: OWNER, assigned_user_id: OWNER, org_id: null, team_id: null,
      member_user_id: null, is_primary: true, archived: false, slug: SLUG,
      name: 'Jo Owner', title: 'Dealer Principal', email: 'jo@example.test', phone: '+27 11 000 0000',
      color_theme: '{"template":"classic"}', bio: '', awards: 'Dealer of the year',
      legacy_unused: null, created_at: '2026-10-07T11:55:00Z', updated_at: '2026-10-07T11:55:00Z',
    },
    { id: 'card-other', user_id: 'someone-else', slug: 'someone-else', name: 'Other' },
  ],
  team_cards: [
    { id: 'tc-1', organization_id: 'org-1', user_id: 'member-1', slug: 'acme-a' },
    { id: 'tc-2', organization_id: 'org-1', user_id: null, slug: 'acme-b' },
  ],
  contacts: [
    { id: 'ct-1', card_id: 'card-1', team_card_id: null },
    { id: 'ct-2', card_id: 'card-1', team_card_id: null },
    { id: 'ct-3', card_id: 'card-other', team_card_id: null },
  ],
  bookings: [{ id: 'bk-1', card_id: 'card-1' }, { id: 'bk-2', card_id: 'card-other' }],
  card_events: [{ id: 'ev-1', card_id: 'card-1' }, { id: 'ev-2', card_id: 'card-1' }, { id: 'ev-3', card_id: 'card-other' }],
  slug_redirects: [{ id: 'rd-1', card_id: 'card-1' }],
})

// Happy path.
{
  const db = makeDb(seed())
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1' })
  const t = db.tables()
  const tc = t.team_cards.find(c => c.id === r.teamCardId)
  if (!r.ok || !tc) bad(`the move did not succeed: ${JSON.stringify(r)}`)
  else {
    if (tc.slug !== SLUG || r.slug !== SLUG) bad(`the team card is on "${tc.slug}", not the original link "${SLUG}"`)
    if (db.log.personalOnSlugAtInsert !== false) bad('the personal card was still on the link when the team card was created (it would shadow it: the public route resolves personal cards first)')
    if (tc.organization_id !== 'org-1' || tc.user_id !== OWNER) bad('the team card is not in the team, claimed by the owner')
    if (!tc.claimed_at || tc.is_active !== true) bad('the team card is not claimed and active')
    for (const k of ['name', 'title', 'email', 'phone', 'color_theme']) {
      if (tc[k] !== seed().cards[0][k]) bad(`"${k}" did not carry across`)
    }
    for (const k of ['is_primary', 'archived', 'assigned_user_id', 'org_id', 'team_id', 'member_user_id', 'created_at', 'updated_at']) {
      if (k in tc) bad(`personal-card field "${k}" was copied onto the team card`)
    }
    if (tc.slug_person !== 'jo-owner') bad(`slug_person is "${tc.slug_person}", expected "jo-owner"`)
    if (JSON.stringify(r.notCarried) !== '["awards"]') bad(`notCarried should report exactly ["awards"] (has a value, no team column), got ${JSON.stringify(r.notCarried)}`)
    const moved = t.contacts.filter(c => c.team_card_id === tc.id && c.card_id === null).map(c => c.id).sort()
    if (moved.join() !== 'ct-1,ct-2' || r.contactsMoved !== 2) bad(`contacts did not move with the card: ${moved.join()} (${r.contactsMoved})`)
    if (t.contacts.find(c => c.id === 'ct-3').card_id !== 'card-other') bad('another card\'s contact was touched')
    if (t.bookings.find(b => b.id === 'bk-1').card_id !== tc.id || r.bookingsMoved !== 1) bad('the booking did not move with the card')
    if (t.bookings.find(b => b.id === 'bk-2').card_id !== 'card-other') bad('another card\'s booking was touched')
    if (t.cards.some(c => c.id === 'card-1')) bad('the personal card was not removed (it would still count against the owner and sit outside the team)')
    if (!t.cards.some(c => c.id === 'card-other')) bad('another person\'s card was removed')
    if (t.card_events.some(e => e.card_id === 'card-1')) bad('the personal card\'s view history was left behind')
    if (!t.card_events.some(e => e.card_id === 'card-other')) bad('another card\'s view history was removed')
    if (t.slug_redirects.some(e => e.card_id === 'card-1')) bad('the personal card\'s redirects were left behind')
    if (r.error) bad(`a clean move reported a problem: ${r.error}`)
  }
}

// Refusals: nothing may change.
const refusals = [
  ['someone else\'s card', s => s, { cardId: 'card-other' }],
  ['an owner who already holds a card in the team', s => { s.team_cards.push({ id: 'tc-3', organization_id: 'org-1', user_id: OWNER, slug: 'acme-c' }); return s }, {}],
  ['a full team', s => { s.organizations[0].max_seats = 2; return s }, {}],
  ['a card another move has parked', s => { s.cards[0].slug = `${SLUG}--moving-abc`; return s }, {}],
  ['a team that does not exist', s => s, { orgId: 'org-404' }],
]
for (const [label, shape, over] of refusals) {
  const start = shape(seed())
  const db = makeDb(start)
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1', ...over })
  if (r.ok) bad(`moved ${label}; it must refuse`)
  else if (!r.error) bad(`refused ${label} without saying why`)
  if (JSON.stringify(db.tables()) !== JSON.stringify(start)) bad(`refusing ${label} still changed the database`)
}

// A failed insert puts the link back.
{
  const db = makeDb(seed(), {
    fail: (st) => st.name === 'team_cards' && st.op === 'insert'
      ? { message: 'duplicate key value violates unique constraint "team_cards_slug_key"' } : null,
  })
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1' })
  const t = db.tables()
  if (r.ok) bad('reported success when the team card could not be created')
  if (t.cards.find(c => c.id === 'card-1')?.slug !== SLUG) bad(`a failed move left the personal card off its link (on "${t.cards.find(c => c.id === 'card-1')?.slug}"): the owner's card would 404`)
  if (t.team_cards.length !== 2) bad('a failed move left a team card behind')
}

// Contacts that could not move: keep the personal card.
{
  const db = makeDb(seed(), {
    fail: (st) => st.name === 'contacts' && st.op === 'update' ? { message: 'permission denied for table contacts' } : null,
  })
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1' })
  const t = db.tables()
  if (!t.cards.some(c => c.id === 'card-1')) bad('the personal card was deleted while 2 of its contacts were still on it: those leads would be orphaned')
  if (!r.ok || !r.error) bad('a partial move must report ok with a note saying what was left behind')
  if (t.card_events.filter(e => e.card_id === 'card-1').length !== 2) bad('view history was removed from a personal card that was kept')
}

// ── 2. Applied where the situation arises ───────────────────────────────────
const prepaid = read('lib/prepaid.ts')
const settleAt = prepaid.indexOf('await settleOwnerCard(db, org.id)')
if (settleAt < 0) bad('lib/prepaid.ts: a paid prepaid invoice no longer settles the owner\'s card (await settleOwnerCard(db, org.id))')
else if (settleAt < prepaid.indexOf("event: 'prepaid_period_applied'")) bad('lib/prepaid.ts: settleOwnerCard runs before the team is switched on; with the team still off, it finds nothing to do')

const route = read('app/api/admin/route.ts')
const createOrg = route.slice(route.indexOf("action === 'create_org'"))
const createOrgBody = createOrg.slice(0, createOrg.indexOf('return NextResponse.json({\n      success: true'))
if (!/await settleOwnerCard\(admin, saved\.id\)/.test(createOrgBody)) bad('admin create_org no longer settles the owner\'s card when it saves a team')
else if (createOrgBody.indexOf('settleOwnerCard') < createOrgBody.indexOf('await write()')) bad('admin create_org settles the owner\'s card before the team is written')
if (!/action === 'move_card_into_team'[\s\S]{0,600}movePersonalCardIntoTeam\(admin, \{ orgId: org_id, cardId: card_id \}\)[\s\S]{0,300}auditLog\(/.test(route)) {
  bad('admin move_card_into_team must call movePersonalCardIntoTeam and write an audit log entry')
}

const page = read('app/dashboard/card/page.tsx')
const hookAt = page.indexOf('ownerTeamNeedingCard(admin, user.id)')
if (hookAt < 0) bad('the Card page no longer puts an owner\'s card in their team')
else {
  if (hookAt > page.indexOf('await getUserPlan(user.id)')) bad('the Card page settles the owner\'s card after reading the plan, so the plan is read for a card that has since moved')
  if (hookAt > page.indexOf(".from('cards')\n      // assigned_user_id")) bad('the Card page creates a personal card before checking whether it belongs in the owner\'s team')
}

const setup = read('lib/account-setup.ts')
const setupHook = setup.indexOf('ownerTeamNeedingCard(admin, user.id)')
if (setupHook < 0) bad('ensureAccountReady no longer creates a team owner\'s first card inside their team')
else if (setupHook > setup.indexOf("admin.from('cards').insert(")) bad('ensureAccountReady makes a personal card before checking the owner\'s team')

// ── 3. Paying owners are left alone ─────────────────────────────────────────
const rule = read('lib/owner-team-card.ts')
const settleFn = rule.slice(rule.indexOf('export async function settleOwnerCard'))
if (!/if \(await paysOwnWay\(db, org\.admin_user_id\)\) return null/.test(settleFn.slice(0, settleFn.indexOf('movePersonalCardIntoTeam')))) {
  bad('settleOwnerCard moves the card without first checking whether the owner pays for it themselves')
}
if (!/!\(await paysOwnWay\(db, userId\)\)/.test(rule.slice(rule.indexOf('export async function ownerTeamNeedingCard')))) {
  bad('ownerTeamNeedingCard no longer leaves paying owners alone')
}
const paysFn = rule.slice(rule.indexOf('async function paysOwnWay'), rule.indexOf('interface LiveTeam'))
if (!/catch \{[\s\S]*?return true[\s\S]*?\}/.test(paysFn)) bad('paysOwnWay must treat an unreadable subscription as paying (return true): doing nothing is the safe failure')
if (!/orgEntitlesMembers\(org\)/.test(rule)) bad('the rule must only apply to a team that is live (orgEntitlesMembers)')
if (!/catch \(e\) \{\s*console\.error\('settleOwnerCard'/.test(settleFn)) bad('settleOwnerCard must never throw: its callers are recording a payment or saving a team')

if (fail) {
  console.error(`check-owner-card: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-owner-card: ok (move run against an in-memory database; hooks and the paying-owner exception in place)')
