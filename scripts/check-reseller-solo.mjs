// Resellers sell Cardtly Solo (stage 4, Andre 2026-11-20: "For resellers: We
// will charge them R35 per month or R350 per year").
//
// WHAT THIS PROTECTS:
//   1. R35 a month and R350 a year by default, the same figures as
//      SOLO_RESELLER_RAND in lib/plan-prices, and editable per reseller.
//   2. A Solo client is billed like a team with one seat: any day live bills
//      the month, yearly is twelve months upfront and nothing more inside it,
//      at the Solo price, on a line that says Cardtly Solo. Teams are billed
//      exactly as before.
//   3. Only a live Solo client with a login is recorded; paused, cancelled and
//      deleted accounts are not.
//   4. One seat from the pool each, counted in the client list everything else
//      reads (pool, admin "still on their bill", levels).
//   5. The card is Solo through a comped row the dashboard and card page
//      already serve, and is never laid over a Paystack subscription, a comp,
//      a team's Pro or another reseller's Solo.
//   6. The person never sees a Cardtly price: their checkout refuses them,
//      Settings names the reseller, and the email has no amount in it.
//   7. A reseller that sold Solo cannot be deleted; the daily cron keeps the
//      cards in step; migration 110 keeps the table closed to the browser.
//
// Run: node scripts/check-reseller-solo.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }
const has = (src, re, what) => { if (!re.test(src)) bad(what) }

const out = mkdtempSync(join(tmpdir(), 'reseller-solo-'))
let P, R, D
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-pricing.ts', 'lib/reseller-billing.ts', 'lib/reseller-delete.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  P = await import(pathToFileURL(join(out, 'reseller-pricing.mjs')).href)
  R = await import(pathToFileURL(join(out, 'reseller-billing.mjs')).href)
  D = await import(pathToFileURL(join(out, 'reseller-delete.mjs')).href)
} catch (e) {
  console.error('check-reseller-solo: could not compile the reseller libraries')
  console.error(String(e.stdout || e.message).slice(0, 800))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. Prices ───────────────────────────────────────────────────────────────
const planPrices = read('lib/plan-prices.ts')
const soloMonthlyRand = Number(planPrices.match(/SOLO_RESELLER_RAND\s*=\s*\{\s*monthly:\s*(\d+)/)?.[1])
const soloYearlyRand = Number(planPrices.match(/SOLO_RESELLER_RAND\s*=\s*\{[^}]*yearly:\s*(\d+)/)?.[1])
eq(soloMonthlyRand, 35, 'SOLO_RESELLER_RAND monthly in lib/plan-prices')
eq(soloYearlyRand, 350, 'SOLO_RESELLER_RAND yearly in lib/plan-prices')
eq(P.RESELLER_DEFAULTS.soloPriceCents, soloMonthlyRand * 100, 'the default Solo price matches lib/plan-prices')
eq(P.RESELLER_DEFAULTS.soloPriceYearCents, soloYearlyRand * 100, 'the default Solo yearly price matches lib/plan-prices')

const migration = read('supabase/migrations/110_reseller_solo.sql')
has(migration, /solo_price_cents\s+integer not null default 3500/, 'migration 110 defaults the Solo price to R35')
has(migration, /solo_price_year_cents\s+integer not null default 35000/, 'migration 110 defaults the Solo year to R350')

// The reseller's prices: the defaults before migration 110, its own after.
eq(R.resellerPrices({ seat_price_cents: 7000 }).soloMonthlyCents, 3500, 'Solo price before migration 110')
eq(R.resellerPrices({ seat_price_cents: 7000 }).soloYearlyCents, 35000, 'Solo year before migration 110')
eq(R.resellerPrices({ seat_price_cents: 7000, solo_price_cents: 3000, solo_price_year_cents: 30000 }).soloMonthlyCents, 3000, 'a reseller\'s own Solo price')
eq(R.resellerPrices({ seat_price_cents: 7000, solo_price_cents: 0 }).soloMonthlyCents, 0, 'a Solo price of R0 is kept, not replaced by the default')

// ── 2. The bill ─────────────────────────────────────────────────────────────
const prices = { monthlyCents: 7000, yearlyCents: 84000, soloMonthlyCents: 3500, soloYearlyCents: 35000 }
const oct = '2026-10-01'
let bill = P.resellerMonthBill(oct, [
  { orgId: 's1', clientName: 'Thandi Mokoena', seats: 1, term: 'monthly', product: 'solo' },
  { orgId: 'o1', clientName: 'Acme', seats: 10, term: 'monthly' },
], [], prices)
eq(bill.lines, [
  { description: 'Acme: Cardtly Pro, 10 seats, October 2026', qty: 10, unitPriceCents: 7000 },
  { description: 'Thandi Mokoena: Cardtly Solo, October 2026', qty: 1, unitPriceCents: 3500 },
], 'a monthly Solo client beside a team')

bill = P.resellerMonthBill(oct, [{ orgId: 's1', clientName: 'Thandi Mokoena', seats: 1, term: 'yearly', product: 'solo' }], [], prices)
eq(bill.lines, [{ description: 'Thandi Mokoena: Cardtly Solo yearly, October 2026 to September 2027', qty: 1, unitPriceCents: 35000 }], 'a yearly Solo client')
eq(bill.newYears.map(y => [y.orgId, y.product, y.endMonth]), [['s1', 'solo', '2027-09-01']], 'a Solo year is recorded as Solo')

bill = P.resellerMonthBill('2027-03-01', [{ orgId: 's1', clientName: 'Thandi Mokoena', seats: 1, term: 'yearly', product: 'solo' }],
  [{ orgId: 's1', startMonth: oct, endMonth: '2027-09-01', coveredSeats: 1 }], prices)
eq(bill.lines.length, 0, 'nothing is billed inside a paid Solo year')

bill = P.resellerMonthBill(oct, [{ orgId: 's1', clientName: 'Sipho', seats: 1, term: 'monthly', product: 'solo' }], [], { monthlyCents: 7000, yearlyCents: 84000 })
eq(bill.lines[0]?.unitPriceCents, 3500, 'Solo prices missing from the call fall back to R35')

bill = P.resellerMonthBill(oct, [{ orgId: 'o1', clientName: 'Acme', seats: 3, term: 'yearly' }], [], prices)
eq(bill.lines[0], { description: 'Acme: Cardtly Pro yearly, 3 seats, October 2026 to September 2027', qty: 3, unitPriceCents: 84000 }, 'a team\'s yearly line is unchanged')
eq(bill.newYears[0]?.product, 'pro', 'a team year is Pro')

// ── 3. Recording and drafting, on a fake database ───────────────────────────
function fakeDb() {
  const t = {
    billing_settings: [{ id: true, vat_number: null, vat_rate_bp: 1500 }],
    organizations: [], resellers: [], reseller_seat_months: [], reseller_invoices: [],
    invoices: [], invoice_lines: [], document_events: [],
    reseller_client_years: [], reseller_year_extras: [], reseller_solo_clients: [],
  }
  let seq = 0
  const match = (row, filters) => filters.every(([op, k, v]) =>
    op === 'eq' ? row[k] === v : op === 'is' ? (row[k] ?? null) === v : op === 'in' ? v.includes(row[k]) : true)
  function builder(table) {
    const q = { op: 'select', filters: [], payload: null, single: false }
    const run = () => {
      const rows = t[table]
      if (q.op === 'insert') {
        const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map(r => ({ id: `id${++seq}`, ...r }))
        if (table === 'reseller_invoices' && list.some(r => rows.some(x => x.reseller_id === r.reseller_id && x.month === r.month))) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } }
        }
        rows.push(...list)
        return { data: q.single ? list[0] : list, error: null }
      }
      if (q.op === 'update') { for (const r of rows.filter(r => match(r, q.filters))) Object.assign(r, q.payload); return { data: null, error: null } }
      if (q.op === 'delete') { t[table] = rows.filter(r => !match(r, q.filters)); return { data: null, error: null } }
      const hit = rows.filter(r => match(r, q.filters))
      return { data: q.single ? hit[0] || null : hit, error: null }
    }
    const api = {
      select() { return api },
      insert(p) { q.op = 'insert'; q.payload = p; return api },
      update(p) { q.op = 'update'; q.payload = p; return api },
      delete() { q.op = 'delete'; return api },
      eq(k, v) { q.filters.push(['eq', k, v]); return api },
      is(k, v) { q.filters.push(['is', k, v]); return api },
      in(k, v) { q.filters.push(['in', k, v]); return api },
      maybeSingle() { q.single = true; return Promise.resolve(run()) },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return api
  }
  return {
    t,
    from: (table) => builder(table),
    rpc: async (name, a) => {
      if (name !== 'reseller_record_seats') return { error: { message: 'unknown rpc' } }
      const row = t.reseller_seat_months.find(r => r.reseller_id === a.p_reseller && r.organization_id === a.p_org && r.month === a.p_month)
      const term = a.p_term === 'yearly' ? 'yearly' : 'monthly'
      const product = a.p_product === 'solo' ? 'solo' : 'pro'
      if (row) Object.assign(row, { peak_seats: Math.max(row.peak_seats, a.p_seats), term, product })
      else t.reseller_seat_months.push({ reseller_id: a.p_reseller, organization_id: a.p_org, month: a.p_month, peak_seats: Math.max(0, a.p_seats), client_name: a.p_client_name, term, product })
      return { error: null }
    },
  }
}

const db = fakeDb()
const reseller = { id: 'r1', name: 'Spark Marketing', billing_client_id: 'bc1', seat_price_cents: 7000, solo_price_cents: 3500, solo_price_year_cents: 35000 }
db.t.resellers.push(reseller)
db.t.organizations.push({ id: 'o1', name: 'Acme', max_seats: 10, billing_period: 'reseller', reseller_id: 'r1', business_plan_active: true })
db.t.reseller_solo_clients.push(
  { id: 's1', reseller_id: 'r1', user_id: 'u1', name: 'Thandi Mokoena', email: 't@example.com', term: 'monthly', state: 'live' },
  { id: 's2', reseller_id: 'r1', user_id: 'u2', name: 'Paused Person', email: 'p@example.com', term: 'monthly', state: 'paused' },
  { id: 's3', reseller_id: 'r1', user_id: null, name: 'Deleted Account', email: 'd@example.com', term: 'monthly', state: 'live' },
)
const octDay = new Date('2026-10-15T08:00:00Z')
await R.recordAllResellerSeats(db, octDay)
const month = (id) => db.t.reseller_seat_months.find(r => r.organization_id === id && r.month === oct)
eq(month('s1') && [month('s1').peak_seats, month('s1').product], [1, 'solo'], 'a live Solo client is recorded as one Solo seat')
if (month('s2')) bad('a paused Solo client was recorded')
if (month('s3')) bad('a Solo client whose account was deleted was recorded')
// The same guard inside recordSoloSeats itself, which every change calls.
await R.recordSoloSeats(db, { id: 's4', reseller_id: 'r1', user_id: null, name: 'Gone', term: 'monthly', state: 'live' }, octDay)
if (month('s4')) bad('recordSoloSeats recorded a Solo client with no login')
await R.recordSoloSeats(db, { id: 's5', reseller_id: 'r1', user_id: 'u5', name: 'Off', term: 'monthly', state: 'cancelled' }, octDay)
if (month('s5')) bad('recordSoloSeats recorded a cancelled Solo client')
eq(month('o1')?.product, 'pro', 'a team is still recorded as Pro')

const drafted = await R.draftResellerMonth(db, reseller, oct)
if (!drafted.invoiceId) bad(`October did not draft: ${drafted.error || drafted.skipped}`)
eq(db.t.invoices[0]?.subtotal_cents, 10 * 7000 + 3500, 'October: ten Pro seats and one Solo card')
eq(db.t.invoice_lines.map(l => l.description).sort(), ['Acme: Cardtly Pro, 10 seats, October 2026', 'Thandi Mokoena: Cardtly Solo, October 2026'], 'the October lines')

// A yearly Solo client's year is saved as Solo; a team's year names no product,
// so it still saves before migration 110.
const db2 = fakeDb()
const r2 = { ...reseller, id: 'r2', billing_client_id: 'bc2' }
db2.t.resellers.push(r2)
db2.t.organizations.push({ id: 'o9', name: 'Yearly Co', max_seats: 2, billing_period: 'reseller', reseller_id: 'r2', business_plan_active: true, reseller_term: 'yearly' })
await R.recordSoloSeats(db2, { id: 's9', reseller_id: 'r2', user_id: 'u9', name: 'Lerato', term: 'yearly', state: 'live' }, octDay)
await R.recordClientSeats(db2, db2.t.organizations[0], octDay)
await R.draftResellerMonth(db2, r2, oct)
const soloYear = db2.t.reseller_client_years.find(y => y.organization_id === 's9')
const teamYear = db2.t.reseller_client_years.find(y => y.organization_id === 'o9')
eq(soloYear && [soloYear.product, soloYear.unit_cents, soloYear.end_month], ['solo', 35000, '2027-09-01'], 'a Solo year is saved as Solo at R350')
if (!teamYear) bad('the team\'s year was not saved')
else if ('product' in teamYear) bad('a team\'s year names a product, which fails before migration 110')

// ── 4. Pool, list and levels ────────────────────────────────────────────────
const reseller_ts = read('lib/reseller.ts')
has(reseller_ts, /export async function listResellerClients[\s\S]{0,200}listSoloClients\(db, resellerId\)[\s\S]{0,40}return \[\.\.\.teams, \.\.\.solos\]/, 'listResellerClients must return the Solo clients too, which the pool, the admin and the levels all read')
has(reseller_ts, /kind: 'solo' as const,[\s\S]{0,80}seats: 1,/, 'a Solo client takes exactly one seat')
has(reseller_ts, /export async function soloResellerFor[\s\S]*?\.neq\('state', 'cancelled'\)/, 'soloResellerFor must ignore cancelled Solo clients')
has(reseller_ts, /resellerPriceScope[\s\S]*?soloResellerFor\(db, userId\)[\s\S]*?solo: true/, 'resellerPriceScope must cover a reseller\'s Solo client')
has(reseller_ts, /\^solo:/, 'printed NFC cards can be ordered for a Solo client')
const levels = read('lib/reseller-levels-server.ts')
if (/product/.test(levels)) bad('levels must count every card sold, Solo included: cardsEverSold should not filter by product')

// ── 5. The card, and never over another plan ────────────────────────────────
const solo = read('lib/reseller-solo.ts')
has(solo, /subscription_tier: 'solo'/, 'the reseller\'s Solo comp is tier solo')
has(solo, /comped: true, reason: SOLO_CLIENT_REASON, reseller_id: row\.reseller_id, solo_client_id: row\.id/, 'the comp is marked as ours, per client')
has(solo, /export const SOLO_CLIENT_REASON = 'reseller_solo'/, 'the reason is reseller_solo')
has(solo, /const wanted = row\.state === 'live' && !!row\.user_id && reseller\?\.status !== 'ended'/, 'the card is Solo only while live, with a login, and the reseller not ended')
for (const [re, what] of [
  [/reseller_members[\s\S]{0,200}runs a Cardtly reseller account/, 'a reseller\'s own login'],
  [/already has a Cardtly Solo card through a reseller/, 'somebody with Solo through a reseller already'],
  [/rows\.some\(isPaystackPayer\)[\s\S]{0,40}return `\$\{email\} already pays Cardtly/, 'somebody Paystack bills'],
  [/already has Cardtly at no charge/, 'somebody comped'],
  [/plan\.viaTeam\) return/, 'somebody on Pro through a team'],
]) has(solo, re, `soloBlocker must refuse ${what}`)
has(solo, /const existing = await findUserByEmail\(db, email\)\s*if \(existing\) \{\s*const why = await soloBlocker/, 'an existing login is checked before it is sold Solo')
has(solo, /fitsPool\(reseller\.seat_pool, poolClients\(clients\), 1\)/, 'a new Solo card must fit the pool')
for (const fn of ['createSoloClient', 'setSoloTerm', 'setSoloState']) {
  has(solo, new RegExp(`export async function ${fn}[\\s\\S]{0,300}?const blocked = writable\\(reseller\\)`), `${fn} must refuse while the reseller is on hold or ended`)
}
has(solo, /if \(rows\.some\(isPaystackPayer\)\) return 'paying'/, 'the sync never lays Solo over a Paystack subscription')
const email = (solo.match(/async function sendSoloWelcome[\s\S]*?\n\}/) || [''])[0]
if (!email) bad('could not find sendSoloWelcome')
if (/R\$?\{?\s*\d|R\d/.test(email) || /price|cents|randCents/i.test(email.replace(/No price in it/, ''))) bad('the Solo client\'s email must name no price')

// ── 6. The person never sees Cardtly's price ───────────────────────────────
for (const f of ['app/api/paystack/initialize/route.ts', 'app/api/paystack/bundle/route.ts']) {
  has(read(f), /soloResellerFor\(serviceDb\(\), user\.id\)[\s\S]{0,80}if \(reseller\)/, `${f} must refuse a reseller's Solo client`)
}
const settings = read('components/settings/SettingsTabs.tsx')
has(settings, /if \(subscription\?\.managedBy\) return 'reseller' as const/, 'Settings must name the reseller for a reseller\'s Solo client')
has(read('app/dashboard/settings/page.tsx'), /reason === 'reseller_solo' \? await soloResellerFor/, 'the settings page must pass the reseller for a reseller_solo row')
const resellerBlock = (settings.match(/state === 'reseller' && \([\s\S]*?\n {8}\)\}/) || [''])[0]
if (!resellerBlock || /R\d|\$\{[^}]*PRICE/.test(resellerBlock)) bad('the reseller state in Settings must exist and name no price')

// ── 7. Routes, cron, delete, migration ──────────────────────────────────────
const route = read('app/api/reseller/route.ts')
for (const a of ['add_solo', 'solo_term', 'solo_state', 'solo_welcome']) has(route, new RegExp(`case '${a}':`), `the reseller API must handle ${a}`)
const post = route.slice(route.indexOf('export async function POST'))
if (/searchParams\.get\('as'\)/.test(post)) bad('POST must never read ?as=: a preview cannot write')
has(read('app/api/cron/trial-reminders/route.ts'), /syncAllSoloCards\(admin\)/, 'the daily cron must keep Solo cards in step')
eq(D.resellerDeleteBlocker({ teamsWithCards: 0, teamsWithSchedules: 0, issuedInvoices: 0, moneyRecords: 0, liveNfcOrders: 0, soloClients: 1 })?.includes('Solo'), true, 'a reseller that sold Solo cannot be deleted')
eq(D.resellerDeleteBlocker({ teamsWithCards: 0, teamsWithSchedules: 0, issuedInvoices: 0, moneyRecords: 0, liveNfcOrders: 0, soloClients: 0 }), null, 'a reseller with no books can still be deleted')
has(read('app/api/admin/resellers/route.ts'), /soloClients: soloErr \? 0 : soloCount \|\| 0/, 'the delete route must count Solo clients')
has(migration, /alter table public\.reseller_solo_clients enable row level security;/, 'RLS on reseller_solo_clients')
has(migration, /grant select, insert, update, delete on public\.reseller_solo_clients to service_role;/, 'reseller_solo_clients is for the service role')
if (/reseller_solo_clients to (anon|authenticated)/.test(migration)) bad('reseller_solo_clients must not be granted to the browser')
has(migration, /revoke all on function public\.reseller_record_seats\(uuid, uuid, date, integer, text, text, text\) from public, anon, authenticated;/, 'the new reseller_record_seats must be revoked from the browser')
has(migration, /reseller_solo_clients_one_per_user[\s\S]{0,120}where state <> 'cancelled'/, 'one reseller Solo per person at a time')

// ── 8. The reseller's screen ────────────────────────────────────────────────
const panel = read('components/reseller/ResellerPanel.tsx')
has(panel, /action: 'add_solo'/, 'the reseller page can add a Solo card')
has(panel, /randCents\(r\.soloPriceCents\)/, 'the reseller page shows the reseller\'s own Solo price, not a fixed one')
if (/R35|R350/.test(panel)) bad('the reseller page must read Solo prices from the API, not hard-code them')

for (const f of ['lib/reseller-solo.ts', 'supabase/migrations/110_reseller_solo.sql', 'scripts/check-reseller-solo.mjs']) {
  if (read(f).includes(String.fromCharCode(0x2014))) bad(`${f} has an em dash`)
}

if (fail) {
  console.error(`check-reseller-solo: ${fail} problem${fail === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log('check-reseller-solo: ok (R35/R350 per card, billed like one seat, live with a login only, one seat from the pool, never over another plan, no Cardtly price for the person, delete refused, closed to the browser)')
