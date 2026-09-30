// The iOS app is for company teams only. Fails the build if an individual could
// get in, sign up, or be invited to.
//
// WHY (App Review, build 8, 2026-09-30, Guidelines 3.1.1 and 3.1.3(c)): Apple
// accepts a company paying Cardtly outside the App Store for its staff, but
// not an individual buying Pro on the website and using it in the app. Andre
// chose Apple's own suggested fix: the app serves organisations only. The rule
// is iosAppAdmits in lib/app-platform; this checks it is still the rule and
// still enforced.
//
//   1. iosAppAdmits admits a team owner, department head, team card holder or
//      staff member, and nobody else. Run, not grepped.
//   2. /signup, /network and /promotions are blocked in the app, and the
//      invite route /team/claim is NOT, or team members could not join.
//   3. The dashboard layout asks iosAppAdmits before rendering any dashboard,
//      and shows CompanyTeamsOnly instead when the answer is no.
//   4. CompanyTeamsOnly offers nothing to buy and no link out, and keeps
//      account deletion reachable (Guideline 5.1.1(v)).
//   5. No link to /signup reaches the app: every file that links to it either
//      lives at a blocked route, renders only on blocked routes, or rules the
//      app out. The magic link cannot create an account in the app either.
//   6. Middleware still refreshes the session on /signup for the web, so a
//      signed-in visitor there is still sent on to the dashboard.
//
// Run: node scripts/check-ios-teams-only.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1 and 2. The rule and the routes, run ───────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'ios-teams-'))
let P
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/app-platform.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  renameSync(join(out, 'app-platform.js'), join(out, 'app-platform.mjs'))
  P = await import(pathToFileURL(join(out, 'app-platform.mjs')).href)
} catch (e) {
  console.error('check-ios-teams-only: could not compile lib/app-platform.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const none = { isStaff: false, ownsTeam: false, managesDepartment: false, holdsTeamCard: false }
const admits = [
  ['an individual (no team at all)', none, false],
  ['a team owner', { ...none, ownsTeam: true }, true],
  ['a department head', { ...none, managesDepartment: true }, true],
  ['a team card holder', { ...none, holdsTeamCard: true }, true],
  ['Cardtly staff', { ...none, isStaff: true }, true],
]
if (typeof P.iosAppAdmits !== 'function') bad('lib/app-platform no longer exports iosAppAdmits, the rule for who the iOS app serves.')
else for (const [who, a, want] of admits) {
  if (P.iosAppAdmits(a) !== want) bad(`iosAppAdmits lets ${who} ${want ? 'NOT ' : ''}in; expected ${want ? 'in' : 'out'}.`)
}

const routes = [
  ['/signup', true], ['/signup/confirm', true], ['/network', true], ['/promotions', true],
  ['/team/claim/abc123', false], ['/login', false], ['/dashboard', false], ['/card/someone', false],
  ['/privacy', false], ['/terms', false], ['/delete-account', false], ['/forgot-password', false], ['/reset-password', false],
]
for (const [path, want] of routes) {
  if (P.isIosBlockedPath(path) !== want) {
    bad(want
      ? `${path} is reachable in the iOS app. It serves individuals, and the app is company teams only.`
      : `${path} is blocked in the iOS app, but it has to stay open there (team invites, sign-in, the legal pages or account deletion).`)
  }
}

// ── 3. The dashboard asks first ─────────────────────────────────────────────
const layout = read('app/dashboard/layout.tsx')
const gateAt = layout.search(/if \(iosApp\) \{\s*\n\s*const admitted = iosAppAdmits\(\{/)
const gate = gateAt >= 0 ? layout.slice(gateAt, gateAt + 900) : ''
if (!gate) bad('app/dashboard/layout.tsx no longer asks iosAppAdmits in the iOS app, so any individual who signs in gets the full dashboard.')
else {
  for (const key of ['isStaff: isAdmin', 'ownsTeam: ownedOrgsList.length > 0', 'managesDepartment: managedDeptsList.length > 0', 'holdsCompanyTeamCard(deptAdmin, user.id)']) {
    if (!gate.includes(key)) bad(`the dashboard's iOS gate no longer passes "${key}" to iosAppAdmits.`)
  }
  if (!/if \(!admitted\) \{\s*\n\s*return \(\s*\n\s*<ThemeProvider>\s*\n\s*<CompanyTeamsOnly /.test(gate)) {
    bad('the dashboard\'s iOS gate no longer returns <CompanyTeamsOnly> when iosAppAdmits says no.')
  }
  const sidebarAt = layout.search(/<Sidebar\b/)
  if (sidebarAt >= 0 && sidebarAt < gateAt) bad('the dashboard renders its Sidebar before the iOS gate is decided.')
}
const cardServer = read('lib/card-server.ts')
const holds = cardServer.match(/export async function holdsCompanyTeamCard[\s\S]*?\n\}/)?.[0] || ''
if (!holds) bad('lib/card-server.ts no longer has holdsCompanyTeamCard.')
else if (!/\.eq\('is_active', true\)/.test(holds) || !/\.not\('organization_id', 'is', null\)/.test(holds)) {
  bad('holdsCompanyTeamCard no longer requires an active card in an organisation, so a stray or switched-off card would let someone in.')
}

// ── 4. The screen an individual sees ────────────────────────────────────────
const screen = read('components/dashboard/CompanyTeamsOnly.tsx')
// Code only: the header comment names the things this screen must not do.
const screenCode = screen.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
if (!screen) bad('components/dashboard/CompanyTeamsOnly.tsx is missing.')
else {
  if (/href=|window\.open|location\.href\s*=/.test(screenCode)) bad('CompanyTeamsOnly links out. The screen an individual sees in the iOS app must not point anywhere, least of all at a way to pay.')
  const sells = screenCode.match(/\/upgrade|\/pricing|\/signup|\bR\s?\d{2,}|\bupgrade\b|\bsubscribe\b|\bbuy\b|\bpurchase\b|\bpric(e|ing)\b|\bPro\b/i)
  if (sells) bad(`CompanyTeamsOnly says "${sells[0]}". In the iOS app that is a call to action to buy outside it (Guideline 3.1.1).`)
  if (!/fetch\('\/api\/account\/delete'/.test(screenCode)) bad('CompanyTeamsOnly no longer offers account deletion, which Guideline 5.1.1(v) requires and which this person cannot reach any other way.')
  if (!/auth\.signOut\(/.test(screenCode)) bad('CompanyTeamsOnly no longer offers to sign out, leaving someone on the wrong account stuck.')
}

// ── 5. No way into signing up ───────────────────────────────────────────────
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next') continue
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p.replace(/\\/g, '/'))
  }
  return acc
}
const files = [...walk('app'), ...walk('components')]
const src = new Map(files.map(f => [f, read(f)]))
const routeOf = (file) => {
  const dir = file.replace(/^app/, '').replace(/\/[^/]+$/, '').replace(/\/\([^)]*\)/g, '')
  return dir === '' ? '/' : dir
}
const atBlockedRoute = (f) => f.startsWith('app/') && P.isIosBlockedPath(routeOf(f))

// A component's route is unknowable from the file, but not from who imports
// it. One that is only ever rendered by pages at blocked routes (the home
// page's hero, the pricing tables) cannot reach the app, and one nothing
// imports cannot render at all.
//
// Imports are resolved, alias, relative and dynamic alike: matching only the
// '@/components/...' spelling would miss './Modal' and count a live component
// as dead, which is the direction that lets a link through.
const imports = new Map(files.map(g => {
  const dir = g.replace(/\/[^/]+$/, '')
  const specs = [...src.get(g).matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map(m => m[1])
  const resolved = specs.map(s => {
    if (s.startsWith('@/')) return s.slice(2)
    if (!s.startsWith('.')) return null
    const parts = []
    for (const seg of `${dir}/${s}`.split('/')) {
      if (seg === '..') parts.pop()
      else if (seg !== '.') parts.push(seg)
    }
    return parts.join('/')
  }).filter(Boolean)
  return [g, new Set(resolved)]
}))
const importersOf = (f) => {
  const mod = f.replace(/\.(tsx|ts)$/, '')
  const asIndex = mod.replace(/\/index$/, '')
  return files.filter(g => g !== f && (imports.get(g).has(mod) || imports.get(g).has(asIndex)))
}
function onlyOnBlockedRoutes(f, seen = new Set()) {
  if (seen.has(f)) return true
  seen.add(f)
  if (f.startsWith('app/')) return atBlockedRoute(f)
  return importersOf(f).every(g => onlyOnBlockedRoutes(g, seen))
}

const KNOWS = /iosApp|useIosApp|isIosApp|isIosAppUA|IOS_APP_UA_TAG/
const SIGNUP = /href=\{?["'`]\/signup[?"'`]/
for (const f of files) {
  const s = src.get(f)
  if (!SIGNUP.test(s)) continue
  if (atBlockedRoute(f) || onlyOnBlockedRoutes(f)) continue
  if (!KNOWS.test(s)) bad(`${f} links to /signup and can render in the iOS app, but never checks for it. The app is company teams only; rule it out with iosApp / useIosApp() / isIosAppUA.`)
}
// Where the check is known, it has to sit on the link itself, not merely
// somewhere in the file: the login page knew about the app for Microsoft
// sign-in while offering "Create one free" to everyone.
for (const f of ['app/login/LoginClient.tsx', 'components/marketing/Navbar.tsx']) {
  const s = src.get(f) || ''
  for (const m of s.matchAll(/href="\/signup"/g)) {
    if (!/!iosApp\b/.test(s.slice(Math.max(0, m.index - 400), m.index))) {
      bad(`${f} links to /signup without ruling out the iOS app (!iosApp) right where the link is rendered.`)
    }
  }
}
const card = src.get('components/card/PublicCardView.tsx') || ''
if (!/setInIosApp\(isIosAppUA\(navigator\.userAgent\)\)/.test(card) || !/inIosApp \? null : \(card as any\)\.addons\?\.cardtlyBadge/.test(card)) {
  bad('components/card/PublicCardView.tsx shows "Get your own Cardtly card" (a link to /signup) inside the iOS app again.')
}
if (!/shouldCreateUser: !iosApp/.test(src.get('app/login/LoginClient.tsx') || '')) {
  bad('the login page\'s magic link can create a new account inside the iOS app again (Supabase does unless shouldCreateUser is false), which is signing up by the back door.')
}

// ── 6. The web keeps its signed-in redirect on /signup ──────────────────────
if (!/if \(blocked && !earlyPath\.startsWith\('\/dashboard'\) && earlyPath !== '\/signup'\)/.test(read('middleware.ts'))) {
  bad('middleware.ts skips the session for /signup now that it is on the iOS block list, so on the web a signed-in visitor there is no longer sent on to the dashboard.')
}

if (fail) {
  console.error(`\ncheck-ios-teams-only: ${fail} failure(s). The iOS app must serve company teams only (App Review, 3.1.3(c)).`)
  process.exit(1)
}
console.log(`check-ios-teams-only: the app admits ${admits.filter(a => a[2]).length} kinds of company account and no individual, ${routes.length} routes resolve as they must, the dashboard asks before rendering, the teams-only screen sells nothing and keeps deletion, and nothing in the app leads to signing up.`)
