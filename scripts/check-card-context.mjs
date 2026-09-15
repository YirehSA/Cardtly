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

/** Compile the module, optionally forcing the master switch on first. */
function load(forceOn) {
  const out = mkdtempSync(join(tmpdir(), 'card-context-'))
  const src = readFileSync(SRC, 'utf8')
  const patched = forceOn
    ? src.replace('export const CONTEXT_ENABLED = false', 'export const CONTEXT_ENABLED = true')
    : src
  if (forceOn && patched === src) {
    bad('could not force CONTEXT_ENABLED on - the declaration was reworded, so the switch is no longer being tested')
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
  if (cta({ kind: 'link', index: 14 })?.index !== 14) bad('a link CTA at the max index was rejected')

  const invalid = [
    ['null', null], ['a string', 'book'], ['an array', []], ['empty', {}],
    ['unknown kind', { kind: 'popup', index: 1 }],
    ['kind missing', { index: 1 }],
    ['link with no index', { kind: 'link' }],
    ['index 0', { kind: 'link', index: 0 }],
    ['index 15', { kind: 'link', index: 15 }],
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

for (const d of [onDir, offDir]) { try { rmSync(d, { recursive: true, force: true }) } catch {} }

if (fail) {
  console.error(`\ncheck-card-context: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-card-context: the entitlement failed closed on all ${HOSTILE.length} malformed inputs without throwing, ` +
  'the master switch overrides a configured card, and the parser drops bad audiences, ids, sections and CTAs ' +
  'without losing the good ones. Protected card areas are unreachable and a CTA cannot carry a URL.',
)
