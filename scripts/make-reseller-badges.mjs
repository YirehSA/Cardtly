// Makes public/badges/reseller-<level>.png from the drawing in
// lib/reseller-badge.ts, for the emails (mail clients drop SVG) and for
// resellers to download. Run it after changing the drawing, and commit the
// PNGs with public/badges/manifest.json: check-reseller-levels compares the
// manifest with the drawing and fails the build if they no longer match.
//
// Run: node scripts/make-reseller-badges.mjs

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const SIZE = 512
const out = mkdtempSync(join(tmpdir(), 'reseller-badges-'))
let B, L
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-badge.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  B = await import(pathToFileURL(join(out, 'reseller-badge.mjs')).href)
  L = await import(pathToFileURL(join(out, 'reseller-levels.mjs')).href)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

mkdirSync('public/badges', { recursive: true })
const manifest = {}
for (const level of L.RESELLER_LEVELS) {
  const svg = B.badgeSvg(level.key)
  manifest[level.key] = createHash('sha256').update(svg).digest('hex').slice(0, 16)
  await sharp(Buffer.from(svg), { density: Math.ceil((72 * SIZE) / 240) })
    .resize(SIZE, SIZE)
    .png({ compressionLevel: 9 })
    .toFile(join('public', B.badgePngPath(level.key)))
  console.log(`made public${B.badgePngPath(level.key)}`)
}
writeFileSync('public/badges/manifest.json', JSON.stringify(manifest, null, 2) + '\n')
console.log('wrote public/badges/manifest.json')
