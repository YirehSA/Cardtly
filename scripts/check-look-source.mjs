// The card a team look follows is the look; it never wears it.
//
// WHAT THIS PROTECTS (built 2026-10-08). Once the owner's card moved into the
// team as one of its seats (lib/owner-team-card), it became the card the team
// look follows, and "Apply to all cards" switched it on as well: the card wore
// a copy of itself. Anything the owner cleared came back from the stored copy,
// and the editor previewed the stored copy over every locked field, so
// changing the design of the very card the team looks like showed no change.
// JETOUR then had the look following the owner's card, seven things locked,
// and nobody wearing the look - every lock holding staff cards at whatever
// they were made with.
//
//   1. isLookSource, RUN: the organisation or a department above the card
//      following it makes it the source; a personal card, another card, or no
//      card does not
//   2. every place that draws a team card skips the look on its source: the
//      public card, the shared resolver (QR, email signature, backgrounds,
//      Network) and the share image
//   3. "Apply to all cards" leaves the source card alone, and the Brand page
//      counts only the cards that can wear the look
//   4. the editor previews the LIVE look (hydrated, whole department chain),
//      not the copy taken when it was chosen, and never over the source card
//   5. Team Cards offers no switch on the source card
//
// Run: node scripts/check-look-source.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. isLookSource, run ────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'look-source-'))
let S
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/brand-source.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  // Node's ESM loader wants extensions: rename and point the imports at them.
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'")
    writeFileSync(join(out, f), src)
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  S = await import(pathToFileURL(join(out, 'brand-source.mjs')).href)
} catch (e) {
  console.error('check-look-source: could not compile lib/brand-source.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const org = (src) => ({ id: 'org', brand_source: src })
const cases = [
  ['the team look follows this card', S.isLookSource('tc-1', [org({ table: 'team_cards', id: 'tc-1' })]), true],
  ['a department above it follows this card', S.isLookSource('tc-1', [org(null), { id: 'd', brand_source: { table: 'team_cards', id: 'tc-1' } }]), true],
  ['the look follows another card', S.isLookSource('tc-1', [org({ table: 'team_cards', id: 'tc-2' })]), false],
  ['the look follows a personal card with the same id', S.isLookSource('tc-1', [org({ table: 'cards', id: 'tc-1' })]), false],
  ['the look is a copy', S.isLookSource('tc-1', [org(null)]), false],
  ['no card id', S.isLookSource(null, [org({ table: 'team_cards', id: 'tc-1' })]), false],
  ['missing records', S.isLookSource('tc-1', [null, undefined]), false],
]
for (const [label, got, want] of cases) if (got !== want) bad(`isLookSource: ${label} should be ${want}, got ${got}`)

// ── 2. Every renderer skips the look on its source ──────────────────────────
const pub = read('components/card/TeamCardPublic.tsx')
if (!/const brandToApply = teamCard\.use_team_brand && !isSourceCard/.test(pub)) bad('TeamCardPublic: the public card applies the team look to the card the look is read from')
if (!/isSourceCard = isSourceCard \|\| isLookSource\(teamCard\.id, \[org\]\)/.test(pub)) bad('TeamCardPublic: the organisation\'s own source card is not recognised')
if (!/isSourceCard = isLookSource\(teamCard\.id, \(depts \|\| \[\]\)\.filter/.test(pub)) bad('TeamCardPublic: a department look\'s source card is not recognised')

const resolver = read('lib/resolve-card-brand.ts')
const resolverMap = resolver.slice(resolver.indexOf('return cards.map'))
if (!/if \(isLookSource\(c\.id, \[orgRowById\[c\.organization_id\], \.\.\.chain\.map\(d => deptRowById\[d\.id\]\)\]\)\) return c/.test(resolverMap)
  || resolverMap.indexOf('isLookSource') > resolverMap.indexOf('mergeBrand(')) {
  bad('lib/resolve-card-brand: the QR page, email signature, backgrounds and Network apply the look to its own source card')
}

const og = read('app/api/og/card/[slug]/route.tsx')
if (!/if \(isLookSource\(brandCtx\.cardId, /.test(og)) bad('the share image applies the look to its own source card, so it no longer matches the page')
if (!/\.select\('id, name, title, company,/.test(og)) bad('the share image must read the card id to know whether it is the source')

// ── 3. Apply to all, and the counts ─────────────────────────────────────────
const team = read('app/api/team/route.ts')
const applyAll = team.slice(team.indexOf("action === 'apply_brand_to_all'"), team.indexOf("action === 'import_brand_from_my_card'"))
if (!/if \(source\?\.table === 'team_cards'\) q = q\.neq\('id', source\.id\)/.test(applyAll)) bad('"Apply to all cards" switches the look on for the card it is read from')
if (!/select\('\*'\)/.test(applyAll)) bad('"Apply to all cards" must read brand_source to know which card to leave alone')

const brandPage = read('app/dashboard/team/brand/page.tsx')
if (!/const wearers = \(cardRows \|\| \[\]\)\.filter\(\(c: any\) => !\(source\?\.table === 'team_cards' && c\.id === source\.id\)\)/.test(brandPage)) {
  bad('the Brand page counts the source card among the cards that can wear the look, so "all cards" is never reached')
}

// ── 4. The editor previews the live look ────────────────────────────────────
const editorPage = read('app/dashboard/team/card/[id]/page.tsx')
if (!/hydrateBrandSources\(admin, orgFull \? \[orgFull\] : \[\]\)/.test(editorPage)) bad('the card editor previews the stored copy of the look, not the live one the public card shows')
if (!/resolveBrandChain\(/.test(editorPage)) bad('the card editor must resolve the look down the whole department chain, as the public card does')
if (!/isTeamLook=\{isTeamLook\}/.test(editorPage)) bad('the card editor is not told when it is editing the card the look follows')
const editor = read('components/team/TeamCardEditor.tsx')
if (!/const usesBrand = !!\(card as any\)\.use_team_brand && !isTeamLook && /.test(editor)) bad('the editor previews the look over the card it is read from: the owner changes the design and sees no change')

// ── 5. No switch on the source card ─────────────────────────────────────────
const dash = read('components/team/TeamDashboard.tsx')
if (!/\{card\.id === lookSourceCardId \? \(/.test(dash)) bad('Team Cards offers a "Use team brand" switch on the card the look follows')

if (fail) {
  console.error(`check-look-source: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-look-source: ok (the look\'s source card never wears it, anywhere it is drawn; editors preview the live look)')
