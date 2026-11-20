// Cardtly Solo (Andre, 2026-11-20): R49 a month or R450 a year, one person's
// card with limits. lib/solo has the rules, lib/paid-plans the Paystack side.
//
// WHAT THIS PROTECTS:
//   1. The prices (R49/R450, resellers R35/R350), the 5 templates, 4 links
//      and 2 gallery images.
//   2. A payment switches on the plan it was for, read from the payment: a
//      Solo payment never becomes Pro, team and older payments read as Pro
//      exactly as before, and Pro is never given for less than Pro's price.
//   3. The public card shows Solo's limits on every template, without
//      changing the stored card (so going back to Pro shows everything), and
//      has no booking, questionnaire, Context or contact form.
//   4. A team seat still gives Pro to someone who also pays for Solo.
//   5. The dashboard: Contacts and NFC open to Solo, the menus show Solo only
//      its own pages, no Team Cards, and Solo is left out of the Network.
//   6. Checkout: Solo is not sold before its Paystack plans exist, never on
//      top of Pro, and upgrading to Pro stops the Solo subscription.
//
// Run: node scripts/check-solo.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

const out = mkdtempSync(join(tmpdir(), 'solo-'))
let S, P
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/solo.ts', 'lib/paid-plans.ts', '--outDir', out, '--rootDir', '.',
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  const walk = (d) => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])
  for (const f of walk(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(f, readFileSync(f, 'utf8').replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(f, f.replace(/\.js$/, '.mjs'))
  }
  S = await import(pathToFileURL(join(out, 'lib', 'solo.mjs')).href)
  P = await import(pathToFileURL(join(out, 'lib', 'paid-plans.mjs')).href)
} catch (e) {
  console.error('check-solo: could not compile lib/solo.ts and lib/paid-plans.ts')
  console.error(String(e.stdout || e.message).slice(0, 1200))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. The plan ─────────────────────────────────────────────────────────────
eq({ ...S.SOLO_PRICE_RAND }, { monthly: 49, yearly: 450 }, 'Solo costs R49 a month or R450 a year')
eq({ ...S.SOLO_RESELLER_RAND }, { monthly: 35, yearly: 350 }, 'a reseller pays R35 a month or R350 a year for Solo')
eq({ ...S.PRO_PRICE_RAND }, { monthly: 97, yearly: 970 }, 'Pro still costs R97 or R970')
eq([...S.SOLO_TEMPLATES], ['classic', 'modern', 'wave', 'split', 'neon'], 'Solo has exactly the 5 templates Andre named')
eq([S.SOLO_MAX_LINKS, S.SOLO_MAX_IMAGES], [4, 2], 'Solo shows 4 links and 2 gallery images')
eq(P.PLAN_CATALOG.solo.monthly.cents, 4900, 'Solo monthly charges 4900 cents')
eq(P.PLAN_CATALOG.solo.yearly.cents, 45000, 'Solo yearly charges 45000 cents')
eq([P.PLAN_CATALOG.pro.monthly.cents, P.PLAN_CATALOG.pro.yearly.cents], [9700, 97000], 'Pro charges are unchanged')
eq(P.planIdFor('solo', 'monthly'), 'paystack_solo_monthly', 'a Solo plan id')
if (!P.planIdFor('solo', 'yearly').startsWith('paystack')) bad('a Solo plan id must start with paystack, which cancelling and reconciling look for')
eq(P.planIdFor('pro', 'yearly'), 'paystack_yearly', 'the Pro plan id is unchanged')
eq(S.templateAllowed('solo', 'showroom'), false, 'Showroom is not a Solo template')
eq(S.templateAllowed('pro', 'showroom'), true, 'Pro has every template')
eq(S.soloTemplate('frost'), 'classic', 'a Solo card on a Pro template shows as Classic')
eq(S.soloTemplate('neon'), 'neon', 'a Solo template is kept')

// ── 2. Which plan a payment switches on ─────────────────────────────────────
const tx = (o) => ({ amount: 4900, metadata: {}, ...o })
eq(P.paidPlanOf(tx({ metadata: { tier: 'solo', plan: 'monthly' } })), { tier: 'solo', cycle: 'monthly' }, 'a Solo monthly payment')
eq(P.paidPlanOf(tx({ amount: 45000, metadata: JSON.stringify({ tier: 'solo', plan: 'yearly' }) })), { tier: 'solo', cycle: 'yearly' }, 'a Solo yearly payment, metadata as a string')
eq(P.planForActivation(tx({ amount: 100, metadata: { tier: 'solo', plan: 'monthly' } })), null, 'a Solo payment that does not add up switches nothing on')
eq(P.planForActivation(tx({ amount: 9700, metadata: { tier: 'solo', plan: 'monthly' } })), null, 'a Solo payment is never read as Pro')
eq(P.planForActivation(tx({ amount: 9700, metadata: { plan: 'monthly', action: 'pro_subscription' } })), { tier: 'pro', cycle: 'monthly' }, 'a Pro monthly payment')
eq(P.planForActivation(tx({ amount: 97000, metadata: { plan: 'yearly' } })), { tier: 'pro', cycle: 'yearly' }, 'a Pro yearly payment')
eq(P.planForActivation(tx({ amount: 6500, metadata: { plan: 'monthly' } })), { tier: 'pro', cycle: 'monthly' }, 'an older renewal at an older price still reads as Pro, as before')
eq(P.planForActivation(tx({ amount: 29100, metadata: { action: 'team_subscription', org_id: 'x' } })), { tier: 'pro', cycle: 'monthly' }, 'a team payment reads as Pro, as before')
eq(P.paidPlanOf(tx({ amount: 6500, plan: 'PLN_lkf7hy3v4mp8w3u', metadata: {} })), { tier: 'pro', cycle: 'monthly' }, 'the Pro plan code decides, whatever the amount')
eq(P.paidPlanOf(tx({ amount: 100, metadata: { plan: 'monthly' } })), null, 'never Pro for less than Pro costs, from the metadata alone')
eq(P.isSoloPlanCode(''), false, 'an empty plan code is not Solo')
eq(P.soloOnSale(), true, 'Solo is on sale: both Paystack plans are set')
eq(P.paidPlanOf(tx({ amount: 4900, plan: 'PLN_1u5pk5f8h37xr8n' })), { tier: 'solo', cycle: 'monthly' }, 'the Solo monthly plan code')
eq(P.paidPlanOf(tx({ amount: 45000, plan_object: { plan_code: 'PLN_06rg37pg6kicdtb' } })), { tier: 'solo', cycle: 'yearly' }, 'the Solo yearly plan code')
eq(P.isSoloPlanCode('PLN_lkf7hy3v4mp8w3u'), false, 'the Pro plan is not Solo')

// ── 3. The public card on Solo ──────────────────────────────────────────────
const card = { id: 'c', color_theme: JSON.stringify({ templateId: 'showroom', showBooking: true, accentColor: 'blue' }),
  addons: { questionnaireEnabled: true, context: { enabled: true }, cardtlyBadge: false, contactExchange: true } }
for (let i = 1; i <= 10; i++) { card[`link_${i}_title`] = `L${i}`; card[`link_${i}_url`] = `https://x/${i}`; card[`image_${i}_url`] = `https://i/${i}` }
const before = JSON.stringify(card)
const v = S.soloCardView(card)
eq(JSON.stringify(card), before, 'soloCardView never changes the stored card')
eq([1, 2, 3, 4, 5, 10].map(i => !!v[`link_${i}_url`]), [true, true, true, true, false, false], 'Solo shows links 1 to 4 only')
eq([1, 2, 3, 10].map(i => !!v[`image_${i}_url`]), [true, true, false, false], 'Solo shows gallery images 1 and 2 only')
const d = JSON.parse(v.color_theme)
eq([d.templateId, d.showBooking, d.accentColor], ['classic', false, 'blue'], 'a Pro template becomes Classic, booking is off, the rest of the design stays')
eq([v.addons.questionnaireEnabled, 'context' in v.addons, 'cardtlyBadge' in v.addons, v.addons.contactExchange],
  [false, false, false, true], 'no questionnaire or Context, the Cardtly badge shows, the share-back prompt that fills Contacts stays')
eq(JSON.parse(S.soloCardView({ color_theme: null }).color_theme).showBooking, false, 'a card with no design still gets no booking')

// ── 4 to 6. Wiring ──────────────────────────────────────────────────────────
const ps = read('lib/plan-server.ts')
if (!/sub\.subscription_tier !== 'pro' && sub\.subscription_tier !== 'solo'/.test(ps)) bad('subscriptionState must let a Solo subscription serve the card')
if (!/if \(state\.tier !== 'solo'\) return \{ tier: 'pro'/.test(ps) || !/if \(solo\) return solo/.test(ps)) bad('getUserPlan must hold Solo back until the team checks have run')

const init = read('app/api/paystack/initialize/route.ts')
if (!/if \(!soloOnSale\(\)\)/.test(init)) bad('Solo must not be sold before its Paystack plans exist')
if (!/current\.tier === 'pro' && current\.isActive && !current\.isTrial && !current\.isPastDue/.test(init)) bad('Solo must never be bought on top of a Pro plan')
if (!/metadata: \{[^}]*\btier,/.test(init)) bad('checkout must label the payment with its tier')

for (const f of ['app/upgrade/verify/page.tsx', 'app/api/paystack/verify/route.ts', 'app/api/webhooks/paystack/route.ts']) {
  const src = read(f)
  if (!/planForActivation\(/.test(src)) bad(`${f} must read the plan from the payment (planForActivation)`)
  if (/subscription_tier: 'pro'/.test(src)) bad(`${f} still writes Pro whatever was bought`)
}
for (const f of ['app/upgrade/verify/page.tsx', 'app/api/paystack/verify/route.ts']) {
  if (!/txMetadata\((transaction|data\.data)\)\.user_id \|\| user/i.test(read(f))) bad(`${f} must take the account from the payment, not the return address`)
}
if (!/bought\.tier === 'pro' && s\.status === 'active' && isSoloPlanCode\(s\.plan_code\)/.test(read('app/api/webhooks/paystack/route.ts'))) bad('paying for Pro must stop a Solo subscription, or an upgrade bills twice')
if (!/plan_code: s\.plan\?\.plan_code \?\? null/.test(read('lib/paystack.ts'))) bad('Paystack subscriptions must carry their plan code, to tell Solo from Pro')

const pcv = read('components/card/PublicCardView.tsx')
if (!/const card = props\.tier === 'solo' \? soloCardView\(props\.card\) : props\.card/.test(pcv)) bad('the public card must apply soloCardView before anything reads the card')
if (!/\{isPro && leadCapture && \(/.test(pcv) || !/leadCapture: tier !== 'solo'/.test(pcv)) bad('the share-your-details form must be off on Solo')
if (!/tier=\{tier\}/.test(read('app/card/[slug]/page.tsx'))) bad('the public card page must say which plan the card is on')
if (!/tier=\{tier\}/.test(read('components/card/CardPreview.tsx'))) bad('the editor preview must show Solo as the public will')

const ed = read('components/card/CardEditor.tsx')
if (!/const maxLinks = solo \? SOLO_MAX_LINKS : MAX_CUSTOM_LINKS/.test(ed) || !/const maxPhotos = solo \? SOLO_MAX_IMAGES : MAX_GALLERY_IMAGES/.test(ed)) bad('the editor must offer Solo only its links and photos')
if (!/const locked = solo \? !templateAllowed\('solo', t\.id\)/.test(read('components/card/DesignPanel.tsx'))) bad('the template picker must lock everything but Solo\'s five')

for (const f of ['components/dashboard/Sidebar.tsx', 'components/dashboard/MobileBottomNav.tsx']) {
  if (!/soloShows\(/.test(read(f))) bad(`${f} must show Solo only its own pages`)
}
if (!/const showTeamCards = showTeamCardsAll && !solo/.test(read('app/dashboard/layout.tsx'))) bad('Team Cards must not be offered to Solo: a Solo card is never a team')
for (const f of ['app/dashboard/contacts/page.tsx', 'app/dashboard/nfc/page.tsx']) {
  if (!/hasCard\(plan\)/.test(read(f))) bad(`${f} must be open to Solo`)
}
eq(['/dashboard/contacts', '/dashboard/qr', '/dashboard/nfc', '/dashboard/analytics', '/dashboard/network', '/dashboard/team'].map(S.soloShows),
  [true, true, true, false, false, false], 'Solo\'s menu: QR Code, Contacts and NFC, not Analytics, the Network or Team Cards')
if (!/!soloUsers\.has\(r\.user_id\)/.test(read('lib/network.ts'))) bad('Solo cards must be left out of the Network directory')

const up = read('components/upgrade/UpgradeView.tsx')
if (!/handleCheckout\(tier\)/.test(up) || !/body: JSON\.stringify\(\{ plan: billing, tier \}\)/.test(up)) bad('the plan page must sell both Solo and Pro')
if (!/charged in South African rand \(ZAR\)/.test(up)) bad('the recurring terms must sit next to the pay button')

if (!/check-solo\.mjs/.test(read('package.json'))) bad('prebuild must run this check')
for (const f of ['lib/solo.ts', 'lib/paid-plans.ts', 'components/upgrade/UpgradeView.tsx', 'app/api/paystack/initialize/route.ts']) {
  if (read(f).includes('—')) bad(`${f} has an em dash`)
}

if (fail) { console.error(`check-solo: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-solo: ok (R49/R450, resellers R35/R350, 5 templates, 4 links, 2 photos; payments switch on what was paid for; Solo limits on every template without touching the card; team seats still Pro; Solo menus, no Network; never Solo on Pro, upgrades stop Solo)')
