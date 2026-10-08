// Every lock means the same thing.
//
// WHAT THIS PROTECTS (2026-10-08). JETOUR locked the office number expecting
// every card to show the main card's switchboard number, and found each card
// still carrying - and an admin still typing - its own: the office number was
// not part of the team look, so its lock only meant "admins type it in, card
// by card". The bio lock promised "the same wording on every card" and had
// the same gap. Andre asked for every lock to work like the office number now
// does:
//
//   1. Every lock group's columns are in the team look (BRAND_FIELDS), so a
//      locked item comes from the look on every card wearing it. The one
//      deliberate exception is the job title, which is per person.
//   2. mergeBrand, RUN: a locked item takes the look's value; an open one is
//      the card's own, with the look filling a blank - except the bio, which
//      never fills a blank (it is somebody's own words, usually first person).
//   3. The editor greys out a locked look item on a card that wears the look,
//      for admins as well as members, and shows the look's value in it.
//
// Run: node scripts/check-lock-meaning.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// Compile the real modules (team-locks pulls in types/design), then fix the
// extensionless relative imports Node's ESM loader will not resolve.
const out = mkdtempSync(join(tmpdir(), 'lock-meaning-'))
let B, L
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/team-brand.ts', 'lib/team-locks.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
  for (const f of walk(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(f, readFileSync(f, 'utf8').replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(f, f.replace(/\.js$/, '.mjs'))
  }
  const find = (name) => walk(out).find(f => f.endsWith(`${name}.mjs`))
  B = await import(pathToFileURL(find('team-brand')).href)
  L = await import(pathToFileURL(find('team-locks')).href)
} catch (e) {
  console.error('check-lock-meaning: could not compile lib/team-brand.ts and lib/team-locks.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. Every lock is part of the look, bar the job title ────────────────────
const PER_PERSON = new Set(['title'])
for (const g of L.LOCK_GROUPS) {
  const outside = g.columns.filter(c => !B.BRAND_FIELDS.includes(c))
  if (PER_PERSON.has(g.id)) {
    if (outside.length !== g.columns.length) bad(`the '${g.id}' lock is per person on purpose, but some of its columns joined the look: ${g.columns.filter(c => B.BRAND_FIELDS.includes(c)).join(', ')}`)
    continue
  }
  if (outside.length) bad(`the '${g.label}' lock covers ${outside.join(', ')}, which the team look does not carry: locking it would freeze each card's own value instead of showing the look's (the office-number defect)`)
}

// ── 2. What a locked and an open item show, run ─────────────────────────────
const look = { work_phone: '+27 11 000 0001', address: '1 Main Rd', bio: 'We sell cars.', company: 'Acme' }
const lockedOffice = L.lockedColumns(['office_phone', 'bio'])
const own = { work_phone: '+27 11 999 9999', address: '', bio: '', company: 'Mine' }
const merged = B.mergeBrand(own, look, lockedOffice)
if (merged.work_phone !== look.work_phone) bad(`a locked office number shows the card's own (${merged.work_phone}), not the look's`)
if (merged.bio !== look.bio) bad('a locked bio does not come from the look')
if (merged.address !== look.address) bad('an open address left blank is not filled in from the look')
if (merged.company !== 'Mine') bad('an open company name was overwritten by the look although the card set its own')
const open = B.mergeBrand({ bio: '', work_phone: '' }, look, [])
if (open.bio !== '') bad(`an OPEN bio left blank was filled with the look's ("${open.bio}"): that is somebody's own words on a colleague's card`)
if (open.work_phone !== look.work_phone) bad('an open office number left blank is not filled in from the look')
if (B.COPYABLE_LOOK_FIELDS.includes('bio')) bad('starting a new card from another card\'s look copies that person\'s bio')

// ── 3. The editor greys them out ────────────────────────────────────────────
const editor = read('components/team/TeamCardEditor.tsx')
if (!/const fromLook = useCallback\(\(field: string\) =>\s*usesBrand && brandLocked\.has\(field\) && \(BRAND_FIELDS as readonly string\[\]\)\.includes\(field\)/.test(editor)) {
  bad('the editor no longer knows which fields come from the team look (fromLook)')
}
if (!/const isLocked = useCallback\(\(field: string\) => locked\.has\(field\) \|\| fromLook\(field\)/.test(editor)) {
  bad('a locked look item stays editable for admins on a card wearing the look: what they type is saved and never shown')
}
for (const f of ['work_phone', 'address', 'website', 'company', 'bio']) {
  if (!new RegExp(`value=\\{shown\\('${f}'\\)\\}`).test(editor)) bad(`the ${f} box shows the card's own value under a lock, not the look's value the card actually shows`)
}

if (fail) {
  console.error(`check-lock-meaning: ${fail} problem(s)`)
  process.exit(1)
}
console.log(`check-lock-meaning: ok (${L.LOCK_GROUPS.length - PER_PERSON.size} of ${L.LOCK_GROUPS.length} locks come from the team look, the job title stays per person; locked items greyed out where the look supplies them)`)
