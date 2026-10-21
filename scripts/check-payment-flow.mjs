// Payment received: from an EFT in the bank to a live team, in the right order.
//
// WHAT THIS PROTECTS (Andre, 2026-10-21: "We have to jump and change to so
// many screens to get the order right... when allocating the payment to the
// invoice I still can't select the invoice that got paid and I have to go into
// the bank to check the amount").
//   1. The steps run in the only order that works: the team exists and the
//      client is linked to it before the months are set and before the money
//      is allocated (allocating is what switches the team on).
//   2. Seats and months are read off the quote lines Cardtly actually writes.
//   3. A bank reference finds its invoice by number, and never the wrong one.
//   4. A payment goes on the invoices it was put on, which must be that
//      client's, issued, and owing at least that much; checked before
//      anything is written.
//   5. The screen is reachable, and its writes go through the routes that
//      own them rather than around them.
//
// Run: node scripts/check-payment-flow.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)
}

const out = mkdtempSync(join(tmpdir(), 'payment-flow-'))
let P
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/payment-flow.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  P = await import(pathToFileURL(join(out, 'payment-flow.mjs')).href)
} catch (e) {
  console.error('check-payment-flow: could not compile lib/payment-flow')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 2. Seats and months off real quote lines ────────────────────────────────
const pick = (lines) => { const s = P.suggestTeam(lines); return { seats: s.seats, months: s.months } }
eq(pick([
  { description: 'Digital Business Card - October', qty: 6 },
  { description: 'Digital Business Card - Novemeber', qty: 6 },
  { description: 'Digital Business Card - December', qty: 6 },
  { description: 'NFC Cards - Custom Design', qty: 6 },
]), { seats: 6, months: 3 }, 'three monthly lines of 6 (one misspelt) and an NFC line')
eq(pick([{ description: 'Number of Seats Required (Yearly)', qty: 3 }]), { seats: 3, months: 12 }, 'a yearly seats line')
eq(pick([{ description: '1 × Cardtly Digital Business Card, annual subscription paid upfront. Includes 12 months of', qty: 1 }]),
  { seats: 1, months: 12 }, 'one card for 12 months')
eq(pick([
  { description: 'Digital Business Card | Seats per month', qty: 10 },
  { description: 'NFC Business Cards', qty: 10 },
]), { seats: 10, months: 1 }, 'seats per month')
eq(pick([
  { description: '10 × Cardtly Digital Business Card – Month-to-Month Subscription', qty: 10 },
  { description: '10 × Cardtly Custom-Designed NFC Cards – Once-Off Payment', qty: 10 },
  { description: 'Delivery Fee: R100.00', qty: 1 },
]), { seats: 10, months: 1 }, 'month-to-month with NFC cards and delivery')
eq(pick([{ description: 'Digital Business Card seats, 6 months', qty: 4 }]), { seats: 4, months: 6 }, 'a counted months line')
eq(pick([{ description: 'NFC Business Cards', qty: 10 }, { description: 'Delivery Fee: R100.00', qty: 1 }]),
  { seats: null, months: null }, 'NFC cards only: no team suggested')
eq(pick([]), { seats: null, months: null }, 'no lines')

// ── 1. The order ────────────────────────────────────────────────────────────
eq(P.planSteps({ source: 'quote', team: 'new', needsLink: true, setMonths: true, send: true }),
  ['save_team', 'link_client', 'make_invoice', 'set_months', 'issue_invoice', 'record_payment', 'send_invoice'],
  'a new client paying a quote')
eq(P.planSteps({ source: 'invoice', team: 'keep', needsLink: false, setMonths: false, send: false }),
  ['record_payment'], 'an issued invoice for a team already set up')
eq(P.planSteps({ source: 'draft_invoice', team: 'none', needsLink: true, setMonths: true, send: true }),
  ['issue_invoice', 'record_payment', 'send_invoice'], 'no team: nothing to link and no months')

const before = (steps, a, b) => !steps.includes(a) || !steps.includes(b) || steps.indexOf(a) < steps.indexOf(b)
let combos = 0
for (const source of ['quote', 'draft_invoice', 'invoice'])
  for (const team of ['new', 'change', 'keep', 'none'])
    for (const needsLink of [true, false])
      for (const setMonths of [true, false])
        for (const send of [true, false]) {
          const s = P.planSteps({ source, team, needsLink, setMonths, send })
          const what = JSON.stringify({ source, team, needsLink, setMonths, send })
          combos++
          if (s[s.length - 1] !== (send ? 'send_invoice' : 'record_payment')) bad(`${what}: the email must be last, after the money`)
          if (!s.includes('record_payment')) bad(`${what}: the payment is never recorded`)
          for (const [a, b] of [['save_team', 'link_client'], ['link_client', 'set_months'], ['link_client', 'record_payment'],
            ['save_team', 'record_payment'], ['set_months', 'record_payment'], ['make_invoice', 'set_months'],
            ['make_invoice', 'issue_invoice'], ['issue_invoice', 'record_payment']]) {
            if (!before(s, a, b)) bad(`${what}: ${a} has to come before ${b}`)
          }
          if (source === 'quote' && !s.includes('make_invoice')) bad(`${what}: a quote is paid without becoming an invoice`)
          if (source !== 'invoice' && !s.includes('issue_invoice')) bad(`${what}: money would go on an unissued invoice`)
          if (team === 'none' && (s.includes('link_client') || s.includes('set_months'))) bad(`${what}: no team, yet it links or sets months`)
          if (new Set(s).size !== s.length) bad(`${what}: a step runs twice`)
        }

// ── The money against what is owed ──────────────────────────────────────────
eq(P.paymentFit(100000, 100000), { kind: 'full', allocateCents: 100000, differenceCents: 0 }, 'exact payment')
eq(P.paymentFit(40000, 100000), { kind: 'short', allocateCents: 40000, differenceCents: 60000 }, 'part payment')
eq(P.paymentFit(120000, 100000), { kind: 'over', allocateCents: 100000, differenceCents: 20000 }, 'overpayment: only what is owed goes on the invoice')

// ── 3. References ───────────────────────────────────────────────────────────
for (const ref of ['INV-2026-0012', 'ACME INV-2026-0012', 'inv 2026 12', 'INV20260012', 'ACMEINV-2026-0012', 'Payment inv-2026-012 thanks']) {
  if (!P.referenceMatches(ref, 'INV-2026-0012')) bad(`"${ref}" did not find INV-2026-0012`)
}
for (const [ref, num] of [['INV-2026-0012', 'INV-2026-0001'], ['INV-2026-0012', 'INV-2026-0120'], ['Q-2026-0003', 'INV-2026-0003'],
  ['INV-2025-0012', 'INV-2026-0012'], ['ACME HOLDINGS', 'INV-2026-0012'], ['', 'INV-2026-0012']]) {
  if (P.referenceMatches(ref, num)) bad(`"${ref}" wrongly matched ${num}`)
}
if (P.referenceMatches('INV-2026-0012', null)) bad('a draft with no number matched a reference')

// ── 4. Where the money may go ───────────────────────────────────────────────
const payments = read('app/api/admin/billing/payments/route.ts')
const post = payments.slice(payments.indexOf('export async function POST'), payments.indexOf('export async function PUT'))
if (!/allocationProblem\(db, body\.client_id \|\| null, named\)/.test(post)) bad('recording a payment no longer checks the invoices it is put on')
else if (post.indexOf('allocationProblem(') > post.indexOf(".from('billing_receipts').insert")) bad('the invoices are checked only after the payment is written')
const patch = payments.slice(payments.indexOf('export async function PATCH'), payments.indexOf('export async function DELETE'))
if (!/allocationProblem\(db, clientId, allocations, receipt\.id\)/.test(patch)) bad('allocating a payment no longer checks the invoices it is put on')
const problem = payments.slice(payments.indexOf('async function allocationProblem'), payments.indexOf('async function restatus'))
for (const [re, what] of [
  [/inv\.client_id !== clientId/, 'that the invoice is the client\'s'],
  [/inv\.status === 'draft'/, 'that the invoice is issued'],
  [/asked\[id\] > owing/, 'that the invoice owes at least that much'],
  [/mine\[id\]/, 'that a receipt being re-allocated does not count against itself'],
]) if (!re.test(problem)) bad(`the allocation check no longer checks ${what}`)
if (!/\.is\('client_id', null\)/.test(patch)) bad('naming the client on a payment can overwrite one already set')
if (!/open: await openFor\(/.test(payments)) bad('the allocate screen no longer gets every invoice the client owes on, so the paid one cannot be picked')

// ── 5. Reachable, and through the routes that own each write ────────────────
const flow = read('components/admin/billing/PaymentFlow.tsx')
if (!flow) bad('components/admin/billing/PaymentFlow.tsx is missing')
if (!/planSteps\(\{/.test(flow)) bad('the screen decides its own order instead of using planSteps')
for (const [re, what] of [
  [/action: 'create_org'/, 'team setup (create_org)'],
  [/'\/api\/admin\/billing\/clients', 'PATCH'/, 'linking the client'],
  [/action: 'convert'/, 'quote to invoice'],
  [/action: 'set_prepaid'/, 'the prepaid months'],
  [/action: 'issue'/, 'issuing'],
  [/'\/api\/admin\/billing\/payments', 'POST'/, 'recording the payment'],
  [/'\/api\/admin\/billing\/invoices\/send', 'POST'/, 'emailing the invoice'],
]) if (!re.test(flow)) bad(`the screen no longer does ${what} through its own route`)
if (/from\('/.test(flow)) bad('the screen talks to the database directly')
if (!/done\.current\.has\(s\)/.test(flow)) bad('Try again repeats steps that already worked')
if (!/ownerHasTeam/.test(flow)) bad('a new team for an owner who already has one would rename their team')

const admin = read('app/api/admin/route.ts')
if (!/organization_id: savedOrgId/.test(admin)) bad('create_org no longer returns the team id the next step links to')
const shell = read('components/admin/AdminShell.tsx')
if (!/\{ id: 'received', label: 'Payment received'/.test(shell)) bad('Payment received is not in the sidebar')
const dash = read('components/admin/AdminDashboard.tsx')
if (!/<PaymentFlow /.test(dash)) bad('AdminDashboard does not render Payment received')
if (!/onPaid=\{\(id\) => go\('received', \{ flow: \{ kind: 'quote'/.test(dash)) bad('a quote\'s Paid button no longer opens Payment received on it')
if (!/onPaid=\{\(id\) => go\('received', \{ flow: \{ kind: 'invoice'/.test(dash)) bad('an invoice\'s Paid button no longer opens Payment received on it')
const send = read('lib/send-invoice.ts')
if (!/paidInFull = !opts\.reminder && outstanding === 0/.test(send)) bad('a paid invoice is emailed as if it were still owing')

if (fail) {
  console.error(`check-payment-flow: ${fail} problem(s)`)
  process.exit(1)
}
console.log(`check-payment-flow: ok (order holds across ${combos} combinations, quote lines read, references matched, allocations checked, screen wired)`)
