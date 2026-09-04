// The dashboard wears the colour of the card it is managing.
//
// Every accent surface in the dashboard already reads hsl(var(--accent)), so
// the whole product can take a customer's brand colour by setting that one
// variable on the shell. What it cannot do is set it to whatever hex the
// customer picked, because an accent is a background that text sits on, and a
// pale yellow with white text on it is unreadable no matter whose brand it is.
//
// So the brand supplies the HUE, which is what a person recognises as "our
// colour", and this module decides how light it is and what colour of text
// goes on it. Both are solved against WCAG rather than chosen by eye, for
// every theme, for any input, including the ones nobody should pick.
//
// Relative, not '@/': scripts compile these libraries on their own with tsc,
// where the path alias does not exist. Same reason as lib/team-locks.

/** Lightness the accent is pinned to per theme, before contrast solving. */
const BASE_LIGHTNESS = { light: 0.46, dark: 0.58 }

/** Text on an accent surface has to clear this. Normal-size text, so 4.5. */
const TARGET = 4.5

/** And the accent has to be visible AS a surface against the page it sits on.
 *  3:1, the WCAG bar for a non-text component.
 *
 *  Both at once, which is the whole difficulty. A deep blue can carry white
 *  text beautifully and still be invisible on a near-black page: solving the
 *  text in isolation drives the surface darker and darker until the button
 *  disappears into the background. Checked against the real page colours -
 *  keep these in step with --background in globals.css. */
const PAGE_LUMINANCE = { light: 0.9037, dark: 0.0043 }
const UI_TARGET = 3

/** Saturation band. The floor stops a near-grey brand producing a dashboard
 *  with no accent at all; the ceiling stops a neon one producing a toy. A
 *  genuinely greyscale brand is left alone - see hslFromHex. */
const SAT_MIN = 0.34
const SAT_MAX = 0.82

export interface BrandTheme {
  /** Hue in degrees, as a bare number for CSS to compose. */
  h: number
  /** Saturation as a percentage string, e.g. "72%". */
  s: string
  /** Lightness per theme, solved. */
  lLight: string
  lDark: string
  /** Text colour that sits on the accent, per theme. */
  onLight: string
  onDark: string
}

function hslFromHex(hex: string): { h: number; s: number; l: number } | null {
  const c = (hex || '').replace('#', '').trim()
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  if (d === 0) return null // greyscale: there is no hue to borrow
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return { h, s: d / (1 - Math.abs(2 * l - 1)), l }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const WHITE = luminance([255, 255, 255])
const NEAR_BLACK = luminance([10, 10, 10])

/**
 * The best text colour for an accent, and how much contrast it gets.
 *
 * Both are returned because the caller needs to know whether the winner is
 * actually good enough, not just which of the two is less bad.
 */
function bestTextOn(h: number, s: number, l: number): { hex: string; ratio: number } {
  const bg = luminance(hslToRgb(h, s, l))
  const white = contrast(WHITE, bg)
  const black = contrast(NEAR_BLACK, bg)
  return white >= black ? { hex: '#ffffff', ratio: white } : { hex: '#0a0a0a', ratio: black }
}

/**
 * Walk the lightness until the accent carries readable text AND is visible as
 * a surface on the page.
 *
 * Order matters, and it is a fidelity argument rather than a contrast one.
 * White text is preferred, because a dashboard where most buttons are
 * white-on-colour and a few are black-on-colour looks like two products. But
 * preferring it at any cost turns a bright yellow brand into an olive one:
 * white only clears 4.5 on yellow once the surface is dark enough to stop
 * being yellow. That is a worse answer than black text on a yellow that still
 * looks like theirs.
 *
 * So white wins while it can be had NEAR the intended weight; past that, black
 * on a faithful colour beats white on an unrecognisable one. The wide passes
 * exist only for hues where neither works close in.
 */
const NEAR = 0.18

function solveLightness(
  h: number, s: number, base: number, page: number,
): { l: number; text: string; ratio: number } {
  const at = (l: number) => luminance(hslToRgb(h, s, l))
  const visible = (l: number) => contrast(at(l), page) >= UI_TARGET

  // Candidate lightnesses, nearest the intended weight first, so the result
  // stays as close to the theme's chosen weight as the constraints allow.
  const candidates: number[] = [base]
  for (let step = 0.02; step <= 0.6; step += 0.02) {
    for (const l of [base - step, base + step]) {
      if (l >= 0.06 && l <= 0.96) candidates.push(l)
    }
  }

  const tryText = (text: string, lum: number, limit: number) => {
    for (const l of candidates) {
      if (Math.abs(l - base) > limit) continue
      if (visible(l) && contrast(lum, at(l)) >= TARGET) {
        return { l, text, ratio: contrast(lum, at(l)) }
      }
    }
    return null
  }

  return tryText('#ffffff', WHITE, NEAR)
    || tryText('#0a0a0a', NEAR_BLACK, NEAR)
    || tryText('#ffffff', WHITE, 1)
    || tryText('#0a0a0a', NEAR_BLACK, 1)
    // Unreachable for any hue, since a mid lightness always clears one of the
    // two. Returning the best text for the intended weight beats returning
    // nothing at all.
    || { l: base, text: bestTextOn(h, s, base).hex, ratio: bestTextOn(h, s, base).ratio }
}

/**
 * Turn a card's accent hex into the variables the dashboard shell sets.
 *
 * Returns null when there is nothing to borrow - an unparseable value, or a
 * greyscale brand, which has no hue and would produce a colour out of nowhere.
 * The caller then leaves the default palette alone.
 */
export function brandTheme(accentHex: string): BrandTheme | null {
  const hsl = hslFromHex(accentHex)
  if (!hsl) return null

  const s = Math.min(SAT_MAX, Math.max(SAT_MIN, hsl.s))
  const light = solveLightness(hsl.h, s, BASE_LIGHTNESS.light, PAGE_LUMINANCE.light)
  const dark = solveLightness(hsl.h, s, BASE_LIGHTNESS.dark, PAGE_LUMINANCE.dark)

  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
  return {
    h: Math.round(hsl.h * 10) / 10,
    s: pct(s),
    lLight: pct(light.l),
    lDark: pct(dark.l),
    onLight: light.text,
    onDark: dark.text,
  }
}

/** The inline style for the dashboard shell. Empty when there is nothing to
 *  apply, so the element simply carries no overrides. */
export function brandThemeStyle(accentHex: string | null | undefined): Record<string, string> {
  const t = accentHex ? brandTheme(accentHex) : null
  if (!t) return {}
  return {
    '--brand-h': String(t.h),
    '--brand-s': t.s,
    '--brand-l-light': t.lLight,
    '--brand-l-dark': t.lDark,
    '--brand-on-light': t.onLight,
    '--brand-on-dark': t.onDark,
  }
}
