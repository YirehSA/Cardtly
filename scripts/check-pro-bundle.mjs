// Does the Pro year + NFC card bundle (R999) still hold together?
//
// The bundle is money taken once and a subscription that starts a year later,
// completed from two places that can run in the same second. The ways it can
// go wrong are all quiet: a payment written as a plain yearly plan with no card
// and no renewal, two cards printed for one payment, a renewal charged a day
// early, a price typed into a page that then drifts from the one charged.
//
// Run: node scripts/check-pro-bundle.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const out = mkdtempSync(join(tmpdir(), 'bundle-'))
let B, E
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/pro-bundle.ts', 'lib/pro-bundle-email.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
} catch (e) {
  // Type noise from unrelated files still emits; a missing output is the failure.
}
try {
  writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}')
  const req = createRequire(join(out, 'x.js'))
  B = req('./pro-bundle.js')
  E = req('./pro-bundle-email.js')
} catch (e) {
  console.error('check-pro-bundle: could not compile lib/pro-bundle.ts')
  console.error(String(e.message).slice(0, 600))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const eq = (label, got, want) => { if (got !== want) bad(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

// 1. The figures.
eq('price', B.BUNDLE_PRICE_RAND, 999)
eq('renews at the yearly price', B.bundleRenewalRand(), 970)
eq('bought separately, standard', B.bundleSeparateRand('standard'), 970 + 150 + 100)
eq('bought separately, custom', B.bundleSeparateRand('custom'), 970 + 200 + 100)
eq('saving advertised is the smaller one', B.bundleSavingRand(), 1220 - 999)
if (B.bundleSavingRand() <= 0) bad('the bundle must cost less than buying the parts')

// 2. The renewal date: a year on, never a day early, never a day late.
const iso = (d) => d.toISOString()
eq('ordinary day', iso(B.bundleRenewalDate(new Date('2026-11-12T10:15:00Z'))), '2027-11-12T10:15:00.000Z')
eq('29 February renews on 28 February', iso(B.bundleRenewalDate(new Date('2028-02-29T08:00:00Z'))), '2029-02-28T08:00:00.000Z')
eq('31 January', iso(B.bundleRenewalDate(new Date('2027-01-31T00:00:00Z'))), '2028-01-31T00:00:00.000Z')
eq('31 December', iso(B.bundleRenewalDate(new Date('2026-12-31T23:59:59Z'))), '2027-12-31T23:59:59.000Z')

// 3. The card and delivery details.
const good = { tier: 'custom', colour: 'white', nameOnCard: '  Thandi   Nkosi ', titleOnCard: '', address: '1 Main Rd', city: 'Benoni', province: 'Gauteng', postalCode: '1 501' }
const ok = B.parseBundleOrder(good)
if (!ok.ok) bad(`a good order was refused: ${ok.error}`)
else {
  eq('name is tidied', ok.order.nameOnCard, 'Thandi Nkosi')
  eq('empty title is null', ok.order.titleOnCard, null)
  eq('postal code spaces removed', ok.order.postalCode, '1501')
  eq('tier kept', ok.order.tier, 'custom')
  if ('price' in ok.order || 'amount' in ok.order) bad('the order must not carry a price from the browser')
}
const refuse = (label, patch) => { const r = B.parseBundleOrder({ ...good, ...patch }); if (r.ok) bad(`should refuse: ${label}`) }
refuse('unknown design', { tier: 'gold' })
refuse('unknown colour', { colour: 'red' })
refuse('no name', { nameOnCard: '   ' })
refuse('no address', { address: '' })
refuse('a province that is not one', { province: 'Gautang' })
refuse('a 5 digit postal code', { postalCode: '15011' })
refuse('a postal code with letters', { postalCode: '15a1' })
if (B.parseBundleOrder({ ...good, nameOnCard: 'x'.repeat(500) }).order?.nameOnCard.length !== 60) bad('name on card must be capped at 60')

// 4. The two emails: Cardtly must see at once that this is the package and
// that a card has to be made and shipped; the customer must see what they
// bought. Nothing the customer typed may become markup.
{
  const order = { tier: 'custom', colour: 'white', nameOnCard: 'Thandi <b>Nkosi</b>', titleOnCard: 'Agent', address: '1 Main <script>x</script> Rd', city: 'Benoni', province: 'Gauteng', postalCode: '1501' }
  const input = {
    customerEmail: 'thandi@example.com', order, rawOrder: order, cardUrl: 'https://www.cardtly.com/card/thandi',
    reference: 'ref123', orderId: 'ord1', paidOn: new Date('2026-11-12T10:00:00Z'), proUntil: new Date('2027-11-12T10:00:00Z'),
    renewal: { ok: true, code: 'SUB_abc' },
  }
  const a = E.bundleAdminEmail(input)
  const c = E.bundleCustomerEmail(input)
  const must = (label, text, bits) => { for (const b of bits) if (!text.includes(b)) bad(`${label} is missing "${b}"`) }
  must('admin subject', a.subject, ['ACTION NEEDED', `R${B.BUNDLE_PRICE_RAND}`, B.BUNDLE_NAME, 'NFC card'])
  must('admin email', a.html, ['Do not send an invoice', 'proof', 'Print the card', 'Write the NFC chip', 'https://www.cardtly.com/card/thandi', 'Custom design', 'White', 'Benoni', '1501', 'Shipped', 'SUB_abc', 'thandi@example.com'])
  must('admin text', a.text, ['do not send an invoice', 'Write the NFC chip', '1501'])
  must('customer subject', c.subject, ['confirmed', B.BUNDLE_NAME])
  must('customer email', c.html, [`R${B.BUNDLE_PRICE_RAND}`, '1 year', 'NFC card', 'proof', '5 to 7 business days', `R${B.bundleRenewalRand()} a year`, 'cancel any time', 'Benoni'])
  for (const [label, html] of [['admin', a.html], ['customer', c.html]]) {
    if (/<script>|<b>Nkosi<\/b>/.test(html)) bad(`the ${label} email lets customer input become markup`)
  }
  if (/[\r\n]/.test(a.subject + c.subject)) bad('an email subject must be one line')
  const failed = E.bundleAdminEmail({ ...input, renewal: { ok: false, error: 'not reusable' } })
  must('admin email when the renewal failed', failed.html, ['NOT set up', 'not reusable'])
  const blank = E.bundleAdminEmail({ ...input, order: null, rawOrder: { x: 1 } })
  must('admin email without card details', blank.html, ['did not come through'])
}

rmSync(out, { recursive: true, force: true })

// 5. The wiring, read from the source.
const server = read('lib/pro-bundle-server.ts')
const hook = read('app/api/webhooks/paystack/route.ts')
const verifyPage = read('app/upgrade/verify/page.tsx')
const verifyApi = read('app/api/paystack/verify/route.ts')
const route = read('app/api/paystack/bundle/route.ts')
const mig = read('supabase/migrations/106_nfc_bundle_orders.sql')
const platform = read('lib/app-platform.ts')

const hookBundle = hook.indexOf('isBundleTransaction(event.data)')
const hookPlain = hook.indexOf("else if (event.event === 'charge.success')")
if (hookBundle < 0 || hookPlain < 0 || hookBundle > hookPlain) bad('the webhook must handle a bundle payment before, and instead of, the plain plan activation')
if (!/completeBundlePayment\(admin, event\.data/.test(hook)) bad('the webhook must complete bundle payments')
if (!/status: 500/.test(hook.slice(hookBundle, hookPlain))) bad('a bundle the webhook could not complete must answer 500 so Paystack retries')
for (const [name, src] of [['upgrade/verify page', verifyPage], ['api/paystack/verify', verifyApi]]) {
  if (!/if \(isBundleTransaction\((transaction|data\.data)\)\) \{/.test(src) || !/completeBundlePayment\(/.test(src)) bad(`${name} must hand a bundle payment to completeBundlePayment, not write a plain plan`)
}
if (!/channels: \['card'\]/.test(server)) bad('the bundle checkout must be card only: the renewal charges the same card next year')
if (!/amount: BUNDLE_AMOUNT_CENTS/.test(server)) bad('the checkout must charge BUNDLE_AMOUNT_CENTS')
if (!/Number\(tx\?\.amount\) !== BUNDLE_AMOUNT_CENTS/.test(server)) bad('completion must check the amount actually paid')
if (!/'23505'/.test(server) || !/paystack_reference: reference/.test(server)) bad('the order insert, keyed by the Paystack reference, must be the once-only lock')
if (!/plan: PAYSTACK_PLAN_CODES\.yearly/.test(server) || !/start_date: startDate\.toISOString\(\)/.test(server)) bad('the renewal must be the yearly plan, starting a year after payment')
if (!/cancel_at: renewsOn\.toISOString\(\), metadata: \{ \.\.\.rowFor\(\{\}\)\.metadata, renewal_failed/.test(server)) bad('if the renewal cannot be set up, Pro must end with the year paid for')
if (!/cancel_at: renewsOn\.toISOString\(\), metadata: \{ renewal_unknown: true \}/.test(server)) bad('a row written by the second caller must end with the year paid for')
if (!/bundleBlockedReason/.test(server) || !/status: 409/.test(server)) bad('someone already paying for Pro must be refused, or they are billed twice')
if (!/isMissingColumn\(probe\.error\)/.test(server)) bad('the checkout must stay closed until migration 106 has run')
if (!/unique index[\s\S]*paystack_reference/.test(mig)) bad('migration 106 must make nfc_orders.paystack_reference unique')
if (!/isIosAppUA\(/.test(route)) bad('the bundle checkout must refuse the iOS app (Guideline 3.1.1)')
if (!/'\/dashboard\/upgrade'/.test(platform)) bad("'/dashboard/upgrade' must stay blocked in the iOS app; it also covers /dashboard/upgrade/bundle")

// 6. The price on public pages comes from the constant, and every page that
// sells the package is closed to the iOS app.
for (const f of ['app/pricing/page.tsx', 'app/nfc/page.tsx', 'app/page.tsx', 'app/package/page.tsx', 'components/marketing/PackageOffer.tsx', 'components/marketing/LeadHero.tsx', 'app/signup/SignupForm.tsx', 'components/settings/SettingsTabs.tsx', 'components/upgrade/UpgradeView.tsx', 'components/upgrade/BundleCheckout.tsx']) {
  // Comments may name the package; only what reaches the page is checked.
  const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (/R999\b/.test(code)) bad(`${f} types R999; use BUNDLE_PRICE_RAND so the page cannot drift from the charge`)
}
if (!/'\/package'/.test(platform)) bad("'/package' must be in IOS_BLOCKED_ROUTES: it quotes a price")
if (!/'\/package',/.test(read('middleware.ts'))) bad("'/package' must be in the middleware matcher, or the iOS block never sees it")
if (!/["']\/signup\?package=1["']/.test(read('components/marketing/PackageOffer.tsx'))) bad('the offer button must lead to sign-up with ?package=1')
if (!/intent === 'package' \? '\/dashboard\/upgrade\/bundle'/.test(read('app/signup/SignupForm.tsx'))) bad('sign-up must send a package sign-up on to the package form')
const llms = read('public/llms.txt')
if (!llms.includes(`R${B.BUNDLE_PRICE_RAND} once`) || !llms.includes(`renews at R${B.bundleRenewalRand()} a year`)) {
  bad(`public/llms.txt must state the bundle as R${B.BUNDLE_PRICE_RAND}, renewing at R${B.bundleRenewalRand()} a year`)
}

if (fail) {
  console.error(`check-pro-bundle: ${fail} problem${fail === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`check-pro-bundle: R${B.BUNDLE_PRICE_RAND} bundle holds (renews at R${B.bundleRenewalRand()}, saves R${B.bundleSavingRand()}+, once-only, card-only, iOS closed)`)
