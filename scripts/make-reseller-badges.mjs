// Makes the reseller level badges in public/badges from Andre's artwork in
// design/reseller-badges/<level>.webp (2026-11-19: "please use these
// badges"). For each level:
//   public/badges/reseller-<level>.png       600 x 600, for the emails (mail
//                                             clients want PNG) and for
//                                             resellers to download
//   public/badges/reseller-<level>-256.webp  256 x 256, for the screens
// The artwork is cropped to the medal and centred on a square, transparent
// canvas. Run it after replacing any artwork, and commit public/badges:
// check-reseller-levels fails the build if a file is missing or not square.
//
// Run: node scripts/make-reseller-badges.mjs

import { mkdirSync, existsSync } from 'node:fs'
import sharp from 'sharp'

const LEVELS = ['starter', 'bronze', 'silver', 'gold', 'platinum']
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

mkdirSync('public/badges', { recursive: true })
for (const level of LEVELS) {
  const src = `design/reseller-badges/${level}.webp`
  if (!existsSync(src)) { console.error(`missing ${src}`); process.exit(1) }

  // Cropped to the medal, then padded to a square so every badge sits the
  // same way in a square box.
  const trimmed = await sharp(src).ensureAlpha().trim({ background: CLEAR, threshold: 1 }).png().toBuffer({ resolveWithObject: true })
  const side = Math.max(trimmed.info.width, trimmed.info.height)
  const square = await sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2), bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2), right: Math.ceil((side - trimmed.info.width) / 2),
      background: CLEAR,
    })
    .png().toBuffer()

  await sharp(square).resize(600, 600, { fit: 'contain', background: CLEAR }).png({ palette: true, quality: 95, colours: 256, dither: 1, compressionLevel: 9, effort: 10 })
    .toFile(`public/badges/reseller-${level}.png`)
  await sharp(square).resize(256, 256, { fit: 'contain', background: CLEAR }).webp({ quality: 88, alphaQuality: 100 })
    .toFile(`public/badges/reseller-${level}-256.webp`)
  console.log(`made public/badges/reseller-${level}.png and -256.webp (medal ${trimmed.info.width} x ${trimmed.info.height})`)
}
