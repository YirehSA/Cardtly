// Is the invoice email safe to send to somebody else's accounts department?
//
// Two things this catches that nothing else does.
//
// ESCAPING. A client name, and the note typed by whoever is sending, both go
// into an HTML email that leaves our control. Cardtly does not choose those
// strings - a client is called whatever the client is called - so an apostrophe
// or an angle bracket in a company name must not be able to break the markup,
// and a note must not be able to carry script into somebody's inbox.
//
// THE SNAPSHOT. The banking details in the email body have to be the ones on
// the attached PDF. They come off the document's own snapshot for that reason,
// and a refactor that quietly swaps them for current settings would produce an
// email whose bank details disagree with its own attachment.
//
// Run: node scripts/check-billing-email.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'bmail-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/billing-email-templates.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
  M = await import(pathToFileURL(join(out, 'billing-email-templates.js')).href)
  if (typeof M.renderInvoiceEmail !== 'function') throw new Error('renderInvoiceEmail was not exported')
} catch (e) {
  console.error('check-billing-email: could not compile lib/billing-email-templates.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const BANK = {
  bankName: 'First National Bank (FNB)', accountName: 'Cardtly',
  accountNumber: '63174887712', branchCode: '255355', accountType: 'Current Account',
}
const FROM = { legalName: 'Cardtly (Pty) Ltd', regNumber: '2025/727173/07', email: 'hello@cardtly.com' }

const base = {
  number: 'INV-2026-1001',
  clientName: 'Acme Holdings (Pty) Ltd',
  totalFormatted: 'R5 616.60',
  dueDate: '2026-09-30',
  from: FROM,
  bank: BANK,
}

// ── Everything an accounts department needs to pay it ─────────────────────
{
  const { subject, html } = M.renderInvoiceEmail(base)
  for (const must of [
    'INV-2026-1001', 'Acme Holdings (Pty) Ltd', 'R5 616.60', '2026-09-30',
    'First National Bank (FNB)', '63174887712', '255355', 'Current Account',
    'Cardtly (Pty) Ltd', '2025/727173/07',
  ]) {
    if (!html.includes(must)) bad(`the email is missing "${must}"`)
  }
  if (!html.includes('payment reference')) bad('the email must state the payment reference')
  if (!subject.includes('INV-2026-1001')) bad('the subject must carry the invoice number')
  if (/reminder/i.test(subject)) bad('a first send must not call itself a reminder')
  // The card wording from the other templates must not leak onto a document
  // sent to somebody who has no Cardtly card.
  if (/because you have a Cardtly card/i.test(html)) {
    bad('the invoice email tells the recipient they signed up for a card')
  }
}

// ── A reminder says so ────────────────────────────────────────────────────
{
  const { subject, html } = M.renderInvoiceEmail({ ...base, isReminder: true })
  if (!/reminder/i.test(subject)) bad('a reminder must say so in the subject')
  if (!/reminder/i.test(html)) bad('a reminder must say so in the body')
}

// ── Part paid asks for the balance, not the whole amount again ────────────
{
  const { html } = M.renderInvoiceEmail({ ...base, outstandingFormatted: 'R1 616.60' })
  if (!html.includes('R1 616.60')) bad('a part-paid invoice must show what is still owing')
  if (!html.includes('Still owing')) bad('the outstanding amount must be labelled')
}
{
  // When nothing is paid, the two figures are the same and the extra row is
  // noise, so it must not appear.
  const { html } = M.renderInvoiceEmail({ ...base, outstandingFormatted: 'R5 616.60' })
  if (html.includes('Still owing')) bad('an unpaid invoice should not repeat the total as "still owing"')
}

// ── Escaping ──────────────────────────────────────────────────────────────
{
  const hostile = '<script>alert(1)</script>'
  const { html } = M.renderInvoiceEmail({
    ...base,
    clientName: `Acme & Sons ${hostile}`,
    message: `Thanks! ${hostile}`,
    number: `INV-1<b>`,
    from: { ...FROM, legalName: `Cardtly ${hostile}` },
    bank: { ...BANK, accountName: `Cardtly ${hostile}` },
  })
  if (html.includes('<script>')) bad('a raw <script> tag survived into the email body')
  if (html.includes('alert(1)</script>')) bad('an unescaped closing script tag survived')
  if (!html.includes('&lt;script&gt;')) bad('hostile input was not escaped at all')
  if (!html.includes('Acme &amp; Sons')) bad('an ampersand in a client name was not escaped')
}

// ── No banking details, no banking block ──────────────────────────────────
{
  const { html } = M.renderInvoiceEmail({ ...base, bank: null })
  if (/BANKING DETAILS/.test(html)) bad('a banking block printed with no bank details')
  if (/payment reference/.test(html)) bad('a payment reference printed with nowhere to pay')
}

// ── Reminders escalate ────────────────────────────────────────────────────
// The same sentence sent three times reads as an autoresponder nobody is
// behind, and a first nudge written like a final demand loses a client over an
// invoice that went to a spam folder.
{
  const at = (stage, isFinal, daysOverdue) =>
    M.renderInvoiceEmail({ ...base, isReminder: true, reminderStage: { stage, isFinal, daysOverdue } })

  const first = at(1, false, 3)
  const second = at(2, false, 14)
  const final = at(3, true, 30)

  if (first.html === second.html) bad('a second reminder is word for word the first')
  if (second.html === final.html) bad('a final notice is word for word the second reminder')
  if (!/final notice/i.test(final.subject)) bad('a final notice must say so in the subject')
  if (/final/i.test(first.subject)) bad('a first nudge must not read as a final notice')

  // The tone has to actually differ, not just the heading.
  if (!/spam|wrong folder|already been paid/i.test(first.html)) {
    bad('the first nudge should assume it is an oversight')
  }
  if (!/escalate|remains unpaid/i.test(final.html)) bad('a final notice should say what is at stake')

  // Days overdue is a fact the client can check, so it must be in the body.
  if (!first.html.includes('3 days')) bad('the first reminder does not say how overdue it is')
  if (!final.html.includes('30 days')) bad('the final notice does not say how overdue it is')

  // A plain send with no stage must still work and must not escalate.
  const plain = M.renderInvoiceEmail({ ...base, isReminder: true })
  if (/final notice/i.test(plain.subject)) bad('a reminder with no stage escalated on its own')
  if (!/reminder/i.test(plain.subject)) bad('a reminder with no stage stopped saying it is a reminder')
}

// ── The quote email ───────────────────────────────────────────────────────
const quoteBase = {
  number: 'Q-2026-1001',
  clientName: 'Acme Holdings (Pty) Ltd',
  totalFormatted: 'R4 884.00',
  validUntil: '2026-09-21',
  acceptUrl: 'https://cardtly.com/quote/9f3c1ab27d5e4610b8c2fe0947a3d156',
  from: FROM,
}
{
  const { subject, html } = M.renderQuoteEmail(quoteBase)
  for (const must of ['Q-2026-1001', 'Acme Holdings (Pty) Ltd', 'R4 884.00', '2026-09-21']) {
    if (!html.includes(must)) bad(`the quote email is missing "${must}"`)
  }
  if (!subject.includes('Q-2026-1001')) bad('the quote subject must carry the quote number')
  if (/invoice/i.test(subject)) bad('a quote must not call itself an invoice in the subject')
  // The button is the point: a PDF can be read but not accepted.
  if (!html.includes(`href="${quoteBase.acceptUrl}"`)) bad('the accept link must be the button href')
  if (!/accept/i.test(html)) bad('the quote email must ask the client to accept')

  // The token IS the security. Printed as visible text it becomes a URL people
  // read out, screenshot and forward.
  const visible = html.replace(/<[^>]+>/g, ' ')
  if (visible.includes('9f3c1ab27d5e4610b8c2fe0947a3d156')) {
    bad('the accept token is printed as visible text, not just as a link target')
  }
}
{
  // Same escaping rule as the invoice: a client name is not a string Cardtly
  // chooses.
  const { html } = M.renderQuoteEmail({
    ...quoteBase,
    clientName: 'Acme <script>alert(1)</script> & Sons',
    message: 'Hi <script>alert(2)</script>',
  })
  if (html.includes('<script>')) bad('a raw <script> tag survived into the quote email')
  if (!html.includes('&lt;script&gt;')) bad('hostile input in the quote email was not escaped')
  if (!html.includes('&amp; Sons')) bad('an ampersand in a client name was not escaped in the quote email')
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-billing-email: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-billing-email: the invoice email carries its number, total, due date and banking details ' +
  'and says when it is a reminder; the quote email carries its accept link without printing the token; ' +
  'both escape every string Cardtly does not control.',
)
