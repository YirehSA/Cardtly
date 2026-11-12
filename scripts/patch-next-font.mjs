// Keep Google Fonts from failing the build at random.
//
// Since November 2026 Google Fonts sometimes answers with a font file address
// that has no file extension (reported at about 1 in 60 responses). next/font
// in Next 15 reads the extension with a regex and uses the match without
// checking it, so one such address fails the whole build with
//   TypeError: Cannot read properties of null (reading '1')
//   at .../@next/font/dist/google/loader.js
// lib/card-fonts.ts asks for twenty families, so a build makes hundreds of
// these requests and failed twice in a row on Vercel (2026-11-12) with no code
// change behind it. Upstream: vercel/next.js#99114, fixed in Next 16.4.3.
//
// Until Next is upgraded, this rewrites that one line so an address without an
// extension is taken as woff2, which is what Google serves to the browser
// next/font identifies as (Chrome 104). The same fix several projects use.
//
// Runs on postinstall and first in prebuild, so Vercel's build has it whether
// or not node_modules came from its cache. Safe to run any number of times.
// Delete this file, and its two package.json entries, after upgrading to a
// Next version with the fix.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// A path argument patches a copy instead, for testing the patch itself.
const FILE = process.argv[2] || 'node_modules/next/dist/compiled/@next/font/dist/google/loader.js'
const MARK = '/* cardtly: extensionless Google Fonts address -> woff2 */'
const ORIGINAL = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];'
const PATCHED = `const ext = (/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl) || [null, 'woff2'])[1]; ${MARK}`

if (!existsSync(FILE)) {
  console.log('patch-next-font: next/font loader not found, nothing to patch')
  process.exit(0)
}

const src = readFileSync(FILE, 'utf8')
if (src.includes(MARK)) {
  console.log('patch-next-font: already patched')
  process.exit(0)
}
if (!src.includes(ORIGINAL)) {
  // A Next version with a different loader. Most likely one with the fix, but
  // say so loudly rather than assume it.
  console.warn('patch-next-font: the line to patch was not found. If builds fail with "Cannot read properties of null (reading \'1\')" in next/font, check this script against the installed Next version.')
  process.exit(0)
}

writeFileSync(FILE, src.replace(ORIGINAL, PATCHED))
try {
  execFileSync(process.execPath, ['--check', FILE], { stdio: 'pipe' })
} catch (e) {
  // Never leave a broken loader behind.
  writeFileSync(FILE, src)
  console.error('patch-next-font: the patched loader did not parse, restored the original')
  console.error(String(e.stderr || e.message).slice(0, 400))
  process.exit(1)
}
console.log('patch-next-font: extensionless Google Fonts addresses now default to woff2')
