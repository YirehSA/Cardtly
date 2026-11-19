// The reseller level badges: Andre's artwork (2026-11-19, "please use these
// badges"), kept in design/reseller-badges/<level>.webp and made into the
// served files by scripts/make-reseller-badges.mjs:
//
//   /badges/reseller-<level>.png       600 x 600, for the emails (mail
//                                       clients want PNG) and the download
//   /badges/reseller-<level>-256.webp  256 x 256, for the screens
//
// Both are square with a transparent background, the medal centred.
// check-reseller-levels fails the build if any is missing or not square.

import type { LevelKey } from './reseller-levels'

/** The PNG: emails and "Download your badge". */
export function badgePngPath(key: LevelKey): string {
  return `/badges/reseller-${key}.png`
}

/** The small WebP: everywhere a badge is shown on screen. */
export function badgeWebpPath(key: LevelKey): string {
  return `/badges/reseller-${key}-256.webp`
}
