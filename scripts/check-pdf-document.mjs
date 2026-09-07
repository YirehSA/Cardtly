// Does the printed document still carry what it is legally required to carry?
//
// A quote or an invoice is not just a screen. Once it is issued it is the
// record, and the things that make it a valid record are the things easiest to
// drop in a refactor: the registration number, the banking details, the
// payment reference, and the heading that says whether VAT is being claimed.
// A missing line here does not throw, it just quietly prints a worse document.
//
// This walks the node tree that lib/pdf/invoice-document builds - the same
// tree @react-pdf's layout engine receives - and asserts the text that has to
// be on the page is on the page.
//
// It also pins the node SHAPE. The document is built without React on purpose
// (see the comment in lib/pdf/nodes.ts); if a future @react-pdf changes what
// its layout engine expects, this is what says so, rather than a blank PDF.
//
// Run: node scripts/check-pdf-document.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'pdfdoc-'))
let D
try {
  // CommonJS, unlike the sibling billing guard: invoice-document imports
  // ../billing-docs, and ESM would need every emitted specifier rewritten with
  // an extension. Nothing in the temp directory claims to be a module, so Node
  // loads the .js as CJS and the named exports come through.
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/pdf/invoice-document.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' },
  )
  // tsc keeps the source folder structure, so the entry lands under pdf/.
  D = await import(pathToFileURL(join(out, 'pdf', 'invoice-document.js')).href)
  if (typeof D.invoiceDocument !== 'function') throw new Error('invoiceDocument was not exported')
} catch (e) {
  console.error('check-pdf-document: could not compile lib/pdf/invoice-document.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const BASE = {
  number: 'INV-0001',
  issuedAt: '2026-09-07T00:00:00Z',
  dueAt: '2026-09-30',
  validUntil: '2026-09-21',
  currency: 'ZAR',
  subtotalCents: 488400, vatRateBp: 0, vatCents: 0, totalCents: 488400,
  lines: [
    { description: 'Cardtly Pro, team seats (monthly)', qty: 12, unitPriceCents: 9700, lineTotalCents: 116400 },
    { description: 'NFC cards, printed and encoded', qty: 12, unitPriceCents: 18500, lineTotalCents: 222000 },
    { description: 'Branding setup', qty: 1, unitPriceCents: 150000, lineTotalCents: 150000 },
  ],
  from: {
    legalName: 'Cardtly (Pty) Ltd', tradingName: 'Cardtly', regNumber: '2025/727173/07',
    vatNumber: null, email: 'hello@cardtly.com', phone: '062 460 7440',
    address: '119 Pretoria Road, Rynfield, Benoni, 1501, Gauteng, South Africa',
    website: 'www.cardtly.com', logoUrl: null,
  },
  to: { name: 'Sample Client (Pty) Ltd', contactPerson: 'Accounts Payable', email: 'ap@example.co.za', phone: '011 000 0000', address: '1 Example Street, Sandton', vatNumber: null },
  bank: {
    bankName: 'First National Bank (FNB)', accountName: 'Cardtly', accountNumber: '63174887712',
    branchCode: '255355', accountType: 'Current Account', swift: null,
  },
  terms: null,
}

/** Every string the tree would print, in order. */
function textOf(node, acc = []) {
  if (!node) return acc
  if (node.type === 'TEXT_INSTANCE') { acc.push(node.value); return acc }
  for (const c of node.children || []) textOf(c, acc)
  return acc
}
const printed = (view) => textOf(D.invoiceDocument(view)).join('\n')

// ── The node shape the layout engine is handed ────────────────────────────
{
  const root = D.invoiceDocument({ ...BASE, kind: 'invoice' })
  if (root.type !== 'DOCUMENT') bad(`root must be DOCUMENT, got ${root.type}`)
  const page = root.children?.[0]
  if (!page || page.type !== 'PAGE') bad('a document must have a PAGE')
  if (page?.props?.size !== 'A4') bad('pages must be A4')
  // Every node the engine walks needs these, or layout silently drops it.
  const walk = (n, path = 'root') => {
    if (n.type === 'TEXT_INSTANCE') {
      if (typeof n.value !== 'string') bad(`${path}: text instance value must be a string`)
      return
    }
    if (!('box' in n)) bad(`${path} (${n.type}): missing box`)
    if (!('style' in n)) bad(`${path} (${n.type}): missing style`)
    if (!Array.isArray(n.children)) bad(`${path} (${n.type}): children must be an array`)
    ;(n.children || []).forEach((c, i) => walk(c, `${path}>${n.type}[${i}]`))
  }
  walk(root)
  // Bare strings must never survive outside a TEXT: the engine has nothing to
  // measure them with, and they vanish from the page without an error.
  const strays = []
  const findStrays = (n) => {
    if (n.type === 'TEXT_INSTANCE') return
    for (const c of n.children || []) {
      if (c.type === 'TEXT_INSTANCE' && !['TEXT', 'LINK', 'TSPAN', 'NOTE'].includes(n.type)) strays.push(c.value)
      findStrays(c)
    }
  }
  findStrays(root)
  if (strays.length) bad(`text outside a TEXT node would not render: ${strays.join(', ')}`)
}

// ── An invoice ────────────────────────────────────────────────────────────
{
  const t = printed({ ...BASE, kind: 'invoice' })
  const must = [
    'INVOICE',                                    // not TAX INVOICE: no VAT number
    'INV-0001',
    'Cardtly (Pty) Ltd',
    'Reg. No. 2025/727173/07',                    // required on a South African document
    'Due 2026-09-30',
    'First National Bank (FNB)',
    'Account: 63174887712',
    'Branch code: 255355',
    'Current Account',
    'Please use INV-0001 as your payment reference.',
    'www.cardtly.com',
    'Registration No. 2025/727173/07',            // the footer
  ]
  for (const m of must) if (!t.includes(m)) bad(`invoice is missing "${m}"`)
  if (t.includes('TAX INVOICE')) bad('an unregistered business must not head a document TAX INVOICE')
  if (t.includes('VAT No.')) bad('a VAT line printed with no VAT number')
  for (const l of BASE.lines) if (!t.includes(l.description)) bad(`line missing: ${l.description}`)
}

// ── A quote ───────────────────────────────────────────────────────────────
{
  const t = printed({ ...BASE, kind: 'quote', number: 'Q-0001', terms: 'Sample terms apply.' })
  if (!t.includes('QUOTATION')) bad('a quote must be headed QUOTATION')
  if (!t.includes('Valid until 2026-09-21')) bad('a quote must state when it lapses')
  if (t.includes('Due ')) bad('a quote has no due date')
  if (!t.includes('Terms and conditions')) bad('terms must print on a quote')
  if (!t.includes('Sample terms apply.')) bad('the terms body must print')

  // On a page of their own. Squeezed under the banking panel they read as
  // small print nobody is expected to have looked at, which is the opposite of
  // what a document being signed needs.
  const root = D.invoiceDocument({ ...BASE, kind: 'quote', number: 'Q-0001', terms: 'Sample terms apply.' })
  const page = root.children[0]
  const findBlock = (n) => {
    if (n.children?.some(c => c.children?.some(g => g.value === 'Terms and conditions'))) return n
    for (const c of n.children || []) { const hit = findBlock(c); if (hit) return hit }
    return null
  }
  const block = findBlock(page)
  if (!block) bad('could not find the terms block to check it starts a new page')
  else if (block.props?.break !== true) bad('terms must start on a page of their own (break)')
  if (!t.includes('First National Bank (FNB)')) bad('banking prints on a quote too')
  // Nothing is owed yet, so there is nothing to reference.
  if (t.includes('payment reference')) bad('a quote must not ask for a payment reference')
}

// ── Registered for VAT ────────────────────────────────────────────────────
{
  const t = printed({
    ...BASE, kind: 'invoice',
    from: { ...BASE.from, vatNumber: '4123456789' },
    vatRateBp: 1500, vatCents: 73260, totalCents: 561660,
  })
  if (!t.includes('TAX INVOICE')) bad('a registered business must head the document TAX INVOICE')
  if (!t.includes('VAT No. 4123456789')) bad('the VAT number must be printed')
  if (!t.includes('VAT @ 15.00%')) bad('the VAT rate must be printed')
}

// ── A credit note ─────────────────────────────────────────────────────────
{
  const t = printed({ ...BASE, kind: 'credit_note', number: 'CN-0001' })
  if (!t.includes('CREDIT NOTE')) bad('a credit note must say so')
}

// ── Nothing optional prints as an empty label ─────────────────────────────
// A client with no VAT number, no phone and no address must not leave "VAT
// No." floating above a blank line.
{
  const t = printed({
    ...BASE, kind: 'invoice',
    from: { legalName: 'Cardtly (Pty) Ltd' },
    to: { name: 'Someone' },
    bank: null,
  })
  for (const m of ['VAT No.', 'Reg. No.', 'Account:', 'Branch code:', 'SWIFT:', 'BANKING DETAILS']) {
    if (t.includes(m)) bad(`"${m}" printed with nothing to show`)
  }
  if (!t.includes('Cardtly (Pty) Ltd')) bad('the legal name must always print')
}

// ── A draft says so ───────────────────────────────────────────────────────
{
  const t = printed({ ...BASE, kind: 'invoice', number: null })
  if (!t.includes('DRAFT')) bad('an unissued document must be marked DRAFT')
  if (t.includes('payment reference')) bad('a draft has no number to reference')
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-pdf-document: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-pdf-document: the printed document carries its registration number, banking details, ' +
  'payment reference and the right heading for its VAT status, and prints no empty labels.',
)
