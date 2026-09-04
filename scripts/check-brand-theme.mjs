// Does the dashboard's brand accent stay readable for ANY colour a customer
// picks?
//
// The dashboard takes its accent from the card's own colour, so the input to
// this is not a palette we chose - it is whatever hex somebody typed into a
// colour picker. Yellow, white, black, neon lime and every hue in between all
// end up as the background of a button with text on it.
//
// lib/brand-theme solves the lightness and the text colour against WCAG rather
// than picking by eye. This checks that it actually did, across every hue and
// the specific colours that break naive implementations, in both themes.
//
// Run: node scripts/check-brand-theme.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'brand-theme-'))
let brandTheme
try {
  // The compiler is invoked through its own JS entry point rather than the
  // .cmd shim: spawning a .cmd needs a shell on Windows, and asking for one
  // means quoting a path that may contain spaces.
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/brand-theme.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' },
  )
  renameSync(join(out, 'brand-theme.js'), join(out, 'brand-theme.mjs'))
  ;({ brandTheme } = await import(pathToFileURL(join(out, 'brand-theme.mjs')).href))
} catch (e) {
  console.error('check-brand-theme: could not compile lib/brand-theme.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
}

const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
const hslToRgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
const hexLum = h => lum([0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16)))
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// The page each accent sits on, so the accent itself can be checked as a UI
// component (3:1) and not only as a text background.
const PAGE = { light: lum([247, 246, 243]), dark: lum([9, 11, 17]) }

const NAMED = {
  'brand blue': '#3b82f6', 'hot pink': '#ec4899', 'neon yellow': '#ffff00',
  'lime': '#00ff00', 'cyan': '#00ffff', 'navy': '#001f3f', 'gold': '#d4af37',
  'olive drab': '#6b8e23', 'muddy green': '#7a8b5a', 'orange': '#ff7f00',
  'pale mint': '#d9f7e7', 'deep purple': '#2d004d', 'red': '#ff0000',
  'terracotta': '#b85042', 'teal': '#028090',
}
const NO_HUE = { 'pure white': '#ffffff', 'pure black': '#000000', 'mid grey': '#808080', 'not a colour': 'nonsense' }

let fail = 0, pairs = 0, minText = Infinity, minUi = Infinity
function check(label, hex) {
  const t = brandTheme(hex)
  if (!t) { console.error(`  FAIL ${label}: expected a theme, got null`); fail++; return }
  for (const [theme, l, on] of [['light', t.lLight, t.onLight], ['dark', t.lDark, t.onDark]]) {
    const bg = lum(hslToRgb(t.h, parseFloat(t.s) / 100, parseFloat(l) / 100))
    const text = ratio(hexLum(on), bg)
    const ui = ratio(bg, PAGE[theme])
    pairs++
    minText = Math.min(minText, text)
    minUi = Math.min(minUi, ui)
    if (text < 4.5) { fail++; console.error(`  FAIL ${label} ${theme}: text ${text.toFixed(2)}:1 with ${on}`) }
    if (ui < 3) { fail++; console.error(`  FAIL ${label} ${theme}: accent only ${ui.toFixed(2)}:1 against the page`) }
  }
}

for (const [label, hex] of Object.entries(NAMED)) check(label, hex)
for (let h = 0; h < 360; h += 5) {
  for (const s of [1, 0.55]) {
    const hex = '#' + hslToRgb(h, s, 0.5).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
    check(`hue ${h} @ s${s}`, hex)
  }
}
// No hue to borrow: these must decline rather than invent a colour.
for (const [label, hex] of Object.entries(NO_HUE)) {
  if (brandTheme(hex) !== null) { console.error(`  FAIL ${label}: expected null, got a theme`); fail++ }
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-brand-theme: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-brand-theme: ${pairs} accent/theme pairs readable for any card colour ` +
  `(worst text ${minText.toFixed(2)}:1 against 4.5, worst accent-on-page ${minUi.toFixed(2)}:1 against 3).`
)
