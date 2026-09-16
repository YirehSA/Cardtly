// Does the Context entitlement fail CLOSED on anything it does not recognise?
//
// THE FACT THIS PROTECTS. Cardtly Context reads its configuration out of the
// `addons` JSON column, which a future admin UI, a migration, or somebody
// hand-editing a row in the Supabase dashboard can put anything into. A public
// business card is the most exposed thing Cardtly serves: it is the link
// printed on an NFC card in somebody's wallet and on a site board at a
// building site. If a malformed Context config could throw, that card would go
// blank, and the owner would have no idea why.
//
// So the entitlement is a total function and this proves it, by throwing the
// worst inputs available at it and checking two things every time: it does not
// throw, and it does not return enabled.
//
// The master switch is exercised separately, by compiling the module a second
// time with CONTEXT_ENABLED forced on. Without that, every case below would
// pass for the wrong reason while the switch is off during Phase 1 - the test
// would prove nothing and would keep passing after somebody broke the parser.
//
// Run: node scripts/check-card-context.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC = 'lib/card-context.ts'
let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

/**
 * MAX_CUSTOM_LINKS, read from the module that owns it.
 *
 * lib/card-context.ts imports this through the `@/` alias, which is the right
 * thing for production: the CTA's upper bound must follow the number of link
 * slots the editor actually exposes, and two hand-kept copies would drift.
 *
 * But this guard compiles card-context.ts ALONE in a temp directory, where no
 * tsconfig and therefore no path alias exists. So the harness substitutes the
 * value, and reads it from types/design.ts rather than hardcoding it - if
 * somebody changes the number of link slots, this picks it up and the CTA
 * bounds tests below move with it.
 */
const DESIGN = readFileSync('types/design.ts', 'utf8')

const readNumber = (name) => {
  const m = DESIGN.match(new RegExp('export const ' + name + "\\s*=\\s*(\\d+)"))
  if (!m) {
    console.error(`check-card-context: could not read ${name} from types/design.ts`)
    process.exit(1)
  }
  return Number(m[1])
}

const MAX_CUSTOM_LINKS = readNumber('MAX_CUSTOM_LINKS')
const MAX_GALLERY_IMAGES = readNumber('MAX_GALLERY_IMAGES')

/** The social keys, read off SOCIAL_SLOTS rather than retyped, for the same
 *  reason the numbers above are read rather than hardcoded: a list typed out
 *  twice disagrees with itself eventually, which is the exact defect
 *  SOCIAL_SLOTS was written to end. */
const SOCIAL_KEYS = (() => {
  const block = DESIGN.match(/export const SOCIAL_SLOTS = \[([\s\S]*?)\] as const/)
  if (!block) {
    console.error('check-card-context: could not read SOCIAL_SLOTS from types/design.ts')
    process.exit(1)
  }
  const keys = [...block[1].matchAll(/key:\s*'([a-z0-9_]+)'/g)].map(m => m[1])
  if (keys.length === 0) {
    console.error('check-card-context: SOCIAL_SLOTS parsed as empty')
    process.exit(1)
  }
  return keys
})()

/**
 * THE SWITCH DECLARATION, matched at either committed position.
 *
 * This used to be a literal search for `= false`, which quietly assumed the
 * switch would ship off forever. The day it ships ON that assumption fails in
 * the worst possible way: the "on" variant cannot be built, and the "off"
 * variant is silently ON, so every test claiming the switch overrides a
 * configured card passes while testing nothing at all. The harness has to be
 * able to construct BOTH states from EITHER committed value.
 *
 * Anchored and exact. `true` and `false` only, never truthy parsing, and a
 * reworded declaration fails loudly rather than being skipped.
 */
const SWITCH_RE = /^export const CONTEXT_ENABLED = (true|false)$/m

/** Which position is committed right now. Reported, not judged: activation is
 *  a deliberate authorised act, and a guard that cannot go green once it
 *  happens is worse than no guard. */
function committedSwitch(src) {
  const m = src.match(SWITCH_RE)
  return m ? m[1] === 'true' : null
}

/**
 * Compile the module with the master switch forced to `forceOn`.
 *
 * `mutations` is a list of [find, replace] pairs applied to the source before
 * compiling. It exists so the guards below can be tested rather than trusted:
 * a rule is only worth having if removing it makes something fail, and the
 * only way to know that is to remove it. Every mutation is verified to have
 * actually applied, because a mutation that silently matched nothing would
 * make a broken guard look proven.
 */
function load(forceOn, mutations = []) {
  const out = mkdtempSync(join(tmpdir(), 'card-context-'))
  // NORMALISED TO LF FOR THE HARNESS ONLY, never written back to the repo.
  //
  // Every transformation below - the switch substitution, the aliased-import
  // strip, and every multi-line mutation find-string - assumes LF. On
  // a Windows checkout git hands these files back as CRLF, so those searches
  // silently match nothing: the guard either dies compiling an import it
  // failed to strip, or worse, reports a mutation as surviving when it was
  // never applied. One normalisation here fixes the whole class, and the file
  // on disk is untouched.
  const src = readFileSync(SRC, 'utf8').replace(new RegExp(String.fromCharCode(13,10), 'g'), String.fromCharCode(10))
  const want = forceOn === true
  if (committedSwitch(src) === null) {
    bad('the CONTEXT_ENABLED declaration could not be found in its expected shape, so NEITHER switch position is being tested')
  }
  // Written explicitly rather than conditionally, so the requested position is
  // what compiles no matter which one is committed.
  let patched = src.replace(SWITCH_RE, `export const CONTEXT_ENABLED = ${want}`)
  if (patched === src && committedSwitch(src) !== want) {
    bad(`could not force CONTEXT_ENABLED to ${want} - the declaration was reworded, so the switch is no longer being tested`)
  }
  for (const [find, replace] of mutations) {
    const before = patched
    patched = patched.replace(find, replace)
    if (patched === before) {
      bad(`mutation did not apply, so the guard it targets is untested: ${String(find).slice(0, 70)}`)
    }
  }

  // Stand in for the aliased import, which cannot resolve outside the project.
  const before = patched
  patched = patched
    // Tolerates a Windows checkout (CRLF) exactly like a Linux one (LF).
    // Without it the import survives, tsc cannot resolve the @/ alias
    // outside the project, and the whole guard dies on a line ending.
    .replace(/^import \{[^}]*\} from '@\/types\/design'\r?\n/m,
             `const MAX_CUSTOM_LINKS = ${MAX_CUSTOM_LINKS}\n`
             + `const MAX_GALLERY_IMAGES = ${MAX_GALLERY_IMAGES}\n`
             + `const SOCIAL_KEYS: readonly string[] = ${JSON.stringify(SOCIAL_KEYS)}\n`)
    .replace('export const MAX_LINK_INDEX = MAX_CUSTOM_LINKS',
             `export const MAX_LINK_INDEX = ${MAX_CUSTOM_LINKS}`)
  if (patched === before) {
    bad('could not substitute MAX_CUSTOM_LINKS - card-context.ts no longer imports it, so the CTA bound may have been hardcoded and can now drift from the editor')
  }
  const tmpTs = join(out, 'card-context.ts')
  writeFileSync(tmpTs, patched)
  try {
    // The compiler through its own JS entry point, not the .cmd shim: spawning
    // a .cmd needs a shell on Windows. Same approach as check-brand-theme.
    execFileSync(
      process.execPath,
      ['node_modules/typescript/bin/tsc', tmpTs, '--outDir', out,
       '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
      { stdio: 'pipe' },
    )
    renameSync(join(out, 'card-context.js'), join(out, 'card-context.mjs'))
    return { mod: import(pathToFileURL(join(out, 'card-context.mjs')).href), out }
  } catch (e) {
    console.error(`check-card-context: could not compile ${SRC}`)
    console.error(String(e.stdout || e.message).slice(0, 600))
    process.exit(1)
  }
}

// ── Every shape a JSON column can hand us ─────────────────────────────────
//
// Each of these has been chosen because it is a plausible accident rather than
// an exotic one: a half-written admin form, a string where a boolean belongs,
// an array where an object belongs, a config from a future version.
const HOSTILE = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'context'],
  ['a number', 1],
  ['true', true],
  ['an array', []],
  ['an array of configs', [{ context: { enabled: true } }]],
  ['empty object', {}],
  ['context missing', { contactExchange: true }],
  ['context null', { context: null }],
  ['context a string', { context: 'on' }],
  ['context an array', { context: [] }],
  ['context empty', { context: {} }],
  ['enabled the STRING "true"', { context: { enabled: 'true' } }],
  ['enabled 1', { context: { enabled: 1 } }],
  ['enabled "yes"', { context: { enabled: 'yes' } }],
  ['enabled null', { context: { enabled: null } }],
  ['enabled false', { context: { enabled: false } }],
  ['audiences without enabled', { context: { audiences: [{ id: 'it' }] } }],
  ['deeply nested junk', { context: { enabled: { nested: { deeper: true } } } }],
  // An ARRAY carrying an `enabled` property. JSON cannot express this, so it
  // will not arrive from the addons column - but readContextEntitlement takes
  // `unknown` and will one day be called from somewhere that is not JSON, and
  // without this case the !Array.isArray() guard is untested. Proved by
  // mutation: deleting that guard passed every other case in this list and
  // only this one catches it. If it enabled, `raw` would be an array and
  // Task 2 would iterate the wrong thing.
  ['an array carrying enabled', { context: Object.assign([], { enabled: true }) }],
  ['a circular-ish blob', { context: { enabled: true, self: '[Circular]', big: 'x'.repeat(5000) } }],
]

const { mod: onMod, out: onDir } = load(true)
const { mod: offMod, out: offDir } = load(false)
const on = await onMod
const off = await offMod

// ── 1. With the master switch ON, only a literal true enables ─────────────
{
  for (const [label, input] of HOSTILE) {
    let res
    try {
      res = on.readContextEntitlement(input)
    } catch (e) {
      bad(`readContextEntitlement threw on ${label}: ${e.message}`)
      continue
    }
    if (!res || typeof res !== 'object') { bad(`${label} did not return an object`); continue }
    if (typeof res.enabled !== 'boolean') { bad(`${label} returned a non-boolean enabled`); continue }

    // The one input in the list that legitimately enables is the circular-ish
    // blob, which has enabled === true. Everything else must be off.
    const shouldEnable = label === 'a circular-ish blob'
    if (res.enabled !== shouldEnable) {
      bad(`${label} returned enabled=${res.enabled}, expected ${shouldEnable}`)
    }
    if (!res.enabled && res.raw !== null) bad(`${label} is disabled but still handed back a raw config`)
  }

  // The happy path has to actually work, or every check above passes for the
  // wrong reason.
  const good = on.readContextEntitlement({ context: { enabled: true, audiences: [{ id: 'it' }] } })
  if (!good.enabled) bad('a correctly configured card did NOT enable Context')
  if (!good.raw || good.raw.audiences?.[0]?.id !== 'it') {
    bad('an enabled card did not hand back its raw config untouched for Task 2')
  }
  if (!on.isContextEnabled({ context: { enabled: true } })) bad('isContextEnabled disagrees with readContextEntitlement')
}

// ── 2. The master switch overrides everything ─────────────────────────────
{
  // The "committed true is always illegal" assertion that used to live here
  // was right while Phase 1 was unfinished and is now retired: activation is a
  // deliberate, reviewed, one-line commit. What it protected is NOT retired -
  // everything below still proves the switch overrides a configured card, and
  // the committed position is reported in the summary instead.
  if (off.CONTEXT_ENABLED !== false) bad('load(false) did not produce a module with the switch OFF')
  if (on.CONTEXT_ENABLED !== true) bad('load(true) did not produce a module with the switch ON')
  const wouldBeOn = { context: { enabled: true, audiences: [{ id: 'it' }] } }
  if (off.readContextEntitlement(wouldBeOn).enabled) {
    bad('the master switch is off but a configured card still enabled Context')
  }
  if (off.isContextEnabled(wouldBeOn)) bad('isContextEnabled ignores the master switch')
}

// ── 3. The source list is the single spelling of these strings ────────────
{
  const want = ['visitor', 'sender', 'default']
  const got = [...(on.CONTEXT_SOURCES || [])]
  if (got.join(',') !== want.join(',')) {
    bad(`CONTEXT_SOURCES is ${JSON.stringify(got)}, expected ${JSON.stringify(want)} in precedence order`)
  }
}

// ══ TASK 2: the configuration parser ══════════════════════════════════════

const P = on.parseContextConfig

/** Every parse must return the right shape and must never throw. */
function parse(label, input) {
  let c
  try {
    c = P(input)
  } catch (e) {
    bad(`parseContextConfig threw on ${label}: ${e.message}`)
    return null
  }
  if (!c || typeof c !== 'object') { bad(`${label}: did not return an object`); return null }
  if (!Array.isArray(c.audiences)) { bad(`${label}: audiences is not an array`); return null }
  if (!(c.defaultAudience === null || typeof c.defaultAudience === 'string')) {
    bad(`${label}: defaultAudience is neither null nor a string`); return null
  }
  return c
}

// ── 4. The real Phase 1 configuration ─────────────────────────────────────
{
  const SIX = on.CONTEXT_AUDIENCE_IDS
  if (SIX.join(',') !== 'executive,it,sales,marketing,hr,procurement') {
    bad(`the six Phase 1 audience ids changed: ${JSON.stringify([...SIX])}. These appear in shared URLs and must not be renamed casually.`)
  }
  if ([...SIX].includes('other')) bad('an `other` audience exists; the agreed fallback is the standard card')

  const real = {
    audiences: [
      { id: 'executive', label: 'Executive / Owner / CEO', order: ['links', 'certifications'], hide: ['gallery'], cta: { kind: 'booking', label: 'Book Executive Demo' } },
      { id: 'it', label: 'IT', order: ['links', 'certifications'], hide: [], cta: { kind: 'link', index: 3, label: 'Book Technical Demo' } },
      { id: 'sales', label: 'Sales', order: ['links'], hide: [], cta: { kind: 'link', index: 1, label: 'See Sales Features' } },
      { id: 'marketing', label: 'Marketing', order: ['gallery', 'links'], hide: [], cta: null },
      { id: 'hr', label: 'HR', order: ['links'], hide: ['gallery'], cta: null },
      { id: 'procurement', label: 'Procurement', order: ['certifications', 'links'], hide: ['gallery'], cta: { kind: 'link', index: 2, label: 'Request Corporate Pricing' } },
    ],
    defaultAudience: 'executive',
  }
  const c = parse('the real six-audience config', real)
  if (c) {
    if (c.audiences.length !== 6) bad(`the real config parsed to ${c.audiences.length} audiences, expected 6`)
    if (c.defaultAudience !== 'executive') bad('the real config lost its defaultAudience')
    const it = c.audiences.find(a => a.id === 'it')
    if (!it) bad('the real config lost the IT audience')
    else {
      if (it.label !== 'IT') bad('IT lost its label')
      if (it.cta?.kind !== 'link' || it.cta.index !== 3) bad('IT lost its link CTA')
      if (it.cta?.label !== 'Book Technical Demo') bad('IT lost its CTA label override')
    }
    const exec = c.audiences.find(a => a.id === 'executive')
    if (exec?.cta?.kind !== 'booking') bad('executive lost its booking CTA')
    // This fixture never ordered the section it hides, so there is no position
    // to keep here. What must hold is that hiding wins at render. The
    // keeps-its-position case is covered where a section is in BOTH lists.
    if (exec && on.orderSections(on.STANDARD_SECTION_ORDER, { audience: exec, source: 'default' }).includes('gallery')) {
      bad('a hidden section was rendered even though hiding is supposed to win')
    }
  }
}

// ── 5. Malformed input, every shape ───────────────────────────────────────
{
  const CASES = [
    // [label, input, expected audience ids, expected default]
    ['root null', null, [], null],
    ['root a string', 'audiences', [], null],
    ['root an array', [{ id: 'it' }], [], null],
    ['audiences missing', { defaultAudience: 'it' }, [], null],
    ['audiences a string', { audiences: 'it' }, [], null],
    ['audiences an object', { audiences: { it: {} } }, [], null],
    ['audiences empty', { audiences: [] }, [], null],

    ['audience null', { audiences: [null, { id: 'it' }] }, ['it'], null],
    ['audience a string', { audiences: ['it', { id: 'hr' }] }, ['hr'], null],
    ['audience an array', { audiences: [[], { id: 'hr' }] }, ['hr'], null],
    ['audience with no id', { audiences: [{ label: 'IT' }, { id: 'it' }] }, ['it'], null],

    ['id empty string', { audiences: [{ id: '' }, { id: 'it' }] }, ['it'], null],
    ['id whitespace only', { audiences: [{ id: '   ' }, { id: 'it' }] }, ['it'], null],
    ['id uppercase', { audiences: [{ id: 'IT' }] }, [], null],
    ['id with a space', { audiences: [{ id: 'it manager' }] }, [], null],
    ['id with a slash', { audiences: [{ id: 'it/admin' }] }, [], null],
    ['id with a dot', { audiences: [{ id: 'it.admin' }] }, [], null],
    ['id percent-encoded', { audiences: [{ id: 'it%20x' }] }, [], null],
    ['id with unicode', { audiences: [{ id: 'itä' }] }, [], null],
    ['id an emoji', { audiences: [{ id: '💼' }] }, [], null],
    ['id underscore', { audiences: [{ id: 'it_admin' }] }, [], null],
    ['id leading digit', { audiences: [{ id: '1it' }] }, [], null],
    ['id leading hyphen', { audiences: [{ id: '-it' }] }, [], null],
    ['id one character', { audiences: [{ id: 'i' }] }, [], null],
    ['id oversized', { audiences: [{ id: 'a'.repeat(25) }] }, [], null],
    ['id at max length', { audiences: [{ id: 'a'.repeat(24) }] }, ['a'.repeat(24)], null],
    ['id a number', { audiences: [{ id: 42 }] }, [], null],
    ['id an object', { audiences: [{ id: { v: 'it' } }] }, [], null],
    ['id with hyphen', { audiences: [{ id: 'quantity-surveyors' }] }, ['quantity-surveyors'], null],

    ['duplicate ids keep the first', { audiences: [{ id: 'it', label: 'First' }, { id: 'it', label: 'Second' }] }, ['it'], null],

    ['default pointing nowhere', { audiences: [{ id: 'it' }], defaultAudience: 'finance' }, ['it'], null],
    ['default pointing at a DROPPED audience', { audiences: [{ id: 'IT' }, { id: 'hr' }], defaultAudience: 'IT' }, ['hr'], null],
    ['default an object', { audiences: [{ id: 'it' }], defaultAudience: {} }, ['it'], null],
    ['default a number', { audiences: [{ id: 'it' }], defaultAudience: 3 }, ['it'], null],
    ['default valid', { audiences: [{ id: 'it' }], defaultAudience: 'it' }, ['it'], 'it'],
  ]

  for (const [label, input, wantIds, wantDefault] of CASES) {
    const c = parse(label, input)
    if (!c) continue
    const got = c.audiences.map(a => a.id)
    if (got.join('|') !== wantIds.join('|')) {
      bad(`${label}: got audiences ${JSON.stringify(got)}, expected ${JSON.stringify(wantIds)}`)
    }
    if (c.defaultAudience !== wantDefault) {
      bad(`${label}: got default ${JSON.stringify(c.defaultAudience)}, expected ${JSON.stringify(wantDefault)}`)
    }
  }

  // Duplicates really do keep the FIRST, not just the right count.
  const dup = P({ audiences: [{ id: 'it', label: 'First' }, { id: 'it', label: 'Second' }] })
  if (dup.audiences[0]?.label !== 'First') bad('duplicate ids did not keep the first entry')
}

// ── 6. Sections: the protected core is unreachable ────────────────────────
{
  const one = (v) => P({ audiences: [{ id: 'it', ...v }] }).audiences[0]

  if (on.CONTEXT_SECTIONS.join(',') !== 'certifications,links,gallery') {
    bad(`CONTEXT_SECTIONS changed to ${JSON.stringify([...on.CONTEXT_SECTIONS])}; anything added here becomes manipulable on every card`)
  }

  // THE SAFEGUARD. Every one of these is core card functionality, and each must
  // be dropped simply because it is not on the allow-list.
  const PROTECTED = ['name', 'photo', 'profile_image', 'title', 'company', 'contact',
    'contactActions', 'save', 'saveContact', 'share', 'exchange', 'bio', 'header',
    'hero', 'nav', 'footer', 'fullProfile', 'context', 'report', '__proto__', 'constructor']
  const hidden = one({ hide: PROTECTED })
  if (hidden.hide.length !== 0) {
    bad(`Context was able to hide protected areas: ${JSON.stringify(hidden.hide)}`)
  }
  const ordered = one({ order: PROTECTED })
  if (ordered.order.length !== 0) bad(`Context was able to order protected areas: ${JSON.stringify(ordered.order)}`)

  if (one({ order: 'links' }).order.length !== 0) bad('order accepted a string')
  if (one({ order: { links: 1 } }).order.length !== 0) bad('order accepted an object')
  if (one({ hide: 'gallery' }).hide.length !== 0) bad('hide accepted a string')

  const dupSec = one({ order: ['links', 'links', 'gallery', 'links'] })
  if (dupSec.order.join(',') !== 'links,gallery') bad(`duplicate sections not collapsed: ${JSON.stringify(dupSec.order)}`)

  const mixed = one({ order: ['links', 'name', 'gallery', 'nonsense'] })
  if (mixed.order.join(',') !== 'links,gallery') bad(`unknown sections not dropped from order: ${JSON.stringify(mixed.order)}`)

  // Overlap: the position is KEPT and hiding wins where it matters, at render.
  // Storing one without the other is what used to move a section the owner had
  // only asked to hide.
  const overlap = one({ order: ['links', 'gallery'], hide: ['gallery'] })
  if (!overlap.order.includes('gallery')) bad('a hidden section lost its stored position')
  if (!overlap.hide.includes('gallery')) bad('a hidden section was lost')
  const rendered = on.orderSections(on.STANDARD_SECTION_ORDER, { audience: overlap, source: 'default' })
  if (rendered.includes('gallery')) bad('hiding stopped winning at render, so a hidden section would show')
  if (rendered.join(',') !== 'links,certifications') bad(`hiding changed the rest of the arrangement: ${rendered.join(',')}`)

  // A huge section list must not be processed wholesale.
  const flood = one({ order: Array(10000).fill('links') })
  if (flood.order.length > on.CONTEXT_SECTIONS.length) bad('a flooded section list was not capped')
}

// ── 7. CTA: references the card, never carries a URL ──────────────────────
{
  const cta = (v) => P({ audiences: [{ id: 'it', cta: v }] }).audiences[0].cta

  if (cta({ kind: 'booking' })?.kind !== 'booking') bad('a booking CTA was rejected')
  if (cta({ kind: 'link', index: 1 })?.index !== 1) bad('a link CTA at index 1 was rejected')
  const MAX = on.MAX_LINK_INDEX
  if (MAX !== MAX_CUSTOM_LINKS) bad(`MAX_LINK_INDEX is ${MAX} but the editor exposes ${MAX_CUSTOM_LINKS} link slots; a CTA could point at a slot nobody can fill`)
  if (cta({ kind: 'link', index: MAX })?.index !== MAX) bad('a link CTA at the max index was rejected')
  if (cta({ kind: 'link', index: MAX + 1 }) !== null) bad('a link CTA past the last editable slot was accepted')

  const invalid = [
    ['null', null], ['a string', 'book'], ['an array', []], ['empty', {}],
    ['unknown kind', { kind: 'popup', index: 1 }],
    ['kind missing', { index: 1 }],
    ['link with no index', { kind: 'link' }],
    ['index 0', { kind: 'link', index: 0 }],
    ['index negative', { kind: 'link', index: -1 }],
    ['index a string', { kind: 'link', index: '3' }],
    ['index a float', { kind: 'link', index: 3.5 }],
    ['index NaN', { kind: 'link', index: NaN }],
    ['index Infinity', { kind: 'link', index: Infinity }],
  ]
  for (const [label, v] of invalid) {
    if (cta(v) !== null) bad(`CTA ${label} was accepted, expected null`)
  }

  // An invalid CTA must not take the audience with it.
  const kept = P({ audiences: [{ id: 'it', cta: { kind: 'popup' } }] })
  if (kept.audiences.length !== 1) bad('an invalid CTA dropped the whole audience')
  if (kept.audiences[0].cta !== null) bad('an invalid CTA was not nulled')

  // THE SECURITY POINT: a CTA cannot introduce a destination.
  const injected = cta({ kind: 'link', index: 1, url: 'https://evil.example', href: 'javascript:alert(1)' })
  if (injected && ('url' in injected || 'href' in injected)) {
    bad('a CTA carried a URL onto the card; the CTA must only reference an existing link index')
  }
  const oversizedLabel = cta({ kind: 'booking', label: 'x'.repeat(500) })
  if (oversizedLabel?.label !== null) bad('an oversized CTA label was not dropped')
}

// ── 8. Volume ─────────────────────────────────────────────────────────────
{
  const many = (n) => P({ audiences: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, label: `A${i}` })) })
  const max = on.MAX_AUDIENCES
  if (typeof max !== 'number' || max < 6) bad('MAX_AUDIENCES is missing or below the six Phase 1 audiences')

  if (many(6).audiences.length !== 6) bad('six audiences did not survive')
  if (many(max).audiences.length !== max) bad(`${max} audiences did not survive`)
  if (many(200).audiences.length !== max) bad(`200 audiences produced ${many(200).audiences.length}, expected the cap of ${max}`)
  if (many(50000).audiences.length !== max) bad('50000 audiences were not capped')

  // The cap must keep the FIRST ones, so a config does not reshuffle itself.
  if (many(200).audiences[0].id !== 'a0') bad('the audience cap did not keep the first entries')
}

// ── 9. Parser boundary oddities ───────────────────────────────────────────
{
  // A prototype-polluting payload must not leak through as configuration.
  const poisoned = JSON.parse('{"audiences":[{"id":"it","__proto__":{"polluted":true}}],"defaultAudience":"it"}')
  const c = parse('a __proto__ payload', poisoned)
  if (c) {
    if (({}).polluted !== undefined) bad('parsing a config polluted Object.prototype')
    if (c.audiences.length !== 1) bad('a __proto__ payload dropped a valid audience')
  }
  // Object.create(null) has no prototype; property access must still work.
  const bare = Object.create(null); bare.audiences = [{ id: 'it' }]
  if (parse('a null-prototype object', bare)?.audiences.length !== 1) {
    bad('a null-prototype config was rejected')
  }
  // Getters that throw are the nastiest realistic boundary.
  const hostile = { get audiences() { throw new Error('boom') } }
  let threw = false
  try { P(hostile) } catch { threw = true }
  if (threw) bad('parseContextConfig threw when reading a hostile getter; it must degrade to the standard card')
}

// ── 10. readCardContext ties entitlement and config together ──────────────
{
  const good = { context: { enabled: true, audiences: [{ id: 'it' }] } }
  const r = on.readCardContext(good)
  if (!r.enabled || r.config.audiences.length !== 1) bad('readCardContext lost a valid config')
  // A disabled card must produce an empty config even though one is present,
  // so a caller that forgets to check `enabled` still renders normally.
  const offR = on.readCardContext({ context: { enabled: false, audiences: [{ id: 'it' }] } })
  if (offR.enabled || offR.config.audiences.length !== 0) bad('a disabled card still produced audiences')
  if (off.readCardContext(good).config.audiences.length !== 0) bad('the master switch did not empty the config')
}

// ══ TASK 3: the resolver ══════════════════════════════════════════════════
//
// These are PRODUCT RULES, not implementation detail. The one that carries the
// weight is that ABSENT and INVALID behave differently: a default is the
// owner's preference when nobody said anything, never a repair for an explicit
// request that did not resolve. Sending ?a=finance to a card with no Finance
// audience must show the standard card, not Executive.
{
  const R = on.resolveContext
  const CONFIG = on.parseContextConfig({
    audiences: [
      { id: 'executive', label: 'Executive' },
      { id: 'it', label: 'IT' },
      { id: 'procurement', label: 'Procurement' },
    ],
    defaultAudience: 'executive',
  })
  const NO_DEFAULT = on.parseContextConfig({ audiences: [{ id: 'it' }] })
  const BAD_DEFAULT = on.parseContextConfig({ audiences: [{ id: 'it' }], defaultAudience: 'finance' })
  const EMPTY = on.parseContextConfig({ audiences: [] })

  // [label, config, visitor, sender, expected id or null, expected source]
  const CASES = [
    // precedence
    ['valid visitor beats sender and default', CONFIG, 'procurement', 'it', 'procurement', 'visitor'],
    ['valid visitor beats default', CONFIG, 'it', null, 'it', 'visitor'],
    ['valid sender beats default', CONFIG, null, 'it', 'it', 'sender'],
    ['default only when nothing explicit', CONFIG, null, null, 'executive', 'default'],

    // the invalid-vs-absent distinction
    ['invalid visitor falls through to valid sender', CONFIG, 'finance', 'it', 'it', 'sender'],
    ['invalid sender does NOT fall through to default', CONFIG, null, 'finance', null, null],
    ['invalid visitor, no sender, does NOT invoke default', CONFIG, 'finance', null, null, null],
    ['invalid visitor AND invalid sender', CONFIG, 'finance', 'ops', null, null],

    // the brief's five worked examples, verbatim
    ['example 1', CONFIG, 'procurement', 'it', 'procurement', 'visitor'],
    ['example 2', CONFIG, 'nope', 'it', 'it', 'sender'],
    ['example 3', CONFIG, null, 'finance', null, null],
    ['example 4', CONFIG, null, null, 'executive', 'default'],
    ['example 5', BAD_DEFAULT, null, null, null, null],

    // defaults
    ['no default configured', NO_DEFAULT, null, null, null, null],
    ['invalid default returns null', BAD_DEFAULT, null, null, null, null],
    ['no audiences returns null', EMPTY, 'it', 'it', null, null],

    // empty and whitespace count as ABSENT, so the default still applies
    ['empty visitor is absent, not invalid', CONFIG, '', null, 'executive', 'default'],
    ['whitespace sender is absent, not invalid', CONFIG, null, '   ', 'executive', 'default'],
    ['both empty falls to default', CONFIG, '', '', 'executive', 'default'],
    ['surrounding whitespace on a real id still resolves', CONFIG, ' it ', null, 'it', 'visitor'],

    // malformed values must not resolve and must not throw
    ['visitor a number', CONFIG, 42, null, 'executive', 'default'],
    ['visitor an object', CONFIG, { id: 'it' }, null, 'executive', 'default'],
    ['visitor an array', CONFIG, ['it'], null, 'executive', 'default'],
    ['sender a boolean', CONFIG, null, true, 'executive', 'default'],
    ['case does not match', CONFIG, 'IT', null, null, null],
  ]

  for (const [label, config, visitor, sender, wantId, wantSource] of CASES) {
    let r
    try {
      r = R({ config, visitorAudience: visitor, senderAudience: sender })
    } catch (e) {
      bad(`resolveContext threw on ${label}: ${e.message}`)
      continue
    }
    const gotId = r ? r.audience?.id : null
    const gotSource = r ? r.source : null
    if (gotId !== wantId) bad(`${label}: got audience ${JSON.stringify(gotId)}, expected ${JSON.stringify(wantId)}`)
    if (gotSource !== wantSource) bad(`${label}: got source ${JSON.stringify(gotSource)}, expected ${JSON.stringify(wantSource)}`)
    if (r && !(on.CONTEXT_SOURCES).includes(r.source)) bad(`${label}: source is not one of CONTEXT_SOURCES`)
    if (r && (!r.audience || typeof r.audience.id !== 'string')) bad(`${label}: returned a malformed audience`)
  }

  // Never throws, whatever it is handed.
  const JUNK = [undefined, null, 'x', 42, [], {}, { config: null }, { config: 'x' },
    { config: { audiences: 'x' } }, { config: { audiences: [null, undefined] } },
    { config: { audiences: [{}] }, visitorAudience: 'it' },
    { get config() { throw new Error('boom') } }]
  for (const j of JUNK) {
    try {
      const r = R(j)
      if (r !== null && (!r.audience || !r.source)) bad(`resolveContext returned a malformed result for ${JSON.stringify(j)}`)
    } catch (e) {
      bad(`resolveContext threw on junk input ${String(j)}: ${e.message}`)
    }
  }

  // The resolved audience must be the real object from the config, so the
  // caller gets its order/hide/cta rather than a copy that has lost them.
  const got = R({ config: CONFIG, visitorAudience: 'it' })
  if (got && got.audience !== CONFIG.audiences.find(a => a.id === 'it')) {
    bad('the resolver returned a different object than the one in the config')
  }
}

// ══ TASK 4: reading the sender's audience out of the URL ══════════════════
//
// The rule under test is that EXTRACTION PRESERVES and RESOLUTION JUDGES. If
// this function quietly dropped values it did not recognise, ?a=finance would
// arrive looking identical to no parameter at all, the configured default
// would apply, and a link deliberately addressed to Finance would show
// Executive. Several cases below exist only to prove that does not happen.
{
  const S = on.readSenderAudience

  // [label, input, expected]
  const CASES = [
    ['?a=it', '?a=it', 'it'],
    ['?a=procurement', '?a=procurement', 'procurement'],
    ['no leading question mark', 'a=it', 'it'],

    // EXPLICIT BUT UNCONFIGURED must survive extraction intact.
    ['?a=finance survives even though it is not configured', '?a=finance', 'finance'],
    ['?a=THIS_IS_INVALID survives', '?a=THIS_IS_INVALID', 'THIS_IS_INVALID'],
    ['case is NOT rewritten', '?a=IT', 'IT'],
    ['mixed case is NOT rewritten', '?a=Procurement', 'Procurement'],

    // ABSENT
    ['no a parameter', '?s=wa', null],
    ['empty search', '', null],
    ['just a question mark', '?', null],
    ['?a= is absent, not invalid', '?a=', null],
    ['whitespace only is absent', '?a=%20%20', null],
    ['tab only is absent', '?a=%09', null],

    // DUPLICATES take the first
    ['?a=it&a=sales takes the first', '?a=it&a=sales', 'it'],
    ['?a=sales&a=it takes the first', '?a=sales&a=it', 'sales'],
    ['empty first, real second, still takes the first', '?a=&a=it', null],

    // EXISTING ?s= MUST BE UNAFFECTED, in either order
    ['?s=wa&a=it', '?s=wa&a=it', 'it'],
    ['?a=it&s=wa', '?a=it&s=wa', 'it'],
    ['?s=nfc&a=procurement&utm_source=x', '?s=nfc&a=procurement&utm_source=x', 'procurement'],

    // Encoded and awkward values
    ['url-encoded value', '?a=it%2Dadmin', 'it-admin'],
    ['plus sign decodes to a space', '?a=it+admin', 'it admin'],
    ['value with surrounding space is preserved, not trimmed', '?a=%20it%20', ' it '],

    // Malformed query strings must not throw
    ['a stray ampersand', '?&&a=it&&', 'it'],
    ['a key with no value', '?a', null],
    ['an equals with no key', '?=it', null],
  ]

  for (const [label, input, want] of CASES) {
    let got
    try {
      got = S(input)
    } catch (e) {
      bad(`readSenderAudience threw on ${label}: ${e.message}`)
      continue
    }
    if (got !== want) bad(`${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)
  }

  // ?s= keeps working alongside ?a=, which is the compatibility requirement.
  for (const q of ['?s=wa&a=it', '?a=it&s=wa']) {
    const s = new URLSearchParams(q).get('s')
    if (s !== 'wa') bad(`${q}: the existing source marker read as ${JSON.stringify(s)}, expected "wa"`)
    if (S(q) !== 'it') bad(`${q}: the audience did not survive alongside the source marker`)
  }

  // Other shapes the boundary may hand us.
  if (S(new URLSearchParams('a=it')) !== 'it') bad('a URLSearchParams input was not read')
  if (S({ a: 'it' }) !== 'it') bad("a Next searchParams record was not read")
  if (S({ a: ['it', 'sales'] }) !== 'it') bad('a repeated record value did not take the first')
  if (S({ a: [] }) !== null) bad('an empty array value did not become null')
  if (S({ a: undefined }) !== null) bad('an undefined record value did not become null')
  if (S({ a: 42 }) !== null) bad('a non-string record value did not become null')
  if (S({ a: { id: 'it' } }) !== null) bad('an object record value did not become null')
  if (S({ s: 'wa' }) !== null) bad('a record without an audience did not become null')

  // Junk must never throw.
  for (const j of [null, undefined, 42, true, [], Symbol.iterator && {},
                   { get a() { throw new Error('boom') } }]) {
    try { S(j) } catch (e) { bad(`readSenderAudience threw on junk ${String(j)}: ${e.message}`) }
  }

  // ── Absurd length: truncated, NOT dropped ───────────────────────────────
  //
  // Dropping it would make a 50,000-character explicit value look absent, and
  // the visitor would get the default audience. Truncating keeps it explicit
  // and provably unresolvable.
  const huge = 'x'.repeat(50000)
  const out = S(`?a=${huge}`)
  if (out === null) bad('an absurdly long audience was dropped to null; it would then look absent and invoke the default')
  if (out === null || out.length > 64) bad(`an absurdly long audience was not capped: length ${out && out.length}`)

  // The safety proof: a truncated value can never resolve, because a valid id
  // is at most 24 characters and anything truncated here is longer than that.
  const cfg = on.parseContextConfig({ audiences: [{ id: 'it' }], defaultAudience: 'it' })
  if (on.resolveContext({ config: cfg, senderAudience: out }) !== null) {
    bad('a truncated audience resolved to something; truncation must never manufacture a valid id')
  }
  // And end to end: an explicit unconfigured audience must NOT fall to default.
  if (on.resolveContext({ config: cfg, senderAudience: S('?a=finance') }) !== null) {
    bad('?a=finance resolved to the default; explicit-but-unknown must fall to the standard card')
  }
  // While a genuinely absent one still may.
  const viaDefault = on.resolveContext({ config: cfg, senderAudience: S('?s=wa') })
  if (viaDefault?.source !== 'default') {
    bad('an absent audience did not fall through to the configured default')
  }

  if (on.CONTEXT_PARAM !== 'a') bad(`CONTEXT_PARAM is ${JSON.stringify(on.CONTEXT_PARAM)}, expected "a"; it appears in shared links and is permanent`)
}

// ══ TASK 5: the presentation transform ════════════════════════════════════
//
// The property that matters most is the first one: with no context, the
// arrangement must be byte-identical to the standard order. That is what makes
// every card that never enables Context provably unchanged.
{
  const O = on.orderSections
  const STD = [...on.STANDARD_SECTION_ORDER]
  if (STD.join(',') !== 'certifications,links,gallery') {
    bad(`STANDARD_SECTION_ORDER is ${JSON.stringify(STD)}; it must match the order BottomSection has always rendered`)
  }

  const ctxOf = (audience) => ({ audience, source: 'sender' })
  const aud = (v) => on.parseContextConfig({ audiences: [{ id: 'it', ...v }] }).audiences[0]

  // ── no context is the standard order, for every subset of content ───────
  const SUBSETS = [
    ['all three', ['certifications', 'links', 'gallery']],
    ['links only', ['links']],
    ['gallery only', ['gallery']],
    ['certifications only', ['certifications']],
    ['links and gallery', ['links', 'gallery']],
    ['nothing populated', []],
  ]
  for (const [label, available] of SUBSETS) {
    const got = O(available, null)
    if (got.join(',') !== available.join(',')) {
      bad(`no context, ${label}: got ${JSON.stringify(got)}, expected the standard ${JSON.stringify(available)}`)
    }
    // And the same when a context exists but says nothing about arrangement.
    const silent = O(available, ctxOf(aud({})))
    if (silent.join(',') !== available.join(',')) {
      bad(`empty context, ${label}: got ${JSON.stringify(silent)}, expected ${JSON.stringify(available)}`)
    }
  }

  // ── reorder ─────────────────────────────────────────────────────────────
  const all = ['certifications', 'links', 'gallery']
  const reordered = O(all, ctxOf(aud({ order: ['links', 'certifications', 'gallery'] })))
  if (reordered.join(',') !== 'links,certifications,gallery') {
    bad(`reorder produced ${JSON.stringify(reordered)}`)
  }
  // A partial order promotes what it names and leaves the rest in place.
  const partial = O(all, ctxOf(aud({ order: ['gallery'] })))
  if (partial.join(',') !== 'gallery,certifications,links') {
    bad(`a partial order produced ${JSON.stringify(partial)}, expected the named one promoted and the rest in standard order`)
  }

  // ── hide ────────────────────────────────────────────────────────────────
  const hidden = O(all, ctxOf(aud({ hide: ['gallery'] })))
  if (hidden.includes('gallery')) bad('a hidden section was still arranged for rendering')
  if (hidden.join(',') !== 'certifications,links') bad(`hide produced ${JSON.stringify(hidden)}`)

  // Hiding everything is allowed and simply renders no content blocks. It
  // cannot touch the name, contact actions or Save Contact, which are not
  // expressible here at all.
  if (O(all, ctxOf(aud({ hide: all }))).length !== 0) bad('hiding every section did not empty the arrangement')

  // ── context can never ADD a section the card does not have ──────────────
  const conjured = O(['links'], ctxOf(aud({ order: ['gallery', 'certifications', 'links'] })))
  if (conjured.join(',') !== 'links') {
    bad(`a context conjured sections the card does not have: ${JSON.stringify(conjured)}`)
  }

  // ── never throws ────────────────────────────────────────────────────────
  for (const [a, c] of [[null, null], [undefined, null], ['x', null], [{}, null],
                        [all, {}], [all, { audience: null }], [all, { audience: { order: 'x', hide: 5 } }],
                        [[null, 'links', undefined], ctxOf(aud({}))]]) {
    try {
      const r = O(a, c)
      if (!Array.isArray(r)) bad(`orderSections returned a non-array for ${JSON.stringify(a)}`)
    } catch (e) { bad(`orderSections threw: ${e.message}`) }
  }

  // ── CTA ─────────────────────────────────────────────────────────────────
  const C = on.resolveContextCta
  const LINKS = [{ index: 1, title: 'Our prices', url: 'https://example.com/prices' },
                 { index: 3, title: 'API docs', url: 'https://example.com/api' }]

  if (C(null, LINKS, true) !== null) bad('no context produced a CTA')
  if (C(ctxOf(aud({})), LINKS, true) !== null) bad('an audience with no CTA produced one')

  const linkCta = C(ctxOf(aud({ cta: { kind: 'link', index: 3, label: 'Book Technical Demo' } })), LINKS, true)
  if (linkCta?.kind !== 'link') bad('a valid link CTA was not resolved')
  if (linkCta?.url !== 'https://example.com/api') bad('the link CTA resolved to the wrong url')
  if (linkCta?.label !== 'Book Technical Demo') bad('the link CTA lost its label override')

  // No label override falls back to the link's own title, never to nothing.
  const noLabel = C(ctxOf(aud({ cta: { kind: 'link', index: 1 } })), LINKS, true)
  if (noLabel?.label !== 'Our prices') bad(`a CTA without a label did not fall back to the link title: ${JSON.stringify(noLabel)}`)

  // THE CLEARED-SLOT CASE. The CTA disappears; the audience keeps working.
  const dead = C(ctxOf(aud({ cta: { kind: 'link', index: 3 }, hide: ['gallery'] })), [LINKS[0]], true)
  if (dead !== null) bad('a CTA pointing at a cleared link slot still rendered')
  const stillWorks = O(all, ctxOf(aud({ cta: { kind: 'link', index: 3 }, hide: ['gallery'] })))
  if (stillWorks.join(',') !== 'certifications,links') {
    bad('a dead CTA broke the rest of its audience; ordering and hiding must still apply')
  }

  // Booking CTA follows the card's own booking availability.
  const booking = C(ctxOf(aud({ cta: { kind: 'booking', label: 'Book Executive Demo' } })), LINKS, true)
  if (booking?.kind !== 'booking' || booking.label !== 'Book Executive Demo') bad('a booking CTA was not resolved')
  if (C(ctxOf(aud({ cta: { kind: 'booking' } })), LINKS, false) !== null) {
    bad('a booking CTA rendered on a card that does not offer booking')
  }
  if (C(ctxOf(aud({ cta: { kind: 'booking' } })), LINKS, true)?.label !== 'Book a meeting') {
    bad('a booking CTA without a label lost its default wording')
  }

  // A link with no url is as dead as a missing one.
  if (C(ctxOf(aud({ cta: { kind: 'link', index: 1 } })), [{ index: 1, title: 'x', url: '' }], true) !== null) {
    bad('a CTA pointing at an empty url still rendered')
  }

  for (const junk of [null, undefined, 'x', 42, [], {}]) {
    try { C(ctxOf(aud({ cta: { kind: 'link', index: 1 } })), junk, true) }
    catch (e) { bad(`resolveContextCta threw on links=${JSON.stringify(junk)}: ${e.message}`) }
  }

  // ── end to end, through every stage ─────────────────────────────────────
  const ADDONS = {
    context: {
      enabled: true,
      defaultAudience: 'executive',
      audiences: [
        { id: 'executive', order: ['links'], hide: ['gallery'], cta: { kind: 'booking' } },
        { id: 'it', order: ['links', 'certifications'], hide: ['gallery'], cta: { kind: 'link', index: 3, label: 'Book Technical Demo' } },
      ],
    },
  }
  const pipeline = (mod, search) => {
    const { enabled, config } = mod.readCardContext(ADDONS)
    if (!enabled) return null
    return mod.resolveContext({ config, senderAudience: mod.readSenderAudience(search) })
  }

  // ?a=it applies IT.
  const itCtx = pipeline(on, '?a=it')
  if (itCtx?.audience?.id !== 'it' || itCtx.source !== 'sender') bad('?a=it did not resolve to the IT audience from the sender')
  if (O(all, itCtx).join(',') !== 'links,certifications') bad(`?a=it arranged as ${JSON.stringify(O(all, itCtx))}`)

  // ?a=finance is explicit and unknown: standard card, NOT the default.
  const finance = pipeline(on, '?a=finance')
  if (finance !== null) bad('?a=finance did not fall to the standard card')
  if (O(all, finance).join(',') !== all.join(',')) bad('?a=finance did not render the standard arrangement')

  // No ?a= uses the configured default.
  const def = pipeline(on, '?s=wa')
  if (def?.audience?.id !== 'executive' || def.source !== 'default') bad('an absent audience did not use the configured default')

  // MASTER SWITCH OFF: even a configured card with ?a=it renders normally.
  if (pipeline(off, '?a=it') !== null) bad('the master switch is off but ?a=it still resolved a context')
  if (O(all, pipeline(off, '?a=it')).join(',') !== all.join(',')) {
    bad('with the master switch off the arrangement was not the standard order')
  }
}

// ══ TASK 6: event metadata ════════════════════════════════════════════════
//
// This validator stands between a public visitor's browser and a jsonb column
// that anybody can post to - the analytics endpoint accepts anonymous requests
// by design, because that is how a card view gets counted. So the rules here
// are the only thing stopping an event row becoming a place to store whatever
// somebody likes, including personal data.
{
  const M = on.sanitiseEventMetadata
  const good = { context: { audience: 'it', source: 'sender', version: 1 } }

  // ── the happy path, and the exact stored shape ──────────────────────────
  const clean = M(good)
  if (JSON.stringify(clean) !== JSON.stringify(good)) {
    bad(`a valid payload was altered: ${JSON.stringify(clean)}`)
  }
  for (const src of ['sender', 'visitor', 'default']) {
    const r = M({ context: { audience: 'executive', source: src, version: 1 } })
    if (r?.context?.source !== src) bad(`source "${src}" was rejected; all three must be supported from the start`)
  }

  // interest is optional, and OMITTED rather than stored as null when absent
  if ('interest' in (M(good)?.context || {})) bad('interest was stored even though it was not supplied')
  const withInterest = M({ context: { audience: 'it', source: 'visitor', version: 1, interest: 'enterprise' } })
  if (withInterest?.context?.interest !== 'enterprise') bad('a valid interest was dropped')

  // ── everything that must be refused ─────────────────────────────────────
  const REJECT = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'context'],
    ['a number', 7],
    ['an array', [good]],
    ['empty object', {}],
    ['context missing', { other: {} }],
    ['context a string', { context: 'it' }],
    ['context an array', { context: [] }],

    ['audience missing', { context: { source: 'sender', version: 1 } }],
    ['audience empty', { context: { audience: '', source: 'sender', version: 1 } }],
    ['audience uppercase', { context: { audience: 'IT', source: 'sender', version: 1 } }],
    ['audience with a space', { context: { audience: 'it admin', source: 'sender', version: 1 } }],
    ['audience oversized', { context: { audience: 'a'.repeat(25), source: 'sender', version: 1 } }],
    ['audience a number', { context: { audience: 3, source: 'sender', version: 1 } }],

    ['source missing', { context: { audience: 'it', version: 1 } }],
    ['source invented', { context: { audience: 'it', source: 'admin', version: 1 } }],
    ['source uppercase', { context: { audience: 'it', source: 'SENDER', version: 1 } }],
    ['source a number', { context: { audience: 'it', source: 1, version: 1 } }],

    ['version missing', { context: { audience: 'it', source: 'sender' } }],
    ['version 2 from a future client', { context: { audience: 'it', source: 'sender', version: 2 } }],
    ['version the string "1"', { context: { audience: 'it', source: 'sender', version: '1' } }],
  ]
  for (const [label, input] of REJECT) {
    let r
    try { r = M(input) } catch (e) { bad(`sanitiseEventMetadata threw on ${label}: ${e.message}`); continue }
    if (r !== null) bad(`${label} was accepted, expected null: ${JSON.stringify(r)}`)
  }

  // ── PERSONAL DATA IS DROPPED, not stored ────────────────────────────────
  //
  // The rule is that metadata describes the interaction, never the person.
  // These extra keys ride alongside an otherwise valid payload, which is the
  // realistic way they would arrive.
  const personal = M({
    context: {
      audience: 'it', source: 'sender', version: 1,
      name: 'Chris Bowers', email: 'chris@example.com', phone: '+27821234567',
      company: 'The Building Company', message: 'please call me', ip: '1.2.3.4',
    },
  })
  if (!personal) bad('a valid payload was rejected because it carried extra keys; the extras should be dropped instead')
  else {
    const keys = Object.keys(personal.context).sort().join(',')
    if (keys !== 'audience,source,version') {
      bad(`personal data survived into metadata: keys are ${keys}`)
    }
    const blob = JSON.stringify(personal)
    for (const leak of ['Chris', 'example.com', '27821234567', 'Building', 'call me', '1.2.3.4']) {
      if (blob.includes(leak)) bad(`"${leak}" reached the stored metadata`)
    }
  }

  // ── future namespaces are NOT accepted yet ──────────────────────────────
  const future = M({ connection: { id: 'x' }, campaign: { id: 'y' } })
  if (future !== null) bad('an unsupported namespace was accepted; those are a deliberate addition, not a client choice')
  // A supported namespace alongside an unsupported one keeps only the supported one.
  const mixed = M({ ...good, connection: { id: 'x' }, campaign: { utm: 'z' } })
  if (mixed && Object.keys(mixed).join(',') !== 'context') {
    bad(`an unsupported namespace survived: ${Object.keys(mixed).join(',')}`)
  }

  // ── size ────────────────────────────────────────────────────────────────
  const cap = on.MAX_METADATA_BYTES
  if (typeof cap !== 'number' || cap > 4096) bad(`MAX_METADATA_BYTES is ${cap}; analytics metadata should be tiny`)
  const huge = { context: { audience: 'it', source: 'sender', version: 1 }, filler: 'x'.repeat(cap * 2) }
  if (M(huge) !== null) bad('an oversized payload was accepted')
  // A 500KB document must be refused rather than trimmed.
  if (M({ context: { audience: 'it', source: 'sender', version: 1, interest: 'x'.repeat(500000) } }) !== null) {
    bad('a 500KB payload was accepted')
  }
  // Deeply nested junk must not be walked into.
  let deep = { v: 1 }; for (let i = 0; i < 2000; i++) deep = { v: deep }
  try { M({ context: deep }) } catch (e) { bad(`deeply nested input threw: ${e.message}`) }

  // ── contextMetadata builds what the validator accepts ───────────────────
  //
  // If these two ever disagree, Cardtly would be posting metadata that its own
  // endpoint refuses, and the events would silently arrive with none.
  const cfg = on.parseContextConfig({
    audiences: [{ id: 'it' }, { id: 'executive' }], defaultAudience: 'executive',
  })
  for (const [label, search] of [['sender', '?a=it'], ['default', '?s=wa']]) {
    const resolved = on.resolveContext({ config: cfg, senderAudience: on.readSenderAudience(search) })
    if (!resolved) { bad(`${label}: nothing resolved, cannot check its metadata`); continue }
    const built = on.contextMetadata(resolved)
    if (built.context.source !== label) bad(`${label}: built source is ${built.context.source}`)
    if (built.context.version !== on.CONTEXT_METADATA_VERSION) bad(`${label}: wrong version`)
    if (JSON.stringify(M(built)) !== JSON.stringify(built)) {
      bad(`${label}: contextMetadata produced something its own validator alters or rejects: ${JSON.stringify(built)} -> ${JSON.stringify(M(built))}`)
    }
    if ('interest' in built.context) bad(`${label}: interest was invented when none exists`)
  }

  // ── event names are spelled once ────────────────────────────────────────
  if (on.CONTEXT_EVENT_VIEWED !== 'context_viewed') bad(`context view event renamed to ${on.CONTEXT_EVENT_VIEWED}`)
  if (on.CONTEXT_EVENT_CTA_CLICKED !== 'context_cta_clicked') bad(`cta event renamed to ${on.CONTEXT_EVENT_CTA_CLICKED}`)
  if ([...on.CONTEXT_EVENT_TYPES].join(',') !== 'context_viewed,context_cta_clicked') {
    bad('CONTEXT_EVENT_TYPES does not match the two Phase 1 events')
  }
}

// ══ TASK 8: what travels with a contact ═══════════════════════════════════
//
// THE RULE UNDER TEST. A sender's ?a=it is Andre's guess about Chris. It is
// not Chris saying "I am IT". Only a visitor's own choice may be recorded as
// qualification ABOUT a person; everything else records what was active and
// stops there. Storing an assumption as a stated fact is how a CRM fills up
// with things nobody said.
{
  const B = on.contactContextMetadata
  const V = on.sanitiseContactMetadata
  const aud = (id, label) => on.parseContextConfig({ audiences: [{ id, label }] }).audiences[0]

  // ── visitor: self-declared, so id AND the label they saw ────────────────
  const visitor = B({ audience: aud('procurement', 'Procurement'), source: 'visitor' })
  const vc = visitor?.context
  if (vc?.selectedAudience !== 'procurement') bad('a visitor choice did not record selectedAudience')
  if (vc?.selectedLabel !== 'Procurement') bad('a visitor choice did not snapshot the label they saw')
  if (vc?.activeAudience !== 'procurement' || vc?.activeSource !== 'visitor') bad('visitor active attribution wrong')

  // ── sender and default: attribution ONLY, never self-declaration ────────
  for (const src of ['sender', 'default']) {
    const m = B({ audience: aud('it', 'IT'), source: src })?.context
    if (!m) { bad(`${src}: produced nothing`); continue }
    if ('selectedAudience' in m) bad(`${src} recorded selectedAudience; that would turn an assumption into a stated fact`)
    if ('selectedLabel' in m) bad(`${src} recorded selectedLabel`)
    if (m.activeAudience !== 'it' || m.activeSource !== src) bad(`${src}: active attribution wrong`)
  }

  if (B(null) !== null) bad('no context produced metadata')

  // ── the validator honours the same rule against a hostile client ────────
  // A browser claiming a selectedAudience alongside source 'sender' is
  // claiming the visitor said something they did not.
  const forged = V({ context: { selectedAudience: 'it', selectedLabel: 'IT', activeAudience: 'it', activeSource: 'sender', version: 1 } })
  if (!forged) bad('a valid sender payload was rejected')
  else if ('selectedAudience' in forged.context) bad('a client forged a self-declaration onto a sender context and it was stored')

  const ok = V({ context: { selectedAudience: 'it', selectedLabel: 'IT', activeAudience: 'it', activeSource: 'visitor', version: 1 } })
  if (ok?.context?.selectedAudience !== 'it' || ok?.context?.selectedLabel !== 'IT') bad('a genuine visitor payload lost its self-declaration')

  // ── refusals, and never throwing ────────────────────────────────────────
  const REJECT = [
    ['null', null], ['a string', 'x'], ['an array', []], ['empty', {}],
    ['no context', { other: {} }],
    ['no activeAudience', { context: { activeSource: 'visitor', version: 1 } }],
    ['bad audience format', { context: { activeAudience: 'IT Manager', activeSource: 'visitor', version: 1 } }],
    ['invented source', { context: { activeAudience: 'it', activeSource: 'admin', version: 1 } }],
    ['wrong version', { context: { activeAudience: 'it', activeSource: 'visitor', version: 2 } }],
    ['oversized', { context: { activeAudience: 'it', activeSource: 'visitor', version: 1, pad: 'x'.repeat(4000) } }],
  ]
  for (const [label, input] of REJECT) {
    let r; try { r = V(input) } catch (e) { bad(`sanitiseContactMetadata threw on ${label}: ${e.message}`); continue }
    if (r !== null) bad(`${label} was accepted, expected null`)
  }

  // ── NOTHING PERSONAL, same rule as the analytics metadata ───────────────
  const personal = V({ context: {
    activeAudience: 'it', activeSource: 'visitor', version: 1,
    name: 'Chris', email: 'chris@example.com', phone: '+27821234567', company: 'TBC',
  } })
  if (personal && Object.keys(personal.context).sort().join(',') !== 'activeAudience,activeSource,version') {
    bad(`personal data survived into contact metadata: ${Object.keys(personal.context).join(',')}`)
  }

  // ── builder and validator must agree, or contacts silently lose it ──────
  for (const src of ['visitor', 'sender', 'default']) {
    const built = B({ audience: aud('executive', 'Executive / Owner / CEO'), source: src })
    if (JSON.stringify(V(built)) !== JSON.stringify(built)) {
      bad(`${src}: contactContextMetadata produced something its own validator alters: ${JSON.stringify(built)} -> ${JSON.stringify(V(built))}`)
    }
  }
}

// ── canonicalisation: the label NEVER comes from the browser ─────────────
//
// /api/contact is anonymous and public. sanitiseContactMetadata only proves a
// value LOOKS like an id; it cannot know whether this card offers it or what
// it is called. Without this step a caller could post selectedLabel
// "CEO - VIP CUSTOMER" and have it stored as though the owner had configured
// it and the visitor had declared it.
{
  const C = on.canonicaliseContactMetadata
  const config = on.parseContextConfig({
    audiences: [{ id: 'it', label: 'IT' }, { id: 'procurement', label: 'Procurement' }],
  })
  const meta = (c) => ({ context: { version: 1, ...c } })

  // THE MALICIOUS LABEL. Stored label must be the configured one.
  const forged = C(meta({ selectedAudience: 'it', selectedLabel: 'CEO - VIP CUSTOMER', activeAudience: 'it', activeSource: 'visitor' }), config)
  if (forged?.context?.selectedLabel !== 'IT') {
    bad(`a client-supplied label survived canonicalisation: ${JSON.stringify(forged?.context?.selectedLabel)}`)
  }
  // Markup must not reach the Contacts screen at all, escaped or otherwise.
  const scripty = C(meta({ selectedAudience: 'it', selectedLabel: '<img src=x onerror=alert(1)>', activeAudience: 'it', activeSource: 'visitor' }), config)
  if (JSON.stringify(scripty).includes('onerror')) bad('markup from the request reached stored contact metadata')

  // AUDIENCE MUST EXIST ON THIS CARD, not merely look like an id.
  if (C(meta({ activeAudience: 'astronaut', activeSource: 'sender' }), config) !== null) {
    bad('an audience this card does not offer was stored')
  }
  if (C(meta({ selectedAudience: 'astronaut', activeAudience: 'astronaut', activeSource: 'visitor' }), config) !== null) {
    bad('an invented selected audience was stored')
  }
  // A selection that disagrees with what was active cannot have happened.
  const mismatch = C(meta({ selectedAudience: 'procurement', activeAudience: 'it', activeSource: 'visitor' }), config)
  if (mismatch?.context && 'selectedAudience' in mismatch.context) {
    bad('a selection that disagreed with the active audience was stored as self-declared')
  }

  // Sender and default keep attribution only, with the real audience.
  for (const src of ['sender', 'default']) {
    const r = C(meta({ selectedAudience: 'it', selectedLabel: 'Fake', activeAudience: 'it', activeSource: src }), config)
    if (!r) { bad(`${src}: valid attribution was dropped`); continue }
    if ('selectedAudience' in r.context || 'selectedLabel' in r.context) {
      bad(`${src}: canonicalisation kept a self-declaration it should have dropped`)
    }
  }

  // The genuine case survives intact.
  const good = C(meta({ selectedAudience: 'procurement', selectedLabel: 'Procurement', activeAudience: 'procurement', activeSource: 'visitor' }), config)
  if (good?.context?.selectedAudience !== 'procurement' || good?.context?.selectedLabel !== 'Procurement') {
    bad('a genuine visitor selection did not survive canonicalisation')
  }

  // No config at all - e.g. the master switch is off, so nothing was shown.
  if (C(meta({ activeAudience: 'it', activeSource: 'sender' }), on.parseContextConfig({ audiences: [] })) !== null) {
    bad('attribution was stored for a card with no configured audiences')
  }
  for (const junk of [null, undefined, {}, 'x', 42, []]) {
    try { C(junk, config); C(meta({ activeAudience: 'it', activeSource: 'visitor' }), junk) }
    catch (e) { bad(`canonicaliseContactMetadata threw on ${String(junk)}: ${e.message}`) }
  }
}

// ══ TASK 9b: audiences that are switched off, not thrown away ═════════════
//
// THE PRODUCT RULE THIS PROTECTS. Switching an audience off must not lose the
// work that went into it. An owner who spent ten minutes arranging IT, turned
// it off for a quarter and came back to a blank form would rightly call that
// data loss, and would be right. So a disabled audience keeps its label, its
// order, its hidden sections and its CTA, and simply does not run.
//
// The second half of the rule is that "does not run" has to mean completely.
// A disabled audience that could still be reached by ?a=it, or could still be
// the default, would be worse than no switch at all: the owner would believe
// it was off.
{
  const P = on.parseContextConfig
  const E = on.effectiveContextConfig
  const R = on.resolveContext

  const FULL = {
    id: 'it',
    label: 'IT / Technology',
    order: ['links', 'certifications'],
    hide: ['gallery'],
    cta: { kind: 'link', index: 3, label: 'Book Technical Demo' },
  }
  const find = (c, id) => c.audiences.find(a => a.id === id) || null

  // ── 1. The three readings of `enabled`, plus every malformed one ────────
  //
  // Absent must mean ENABLED. Every config written before this field existed
  // said "in the list" for "switched on", and a schema change is not allowed
  // to switch off cards that are working today.
  {
    const legacy = find(P({ audiences: [{ id: 'it', label: 'IT' }] }), 'it')
    if (legacy?.enabled !== true) bad('an audience with no `enabled` key did not read as enabled, which silently switches off every config written before the field existed')

    if (find(P({ audiences: [{ id: 'it', enabled: true }] }), 'it')?.enabled !== true) bad('enabled: true did not read as enabled')
    if (find(P({ audiences: [{ id: 'it', enabled: false }] }), 'it')?.enabled !== false) bad('enabled: false did not read as disabled')

    // No truthy coercion. 1 is not true, "false" is not false, and an
    // explicit null is a value somebody wrote rather than a field nobody
    // wrote. All of them fail closed, and all of them KEEP the config.
    for (const junk of ['true', 'false', 1, 0, '', [], {}, null, NaN]) {
      const a = find(P({ audiences: [{ ...FULL, enabled: junk }] }), 'it')
      if (!a) { bad(`a malformed enabled value ${JSON.stringify(junk)} dropped the whole audience, destroying the configuration it was meant to protect`); continue }
      if (a.enabled !== false) bad(`a malformed enabled value ${JSON.stringify(junk)} did not fail closed`)
      if (a.label !== FULL.label || a.cta?.index !== 3 || a.hide[0] !== 'gallery') {
        bad(`a malformed enabled value ${JSON.stringify(junk)} lost the rest of the audience's configuration`)
      }
    }
  }

  // ── 2. Disabling preserves everything, re-enabling restores it ──────────
  {
    const offCfg = P({ audiences: [{ ...FULL, enabled: false }], defaultAudience: 'it' })
    const a = find(offCfg, 'it')
    if (!a) bad('a disabled audience was dropped from the stored config, so the dashboard could never read it back')
    if (a && (a.label !== 'IT / Technology' || a.order.join() !== 'links,certifications' || a.hide.join() !== 'gallery' || a.cta?.kind !== 'link' || a.cta?.index !== 3 || a.cta?.label !== 'Book Technical Demo')) {
      bad('disabling an audience lost its label, order, hidden sections or CTA')
    }

    // Re-enabling the same stored object returns the same behaviour, with no
    // repair step and nothing rebuilt.
    const onCfg = P({ audiences: [{ ...FULL, enabled: true }], defaultAudience: 'it' })
    const b = find(onCfg, 'it')
    if (!b?.enabled || b.cta?.label !== 'Book Technical Demo' || b.order.join() !== 'links,certifications') {
      bad('re-enabling an audience did not restore exactly what was configured')
    }
    if (onCfg.defaultAudience !== 'it') bad('re-enabling the audience did not make it usable as the default again')
  }

  // ── 3. A disabled audience cannot be the default ────────────────────────
  //
  // Cleared in the STORED config, not merely ignored at runtime, so the
  // dashboard shows the truth rather than a setting that can never fire.
  {
    const cfg = P({ audiences: [{ id: 'it', enabled: false }, { id: 'executive' }], defaultAudience: 'it' })
    if (cfg.defaultAudience !== null) bad('a disabled audience survived as defaultAudience, which is a setting that can never execute')
    if (!find(cfg, 'it')) bad('clearing the default also dropped the disabled audience')
  }

  // ── 4. The effective config is what the public card may run ─────────────
  {
    const stored = P({ audiences: [{ ...FULL, enabled: false }, { id: 'executive', label: 'Executive' }], defaultAudience: 'executive' })
    const eff = E(stored)
    if (stored.audiences.length !== 2) bad('the stored config lost an audience')
    if (eff.audiences.length !== 1 || eff.audiences[0].id !== 'executive') bad('the effective config still carried a disabled audience')
    if (eff.defaultAudience !== 'executive') bad('the effective config dropped a perfectly good default')

    const onlyDisabled = E(P({ audiences: [{ id: 'it', enabled: false }], defaultAudience: 'it' }))
    if (onlyDisabled.audiences.length !== 0 || onlyDisabled.defaultAudience !== null) {
      bad('a config whose only audience is disabled did not reduce to nothing')
    }
    for (const junk of [null, undefined, {}, 'x', 42, [], { audiences: 'no' }]) {
      try { E(junk) } catch (e) { bad(`effectiveContextConfig threw on ${String(junk)}: ${e.message}`) }
    }
  }

  // ── 5. A disabled audience cannot resolve, from anywhere ────────────────
  //
  // AND THE FALLBACK IS THE STANDARD CARD, NOT THE DEFAULT. ?a=it on a card
  // where IT is switched off is an explicit request that cannot be honoured,
  // which is the existing invalid-explicit rule: answering it with Executive
  // would be showing somebody a different audience than the sender addressed.
  {
    const eff = E(P({
      audiences: [{ id: 'it', enabled: false }, { id: 'executive' }],
      defaultAudience: 'executive',
    }))
    if (eff.defaultAudience !== 'executive') bad('the working default did not survive alongside a disabled audience')

    const CASES = [
      ['sender ?a=it with IT disabled', { config: eff, senderAudience: 'it' }],
      ['visitor selecting IT with IT disabled', { config: eff, visitorAudience: 'it' }],
      ['visitor IT, sender IT, both disabled', { config: eff, visitorAudience: 'it', senderAudience: 'it' }],
    ]
    for (const [label, input] of CASES) {
      const r = R(input)
      if (r !== null) bad(`${label}: resolved to ${r.audience.id} via ${r.source} instead of the standard card`)
    }

    // The control: with nothing explicit supplied the default still applies,
    // so the cases above are failing for the right reason.
    if (R({ config: eff })?.audience.id !== 'executive') bad('the default stopped applying when nothing was supplied')
    // And the enabled audience still resolves, so the filter is not simply
    // breaking everything.
    if (R({ config: eff, senderAudience: 'executive' })?.source !== 'sender') bad('an enabled audience stopped resolving')
  }

  // ── 6. The platform switch and the customer's switch are different ──────
  //
  // This is the release plan, expressed as a test. We must be able to build
  // and save configuration on Cardtly-owned cards while every public card in
  // the country still renders standard.
  {
    const ADDONS = {
      contactExchange: true,
      questionnaireEnabled: true,
      questionnaire: { questions: [{ label: 'Q', value: '' }] },
      cardtlyBadge: true,
      context: { enabled: true, audiences: [{ id: 'it', label: 'IT', enabled: true }], defaultAudience: 'it' },
    }

    // Platform OFF: the public card sees nothing at all...
    const pub = off.readCardContext(ADDONS)
    if (pub.enabled !== false || pub.config.audiences.length !== 0) {
      bad('the platform switch stopped overriding a configured card, so Context would go live before we turned it on')
    }
    // ...while the owner's dashboard still reads the whole configuration.
    const stored = off.readStoredContext(ADDONS)
    if (stored.enabled !== true) bad('readStoredContext reported the customer switch as off while the platform switch was off, so the dashboard could not be used before launch')
    if (stored.config.audiences.length !== 1 || stored.config.defaultAudience !== 'it') {
      bad('readStoredContext lost the configuration while the platform switch was off')
    }

    // Context switched off by the OWNER still keeps everything.
    const offAddons = { ...ADDONS, context: { ...ADDONS.context, enabled: false } }
    const kept = on.readStoredContext(offAddons)
    if (kept.enabled !== false) bad('the customer switch did not read as off')
    if (kept.config.audiences.length !== 1 || kept.config.audiences[0].label !== 'IT' || kept.config.defaultAudience !== 'it') {
      bad('switching the Context add-on off discarded the audiences, so turning it back on would not restore anything')
    }
    // And with the add-on off, the public card shows standard even when the
    // platform switch is on.
    if (on.readCardContext(offAddons).enabled !== false) bad('a card with Context switched off still executed Context')

    for (const junk of [null, undefined, 'x', 42, [], { context: 'no' }, { context: null }]) {
      try {
        const r = on.readStoredContext(junk)
        if (r.enabled !== false || r.config.audiences.length !== 0) bad(`readStoredContext accepted junk: ${JSON.stringify(junk)}`)
      } catch (e) { bad(`readStoredContext threw on ${JSON.stringify(junk)}: ${e.message}`) }
    }
  }

  // ── 7. What the owner's save route will accept ──────────────────────────
  {
    const S = on.canonicaliseContextForSave

    // The six, and only the six, during the beta. A well-formed id we do not
    // offer is refused by name rather than quietly dropped: silently saving
    // less than somebody asked for is how a settings screen starts lying.
    const unsupported = S({ enabled: true, audiences: [{ id: 'executive' }, { id: 'quantity-surveyors' }] })
    if (unsupported.ok !== false) bad('the save route accepted an audience id outside the supported six, which would mint a permanent public id nobody designed')
    if (unsupported.ok === false && !unsupported.error.includes('quantity-surveyors')) bad('the refusal did not name the offending audience')

    for (const id of on.CONTEXT_AUDIENCE_IDS) {
      const r = S({ enabled: true, audiences: [{ id }] })
      if (!r.ok) bad(`the save route refused a supported audience: ${id}`)
    }

    // Structurally broken input is the parser's ordinary business: dropped,
    // not refused. Only a well-formed unsupported id is an instruction.
    const messy = S({
      enabled: true,
      audiences: [
        { id: 'IT Manager' },                    // not a usable id at all
        { id: 'it', order: ['links', 'wallet'], hide: ['nope'], cta: { kind: 'link', index: 99 } },
        'not an object',
      ],
      defaultAudience: 'finance',
    })
    if (!messy.ok) bad('the save route refused a config it should simply have canonicalised')
    if (messy.ok) {
      if (messy.stored.audiences.length !== 1 || messy.stored.audiences[0].id !== 'it') bad('canonicalisation did not drop the unusable entries')
      if (messy.stored.audiences[0].cta !== null) bad('a CTA pointing past the last link slot was stored')
      if (messy.stored.audiences[0].order.join() !== 'links') bad('an unknown section survived canonicalisation')
      if (messy.stored.defaultAudience !== null) bad('a default naming no configured audience was stored')
    }

    // The customer switch is strict true, like every other switch here.
    for (const junk of ['true', 1, 'yes', {}, null, undefined]) {
      const r = S({ enabled: junk, audiences: [{ id: 'it' }] })
      if (r.ok && r.stored.enabled !== false) bad(`a non-boolean enabled (${JSON.stringify(junk)}) switched Context on`)
    }
    if (!S({ enabled: true, audiences: [{ id: 'it' }] }).stored.enabled) bad('enabled: true did not switch Context on')

    // Disabled audiences survive the save, which is the entire point.
    const savedOff = S({ enabled: false, audiences: [{ ...FULL, enabled: false }], defaultAudience: 'it' })
    if (!savedOff.ok) bad('the save route refused a config whose only audience is disabled')
    if (savedOff.ok) {
      const a = savedOff.stored.audiences[0]
      if (!a || a.enabled !== false || a.cta?.label !== 'Book Technical Demo' || a.hide.join() !== 'gallery') {
        bad('saving did not preserve a disabled audience exactly')
      }
      if (savedOff.stored.defaultAudience !== null) bad('saving kept a default that names a disabled audience')
    }

    for (const junk of [null, undefined, 'x', 42, [], true]) {
      const r = S(junk)
      if (r.ok !== false) bad(`the save route accepted junk: ${JSON.stringify(junk)}`)
    }
  }

  // ── 8. Saving Context cannot disturb any other add-on ───────────────────
  //
  // Release blocking. Contact exchange, the questionnaire and the badge are
  // things customers are already using; a Context save that touched them
  // would break paid features to configure an unreleased one.
  {
    const M = on.mergeContextAddon
    const existing = {
      contactExchange: true,
      questionnaireEnabled: true,
      questionnaire: { title: 'Form', questions: [{ label: 'Q', value: '' }] },
      questionnaires: [{ id: 'form_1' }],
      activeQuestionnaireId: 'form_1',
      cardtlyBadge: true,
    }
    const snapshot = JSON.stringify(existing)
    const stored = { enabled: true, audiences: [{ id: 'it', enabled: true, label: 'IT', order: [], hide: [], cta: null }], defaultAudience: null }
    const next = M(existing, stored)

    if (JSON.stringify(existing) !== snapshot) bad('the merge mutated the addons object it was given')
    for (const k of Object.keys(existing)) {
      if (JSON.stringify(next[k]) !== JSON.stringify(existing[k])) bad(`saving Context changed an unrelated add-on: ${k}`)
    }
    if (JSON.stringify(next.context) !== JSON.stringify(stored)) bad('the merge did not store the Context it was given')
    if (Object.keys(next).length !== Object.keys(existing).length + 1) bad('the merge added or removed keys beyond context')

    // Replacing an existing context replaces only that key.
    const again = M(next, { enabled: false, audiences: [], defaultAudience: null })
    if (again.contactExchange !== true || again.questionnaireEnabled !== true || again.cardtlyBadge !== true) {
      bad('saving Context a second time disturbed the other add-ons')
    }
    for (const junk of [null, undefined, 'x', 42, []]) {
      const r = M(junk, stored)
      if (!r || typeof r !== 'object' || JSON.stringify(r.context) !== JSON.stringify(stored)) bad(`the merge mishandled addons of ${JSON.stringify(junk)}`)
    }
  }
}

// ══ TASK 9f: the save route's gates, checked by POSITION ══════════════════
//
// WHAT THIS PROTECTS AND WHY IT IS POSITIONAL. /api/card/context writes to a
// jsonb column with the SERVICE ROLE key, which bypasses RLS entirely. The
// only things standing between that write and any caller are four checks and
// the order they appear in: authenticate, resolve a target the caller owns,
// confirm an active Pro plan, canonicalise. Move the update above any of them
// and nothing fails to compile, no page looks different, and no type is
// violated. Exactly the situation check-entitlement-order.mjs exists for.
//
// This is NOT a substitute for exercising the gate as a real non-Pro user. It
// is the half we can hold at build time: the gate cannot be quietly deleted or
// reordered without this failing.
{
  const SRC = 'app/api/card/context/route.ts'
  let src = ''
  try { src = readFileSync(SRC, 'utf8') } catch { bad(`${SRC} is missing`) }

  // Comments stripped, so prose describing a rule can never satisfy a check
  // looking for the code that implements it.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(String.fromCharCode(10)).map(l => l.replace(/\/\/.*$/, '')).join(String.fromCharCode(10))

  const at = (needle) => code.indexOf(needle)
  const needs = [
    ['authentication', 'auth.getUser()'],
    ['the unauthorized answer', "status: 401"],
    ['ownership resolution', 'await loadOwnedTarget('],
    ['the Pro gate', 'await getUserPlan('],
    ['the active-Pro condition', "plan.tier === 'pro' && plan.isActive"],
    ['the 403 answer', 'status: 403'],
    ['canonicalisation', 'canonicaliseContextForSave(body'],
    ['the merge helper', 'mergeContextAddon(target'],
  ]
  for (const [label, needle] of needs) {
    if (at(needle) < 0) bad(`the Context save route no longer contains ${label} (${needle})`)
  }

  const write = at('.update(')
  if (write < 0) bad('the Context save route no longer writes, so this guard is checking nothing')
  else {
    for (const [label, needle] of needs) {
      const i = at(needle)
      if (i >= 0 && i > write) bad(`${label} now happens AFTER the database write in ${SRC}`)
    }
  }

  // The platform switch must NOT gate configuration. Reintroducing it here is
  // how we would lose the ability to set Context up before launching it.
  if (/CONTEXT_ENABLED/.test(code)) {
    bad(`${SRC} references CONTEXT_ENABLED. The platform switch governs public execution, not whether an owner may configure Context.`)
  }

  // And the route must not hand a database message back to the caller.
  if (/error:\s*error\.message/.test(code)) bad(`${SRC} returns a raw database message to the caller`)
}

// == TASK 9f: the CTA the owner configured is the CTA that renders ==========
//
// THE BUG THIS EXISTS BECAUSE OF, and the reason the existing tests did not
// catch it. resolveContextCta has always returned the right label, and there
// is an assertion above proving exactly that. The renderer then dropped it: a
// booking CTA was handed to BookingTrigger with no label, so an audience
// configured with "Book an exec call" rendered a second button reading "Book a
// meeting", identical to the one the card already shows.
//
// A resolver test cannot see that. The value was correct every step of the way
// until the moment nobody passed it on, which is the class of defect only a
// render check or a person looking at the screen finds. Checked at the source
// because this harness has no React renderer, and checked narrowly so it fails
// on the one thing that went wrong rather than on any reformatting.
{
  const VIEW = 'components/card/PublicCardView.tsx'
  let src = ''
  try { src = readFileSync(VIEW, 'utf8') } catch { bad(VIEW + ' is missing') }

  const ctaAt = src.indexOf('{contextCta && (')
  if (ctaAt < 0) bad(VIEW + ': the Context CTA block is gone, so this guard checks nothing')
  else {
    const branch = src.slice(ctaAt, ctaAt + 2600)
    if (!/<BookingTrigger[^>]*label=\{contextCta\.label\}/.test(branch)) {
      bad(VIEW + ": the Context booking CTA does not pass label={contextCta.label}, so an owner's wording is replaced by the default")
    }
  }

  const trigAt = src.indexOf('function BookingTrigger')
  if (trigAt < 0) bad(VIEW + ': BookingTrigger is gone')
  else {
    const body = src.slice(trigAt, trigAt + 1800)
    if (!/label\?: string/.test(body)) bad(VIEW + ': BookingTrigger no longer accepts a label')
    if (!/\{label \|\| 'Book a meeting'\}/.test(body)) {
      bad(VIEW + ": BookingTrigger no longer renders {label || 'Book a meeting'}, so a Context booking label cannot reach the screen")
    }
  }
}


// == The editor and the card must agree on where booking can render ========
//
// THE BUG THIS EXISTS BECAUSE OF. The dashboard hardcoded "booking is always
// available", so on Circuit - the one template that draws its own booking
// control and therefore omits the shared one - an owner could pick a booking
// CTA, type wording for it, see it summarised as though it were live, and get
// no button on their card. The card behaved correctly the whole time. The
// editor was describing a card that did not exist.
//
// Two lists have to stay equal: TEMPLATES_WITHOUT_BOOKING in types/design,
// which the dashboard reads, and the templates that actually pass omitBooking
// in PublicCardView. Nothing else connects them, so nothing else would notice
// them drifting apart.
{
  const DESIGN = 'types/design.ts'
  const VIEW = 'components/card/PublicCardView.tsx'
  const LF = String.fromCharCode(10)
  const strip = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

  let design = '', view = ''
  try { design = strip(readFileSync(DESIGN, 'utf8')) } catch { bad(DESIGN + ' is missing') }
  try { view = strip(readFileSync(VIEW, 'utf8')) } catch { bad(VIEW + ' is missing') }

  const m = design.match(/TEMPLATES_WITHOUT_BOOKING[^=]*=\s*\[([^\]]*)\]/)
  if (!m) {
    bad(DESIGN + ': TEMPLATES_WITHOUT_BOOKING is gone, so the dashboard cannot know which designs have no booking button')
  } else {
    const declared = (m[1].match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, '')).sort()
    const marks = [...view.matchAll(/design\.templateId === '([a-z]+)'/g)].map(x => ({ id: x[1], at: x.index }))
    const actual = []
    for (const om of [...view.matchAll(/<BottomSection[^>]*omitBooking/g)]) {
      let owner = null
      for (const mk of marks) if (mk.at < om.index) owner = mk.id
      if (owner && !actual.includes(owner)) actual.push(owner)
    }
    actual.sort()
    if (actual.length === 0) {
      bad(VIEW + ': no template passes omitBooking any more, so this check cannot see what it compares against')
    }
    if (declared.join(',') !== actual.join(',')) {
      bad('booking availability drifted: types/design says [' + declared.join(',') + '] but PublicCardView omits booking on [' + actual.join(',') + ']. The editor would offer a booking CTA that cannot render, or refuse one that can.')
    }
  }
}


// == TASK 10a: which links an audience shows ===============================
//
// THE RULE THAT CARRIES THE WEIGHT. Absent, empty and malformed are three
// different things, and only one of them hides anything:
//
//   key absent     every link      nobody chose, and a schema change must not
//                                  empty a links section that works today
//   [3, 1]         those two
//   []             none            chosen emptiness, said out loud
//   junk           every link      fails OPEN: neutralising a bad field is the
//                                  standing rule, and hiding somebody's
//                                  content because we could not read a value
//                                  is not neutral
{
  const P = on.parseContextConfig
  const V = on.visibleLinks
  const LINKS = [
    { index: 1, title: 'Features', url: 'https://e.com/f' },
    { index: 2, title: 'Network', url: 'https://e.com/n' },
    { index: 3, title: 'How it Works', url: 'https://e.com/h' },
  ]
  const aud = (extra) => P({ audiences: [{ id: 'it', ...extra }] }).audiences[0]
  const ctx = (a) => ({ audience: a, source: 'sender' })
  const idx = (r) => r.map(l => l.index).join(',')

  // ── 1. The four stored states ──────────────────────────────────────────
  if (aud({}).links !== null) bad('an audience with no links key did not parse as null, so every existing config would change what it shows')
  if (idx(V(LINKS, ctx(aud({})))) !== '1,2,3') bad('an unconfigured audience did not show every link')

  const two = aud({ links: [3, 1] })
  if (!Array.isArray(two.links) || two.links.join(',') !== '3,1') bad(`a slot list did not survive parsing: ${JSON.stringify(two.links)}`)
  if (idx(V(LINKS, ctx(two))) !== '3,1') bad('a slot list did not control the order the links render in')

  const none = aud({ links: [] })
  if (!Array.isArray(none.links) || none.links.length !== 0) bad('an explicitly empty selection did not survive as empty')
  if (V(LINKS, ctx(none)).length !== 0) bad('an explicitly empty selection still rendered links')

  for (const junk of ['abc', 42, {}, null, true]) {
    const a = aud({ links: junk })
    if (a.links !== null) bad(`a malformed links value ${JSON.stringify(junk)} did not fail open to null`)
    if (idx(V(LINKS, ctx(a))) !== '1,2,3') bad(`a malformed links value ${JSON.stringify(junk)} hid links instead of failing open`)
  }

  // ── 2. Slot hygiene, the same treatment parseCta gives an index ────────
  const messy = aud({ links: [3, 3, 0, 99, 2.5, '1', -4, NaN, 2] })
  if (messy.links.join(',') !== '3,2') bad(`slot hygiene failed: ${JSON.stringify(messy.links)}`)
  const flooded = aud({ links: Array(9000).fill(1) })
  if (flooded.links.length !== 1) bad('a flooded slot list was not reduced')

  // ── 3. A selected slot that is now empty simply disappears ─────────────
  const cleared = aud({ links: [3, 2] })
  if (idx(V([LINKS[1]], ctx(cleared))) !== '2') bad('clearing a selected link broke the rest of the selection')
  if (V([], ctx(cleared)).length !== 0) bad('a card with no links still rendered some')

  // ── 4. THE TRAP. The CTA is additive and must not be filtered ──────────
  //
  // BottomSection uses the card's links twice: to build the links section and
  // to resolve the CTA. Filter once and pass the result to both, and hiding a
  // link silently kills a CTA pointing at it. An audience may legitimately
  // show two links while recommending a third it does not list.
  {
    const a = P({ audiences: [{ id: 'it', links: [1], cta: { kind: 'link', index: 3, label: 'Deep dive' } }] }).audiences[0]
    const shown = V(LINKS, ctx(a))
    if (idx(shown) !== '1') bad('the links selection was not applied')
    const cta = on.resolveContextCta(ctx(a), LINKS, false)
    if (!cta || cta.kind !== 'link' || !/Deep dive/.test(cta.label)) {
      bad('a CTA pointing at a link the audience does not list stopped resolving. resolveContextCta must keep receiving the card FULL link list, never the filtered one.')
    }
    // And the reverse: resolving the CTA against the filtered list is exactly
    // the mistake, so prove it would be visible.
    if (on.resolveContextCta(ctx(a), shown, false) !== null) {
      bad('this check cannot detect the filtered-list mistake any more')
    }
  }

  // ── 5. Hiding the section still wins over any selection ────────────────
  {
    const a = aud({ links: [1, 2], hide: ['links'] })
    if (on.orderSections(on.STANDARD_SECTION_ORDER, ctx(a)).includes('links')) {
      bad('a hidden links section was rendered because the audience had a link selection')
    }
  }

  // ── 6. Total, like everything else on the render path ──────────────────
  for (const junk of [null, undefined, 'x', 42, {}, []]) {
    try { V(junk, null); V(LINKS, junk) } catch (e) { bad(`visibleLinks threw on ${String(junk)}: ${e.message}`) }
  }
  if (idx(V(LINKS, null)) !== '1,2,3') bad('no context did not mean every link')
}


// == TASK 10c: the owner's choice survives the trip to the card ============
//
// FOUR HANDOFFS, and a value that is correct at every one of them until it is
// not. The picker writes `links` onto the draft, the draft becomes a
// ContextAudience for the preview, the same draft becomes the body of the save
// request, and the parser reads it back. Any one of those four dropping the
// field gives an editor that ticks, saves, reloads clean and changes nothing,
// which is the 9f failure again: the resolver was right, the renderer was
// right, and nobody passed the value on.
//
// Checked at the source because this harness has no React renderer. Narrow on
// purpose: it looks for the field surviving each conversion, not for any
// particular way of writing it.
{
  const EDITOR = 'components/context/ContextEditor.tsx'
  const PREVIEW = 'components/context/ContextPreview.tsx'
  const LF = String.fromCharCode(10)
  const strip = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

  let editor = '', preview = ''
  try { editor = strip(readFileSync(EDITOR, 'utf8')) } catch { bad(EDITOR + ' is missing') }
  try { preview = strip(readFileSync(PREVIEW, 'utf8')) } catch { bad(PREVIEW + ' is missing') }

  // Sliced to the next top-level function rather than to the first column-zero
  // closing brace, because a destructured props type ends with "}) {" on its
  // own line and the naive version stopped at the signature, reporting the
  // whole body missing. Same extraction the 10b guard above uses.
  const fn = (src, name) => {
    const at = src.indexOf('function ' + name)
    if (at < 0) return null
    const rest = src.slice(at + ('function ' + name).length)
    const end = rest.indexOf(LF + 'function ')
    return end < 0 ? rest : rest.slice(0, end)
  }

  // 1. Stored audience -> draft. Absent must become null, not undefined and
  //    not [], or an untouched audience would stop showing every link.
  const toDraft = fn(editor, 'toDraft')
  if (!toDraft) bad(EDITOR + ': toDraft is gone')
  else if (!/links:\s*a\?\.links \?\? null/.test(toDraft)) {
    bad(EDITOR + ': toDraft no longer maps a missing links key to null, so an audience that never chose would stop showing every link')
  }

  // 2. Draft -> audience, in BOTH places. The editor builds one for saving and
  //    the preview builds one for rendering, and they drift independently.
  for (const [file, src] of [[EDITOR, editor], [PREVIEW, preview]]) {
    if (!/links:\s*d\.links/.test(src)) {
      bad(file + ': a draft is turned into a ContextAudience without carrying links, so the owner ticks boxes that reach nothing')
    }
  }

  // 3. The picker exists and is wired to the draft rather than to itself.
  // The delimiter matters. `/<LinkPicker/` alone also matches <LinkPickerX,
  // so renaming the element to something that does not exist passed the check.
  // Found by mutating exactly that, which is the point of mutating.
  if (!/<LinkPicker[\s/>]/.test(editor)) {
    bad(EDITOR + ': the link picker is not rendered, so nothing can set a selection')
  }
  if (!/onLinks=\{[^}]*links: v/.test(editor)) {
    bad(EDITOR + ': onLinks does not patch links onto the draft, so the picker changes nothing that gets saved')
  }

  // 4. THE COLLAPSE RULE, which is the one piece of judgement in the picker.
  //    Every box ticked stores null, not a list of every slot. Without it,
  //    ticking everything freezes the audience against links added later.
  // 5. EVERY TICK HAS TO SAY WHAT IT IS.
  //
  //    Found in the 10d pass, by reading the accessibility tree instead of the
  //    DOM text. The rows were built as a label WRAPPING the input, which is
  //    valid HTML and came back named "on" - the default value attribute of a
  //    checkbox, and what a control with no accessible name falls back to. The
  //    radios ten lines below in the same file read correctly, because Radio
  //    uses id and htmlFor. Two ways to do the same thing, one of them legible
  //    to the tooling, and the picker had picked the other one.
  //
  //    A person using a screen reader would have heard "on, on, on, on, on".
  const picker0 = fn(editor, 'LinkPicker')
  if (picker0) {
    if (!/aria-label=\{/.test(picker0)) {
      bad(EDITOR + ': the link picker checkboxes have no aria-label, so each one is announced as "on" rather than as the link it selects')
    }
    if (!/htmlFor=\{`lnk-/.test(picker0) || !/id=\{`lnk-/.test(picker0)) {
      bad(EDITOR + ': the link picker no longer associates each label with its input by id, which is the half of this that survives a tooling change')
    }
  }

  const picker = fn(editor, 'LinkPicker')
  if (!picker) bad(EDITOR + ': LinkPicker is gone')
  else if (!/onLinks\(\s*isEverything \? null : ordered\s*\)/.test(picker)) {
    bad(EDITOR + ': LinkPicker no longer collapses a fully ticked selection back to null, so ticking every box would silently exclude any link added later')
  }
}


// == TASK 11a: one mechanism, two ways of naming a thing ===================
//
// Task 10 gave links their own parser, their own resolver and their own
// picker. Socials were about to be a second copy and the gallery a third, and
// three copies of one idea is precisely how the social row ended up rendered
// three different ways with two of them missing platforms.
//
// So the collections are declared and the machinery is shared. The block above
// is now also the proof that sharing it changed nothing: every Task 10
// assertion runs against the generalised code unaltered. What is left to check
// is the half links never exercised - a collection identified by KEY rather
// than by slot number.
{
  const P = on.parseContextConfig
  const picks = on.parsePicks
  const V = on.visiblePicks
  const C = on.CONTEXT_COLLECTIONS

  // 1. THE REGISTRY HAS TO DESCRIBE THE CARD THE EDITOR ACTUALLY OFFERS.
  //    Same drift this file already guards between types/design and the
  //    booking templates: two lists, no type connecting them.
  if (!C) bad('CONTEXT_COLLECTIONS is gone, so nothing declares what an audience can choose from')
  else {
    if (C.links && C.links.max !== MAX_CUSTOM_LINKS) {
      bad(`the registry offers ${C.links.max} link slots but the card has ${MAX_CUSTOM_LINKS}`)
    }
    if (C.gallery && C.gallery.max !== MAX_GALLERY_IMAGES) {
      bad(`the registry offers ${C.gallery.max} gallery slots but the card has ${MAX_GALLERY_IMAGES}`)
    }
    const declared = C.socials ? [...C.socials.keys].join(',') : ''
    if (declared !== SOCIAL_KEYS.join(',')) {
      bad(`the registry's socials (${declared}) have drifted from SOCIAL_SLOTS (${SOCIAL_KEYS.join(',')})`)
    }
  }

  // 2. THE FOUR STATES, for a key-identified collection.
  if (picks({}, 'socials') !== null) bad('an absent key collection did not parse as null, so every existing config would change what it shows')
  const two = picks({ socials: ['linkedin', 'tiktok'] }, 'socials')
  if (!two || two.join(',') !== 'linkedin,tiktok') bad(`a key selection did not survive parsing: ${JSON.stringify(two)}`)
  const none = picks({ socials: [] }, 'socials')
  if (!Array.isArray(none) || none.length !== 0) bad('an explicitly empty key selection did not survive as empty')
  for (const junk of ['abc', 42, {}, null, true]) {
    if (picks({ socials: junk }, 'socials') !== null) bad(`a malformed key collection ${JSON.stringify(junk)} did not fail open to null`)
  }

  // 3. KEY HYGIENE, the same treatment a slot list gets. An unknown platform
  //    is dropped rather than carried, so a renamed key cannot resurrect as a
  //    selection nothing can render.
  const messy = picks({ socials: ['linkedin', 'linkedin', 'myspace', 7, null, 'tiktok'] }, 'socials')
  if (!messy || messy.join(',') !== 'linkedin,tiktok') bad(`key hygiene failed: ${JSON.stringify(messy)}`)
  const flooded = picks({ socials: Array(9000).fill('linkedin') }, 'socials')
  if (!flooded || flooded.length !== 1) bad('a flooded key list was not reduced')

  // THE CAP BOUNDS WORK, NOT OUTPUT, so length alone cannot see it: dedupe
  // already reduces a flood of one repeated value to one item, which is why
  // the equivalent link assertion above passes whether the cap exists or not.
  // Parking a VALID value past the cap is what makes it observable.
  const beyondKeys = picks({ socials: [...Array(400).fill('nope'), 'linkedin'] }, 'socials')
  if (!beyondKeys || beyondKeys.length !== 0) {
    bad('the parser read past its flood cap on a key collection, so a public card can be made to do unbounded work')
  }
  const beyondSlots = picks({ links: [...Array(400).fill(0), 3] }, 'links')
  if (!beyondSlots || beyondSlots.length !== 0) {
    bad('the parser read past its flood cap on a slot collection, so a public card can be made to do unbounded work')
  }

  // 4. THE RESOLVER, on keys.
  const ITEMS = [{ key: 'linkedin' }, { key: 'tiktok' }, { key: 'youtube' }]
  const by = (x) => x.key
  const ctx = (socials) => ({
    audience: { id: 'it', enabled: true, label: 'IT', order: [], hide: [], links: null, socials, cta: null },
    source: 'sender',
  })
  if (V(ITEMS, ctx(null), 'socials', by).length !== 3) bad('a null key selection did not mean every item')
  if (V(ITEMS, ctx(['tiktok', 'linkedin']), 'socials', by).map(by).join(',') !== 'tiktok,linkedin') {
    bad('a key selection did not control the order items render in')
  }
  if (V(ITEMS, ctx([]), 'socials', by).length !== 0) bad('an explicitly empty key selection still rendered items')
  if (V(ITEMS, ctx(['myspace']), 'socials', by).length !== 0) bad('an unknown key resolved to something')

  // 5. Total, like everything else on the render path.
  for (const junk of [null, undefined, 'x', 42, {}, []]) {
    try { V(junk, null, 'socials', by); V(ITEMS, junk, 'socials', by) }
    catch (e) { bad(`visiblePicks threw on ${String(junk)}: ${e.message}`) }
  }

  // 6. AND NOTHING NEW IS STORED YET, deliberately. 11a declares gallery and
  //    socials and wires neither onto an audience, so this release cannot save
  //    a selection that no renderer honours. DELETE THIS CHECK IN 11c, when
  //    the renderers exist - it is here to make that a decision rather than an
  //    accident.
  const a = P({ audiences: [{ id: 'it', socials: ['linkedin'], gallery: [1] }] }).audiences[0]
  if ('socials' in a || 'gallery' in a) {
    bad('an audience now carries a collection that has no renderer yet; if that is intentional this check is the thing to remove, in the same commit')
  }
}


// == TASK 10b: the filter reaches the links section, and ONLY the links =====
//
// 10a built visibleLinks and deliberately did not call it, so the block above
// proves the rules and proves nothing about the card. This is the other half,
// and it is the half that has bitten us before: in 9f resolveContextCta was
// correct at every step until the renderer dropped its result on the floor.
//
// TWO FAILURES, OPPOSITE DIRECTIONS. Render the full list and a saved
// selection does nothing, which is visible and annoying. Hand the FILTERED
// list to resolveContextCta and an audience that shows two links while
// recommending a third loses its CTA entirely, with nothing on screen to
// suggest a CTA was ever configured. The second is the quiet one, so it gets
// its own check at the call site rather than only at module level.
//
// Checked at the source because this harness has no React renderer, and kept
// narrow enough to fail on the substitution rather than on reformatting.
{
  const VIEW = 'components/card/PublicCardView.tsx'
  const LF = String.fromCharCode(10)
  const strip = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

  let view = ''
  try { view = strip(readFileSync(VIEW, 'utf8')) } catch { bad(VIEW + ' is missing') }

  const at = view.indexOf('function BottomSection')
  if (at < 0) bad(VIEW + ': BottomSection is gone, so this guard checks nothing')
  else {
    const rest = view.slice(at + 'function BottomSection'.length)
    const end = rest.indexOf(LF + 'function ')
    const body = end < 0 ? rest : rest.slice(0, end)

    if (!/const audienceLinks = visibleLinks\(links, context\)/.test(body)) {
      bad(VIEW + ': BottomSection no longer derives audienceLinks from visibleLinks(links, context), so a saved link selection would be stored and never rendered')
    }
    if (!/\{audienceLinks\.map\(/.test(body)) {
      bad(VIEW + ': the links section does not map audienceLinks, so it renders every link whatever the audience chose')
    }
    if (/\{links\.map\(/.test(body)) {
      bad(VIEW + ': something in BottomSection still maps the card full link list')
    }
    if (!/audienceLinks\.length > 0/.test(body)) {
      bad(VIEW + ': the links section is still gated on the full list length, so an audience showing no links would render an empty Links heading')
    }

    const cta = body.match(/resolveContextCta\(([^)]*)\)/)
    if (!cta) bad(VIEW + ': resolveContextCta is no longer called from BottomSection')
    else if (/audienceLinks/.test(cta[1])) {
      bad(VIEW + ': resolveContextCta is being handed the FILTERED list. A Context CTA is additive and may point at a link the audience does not list, so it must keep receiving `links`.')
    }
  }
}


// ══ TASK 9b MUTATIONS: prove each rule is load bearing ════════════════════
//
// A guard nobody has broken on purpose is a guard nobody knows works. Each
// entry below removes exactly one rule, recompiles, and asserts that the
// behaviour the rule protects genuinely changes. If a mutation compiles and
// the behaviour stays correct, the rule was decorative and this says so.
{
  const MUTANTS = [
    {
      what: 'a missing `enabled` key defaults to enabled',
      mutate: [["  if (!('enabled' in raw)) return true", '  if (false) return true']],
      // A legacy config, written before the field existed, must still run.
      broken: m => m.parseContextConfig({ audiences: [{ id: 'it', label: 'IT' }] }).audiences[0].enabled === false,
    },
    {
      what: 'disabled audiences are removed from the effective config',
      mutate: [['.filter(a => a && a.enabled)', '.filter(a => a)']],
      // A switched-off audience becomes reachable by ?a=it again.
      broken: m => {
        const eff = m.effectiveContextConfig(m.parseContextConfig({ audiences: [{ id: 'it', enabled: false }, { id: 'executive' }] }))
        return m.resolveContext({ config: eff, senderAudience: 'it' })?.audience.id === 'it'
      },
    },
    {
      what: 'a disabled audience is cleared as the default',
      mutate: [['const defaultAudience = wanted && usable.has(wanted) ? wanted : null',
                'const defaultAudience = wanted && seen.has(wanted) ? wanted : null']],
      broken: m => m.parseContextConfig({ audiences: [{ id: 'it', enabled: false }], defaultAudience: 'it' }).defaultAudience === 'it',
    },
    {
      what: 'saving Context leaves other add-ons alone',
      mutate: [['  const base = isPlainObject(existing) ? existing : {}', '  const base = {}']],
      broken: m => m.mergeContextAddon({ contactExchange: true }, { enabled: true, audiences: [], defaultAudience: null }).contactExchange === undefined,
    },
    {
      // The parser no longer strips a hidden section out of `order`, so the
      // ONLY thing stopping a hidden section from rendering is this filter.
      // It carried a belt and braces before; now it is the belt.
      what: 'hiding still wins at render',
      mutate: [['    const kept = list.filter(s => !hide.includes(s))', '    const kept = list']],
      broken: m => {
        const a = m.parseContextConfig({ audiences: [{ id: 'it', order: ['links', 'gallery'], hide: ['gallery'] }] }).audiences[0]
        return m.orderSections(m.STANDARD_SECTION_ORDER, { audience: a, source: 'default' }).includes('gallery')
      },
    },
    {
      what: 'a hidden section keeps its position in the stored order',
      mutate: [['  const order = sectionList(v.order)', '  const order = sectionList(v.order).filter(s => !hide.includes(s))']],
      broken: m => !m.parseContextConfig({ audiences: [{ id: 'it', order: ['links', 'gallery'], hide: ['gallery'] }] }).audiences[0].order.includes('gallery'),
    },
    {
      what: 'a malformed links value fails open rather than hiding links',
      mutate: [['  if (!Array.isArray(v)) return null', '  if (!Array.isArray(v)) return []']],
      broken: m => {
        const a = m.parseContextConfig({ audiences: [{ id: 'it', links: 'abc' }] }).audiences[0]
        return m.visibleLinks([{ index: 1 }], { audience: a, source: 'sender' }).length === 0
      },
    },
    {
      what: 'an explicitly empty selection shows nothing',
      mutate: [['    if (!Array.isArray(wanted)) return all', '    if (!Array.isArray(wanted) || wanted.length === 0) return all']],
      broken: m => {
        const a = m.parseContextConfig({ audiences: [{ id: 'it', links: [] }] }).audiences[0]
        return m.visibleLinks([{ index: 1 }], { audience: a, source: 'sender' }).length > 0
      },
    },
    {
      what: 'the selection controls the order links render in',
      mutate: [['    for (const id of wanted) {', '    for (const id of [...wanted].sort()) {']],
      broken: m => {
        const a = m.parseContextConfig({ audiences: [{ id: 'it', links: [3, 1] }] }).audiences[0]
        return m.visibleLinks([{ index: 1 }, { index: 3 }], { audience: a, source: 'sender' })
          .map(l => l.index).join(',') !== '3,1'
      },
    },
    {
      what: 'the platform switch does not block configuration',
      mutate: [['export function readStoredContext(addons: unknown): { enabled: boolean; config: ContextConfig } {\n  try {',
                'export function readStoredContext(addons: unknown): { enabled: boolean; config: ContextConfig } {\n  try {\n    if (!CONTEXT_ENABLED) return { enabled: false, config: EMPTY_CONFIG }']],
      // Compiled with the switch OFF, which is how it ships today.
      forceOn: false,
      broken: m => m.readStoredContext({ context: { enabled: true, audiences: [{ id: 'it' }] } }).config.audiences.length === 0,
    },
  ]

  for (const t of MUTANTS) {
    const forceOn = t.forceOn === undefined ? true : t.forceOn
    const baseline = forceOn ? on : off

    // TWO SIDED, because a one-sided mutation test proves nothing. If the
    // predicate already reports "broken" against the real module then it is
    // not detecting the mutation, it is simply always true, and every mutation
    // it guards would pass whether or not the rule exists.
    let baselineBroken = true
    try { baselineBroken = t.broken(baseline) === true } catch { baselineBroken = true }
    if (baselineBroken) {
      bad(`MUTATION TEST IS VACUOUS: the check for "${t.what}" already reports broken against the unmutated module, so it cannot detect anything`)
      continue
    }

    const { mod, out } = load(forceOn, t.mutate)
    const m = await mod
    let caught = false
    try { caught = t.broken(m) === true } catch { caught = true }
    if (!caught) bad(`MUTATION SURVIVED: removing "${t.what}" changed nothing, so that rule is not actually doing the work`)
    try { rmSync(out, { recursive: true, force: true }) } catch {}
  }
}

for (const d of [onDir, offDir]) { try { rmSync(d, { recursive: true, force: true }) } catch {} }

if (fail) {
  console.error(`\ncheck-card-context: ${fail} failure(s).`)
  process.exit(1)
}
// DEPLOYMENT EVIDENCE, printed whichever way the switch is set. A build log
// should say out loud which platform state shipped, because "Context went live
// and nobody noticed which build did it" is a question we would otherwise be
// answering from memory.
console.log(`
Cardtly Context platform switch: ${committedSwitch(readFileSync(SRC, 'utf8')) ? 'ON' : 'OFF'}`)
console.log(
  `check-card-context: the entitlement failed closed on all ${HOSTILE.length} malformed inputs without throwing, ` +
  'the master switch overrides a configured card, the parser drops bad audiences, ids, sections and CTAs ' +
  'without losing the good ones, protected card areas are unreachable, a CTA cannot carry a URL, and the ' +
  'resolver treats an absent audience as the configured default while an unresolvable one falls to the standard card. ' +
  'A switched-off audience keeps its label, order, hidden sections and CTA, cannot resolve from a visitor or a sender, ' +
  'cannot be the default, and leaves the standard card rather than the default when one is explicitly asked for. ' +
  'An audience written before `enabled` existed still runs, a malformed `enabled` fails closed without losing the ' +
  'configuration, the owner can save and read back Context while the platform switch is off, and saving Context ' +
  'cannot touch another add-on. All five of those rules were then deliberately removed and every one was caught.',
)
