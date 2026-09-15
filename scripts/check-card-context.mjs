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
const MAX_CUSTOM_LINKS = (() => {
  const m = readFileSync('types/design.ts', 'utf8').match(/export const MAX_CUSTOM_LINKS\s*=\s*(\d+)/)
  if (!m) {
    console.error('check-card-context: could not read MAX_CUSTOM_LINKS from types/design.ts')
    process.exit(1)
  }
  return Number(m[1])
})()

/** Compile the module, optionally forcing the master switch on first. */
function load(forceOn) {
  const out = mkdtempSync(join(tmpdir(), 'card-context-'))
  const src = readFileSync(SRC, 'utf8')
  let patched = forceOn
    ? src.replace('export const CONTEXT_ENABLED = false', 'export const CONTEXT_ENABLED = true')
    : src
  if (forceOn && patched === src) {
    bad('could not force CONTEXT_ENABLED on - the declaration was reworded, so the switch is no longer being tested')
  }

  // Stand in for the aliased import, which cannot resolve outside the project.
  const before = patched
  patched = patched
    .replace(/^import \{ MAX_CUSTOM_LINKS \} from '@\/types\/design'\n/m, '')
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
  if (off.CONTEXT_ENABLED !== false) {
    bad('CONTEXT_ENABLED is committed as true - Phase 1 is not finished and this switch is the backstop')
  }
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
    if (exec && exec.order.includes('gallery')) bad('executive ordered a section it also hides')
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

  // Overlap: hiding wins over ordering.
  const overlap = one({ order: ['links', 'gallery'], hide: ['gallery'] })
  if (overlap.order.includes('gallery')) bad('a hidden section survived in order')
  if (!overlap.hide.includes('gallery')) bad('a hidden section was lost')

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

for (const d of [onDir, offDir]) { try { rmSync(d, { recursive: true, force: true }) } catch {} }

if (fail) {
  console.error(`\ncheck-card-context: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-card-context: the entitlement failed closed on all ${HOSTILE.length} malformed inputs without throwing, ` +
  'the master switch overrides a configured card, the parser drops bad audiences, ids, sections and CTAs ' +
  'without losing the good ones, protected card areas are unreachable, a CTA cannot carry a URL, and the ' +
  'resolver treats an absent audience as the configured default while an unresolvable one falls to the standard card.',
)
