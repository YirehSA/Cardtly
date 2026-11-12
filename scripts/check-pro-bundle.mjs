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
let B
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/pro-bundle.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
} catch (e) {
  // Type noise from unrelated files still emits; a missing output is the failure.
}
try {
  writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}')
  B = createRequire(join(out, 'x.js'))('./pro-bundle.js')
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

rmSync(out, { recursive: true, force: true })

// 4. The wiring, read from the source.
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

// 5. The price on public pages comes from the constant.
for (const f of ['app/pricing/page.tsx', 'app/nfc/page.tsx', 'components/upgrade/UpgradeView.tsx', 'components/upgrade/BundleCheckout.tsx']) {
  if (/R999\b/.test(read(f))) bad(`${f} types R999; use BUNDLE_PRICE_RAND so the page cannot drift from the charge`)
}
const llms = read('public/llms.txt')
if (!llms.includes(`R${B.BUNDLE_PRICE_RAND} once`) || !llms.includes(`renews at R${B.bundleRenewalRand()} a year`)) {
  bad(`public/llms.txt must state the bundle as R${B.BUNDLE_PRICE_RAND}, renewing at R${B.bundleRenewalRand()} a year`)
}

if (fail) {
  console.error(`check-pro-bundle: ${fail} problem${fail === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`check-pro-bundle: R${B.BUNDLE_PRICE_RAND} bundle holds (renews at R${B.bundleRenewalRand()}, saves R${B.bundleSavingRand()}+, once-only, card-only, iOS closed)`)
