// Sign-up chooses a plan (Andre, 2026-11-20): "we don't want to promote the
// trial, they must actually just choose between the 2 and if they don't want
// to then we offer the 7 day free trial", and the trial is Cardtly Solo.
//
// WHAT THIS PROTECTS:
//   1. A new account starts with no plan and no trial (migration 109), and
//      nothing reads that as a running trial: its card is offline, the
//      dashboard asks it to choose, admin says "No plan yet".
//   2. Every account from before keeps its trial and its Pro, unchanged.
//   3. The trial is offered only as the quiet fallback (the plan page, the
//      payment-cancelled page, one email), is Solo, 7 days, once, never after a
//      subscription, and cannot be set by the user.
//   4. A rep's trial code still works for a new account and still gives Pro.
//   5. The sign-up page sells the choice, not the trial, and the reminder
//      emails name both plans.
//
// Run: node scripts/check-signup-plan.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const has = (f, re, msg) => { if (!re.test(read(f))) bad(`${f}: ${msg}`) }
const hasNot = (f, re, msg) => { if (re.test(read(f))) bad(`${f}: ${msg}`) }

// ── 1 and 2. The data and the rule ──────────────────────────────────────────
const mig = read('supabase/migrations/109_signup_choose_plan.sql')
if (!mig) bad('migration 109 is missing')
if (!/add column if not exists trial_tier text\s+check \(trial_tier in \('none', 'solo', 'pro'\)\)/.test(mig)) bad('109 must add trial_tier, nullable, with only none/solo/pro')
if (!/alter column trial_tier set default 'none'/.test(mig)) bad('109: new accounts must start with no trial')
if (!/alter column trial_ends_at set default now\(\)/.test(mig)) bad('109: a new account must not get a running 7-day trial by default')
if (/update public\.profiles/i.test(mig)) bad('109 must not change any existing account: every running trial stays as it is')
if (!/'card_live', 'choose_plan'\)\)/.test(mig)) bad('109 must allow the choose_plan email')

const ps = read('lib/plan-server.ts')
if (!/if \(trialTier === 'none'\) \{\s*return \{ tier: 'expired', isActive: false, isTrial: false, needsPlan: true/.test(ps)) bad('planFromTrial must read a new account with no plan as not live, needing a plan')
if (!/const tier = trialTier === 'solo' \? 'solo' : 'pro'/.test(ps)) bad('a Solo trial must be Solo, and every older trial still Pro')
if (!/if \(error && isMissingColumn\(error\)\) \(\{ data, error \} = await run\(base\)\)/.test(ps.slice(ps.indexOf('export async function profileTrialFor')))) bad('profileTrialFor must fall back before migration 109, never fail open')
has('lib/plan-server.ts', /return planFromTrial\(profile\?\.trial_ends_at \?\? null, profile\?\.trial_tier \?\? null\)/, 'getUserPlan must pass trial_tier to planFromTrial')
has('app/card/[slug]/page.tsx', /profileTrialFor\(admin, \(card as any\)\.user_id/, 'the public card must read the trial through profileTrialFor')
has('app/card/[slug]/page.tsx', /planFromTrial\(\(profile as any\)\?\.trial_ends_at \?\? null, \(profile as any\)\?\.trial_tier \?\? null\)/, 'the public card must know a new account has no plan')
has('app/dashboard/page.tsx', /if \(plan\.needsPlan && !iosApp\) redirect\('\/dashboard\/upgrade'\)/, 'a new account must be taken to the plan page')
has('components/upgrade/UpgradeScreen.tsx', /plan\.needsPlan \? 'choose'/, 'the plan page must greet a new account, not say a trial ended')
has('components/settings/SettingsTabs.tsx', /if \(plan\.needsPlan\) return 'choose' as const/, 'Settings must say "No plan yet", not "trial ended"')
has('lib/admin-data.ts', /else if \(p\.trial_tier === 'none'\) status = 'none'/, 'admin must show "No plan yet"')

// ── 3. The trial, only as the fallback ──────────────────────────────────────
const st = read('lib/signup-trial.ts')
if (!/export const SIGNUP_TRIAL_DAYS = 7/.test(st)) bad('the fallback trial is 7 days')
if (!/\.update\(\{ trial_tier: 'solo', trial_ends_at: endsAt \}\)\s*\.eq\('user_id', userId\)\.eq\('trial_tier', 'none'\)/.test(st)) bad('the trial must be Solo, and claimed compare-and-set from "no plan" so it starts once')
if (!/if \(\(count \?\? 0\) > 0\)/.test(st)) bad('the trial must not be given to an account that has had a subscription')
has('app/api/trial/start/route.ts', /isIosAppUA\(/, 'the trial must not start in the iOS app')
has('app/api/trial/start/route.ts', /startSoloTrial\(createServiceClient\(\)/, 'only the server sets the trial (the user cannot write trial_tier)')
const view = read('components/upgrade/UpgradeView.tsx')
const trialLinks = [...view.matchAll(/onClick=\{startTrial\}/g)].map(m => m.index)
if (trialLinks.length !== 1) bad(`the plan page must offer the trial exactly once, found ${trialLinks.length}`)
else if (!/\{state === 'choose' && \(\s*<p[\s\S]{0,200}$/.test(view.slice(Math.max(0, trialLinks[0] - 260), trialLinks[0]))) bad('the plan page must offer the trial only to a new account with no plan')
has('app/upgrade/cancel/page.tsx', /offerTrial = !!\(await getUserPlan\(user\.id\)\)\.needsPlan/, 'the cancelled page must offer the trial only to an account with no plan')
has('app/upgrade/cancel/page.tsx', /\{offerTrial && <TrialFallback \/>\}/, 'the cancelled page must show the fallback when it applies')

// ── 4. Trial codes ──────────────────────────────────────────────────────────
has('app/api/trial-code/claim/route.ts', /const neverTrialled = \(profile as any\)\?\.trial_tier === 'none'/, 'a new account must be able to use a trial code')
has('app/api/trial-code/claim/route.ts', /\.\.\.\(tierKnown \? \{ trial_tier: 'pro' \} : \{\}\)/, 'a trial code still gives Pro')

// ── 5. The sign-up page and the emails ──────────────────────────────────────
const su = read('app/signup/SignupForm.tsx')
if (/Start 7 days free/.test(su)) bad('the sign-up page must not advertise the trial')
if (!/: codeTrialStarted \? '\/dashboard'\s*: '\/dashboard\/upgrade'/.test(su)) bad('after signing up, a new account goes to choose a plan')
if ([...su.matchAll(/setIntent\('trial'\)/g)].length) bad('only the iOS app may sign up into a trial')
if (!/R\{SOLO_PRICE_RAND\.monthly\} a month or Pro at R\{PRO_PRICE_RAND\.monthly\} a month/.test(su)) bad('the sign-up page must say what each plan costs, from lib/solo')

const cron = read('app/api/cron/trial-reminders/route.ts')
if ([...cron.matchAll(/p\.trial_tier === 'none'\) continue/g)].length < 2) bad('a new account with no plan must never get the trial-ended or card-live emails')
if (!/kind: 'choose_plan'/.test(cron) || !/if \(!userId \|\| p\.trial_tier !== 'none'\) continue/.test(cron)) bad('a new account with no plan must get the choose-a-plan email')
if (!/if \(res\.error && isMissingColumn\(res\.error\)\) res = await run\('user_id, name, trial_ends_at'\)/.test(cron)) bad('the reminders must keep running before migration 109')

const out = mkdtempSync(join(tmpdir(), 'signup-plan-'))
let T
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/trial-email-templates.ts', '--outDir', out, '--rootDir', '.',
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  const walk = (d) => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])
  for (const f of walk(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(f, readFileSync(f, 'utf8').replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(f, f.replace(/\.js$/, '.mjs'))
  }
  T = await import(pathToFileURL(join(out, 'lib', 'trial-email-templates.mjs')).href)
} catch (e) {
  bad(`could not compile lib/trial-email-templates.ts: ${String(e.stdout || e.message).slice(0, 300)}`)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}
if (T) {
  const base = { firstName: 'Ann', slug: 'ann', daysLeft: 3 }
  const choose = T.renderTrialEmail({ ...base, kind: 'choose_plan' })
  if (!/R49 a month/.test(choose.html) || !/R97 a month/.test(choose.html)) bad('the choose-a-plan email must name both plans and their prices')
  if (!/try Solo free for 7 days/.test(choose.html)) bad('the choose-a-plan email offers the trial, as the fallback')
  for (const kind of ['card_live', 'trial_7d', 'trial_1d', 'trial_expired']) {
    const m = T.renderTrialEmail({ ...base, kind })
    if (!/R49 a month/.test(m.html)) bad(`the ${kind} email must offer Solo as well as Pro`)
    if (/Subscribe for R97|R97\/month/.test(m.html)) bad(`the ${kind} email still sells R97 alone`)
    if (/free for 7 days/.test(m.html)) bad(`the ${kind} email must not advertise the trial`)
  }
}

if (!/check-signup-plan\.mjs/.test(read('package.json'))) bad('prebuild must run this check')
for (const f of ['lib/signup-trial.ts', 'app/api/trial/start/route.ts', 'components/upgrade/TrialFallback.tsx', 'supabase/migrations/109_signup_choose_plan.sql']) {
  if (read(f).includes('—')) bad(`${f} has an em dash`)
}

if (fail) { console.error(`check-signup-plan: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-signup-plan: ok (new accounts start with no plan and are asked to choose; older trials unchanged; the trial is a quiet, once-only, 7-day Solo fallback; codes still Pro; sign-up and emails name both plans)')
