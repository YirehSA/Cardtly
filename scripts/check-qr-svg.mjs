// The QR page's vector download and print card open.
//
// WHAT THIS PROTECTS (2026-10-15): both exports nested the qrcode library's
// <svg> and added a width and height it already had. Inside a web page a
// browser ignores that; a downloaded .svg is strict XML, and duplicate
// attributes made the file fail to open at all.
//
//   1. lib/qr-svg's placeQrSvg, RUN on a real QR from the qrcode package and
//      wrapped the way QRPage wraps it, gives well-formed XML for both the
//      vector download and the print card, logo included.
//   2. QRPage nests the QR through placeQrSvg in both places, and writes the
//      logo reference through svgImageHref.
//
// Run: node scripts/check-qr-svg.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const out = mkdtempSync(join(tmpdir(), 'qr-svg-'))
let L
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/qr-svg.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  L = await import(pathToFileURL(join(out, 'qr-svg.mjs')).href)
} catch (e) {
  console.error('check-qr-svg: could not compile lib/qr-svg.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// Strict well-formedness. saxes when it is installed (it reports duplicate
// attributes, unclosed tags and bad entities); otherwise the duplicate-
// attribute rule on its own, which is the one that broke.
function xmlProblems(xml) {
  const problems = []
  for (const m of xml.matchAll(/<([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*\/?>/g)) {
    // Whole name="value" pairs: a base64 logo ends in "=", which is not a name.
    const names = [...m[2].matchAll(/([\w:-]+)\s*=\s*"[^"]*"/g)].map(a => a[1])
    const dup = names.find((n, i) => names.indexOf(n) !== i)
    if (dup) problems.push(`<${m[1]}> has "${dup}" twice`)
  }
  try {
    const { SaxesParser } = require('saxes')
    const p = new SaxesParser({ xmlns: true })
    p.on('error', e => { problems.push(e.message) })
    p.write(xml).close()
  } catch (e) {
    if (e?.code !== 'MODULE_NOT_FOUND') problems.push(String(e.message || e))
  }
  return problems
}

const QRCode = require('qrcode')
const MARK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const qr = (px) => QRCode.toString('https://cardtly.com/card/check-qr-svg', {
  type: 'svg', width: px, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0f172a', light: '#ffffff' },
})
const logo = `<rect x="1" y="1" width="10" height="10" rx="2" fill="#ffffff"/><image ${L.svgImageHref(MARK)} x="1" y="1" width="10" height="10" preserveAspectRatio="xMidYMid meet"/>`

// ── 1. Both files are well-formed ───────────────────────────────────────────
{
  const px = 800
  const inner = L.placeQrSvg(await qr(px), 0, 0, px)
  const file = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">${inner}${logo}</svg>`
  for (const p of xmlProblems(file)) bad(`vector download: ${p}`)
  const open = inner.match(/<svg\b[^>]*>/)?.[0] || ''
  if (!/ x="0" y="0" width="800" height="800"/.test(open)) bad(`vector download: the nested QR is not placed at 0,0 at 800px: ${open}`)
  if (!/viewBox="0 0 \d+ \d+"/.test(open)) bad('vector download: the nested QR lost its viewBox, so it would not scale')
}
{
  const px = 400
  const inner = L.placeQrSvg(await qr(px), 50, 40, px)
  const file = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" height="580" viewBox="0 0 500 580">
  <rect width="500" height="580" rx="20" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  ${inner}
  <g transform="translate(50,40)">${logo}</g>
  <text x="250" y="508" text-anchor="middle">Name</text>
</svg>`
  for (const p of xmlProblems(file)) bad(`print card: ${p}`)
  const open = inner.match(/<svg\b[^>]*>/)?.[0] || ''
  if (!/ x="50" y="40" width="400" height="400"/.test(open)) bad(`print card: the QR is not placed at 50,40 at 400px: ${open}`)
}
// And the rule itself still bites: the old way of nesting must fail here.
{
  const old = (await qr(800)).replace('<svg ', '<svg x="0" y="0" width="800" height="800" ')
  if (xmlProblems(`<svg xmlns="http://www.w3.org/2000/svg">${old}</svg>`).length === 0) bad('the XML check no longer catches a doubled width: it would pass the bug it was written for')
}

// ── 2. QRPage uses them ─────────────────────────────────────────────────────
const page = readFileSync('components/card/QRPage.tsx', 'utf8').replace(/\r/g, '')
if (/\.replace\('<svg '/.test(page)) bad("QRPage still nests the QR with .replace('<svg ', ...), which doubles its size attributes")
if ((page.match(/placeQrSvg\(svg, /g) || []).length !== 2) bad('QRPage must nest the QR through placeQrSvg in both the vector download and the print card')
if (/<image href=/.test(page)) bad('QRPage writes a logo <image> without svgImageHref, so print software that reads only xlink:href shows no logo')

if (fail) {
  console.error(`check-qr-svg: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-qr-svg: ok (vector download and print card are well-formed XML from a real QR, logo included; the old doubled width is still caught)')
