// Signatures, purchase orders, and correcting the client on an issued invoice
// (migration 092, built 2026-10-05 for Jetour).
//
// WHAT THIS PROTECTS
//   1. The helpers, run: which client fields changed, what counts as a
//      signature image, and that signatures are copied rather than referenced.
//   2. The one door into an issued invoice. Migration 092 lets to_snapshot -
//      and ONLY to_snapshot - change, and only inside
//      refresh_invoice_recipient, which nobody but the server may call. The
//      number, the money, our details, the bank and the terms stay frozen.
//   3. The invoice route corrects a client through that function, never by
//      writing to_snapshot itself.
//   4. Signature images stay inside the billing tables and the PDFs: the
//      screens get names, the public signing page gets names, and nothing
//      public touches billing_signatories.
//   5. The public signing route is pinned to its token, checks the drawn
//      signature, and cannot be signed twice.
//
// Run: node scripts/check-signatures-po.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
/** SQL without comments, so an explanation cannot satisfy a rule. */
const sqlCode = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/--.*$/, '')).join('\n')

// ── 1. The helpers, run ─────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'sigpo-'))
let B
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/billing-docs.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'billing-docs.js'), join(out, 'billing-docs.mjs'))
  B = await import(pathToFileURL(join(out, 'billing-docs.mjs')).href)
} catch (e) {
  console.error('check-signatures-po: could not compile lib/billing-docs.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const snap = { name: 'Old Name (Pty) Ltd', contactPerson: 'Accounts', email: 'ap@example.co.za', phone: null, address: '1 Old Road', vatNumber: null }
const client = { name: 'New Name (Pty) Ltd', contact_person: 'Accounts', email: 'ap@example.co.za', phone: '', address: '1 Old Road', vat_number: '4000000000' }
const changed = B.recipientChanges(snap, client).join(',')
if (changed !== 'name,VAT number') bad(`recipientChanges should report "name,VAT number", got "${changed}"`)
if (B.recipientChanges(snap, { name: 'Old Name (Pty) Ltd', contact_person: 'Accounts', email: 'ap@example.co.za', address: ' 1 Old Road ' }).length) {
  bad('recipientChanges treats empty versus missing, or surrounding spaces, as a change')
}
if (B.recipientChanges(null, client).length) bad('recipientChanges reports changes for a draft with no snapshot')

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const sigCases = [
  [PNG, true, 'a PNG data URL'],
  ['data:image/jpeg;base64,/9j/4AAQ', false, 'a JPEG'],
  ['https://example.com/sig.png', false, 'a URL'],
  ['data:image/png;base64,abc"><script>', false, 'markup smuggled into the data'],
  ['data:image/png;base64,' + 'A'.repeat(B.SIGNATURE_MAX_CHARS), false, 'an image over the size cap'],
  [null, false, 'nothing'],
]
for (const [v, want, what] of sigCases) {
  if (B.isSignaturePng(v) !== want) bad(`isSignaturePng is ${!want} for ${what}`)
}
const copies = B.signatureCopies([
  { name: 'Andre Nel', title: 'Director', signature_png: PNG },
  { name: '', title: 'Nobody', signature_png: PNG },
  { name: 'Broken', title: null, signature_png: 'not an image' },
], new Date('2026-10-05T08:00:00Z'))
if (copies.length !== 1 || copies[0].name !== 'Andre Nel' || copies[0].png !== PNG || copies[0].signedAt !== '2026-10-05T08:00:00.000Z') {
  bad('signatureCopies must copy name, title, image and time for valid signatories only')
}
if (B.documentTitle('purchase_order', null) !== 'PURCHASE ORDER') bad('a purchase order must be headed PURCHASE ORDER')

// ── 2. The one door into an issued invoice ──────────────────────────────────
const mig = sqlCode(read('supabase/migrations/092_signatures_and_purchase_orders.sql'))
const trig = mig.match(/create or replace function public\.forbid_issued_document_edit\(\)[\s\S]*?\$\$;/)?.[0] || ''
if (!trig) bad('migration 092 no longer redefines forbid_issued_document_edit, so it is not clear what the trigger allows.')
else {
  for (const col of ['number', 'total_cents', 'subtotal_cents', 'vat_cents', 'issued_at', 'from_snapshot', 'bank_snapshot', 'terms_snapshot']) {
    if (!new RegExp(`or NEW\\.${col} is distinct from OLD\\.${col}(?! and)`).test(trig) && !new RegExp(`if NEW\\.${col} is distinct from OLD\\.${col}`).test(trig)) {
      bad(`the issued-invoice trigger no longer freezes ${col}. Only to_snapshot may move, and only through refresh_invoice_recipient.`)
    }
  }
  if (!/\(NEW\.to_snapshot is distinct from OLD\.to_snapshot and not v_recipient_refresh\)/.test(trig)) {
    bad('the trigger no longer guards to_snapshot with the refresh flag: either it is frozen again (corrections fail) or open to anything.')
  }
  if (!/current_setting\('cardtly\.refresh_recipient', true\)/.test(trig)) bad('the trigger no longer reads its door from cardtly.refresh_recipient.')
}
const fn = mig.match(/create or replace function public\.refresh_invoice_recipient[\s\S]*?\$\$;/)?.[0] || ''
if (!fn) bad('refresh_invoice_recipient is gone from migration 092.')
else {
  if (!/set_config\('cardtly\.refresh_recipient', 'on', true\)/.test(fn)) bad('refresh_invoice_recipient must open the door transaction-locally (set_config(..., true)) so it cannot leak.')
  if (!/insert into public\.document_events[\s\S]*'recipient_refreshed'[\s\S]*'before', v_before, 'after', p_to/.test(fn)) {
    bad('refresh_invoice_recipient no longer records the old and new details, so a correction would leave no trace.')
  }
  if (/update public\.invoices\s+set[^;]*(total_cents|number|lines|from_snapshot)/.test(fn)) bad('refresh_invoice_recipient touches more than to_snapshot.')
}
if (!/revoke all on function public\.refresh_invoice_recipient\(uuid, jsonb, uuid\) from public, anon, authenticated;/.test(mig)) {
  bad('refresh_invoice_recipient is callable by signed-in or anonymous users. Only the server may rewrite who an invoice is addressed to.')
}

// ── 3. The route uses the door ──────────────────────────────────────────────
const inv = read('app/api/admin/billing/invoices/route.ts')
const refreshBlock = inv.match(/if \(body\.action === 'refresh_client'\) \{[\s\S]*?\n  \}\n/)?.[0] || ''
if (!refreshBlock) bad('the invoice route has no refresh_client action, so a corrected client cannot reach an issued invoice.')
else {
  if (!/db\.rpc\('refresh_invoice_recipient'/.test(refreshBlock)) bad('refresh_client no longer goes through refresh_invoice_recipient.')
  if (/\.update\(/.test(refreshBlock)) bad('refresh_client writes the invoice directly instead of through refresh_invoice_recipient, skipping the audit record.')
}
const toSnapWrites = [...inv.matchAll(/to_snapshot:\s*toSnapshot\(client\)/g)].length
if (toSnapWrites !== 1) bad(`the invoice route writes to_snapshot ${toSnapWrites} times; only issuing a draft may (corrections go through the database function).`)

// ── 4. Signature images stay put ────────────────────────────────────────────
if (!/function forScreen\(i: any\) \{\s*\n\s*const \{ signatures, \.\.\.rest \}/.test(inv)) bad('the invoice route no longer strips signature images before answering the screen.')
if (!/invoice: forScreen\(invoice\)/.test(inv) || !/\.\.\.forScreen\(i\)/.test(inv)) bad('an invoice response sends signature images to the browser (list or single).')
const poAdmin = read('app/api/admin/billing/purchase-orders/route.ts')
if (!/const \{ signature_png, supplier_signatures, \.\.\.rest \} = po/.test(poAdmin)) bad('the purchase order route sends signature images to the screen.')
const sigRoute = read('app/api/admin/billing/signatories/route.ts')
for (const verb of ['GET', 'POST', 'PATCH', 'DELETE']) {
  const body = sigRoute.match(new RegExp(`export async function ${verb}\\([\\s\\S]*?\\n\\}`))?.[0] || ''
  if (!/const gate = await requireAdmin\(\)\s*\n\s*if \('error' in gate\) return gate\.error/.test(body)) bad(`signatories ${verb} is not admin only.`)
}
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, acc); else if (/\.(ts|tsx)$/.test(n)) acc.push(p.replace(/\\/g, '/'))
  }
  return acc
}
for (const f of walk('app')) {
  if (f.startsWith('app/api/admin/')) continue
  if (/billing_signatories/.test(read(f))) bad(`${f} reads billing_signatories outside the admin API. Signature images must never be reachable publicly.`)
}

// ── 5. The public signing route ─────────────────────────────────────────────
const pub = read('app/api/po/[token]/route.ts')
if (!pub) bad('app/api/po/[token]/route.ts is missing, so a purchase order cannot be signed.')
else {
  if (!/const validToken = \(t: string \| undefined\) => !!t && \/\^\[a-f0-9\]\{32\}\$\/\.test\(t\)/.test(pub)) bad('the public route no longer insists on a 32-hex token.')
  if ((pub.match(/\.eq\('public_token', token\)/g) || []).length < 2) bad('a public purchase order read is not pinned to its token.')
  if (!/if \(!isSignaturePng\(body\?\.signature\)\)/.test(pub)) bad('the public route stores whatever arrives as a signature.')
  if (!/\.eq\('status', 'awaiting_signature'\)\s*\n\s*\.select\('id'\)/.test(pub)) bad('the public route can sign an order twice (the update is not conditional on it still waiting).')
  if (!/if \(body\?\.authorised !== true\)/.test(pub)) bad('the public route no longer requires the signer to confirm their authority.')
  const view = pub.match(/function publicView[\s\S]*?\n\}/)?.[0] || ''
  if (/signature_png|\.png\b/.test(view)) bad('the public purchase order view sends a signature image to the signing page.')
}
if (!existsSync('app/po/[token]/page.tsx')) bad('the public signing page app/po/[token]/page.tsx is missing.')
else if (!/robots: \{ index: false/.test(read('app/po/[token]/page.tsx'))) bad('the signing page can be indexed by search engines; its URL is its only security.')

if (fail) {
  console.error(`\ncheck-signatures-po: ${fail} failure(s).`)
  process.exit(1)
}
console.log('check-signatures-po: client changes, signature images and copies behave, an issued invoice opens only to a logged recipient correction through the server, signature images never reach a screen or a public page, and the signing link is pinned, validated and signs once.')
