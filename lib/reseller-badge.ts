// The reseller level badge (Andre, 2026-11-16: "create nice badges so they
// know their level"). One drawing, used three ways:
//   - inline on the Reseller page, the public listing and admin
//     (components/reseller/ResellerLevelCard, LevelBadge);
//   - as PNG files in public/badges, for the emails (mail clients drop SVG)
//     and for resellers to download and show on their own website. Made by
//     scripts/make-reseller-badges.mjs; check-reseller-levels fails the build
//     when the drawing changes and the PNGs were not made again.
//
// A medal: a notched metal rim, a polished ring with CARDTLY RESELLER around
// the top, a darker face with one star per level (Bronze one, Platinum four)
// over a digital card, and a ribbon with the level's name. Small sizes drop
// the lettering and the ribbon, which would only be noise.
//
// Pure: returns SVG markup. Relative import so the scripts can compile it.

import { levelByKey, type LevelKey } from './reseller-levels'

interface Metal {
  light: string; mid: string; dark: string
  faceLight: string; faceDark: string
  ribbonLight: string; ribbonDark: string
  ink: string
  stars: number
}

export const BADGE_METALS: Record<LevelKey, Metal> = {
  starter: {
    light: '#dff3ea', mid: '#8db8a5', dark: '#3d5e50',
    faceLight: '#5c8574', faceDark: '#22372e', ribbonLight: '#5c8574', ribbonDark: '#2c473b', ink: '#f4fffa', stars: 0,
  },
  bronze: {
    light: '#ffd9b5', mid: '#c47f45', dark: '#6e3a14',
    faceLight: '#9a5a2a', faceDark: '#45200a', ribbonLight: '#a85f2a', ribbonDark: '#5c2e0e', ink: '#fff1e4', stars: 1,
  },
  silver: {
    light: '#ffffff', mid: '#b8c0c8', dark: '#5f6873',
    faceLight: '#8b949e', faceDark: '#3a4149', ribbonLight: '#8a949f', ribbonDark: '#454d56', ink: '#ffffff', stars: 2,
  },
  gold: {
    light: '#fff3b8', mid: '#e0ad1f', dark: '#7c5800',
    faceLight: '#b88a0c', faceDark: '#553b00', ribbonLight: '#c99410', ribbonDark: '#6a4900', ink: '#fffbea', stars: 3,
  },
  platinum: {
    light: '#f2fcff', mid: '#a9dcef', dark: '#3b7891',
    faceLight: '#5aa3bf', faceDark: '#1c4a5d', ribbonLight: '#4f9bb8', ribbonDark: '#1f5266', ink: '#ffffff', stars: 4,
  },
}

const C = 120 // the centre of the 240 by 240 drawing
const r2 = (n: number) => Math.round(n * 100) / 100

function rosette(points: number, outer: number, inner: number): string {
  const out: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    out.push(`${r2(C + r * Math.cos(a))},${r2(C + r * Math.sin(a))}`)
  }
  return out.join(' ')
}

function star(cx: number, cy: number, outer: number, inner: number): string {
  const out: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    out.push(`${r2(cx + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}`)
  }
  return out.join(' ')
}

function stars(n: number, cy: number, size: number, gap: number, m: Metal): string {
  if (!n) return ''
  const start = C - ((n - 1) * gap) / 2
  return Array.from({ length: n }, (_, i) =>
    `<polygon points="${star(start + i * gap, cy, size, size * 0.45)}" fill="${m.ink}" stroke="${m.dark}" stroke-width="0.8" stroke-linejoin="round"/>`).join('')
}

/** A digital card with the contactless waves on it. */
function cardGlyph(cx: number, cy: number, scale: number, m: Metal): string {
  const w = 52 * scale, h = 34 * scale
  const x = cx - w / 2, y = cy - h / 2
  const wave = (r: number) => {
    const a = Math.PI / 4
    const ox = cx + 6 * scale
    return `<path d="M${r2(ox + r * Math.cos(-a))},${r2(cy + r * Math.sin(-a))} A${r2(r)},${r2(r)} 0 0 1 ${r2(ox + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}" fill="none" stroke="${m.ink}" stroke-width="${r2(3 * scale)}" stroke-linecap="round"/>`
  }
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(6 * scale)}" fill="none" stroke="${m.ink}" stroke-width="${r2(3.5 * scale)}"/>`
    + `<rect x="${r2(x + 7 * scale)}" y="${r2(cy - 5 * scale)}" width="${r2(9 * scale)}" height="${r2(10 * scale)}" rx="${r2(2 * scale)}" fill="${m.ink}" opacity="0.85"/>`
    + wave(5 * scale) + wave(10 * scale) + wave(15 * scale)
}

// Rough widths of bold capitals, in ems. Close enough to space letters evenly.
const EM: Record<string, number> = { ' ': 0.34, A: 0.74, C: 0.72, D: 0.76, E: 0.62, L: 0.58, R: 0.7, S: 0.66, T: 0.64, Y: 0.68 }

/**
 * Text around the top of the ring, centred, one letter at a time. Not a
 * textPath: the renderer that makes the PNGs (librsvg) does not draw those,
 * and this looks the same in browsers and in the PNGs.
 */
function arcLetters(text: string, radius: number, size: number, spacing: number): string {
  const widths = [...text].map(ch => (EM[ch] ?? 0.7) * size + spacing)
  const total = widths.reduce((a, b) => a + b, 0) - spacing
  let at = -total / 2
  return [...text].map((ch, i) => {
    const mid = at + (widths[i] - spacing) / 2
    at += widths[i]
    if (ch === ' ') return ''
    const a = mid / radius - Math.PI / 2
    const x = r2(C + radius * Math.cos(a)), y = r2(C + radius * Math.sin(a))
    return `<text x="${x}" y="${y}" text-anchor="middle" transform="rotate(${r2((a * 180) / Math.PI + 90)} ${x} ${y})">${ch}</text>`
  }).join('')
}

export interface BadgeOptions {
  /** Makes the gradient ids unique when several badges share a page. */
  id?: string
  /** No lettering and no ribbon: for anything shown smaller than 64px. */
  compact?: boolean
}

/** The badge as SVG markup, 240 by 240, transparent around the medal. */
export function badgeSvg(key: LevelKey, opts: BadgeOptions = {}): string {
  const m = BADGE_METALS[key] || BADGE_METALS.starter
  const s = String(opts.id || key).replace(/[^a-zA-Z0-9_-]/g, '')
  const name = levelByKey(key).name.toUpperCase()
  const compact = !!opts.compact
  const font = `font-family="'Plus Jakarta Sans','Segoe UI',Arial,sans-serif" font-weight="800"`

  const defs = `<defs>
<linearGradient id="m${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.light}"/><stop offset="0.45" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.dark}"/></linearGradient>
<linearGradient id="e${s}" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${m.light}"/><stop offset="0.5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.dark}"/></linearGradient>
<radialGradient id="f${s}" cx="0.4" cy="0.32" r="0.8"><stop offset="0" stop-color="${m.faceLight}"/><stop offset="1" stop-color="${m.faceDark}"/></radialGradient>
<linearGradient id="b${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.ribbonLight}"/><stop offset="1" stop-color="${m.ribbonDark}"/></linearGradient>
<linearGradient id="g${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<clipPath id="k${s}"><circle cx="${C}" cy="${C}" r="92"/></clipPath>
</defs>`

  const medal = `<polygon points="${rosette(36, 112, 103)}" fill="url(#e${s})" stroke="${m.dark}" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${C}" cy="${C}" r="92" fill="url(#m${s})" stroke="${m.dark}" stroke-width="2"/>`
    + `<circle cx="${C}" cy="${C}" r="72" fill="url(#f${s})" stroke="${m.dark}" stroke-width="2"/>`
    + `<circle cx="${C}" cy="${C}" r="69" fill="none" stroke="${m.light}" stroke-opacity="0.45" stroke-width="1.2"/>`

  const gloss = `<g clip-path="url(#k${s})"><ellipse cx="92" cy="70" rx="86" ry="44" transform="rotate(-28 92 70)" fill="url(#g${s})"/></g>`

  if (compact) {
    // Stars big enough to count at a glance; Starter, with none, shows the card.
    const face = m.stars
      ? stars(m.stars, C, m.stars > 2 ? 15 : 20, m.stars > 2 ? 30 : 40, m)
      : cardGlyph(C, C, 1.2, m)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" aria-hidden="true">${defs}${medal}${face}${gloss}</svg>`
  }

  const lettering = `<g ${font} font-size="12.5" fill="${m.dark}" opacity="0.85">${arcLetters('CARDTLY RESELLER', 77, 12.5, 3.2)}</g>`
  const face = stars(m.stars, 81, 11.5, 27, m) + cardGlyph(C, m.stars ? 118 : 108, 0.95, m)
  const ribbon = `<path d="M30,152 L8,152 L19,166 L8,180 L30,180 Z" fill="${m.ribbonDark}"/>`
    + `<path d="M210,152 L232,152 L221,166 L232,180 L210,180 Z" fill="${m.ribbonDark}"/>`
    + `<path d="M30,180 L30,186 L40,180 Z M210,180 L210,186 L200,180 Z" fill="${m.dark}"/>`
    + `<rect x="30" y="146" width="180" height="34" rx="3" fill="url(#b${s})" stroke="${m.dark}" stroke-width="1.2"/>`
    + `<text x="${C}" y="170" text-anchor="middle" ${font} font-size="19" letter-spacing="4" fill="#ffffff">${name}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" aria-hidden="true">${defs}${medal}${lettering}${face}${gloss}${ribbon}</svg>`
}

/** Where the PNG of a badge is served from (public/badges). */
export function badgePngPath(key: LevelKey): string {
  return `/badges/reseller-${key}.png`
}
