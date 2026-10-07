// A team owner's own card lives in their team, as one of its seats.
//
// WHAT THIS PROTECTS (built 2026-10-07, after JETOUR Bryanston's administrator
// ended up with a personal card outside his six-seat team: a seventh card on a
// six-seat invoice, served by a 7-day signup trial instead of the team his
// company had paid for; extended the same day to self-serve teams):
//   1. movePersonalCardIntoTeam, RUN against an in-memory database:
//      - the team card takes the SAME link, and the personal card is off that
//        link before the team card exists (the public route resolves personal
//        cards first, so a personal card left on it would shadow the team card)
//      - the card's contents go across; identity and personal bookkeeping do
//        not; anything the team table has no column for is reported WITH its
//        value, for the audit log
//      - an automatic move refuses to drop content a visitor would see (extra
//        phone numbers and the like); look settings are fine to drop
//      - contacts, bookings, reports, Network blocks and the view history go
//        with it (paged past PostgREST's 1000-row cap, country and city kept,
//        the view count not doubled); old-link redirects survive the delete;
//        a team or department look following the card follows the team card
//      - it refuses someone else's card, a full team, an owner who already
//        holds a team card, and a card another move has already parked
//      - a failed insert puts the link back; a failed history copy is taken
//        back off and the personal card kept; so is a card whose contacts
//        could not move
//   2. The rule is applied where the situation arises: a team going live
//      (admin create_org, self-serve payment, a paid prepaid invoice), the
//      owner's Card page, and a first sign-in.
//   3. Who it reaches: self-serve owners included, other owners whose own
//      subscription pays left alone (unreadable counts as paying), and an
//      owner with several cards and no single main one left alone.
//   4. The team brand can be pulled from the owner's team card, since that is
//      where their card now lives.
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

// The mock's team_cards takes exactly the columns the module believes it has,
// and refuses anything else the way PostgREST does.
const TEAM_COLUMNS = M.TEAM_CARD_COLUMNS
const ROW_CAP = 1000 // PostgREST's default max-rows

// A small in-memory stand-in for the supabase-js query builder: from / select /
// eq / in / order / range / update / insert / delete / maybeSingle, thenable
// like the real one. `fail(state)` may return an error to simulate the
// database refusing. team_card_events bumps team_cards.view_count per view,
// as the real trigger (migration 018) does.
function makeDb(seed, { fail: failHook } = {}) {
  const tables = JSON.parse(JSON.stringify(seed))
  const log = { personalOnSlugAtInsert: null }
  let n = 0
  const matches = (row, filters) => filters.every(([op, c, v]) => op === 'in' ? v.includes(row[c]) : row[c] === v)

  function run(st) {
    const rows = tables[st.name] || (tables[st.name] = [])
    const injected = failHook?.(st, tables)
    if (injected) return { data: null, error: injected, count: null }

    if (st.op === 'select') {
      let hit = rows.filter(r => matches(r, st.filters))
      if (st.count) return { data: st.head ? null : hit, error: null, count: hit.length }
      if (st.orderBy) hit = [...hit].sort((a, b) => String(a[st.orderBy]).localeCompare(String(b[st.orderBy])))
      hit = st.range ? hit.slice(st.range[0], st.range[1] + 1) : hit
      return { data: hit.slice(0, ROW_CAP).map(r => ({ ...r })), error: null }
    }
    if (st.op === 'update') {
      const hit = rows.filter(r => matches(r, st.filters))
      for (const r of hit) Object.assign(r, JSON.parse(JSON.stringify(st.patch)))
      return { data: hit.map(r => ({ ...r })), error: null }
    }
    if (st.op === 'delete') {
      tables[st.name] = rows.filter(r => !matches(r, st.filters))
      return { data: null, error: null }
    }
    if (st.op === 'insert') {
      const list = Array.isArray(st.patch) ? st.patch : [st.patch]
      if (st.name === 'team_cards') {
        const unknown = Object.keys(list[0]).find(k => !TEAM_COLUMNS.has(k))
        if (unknown) {
          return { data: null, error: { message: `Could not find the '${unknown}' column of 'team_cards' in the schema cache` } }
        }
        log.personalOnSlugAtInsert = (tables.cards || []).some(c => c.slug === list[0].slug)
      }
      const made = list.map(p => ({ id: `new-${++n}`, ...JSON.parse(JSON.stringify(p)) }))
      rows.push(...made)
      if (st.name === 'team_card_events') {
        for (const e of made) if (e.event_type === 'view') {
          const tc = (tables.team_cards || []).find(t => t.id === e.team_card_id)
          if (tc) tc.view_count = (tc.view_count || 0) + 1
        }
      }
      return { data: made.map(r => ({ ...r })), error: null }
    }
    return { data: null, error: { message: 'mock: unknown op' } }
  }

  function from(name) {
    const st = { name, op: 'select', filters: [], patch: null, count: false, head: false, orderBy: null, range: null }
    const q = {
      select(_cols, o) { if (st.op === 'select' && o?.count) { st.count = true; st.head = !!o.head } return q },
      eq(c, v) { st.filters.push(['eq', c, v]); return q },
      in(c, v) { st.filters.push(['in', c, v]); return q },
      order(c) { st.orderBy = c; return q },
      range(a, b) { st.range = [a, b]; return q },
      limit() { return q },
      update(p) { st.op = 'update'; st.patch = p; return q },
      insert(p) { st.op = 'insert'; st.patch = p; return q },
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
const EVENTS = 1203 // past one page of 500 and past PostgREST's 1000-row cap
const pad = (i) => String(i).padStart(5, '0')
const seed = (extra = {}) => ({
  organizations: [{ id: 'org-1', name: 'Acme', admin_user_id: OWNER, max_seats: 6, brand_source: { table: 'cards', id: 'card-1' } }],
  departments: [
    { id: 'dept-1', organization_id: 'org-1', brand_source: { table: 'cards', id: 'card-1' } },
    { id: 'dept-2', organization_id: 'org-1', brand_source: { table: 'team_cards', id: 'tc-1' } },
  ],
  cards: [
    {
      id: 'card-1', user_id: OWNER, assigned_user_id: OWNER, org_id: null, team_id: null,
      member_user_id: null, is_primary: true, archived: false, slug: SLUG, redirect_to_slug: SLUG,
      name: 'Jo Owner', title: 'Dealer Principal', email: 'jo@example.test', phone: '+27 11 000 0000',
      color_theme: '{"template":"classic"}', bio: '', view_count: 1500,
      // Look settings every personal card carries, with no team column: fine to drop.
      visible_sections: { gallery: false }, email_signature_settings: { style: 'compact' }, font_family: 'Inter',
      // Personal-only columns left empty: nothing to lose.
      phone_numbers: [], awards: null,
      created_at: '2026-10-07T11:55:00Z', updated_at: '2026-10-07T11:55:00Z',
      ...extra,
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
  card_events: [
    ...Array.from({ length: EVENTS }, (_, i) => ({
      id: `ev-${pad(i)}`, card_id: 'card-1', event_type: i % 3 ? 'view' : 'tap',
      country: i === 0 ? 'ZA' : null, city: i === 0 ? 'Johannesburg' : null,
      metadata: i === 0 ? { src: 'qr' } : null, visitor_hash: `v${i}`, created_at: `2026-10-07T${pad(i)}`,
    })),
    { id: 'ev-other', card_id: 'card-other', event_type: 'view' },
  ],
  team_card_events: [],
  card_reports: [{ id: 'rp-1', card_id: 'card-1', team_card_id: null }, { id: 'rp-2', card_id: 'card-other', team_card_id: null }],
  network_blocks: [{ id: 'nb-1', card_id: 'card-1', team_card_id: null }],
  slug_redirects: [{ id: 'rd-1', old_slug: 'jo-old', new_slug: SLUG, card_id: 'card-1' }],
  contact_submissions: [{ id: 'cs-1', card_id: 'card-1' }],
})

// Happy path, the way the automatic rule calls it.
{
  const db = makeDb(seed())
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1', requireLossless: true })
  const t = db.tables()
  const tc = t.team_cards.find(c => c.id === r.teamCardId)
  if (!r.ok || !tc) bad(`the move did not succeed: ${JSON.stringify({ ...r, dropped: undefined })}`)
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
    if ('redirect_to_slug' in tc) bad('a vanity redirect onto the card\'s own link was copied: the card would redirect to itself forever')
    if (tc.slug_person !== 'jo-owner') bad(`slug_person is "${tc.slug_person}", expected "jo-owner"`)
    const nc = [...(r.notCarried || [])].sort().join()
    if (nc !== 'email_signature_settings,font_family,visible_sections') bad(`notCarried should be the three look settings, got ${nc}`)
    if (JSON.stringify(r.dropped?.visible_sections) !== '{"gallery":false}') bad('a dropped value was not returned for the audit log')
    const moved = t.contacts.filter(c => c.team_card_id === tc.id && c.card_id === null).map(c => c.id).sort()
    if (moved.join() !== 'ct-1,ct-2' || r.contactsMoved !== 2) bad(`contacts did not move with the card: ${moved.join()} (${r.contactsMoved})`)
    if (t.contacts.find(c => c.id === 'ct-3').card_id !== 'card-other') bad('another card\'s contact was touched')
    if (t.bookings.find(b => b.id === 'bk-1').card_id !== tc.id || r.bookingsMoved !== 1) bad('the booking did not move with the card')
    if (t.bookings.find(b => b.id === 'bk-2').card_id !== 'card-other') bad('another card\'s booking was touched')
    const ev = t.team_card_events.filter(e => e.team_card_id === tc.id)
    if (ev.length !== EVENTS || r.eventsMoved !== EVENTS) bad(`view history: ${ev.length} of ${EVENTS} events reached the team card (paging past 1000 rows?)`)
    const first = ev.find(e => e.visitor_hash === 'v0')
    if (first?.metadata?.country !== 'ZA' || first?.metadata?.city !== 'Johannesburg' || first?.metadata?.src !== 'qr') bad(`country and city must ride along in metadata, keeping what was there: ${JSON.stringify(first?.metadata)}`)
    if (tc.view_count !== 1500) bad(`the team card's view count is ${tc.view_count}, not the personal card's 1500 (doubled, or left at the trigger's partial count)`)
    if (t.card_events.some(e => e.card_id === 'card-1')) bad('the personal card\'s view history was left behind')
    if (!t.card_events.some(e => e.card_id === 'card-other')) bad('another card\'s view history was removed')
    const rp = t.card_reports.find(x => x.id === 'rp-1'), nb = t.network_blocks.find(x => x.id === 'nb-1')
    if (rp.card_id !== null || rp.team_card_id !== tc.id) bad('a report about the card did not follow it')
    if (t.card_reports.find(x => x.id === 'rp-2').card_id !== 'card-other') bad('another card\'s report was touched')
    if (nb.card_id !== null || nb.team_card_id !== tc.id) bad('a Network block of the card did not follow it')
    const rd = t.slug_redirects.find(x => x.id === 'rd-1')
    if (!rd) bad('an old-link redirect was deleted: a link from before a rename would stop working')
    else if (rd.card_id !== null) bad('an old-link redirect still names the deleted personal card')
    if (t.contact_submissions.find(x => x.id === 'cs-1')?.card_id !== null) bad('a contact-form log row still names the deleted personal card')
    if (JSON.stringify(t.organizations[0].brand_source) !== JSON.stringify({ table: 'team_cards', id: tc.id })) bad('the team look still follows the deleted personal card')
    if (JSON.stringify(t.departments[0].brand_source) !== JSON.stringify({ table: 'team_cards', id: tc.id })) bad('a department look still follows the deleted personal card')
    if (JSON.stringify(t.departments[1].brand_source) !== JSON.stringify({ table: 'team_cards', id: 'tc-1' })) bad('a department following another card was repointed')
    if (t.cards.some(c => c.id === 'card-1')) bad('the personal card was not removed (it would still count against the owner and sit outside the team)')
    if (!t.cards.some(c => c.id === 'card-other')) bad('another person\'s card was removed')
    if (r.error) bad(`a clean move reported a problem: ${r.error}`)
  }
}

// A group: /card/<company>/<person> looks a person up by slug_person across
// the whole organisation, so the owner must not take a staff member's.
{
  const s = seed()
  s.team_cards[0].slug_person = 'jo-owner'
  s.team_cards[1].slug_person = 'jo-owner-2'
  const db = makeDb(s)
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1', requireLossless: true })
  const tc = db.tables().team_cards.find(c => c.id === r.teamCardId)
  if (tc?.slug_person !== 'jo-owner-3') bad(`in a group, the owner took slug_person "${tc?.slug_person}" while jo-owner and jo-owner-2 were in use: both company links would break`)
}

// Content a team card cannot hold: an automatic move refuses, an admin may force.
{
  const extra = { phone_numbers: ['+27 82 000 0000'], link_2_image_url: 'https://example.test/x.png' }
  const lose = M.contentThatWouldNotCarry(seed(extra).cards[0]).sort().join()
  if (lose !== 'link_2_image_url,phone_numbers') bad(`contentThatWouldNotCarry: expected link_2_image_url,phone_numbers, got "${lose}" (look settings and empty values must not count)`)
  if (M.contentThatWouldNotCarry(seed().cards[0]).length) bad('a card with only look settings and empty values reads as losing content')

  const start = seed(extra)
  const db = makeDb(start)
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1', requireLossless: true })
  if (r.ok) bad('an automatic move dropped extra phone numbers and link images off a live card')
  else if ((r.wouldLose || []).sort().join() !== 'link_2_image_url,phone_numbers') bad(`the refusal must name what would be lost, got ${JSON.stringify(r.wouldLose)}`)
  if (JSON.stringify(db.tables()) !== JSON.stringify(start)) bad('refusing to drop content still changed the database')

  const db2 = makeDb(seed(extra))
  const forced = await M.movePersonalCardIntoTeam(db2, { orgId: 'org-1', cardId: 'card-1' })
  if (!forced.ok) bad(`an admin's deliberate move was refused: ${forced.error}`)
  else if (JSON.stringify(forced.dropped?.phone_numbers) !== '["+27 82 000 0000"]') bad('a forced move dropped content without returning its value for the audit log')
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

// A history copy that fails part way is taken back off, and the personal card kept.
{
  let inserts = 0
  const db = makeDb(seed(), {
    fail: (st) => st.name === 'team_card_events' && st.op === 'insert' && ++inserts === 2 ? { message: 'statement timeout' } : null,
  })
  const r = await M.movePersonalCardIntoTeam(db, { orgId: 'org-1', cardId: 'card-1' })
  const t = db.tables()
  if (t.team_card_events.some(e => e.team_card_id === r.teamCardId)) bad('a failed history copy left a partial, duplicated history on the team card')
  if (!t.cards.some(c => c.id === 'card-1')) bad('the personal card was deleted although its view history did not copy: the history would be lost')
  if (t.card_events.filter(e => e.card_id === 'card-1').length !== EVENTS) bad('the personal card\'s view history was touched although it had not copied')
  if (!r.ok || !r.error) bad('a partial move must report ok with a note saying what was left behind')
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
  if (t.card_events.filter(e => e.card_id === 'card-1').length !== EVENTS) bad('view history was removed from a personal card that was kept')
}

// ── 2. Applied where the situation arises ───────────────────────────────────
const move = read('lib/move-card-to-team.ts')
if (!/const NOT_COPIED = new Set\(\[[\s\S]*?'view_count',[\s\S]*?\]\)/.test(move)) bad('lib/move-card-to-team.ts: view_count must not be copied; the history copy rebuilds it, and copying both counts every view twice')

const prepaid = read('lib/prepaid.ts')
const settleAt = prepaid.indexOf('await settleOwnerCard(db, org.id)')
if (settleAt < 0) bad('lib/prepaid.ts: a paid prepaid invoice no longer settles the owner\'s card (await settleOwnerCard(db, org.id))')
else if (settleAt < prepaid.indexOf("event: 'prepaid_period_applied'")) bad('lib/prepaid.ts: settleOwnerCard runs before the team is switched on; with the team still off, it finds nothing to do')

const verify = read('app/api/team/verify/route.ts')
const verifySettle = verify.indexOf('await settleOwnerCard(supabase, orgId)')
if (verifySettle < 0) bad('team/verify: a self-serve team going live no longer settles the owner\'s card')
else if (verifySettle < verify.indexOf('if (updateError)')) bad('team/verify: settleOwnerCard runs before the team is known to be live')

const route = read('app/api/admin/route.ts')
const createOrg = route.slice(route.indexOf("action === 'create_org'"))
const createOrgBody = createOrg.slice(0, createOrg.indexOf('return NextResponse.json({\n      success: true'))
if (!/await settleOwnerCard\(admin, saved\.id\)/.test(createOrgBody)) bad('admin create_org no longer settles the owner\'s card when it saves a team')
else if (createOrgBody.indexOf('settleOwnerCard') < createOrgBody.indexOf('await write()')) bad('admin create_org settles the owner\'s card before the team is written')
const moveAction = route.slice(route.indexOf("action === 'move_card_into_team'"), route.indexOf("action === 'create_org'"))
if (!/movePersonalCardIntoTeam\(admin, \{ orgId: org_id, cardId: card_id \}\)[\s\S]{0,300}auditLog\(/.test(moveAction)) {
  bad('admin move_card_into_team must call movePersonalCardIntoTeam and write an audit log entry')
}
if (!/dropped: _dropped, \.\.\.rest/.test(moveAction)) bad('admin move_card_into_team sends the dropped card values to the browser; they belong in the audit log only')

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

// ── 3. Who it reaches ───────────────────────────────────────────────────────
const rule = read('lib/owner-team-card.ts')
const settleFn = rule.slice(rule.indexOf('export async function settleOwnerCard'), rule.indexOf('export async function ownerTeamNeedingCard'))
const beforeMove = settleFn.slice(0, settleFn.indexOf('movePersonalCardIntoTeam'))
if (!/if \(!\(await ruleApplies\(db, org\)\)\) return null/.test(beforeMove)) bad('settleOwnerCard moves the card without first checking whether the rule applies to this owner')
if (!/primaries\.length === 1 \? primaries\[0\] : list\.length === 1 \? list\[0\] : null/.test(beforeMove)) bad('settleOwnerCard must leave an owner with several personal cards and no single main one alone: picking one is a guess')
if (!/movePersonalCardIntoTeam\(db, \{ orgId: org\.id, cardId: pick\.id, requireLossless: true \}\)/.test(settleFn)) bad('the automatic move must pass requireLossless: true, or it drops content off live cards')
const applies = rule.slice(rule.indexOf('async function ruleApplies'), rule.indexOf('export async function settleOwnerCard'))
if (!/return boughtSelfServe\(org\) \|\| !\(await paysOwnWay\(db, org\.admin_user_id\)\)/.test(applies)) bad('ruleApplies must reach self-serve owners and leave other owners who pay their own way alone')
if (!/const boughtSelfServe = \(org: LiveTeam\) => !!org\.whop_membership_id/.test(rule)) bad('a self-serve team is the one team/verify put a Paystack reference on (whop_membership_id)')
if (!/whop_membership_id/.test(rule.slice(rule.indexOf('async function teamNeedingOwnerCard')))) bad('teamNeedingOwnerCard must read whop_membership_id, or no team ever reads as self-serve')
if (!/if \(org && \(await ruleApplies\(db, org\)\)\) return org/.test(rule.slice(rule.indexOf('export async function ownerTeamNeedingCard')))) bad('ownerTeamNeedingCard must apply the same rule as settleOwnerCard')
const paysFn = rule.slice(rule.indexOf('async function paysOwnWay'), rule.indexOf('interface LiveTeam'))
if (!/catch \{[\s\S]*?return true[\s\S]*?\}/.test(paysFn)) bad('paysOwnWay must treat an unreadable subscription as paying (return true): doing nothing is the safe failure')
if (!/orgEntitlesMembers\(org\)/.test(rule)) bad('the rule must only apply to a team that is live (orgEntitlesMembers)')
if (!/catch \(e\) \{\s*console\.error\('settleOwnerCard'/.test(settleFn)) bad('settleOwnerCard must never throw: its callers are recording a payment or saving a team')
if (!/auditLog\(db, \{\s*action: 'owner_card_auto_move'/.test(settleFn)) bad('an automatic move must be on the audit log, with what did not carry')

// ── 4. The brand from the owner's card, wherever it lives ───────────────────
const team = read('app/api/team/route.ts')
const importBrand = team.slice(team.indexOf("action === 'import_brand_from_my_card'"), team.indexOf("action === 'unlink_brand_source'"))
if (!/from\('team_cards'\)\.select\('\*'\)\.eq\('organization_id', org_id\)\.eq\('user_id', user\.id\)/.test(importBrand)) bad('"Set brand from my card" no longer finds the owner\'s team card, so an owner whose card moved in is told they have no card')
if (!/table: myPersonal \? 'cards' : 'team_cards'/.test(importBrand)) bad('"Set brand from my card" must link to whichever table the card is in')
if (!/brand\.company \|\| orgName/.test(read('components/team/TeamBrandPanel.tsx'))) bad('the Brand page must show the team\'s own name until a brand sets one, not "No company name set"')

if (fail) {
  console.error(`check-owner-card: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-owner-card: ok (move run against an in-memory database, history paged and content protected; hooks, who it reaches and the brand source in place)')
