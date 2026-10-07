// Section headings and gallery captions: readable by default, and the
// cardholder's colour when they pick one.
//
// WHY (2026-10-07): a Showroom card on a #c2c2c2 page drew Certifications, More,
// Gallery and every gallery caption in 60% white, about 1.4:1. The page counts
// as "dark" by getReadableTextOn's 0.55 cut-off, which is right for buttons and
// the hero and wrong for small text on a mid grey. Two things fixed it:
//
//   1. sectionMutedOn picks dark muted text for those labels on a custom page
//      white cannot carry (under 3:1), and leaves every other card alone.
//      Deliberately NOT a change to bg.subtext or isLightBg: Showroom draws its
//      job title in bg.subtext over a dark hero scrim, and moving either would
//      have put a dark title on a dark scrim or flipped the scrim itself.
//   2. sectionHeadingColor and captionColor in the design, set under Design,
//      Typography. Captions follow the headings unless given their own.
//
// Run: node scripts/check-section-colours.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '')

const out = mkdtempSync(join(tmpdir(), 'sectioncol-'))
let D
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'types/design.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'design.js'), join(out, 'design.mjs'))
  D = await import(pathToFileURL(join(out, 'design.mjs')).href)
} catch (e) {
  console.error('check-section-colours: could not compile types/design.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const DARK = 'rgba(0,0,0,0.60)'
const WHITE60 = 'rgba(255,255,255,0.60)'
const cases = [
  ['the grey that was reported (#c2c2c2) gets dark labels', D.sectionMutedOn(WHITE60, '#c2c2c2'), DARK],
  ['a mid grey (#9e9e9e) gets dark labels', D.sectionMutedOn(WHITE60, '#9e9e9e'), DARK],
  ['a mid blue white can still carry (#4f7cb0) is left alone', D.sectionMutedOn(WHITE60, '#4f7cb0'), WHITE60],
  ['a dark page is left alone', D.sectionMutedOn(WHITE60, '#111827'), WHITE60],
  ['a light page keeps its own (already dark) muted text', D.sectionMutedOn(DARK, '#f5f5f5'), DARK],
  ['no custom colour means the palette decides', D.sectionMutedOn('#9ca3af', undefined), '#9ca3af'],
  ['a gradient or rgba page is left alone', D.sectionMutedOn(WHITE60, 'linear-gradient(red, blue)'), WHITE60],
  ['the heading pick wins', D.getSectionHeadingColor({ sectionHeadingColor: '#d4202c' }, '#999'), '#d4202c'],
  ['no heading pick falls back', D.getSectionHeadingColor({}, '#999'), '#999'],
  ['captions follow the headings when not set', D.getCaptionColor({ sectionHeadingColor: '#d4202c' }, '#999'), '#d4202c'],
  ['a caption pick wins over the headings', D.getCaptionColor({ sectionHeadingColor: '#d4202c', captionColor: '#111111' }, '#999'), '#111111'],
  ['no picks at all falls back', D.getCaptionColor({}, '#999'), '#999'],
]
for (const [what, got, want] of cases) if (got !== want) bad(`${what}: got ${got}, expected ${want}`)

// The page palette itself must not have moved: the hero reads bg.subtext.
const pal = D.getBgColors('light', 'showroom', '#c2c2c2')
if (pal.subtext !== WHITE60) bad(`getBgColors changed bg.subtext on #c2c2c2 to ${pal.subtext}; Showroom draws its job title in it over a dark scrim.`)
if (D.isLightBg('#c2c2c2') !== false) bad('isLightBg changed for #c2c2c2, which would flip Showroom\'s hero scrim.')

// Wired: the card uses them, and the panel offers them.
const card = read('components/card/PublicCardView.tsx')
for (const label of ['Certifications', 'Gallery']) {
  if (!new RegExp(`style=\\{\\{ color: headingColor \\}\\}>${label}</p>`).test(card)) bad(`the ${label} heading no longer uses the heading colour.`)
}
if (!/style=\{\{ color: headingColor \}\}>\s*\n\s*\{primaryLinks\.length > 0 \? 'More' : 'Links'\}/.test(card)) bad('the Links / More heading no longer uses the heading colour.')
if (!/text-\[11px\] leading-snug" style=\{\{ color: captionColor \}\}/.test(card)) bad('gallery captions no longer use the caption colour.')
if (!/headingColor: getSectionHeadingColor\(design, sectionMutedOn\(bg\.subtext, design\.customBgColor\)\)/.test(card)
  || !/captionColor: getCaptionColor\(design, sectionMutedOn\(bg\.subtext, design\.customBgColor\)\)/.test(card)) {
  bad('the card no longer resolves the heading and caption colours through the pick and sectionMutedOn.')
}
const panel = read('components/card/DesignPanel.tsx')
if (!/key: 'sectionHeadingColor', label: 'Section headings'/.test(panel) || !/key: 'captionColor', label: 'Gallery captions'/.test(panel)) {
  bad('the Design panel no longer offers the section heading and caption colours.')
}

if (fail) {
  console.error(`\ncheck-section-colours: ${fail} failure(s).`)
  process.exit(1)
}
console.log(`check-section-colours: ${cases.length} cases pass, the hero palette is untouched, and the card and Design panel are wired to the heading and caption colours.`)
