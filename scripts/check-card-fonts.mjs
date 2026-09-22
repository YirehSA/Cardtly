// Every font Cardtly offers is a font Cardtly loads.
//
// WHAT THIS EXISTS BECAUSE OF. types/design offered five fonts and the app
// loaded none of them. `heading: 'Inter, system-ui, sans-serif'` only ASKS for
// Inter; it does not fetch it, and nothing else on the page did either. So
// four of the five choices fell back to the same system sans: "Clean",
// "Modern" and "Friendly" were three names for one result, and had been for as
// long as the picker existed. Nothing failed. Nothing logged. The picker
// looked fine, because every tile rendered its sample in the fallback too.
//
// That is the shape of bug this guards: a font choice that is a string nobody
// checked. The rule is that a family must come from a CSS variable declared in
// lib/card-fonts, which is the only place that actually fetches a file.
//
// Run: node scripts/check-card-fonts.mjs

import { readFileSync } from 'fs'

const DESIGN = 'types/design.ts'
const FONTS_LIB = 'lib/card-fonts.ts'
const LAYOUT = 'app/layout.tsx'
const LF = String.fromCharCode(10)

// The one family allowed to be named directly. Georgia ships with Windows,
// macOS, iOS and Android, so it is genuinely present without being fetched -
// verified on the live site, where it was the only one of the original five
// that worked. Anything else named as a bare string is the old bug returning.
const SYSTEM_ALLOWED = ['Georgia', 'Times New Roman', 'system-ui', 'sans-serif', 'serif', 'monospace', 'Impact']

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

const design = read(DESIGN)
const lib = read(FONTS_LIB)
const layout = read(LAYOUT)
if (!design || !lib || !layout) { bad('a source file is missing'); process.exit(1) }

// ── 1. The variables the picker asks for are the ones the loader declares ───
const declared = new Set([...lib.matchAll(/variable: '(--font-[a-z-]+)'/g)].map(m => m[1]))
const fontsBlock = design.match(/export const FONTS: Record<FontId[\s\S]*?\n\}/)
if (!fontsBlock) {
  bad(`${DESIGN}: the FONTS map is gone or no longer written as a Record<FontId, ...>.`)
  process.exit(1)
}
const used = new Set([...fontsBlock[0].matchAll(/var\((--font-[a-z-]+)\)/g)].map(m => m[1]))

for (const v of used) {
  if (!declared.has(v)) {
    bad(`${DESIGN} offers a font set in ${v}, but ${FONTS_LIB} never declares it. The variable resolves to nothing, so that choice silently renders in the fallback - which is exactly the defect this guard was written for.`)
  }
}
for (const v of declared) {
  if (!used.has(v)) {
    bad(`${FONTS_LIB} loads ${v} but no font in ${DESIGN} uses it. That is a typeface being downloaded at build time for nothing; either wire it up or drop it.`)
  }
}

// ── 2. Every choice in the picker resolves to a real face ───────────────────
//
// A family that is neither a declared variable nor a genuine system font is a
// name being hoped for.
const entries = [...fontsBlock[0].matchAll(/^\s*(\w+):\s*\{ label: '([^']*)',\s*heading: '([^']*)',\s*body: '([^']*)'/gm)]
if (entries.length === 0) bad(`${DESIGN}: no font entries could be read out of FONTS, so none of them can be checked.`)
for (const [, id, label, heading, body] of entries) {
  for (const [which, stack] of [['heading', heading], ['body', body]]) {
    const named = stack
      .split(',')
      .map(p => p.trim().replace(/^["']|["']$/g, ''))
      .filter(p => !p.startsWith('var('))
    for (const fam of named) {
      if (!SYSTEM_ALLOWED.includes(fam)) {
        bad(`${DESIGN}: font "${id}" names ${which} family "${fam}" directly. Nothing loads it, so it will fall back silently. Declare it in ${FONTS_LIB} and use its var(), or add it to SYSTEM_ALLOWED here if it genuinely ships with every OS.`)
      }
    }
    if (named.length === stack.split(',').length && !SYSTEM_ALLOWED.includes(named[0])) {
      bad(`${DESIGN}: font "${id}" has no loaded family at all in its ${which} stack.`)
    }
  }
  // The labels are the typefaces' real names now, not adjectives. "Clean" and
  // "Tech" told somebody choosing a font nothing about what they would get.
  if (['Clean', 'Classic', 'Modern', 'Friendly', 'Tech'].includes(label) && id !== 'serif') {
    bad(`${DESIGN}: font "${id}" is labelled "${label}". The picker shows the typeface's real name so people can recognise it.`)
  }
}

// ── 3. The variables actually reach the document ────────────────────────────
//
// Declaring a font emits a variable; it does nothing until the class is on an
// element. Attached nowhere, all twenty resolve to nothing and every card
// falls back - the original bug, one level further along.
if (!/export const cardFontVariables/.test(lib)) {
  bad(`${FONTS_LIB} no longer exports cardFontVariables, so ${LAYOUT} has nothing to attach.`)
}
if (!/cardFontVariables/.test(layout)) {
  bad(`${LAYOUT} does not use cardFontVariables, so none of the card font variables are defined on the page and every font choice falls back.`)
}
// `[\s\S]{0,300}?` and not `[^}]*`: the className is a template literal full
// of `${...}` interpolations, so anything excluding a closing brace stops at
// the first one and reports a failure that is not there.
if (!/<html[\s\S]{0,300}?cardFontVariables/.test(layout)) {
  bad(`${LAYOUT}: cardFontVariables is imported but not on the <html> className. A card renders inside <body>, so the variables have to be defined at or above it.`)
}

// ── 4. next/font can still read its own arguments ───────────────────────────
//
// Its options are analysed at build time, so a spread fails the build with
// "Unexpected spread" - which is how the first version of card-fonts died.
// Cheaper to say so here than to find out at the end of a deploy.
if (/\(\s*\{\s*\.\.\./.test(lib)) {
  bad(`${FONTS_LIB} passes a spread into a next/font call. Those options are read statically at build time, so this fails the build with "Unexpected spread". Write each option object out in full.`)
}

if (fail) {
  console.error(`${LF}check-card-fonts: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-card-fonts: all ${entries.length} font choices resolve to a face that is actually loaded (${declared.size} self-hosted ` +
  'families plus Georgia), every declared family is used, and the variables reach the document.',
)
