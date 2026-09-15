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

for (const d of [onDir, offDir]) { try { rmSync(d, { recursive: true, force: true }) } catch {} }

if (fail) {
  console.error(`\ncheck-card-context: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-card-context: the entitlement failed closed on all ${HOSTILE.length} malformed inputs without throwing, ` +
  'only a literal `enabled: true` switches it on, and the master switch overrides a configured card.',
)
