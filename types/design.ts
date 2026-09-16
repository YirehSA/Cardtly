// What a person can actually create through the editor, which is not the same
// as what the database can hold. cards has link_1..link_20 columns and
// extractLinks will render all twenty, but the editor only offers these - so
// "up to 14 custom links" was true of the schema and false of the product, and
// it sat on three marketing pages. Copy is checked against these by
// scripts/check-facts.mjs.
//
// Raised from 5 and 6 in migration 060, which added the columns team_cards was
// missing. Every list of slots in the app counts off these two numbers rather
// than writing [1,2,3,4,5] out again, because the ones that did were how the
// team editor ended up offering five links while the schema held twenty.
export const MAX_CUSTOM_LINKS = 10
export const MAX_GALLERY_IMAGES = 10

// Written out and `as const` rather than counted with Array.from, because the
// literal tuple is what lets TypeScript know `link_7_url` is a real field name.
// Generated slots typed as plain strings would have every form and preview
// silently accept a key that does not exist.
//
// scripts/check-facts.mjs reads the two numbers above by regex, and the pair
// below is checked against them at module load, so the two cannot drift.
export const LINK_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export const IMAGE_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export type LinkSlot = typeof LINK_SLOTS[number]
export type ImageSlot = typeof IMAGE_SLOTS[number]

// Every social account a card can carry, named once, with the column it lives
// in. Written out `as const` for the same reason the slot tuples above are:
// the literal keeps `youtube` a real field name rather than a hopeful string.
//
// WHY THIS LIST EXISTS AT ALL. Three places in PublicCardView built their own
// version of it - the shared socialLinks row, Minimal, and Studio - and two of
// them quietly stopped short. YouTube and TikTok render on neither Minimal nor
// Studio, and Instagram renders on neither Minimal; a customer on those
// designs fills the field in, watches it save, and it never appears. That is
// the same failure the comment above IMAGE_SLOTS describes about link slots 7
// to 10, one collection later, which is the argument for counting off a single
// declaration instead of retyping the list per template.
//
// The order is the order they render in.
export const SOCIAL_SLOTS = [
  { key: 'linkedin',  column: 'linkedin_url',  label: 'LinkedIn' },
  { key: 'twitter',   column: 'twitter_url',   label: 'Twitter / X' },
  { key: 'instagram', column: 'instagram_url', label: 'Instagram' },
  { key: 'facebook',  column: 'facebook_url',  label: 'Facebook' },
  { key: 'youtube',   column: 'youtube',       label: 'YouTube' },
  { key: 'tiktok',    column: 'tiktok',        label: 'TikTok' },
  { key: 'whatsapp',  column: 'whatsapp',      label: 'WhatsApp' },
] as const

export type SocialKey = typeof SOCIAL_SLOTS[number]['key']
export const SOCIAL_KEYS: readonly SocialKey[] = SOCIAL_SLOTS.map(s => s.key)

if (LINK_SLOTS.length !== MAX_CUSTOM_LINKS || IMAGE_SLOTS.length !== MAX_GALLERY_IMAGES) {
  throw new Error('types/design: LINK_SLOTS / IMAGE_SLOTS do not match the MAX_ constants')
}

/** Every link column, exactly, so a form holding these satisfies a preview. */
export type LinkFields = { [K in LinkSlot as `link_${K}_title` | `link_${K}_url`]: string }
export type ImageFields = { [K in ImageSlot as `image_${K}_url` | `image_${K}_link`]: string }

export function linkFieldsFrom(card: any): LinkFields {
  return Object.fromEntries(LINK_SLOTS.flatMap(i => [
    [`link_${i}_title`, card?.[`link_${i}_title`] || ''],
    [`link_${i}_url`, card?.[`link_${i}_url`] || ''],
  ])) as LinkFields
}

export function imageFieldsFrom(card: any): ImageFields {
  return Object.fromEntries(IMAGE_SLOTS.flatMap(i => [
    [`image_${i}_url`, card?.[`image_${i}_url`] || ''],
    [`image_${i}_link`, card?.[`image_${i}_link`] || ''],
  ])) as ImageFields
}

export type TemplateId = 'classic' | 'modern' | 'bold' | 'minimal' | 'executive' | 'creative' | 'wave' | 'split' | 'splitpro' | 'circuit' | 'meridian' | 'neon' | 'studio' | 'frost' | 'editorial'
export type FontId = 'sans' | 'serif' | 'modern' | 'rounded' | 'mono'
export type AccentColor = 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'pink' | 'teal' | 'gold' | 'custom'
export type LogoPosition = 'left' | 'center' | 'right' | 'hidden'
export type CardStyle = 'flat' | 'glass' | 'gradient'
export type BgMode = 'dark' | 'light'

// Templates that support text position nudging.
//
// Executive was on this list and does not read textNudge, so the nudge
// controls appeared on it and did nothing. Checked against the source by
// scripts/check-template-controls.mjs.
export const TEXT_POSITION_TEMPLATES: TemplateId[] = ['bold', 'wave', 'modern', 'neon']

// Which design controls each template actually honours.
//
// Not every template reads every setting - most hardcode their own surfaces,
// and only some size the photograph - so a customer could drag a slider on a
// template that ignores it and watch nothing happen. The panel greys those out
// and says why, which it can only do from a list like this.
//
// Generated from the template source, not written by hand:
//   node scripts/check-template-controls.mjs --print
// and checked against it, so a template that stops reading a setting cannot
// leave the panel promising it.
export const TEMPLATE_CONTROLS: Record<TemplateId, string[]> = {
  classic: ['profileBorder', 'logo', 'cardStyle', 'solidBackground', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  modern: ['logo', 'nameType', 'titleType', 'companyType', 'bioType', 'textPosition'],
  bold: ['photoSize', 'profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'textPosition'],
  minimal: ['profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  executive: ['photoZoom', 'logo', 'nameType', 'titleType', 'companyType', 'bioType'],
  creative: ['photoSize', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  wave: ['logo', 'solidBackground', 'nameType', 'titleType', 'companyType', 'bioType', 'textPosition'],
  split: ['photoSize', 'profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType'],
  splitpro: ['photoSize', 'profileBorder', 'logo', 'cardStyle', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  circuit: ['photoSize', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  meridian: ['photoSize', 'photoZoom', 'logo', 'cardStyle', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  neon: ['photoSize', 'profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'textPosition'],
  studio: ['photoSize', 'profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType'],
  frost: ['photoSize', 'logo', 'nameType', 'titleType', 'companyType', 'bioType', 'bodySize'],
  editorial: ['profileBorder', 'logo', 'nameType', 'titleType', 'companyType', 'bioType'],
}

/** Does this template read this setting at all? */
export function supportsControl(templateId: TemplateId, control: string): boolean {
  return (TEMPLATE_CONTROLS[templateId] || []).includes(control)
}

export interface CardDesign {
  templateId: TemplateId
  accentColor: AccentColor
  customAccentColor?: string   // hex string when accentColor === 'custom'
  bgMode: BgMode
  fontId: FontId
  logoPosition: LogoPosition
  cardStyle: CardStyle
  profilePhotoSize: number
  logoSize: number
  // Text position nudge — applies to bold, executive, wave, modern, neon
  textX: number       // -40 to +40 px horizontal
  textY: number       // -40 to +40 px vertical
  // Bold hero image controls
  boldImageZoom: number
  boldImagePosition: 'top' | 'center' | 'bottom'
  // Save Contact button overrides (optional, blank = auto)
  buttonBgColor?: string
  buttonTextColor?: string
  buttonBorderColor?: string
  // Hero/background fill style. When true, the hero band uses a solid
  // colour (page bg) instead of the accent-tinted gradient. Currently
  // only the Classic template reads this field.
  solidBackground?: boolean
  // Custom card background colour (hex). When set, overrides the
  // template's default page background. Applies to every template
  // since they all read bg.page from getBgColors.
  customBgColor?: string
  // Typography overrides. All optional - blank means "use the
  // template's default". Applied via helper functions below so
  // every template reads from the same source.
  // Typography overrides - each element (name, title, company, bio)
  // gets its own size (80-160 percent) and colour. Size is rendered
  // in the panel as -/+ buttons; colour as a swatch + native input.
  nameSize?: number          // 80-160 percentage of the template's default name font size
  nameColor?: string         // hex - overrides the name colour (defaults to template text)
  titleSize?: number         // 80-160 percentage
  titleColor?: string        // hex - overrides the title colour (defaults to accent)
  companySize?: number       // 80-160 percentage
  companyColor?: string      // hex - overrides the company colour (defaults to muted)
  bioSize?: number           // 80-160 percentage
  bioColor?: string          // hex - overrides the bio paragraph colour
  bodySize?: 'small' | 'medium' | 'large'  // contact row + custom link text size (separate)
  buttonTextSize?: 'small' | 'medium' | 'large'  // Save Contact button text size
  profileBorder?: boolean    // toggle the photo's border ring on/off (default: true)
}

export const DEFAULT_DESIGN: CardDesign = {
  templateId: 'classic',
  accentColor: 'blue',
  customAccentColor: undefined,
  bgMode: 'dark',
  fontId: 'sans',
  logoPosition: 'center',
  cardStyle: 'flat',
  profilePhotoSize: 100,
  logoSize: 100,
  textX: 0,
  textY: 0,
  boldImageZoom: 100,
  boldImagePosition: 'center',
  buttonBgColor: undefined,
  buttonTextColor: undefined,
  buttonBorderColor: undefined,
  solidBackground: false,
  customBgColor: undefined,
  nameSize: 100,
  nameColor: undefined,
  titleSize: 100,
  titleColor: undefined,
  companySize: 100,
  companyColor: undefined,
  bioSize: 100,
  bioColor: undefined,
  bodySize: 'medium',
  buttonTextSize: 'medium',
  profileBorder: true,
}

export const ACCENT_COLORS: Record<Exclude<AccentColor, 'custom'>, { label: string; hex: string }> = {
  blue:   { label: 'Blue',   hex: '#3b82f6' },
  purple: { label: 'Purple', hex: '#8b5cf6' },
  green:  { label: 'Green',  hex: '#22c55e' },
  red:    { label: 'Red',    hex: '#ef4444' },
  orange: { label: 'Orange', hex: '#f97316' },
  pink:   { label: 'Pink',   hex: '#ec4899' },
  teal:   { label: 'Teal',   hex: '#14b8a6' },
  gold:   { label: 'Gold',   hex: '#f59e0b' },
}

// Get the resolved accent hex from a design (handles custom colour)
export function getAccentHex(design: CardDesign): string {
  if (design.accentColor === 'custom' && design.customAccentColor) {
    return design.customAccentColor
  }
  return ACCENT_COLORS[design.accentColor as Exclude<AccentColor, 'custom'>]?.hex ?? '#3b82f6'
}

// Return black or white depending on which has better contrast against the given hex.
// Uses the WCAG relative luminance formula.
export function getReadableTextOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 3 && h.length !== 6) return '#ffffff'
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const toLin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  return L > 0.55 ? '#0a0a0a' : '#ffffff'
}

/**
 * The accent, adjusted until it is READABLE AS TEXT on the grounds given.
 *
 * THE PROBLEM THIS SOLVES. The accent is whatever hex a customer typed into a
 * colour picker, and the card uses it for a job title, a speciality chip and a
 * button label as well as for fills and icons. As a fill it only has to be
 * visible, 3:1, which lib/brand-theme already guarantees. As TEXT it has to
 * clear 4.5:1, and on real cards it does not: David Botha's olive #57602e sits
 * at 2.9:1 on his card and Damien's blue #2a6bca at 3.57:1 on his.
 *
 * WHY NOT JUST CHANGE THE ACCENT. Because it is their brand, and it is correct
 * everywhere else. A chip filled with their olive, an icon drawn in it and a
 * button painted with it are all fine and all recognisably theirs. Only the
 * small text is wrong, so only the small text changes.
 *
 * WHAT IT DOES. Holds hue and saturation, walks lightness away from the
 * original in the smallest steps that clear the target against EVERY ground
 * passed in, and returns the first that does. Nearest-first, so a colour that
 * already passes is returned untouched and one that nearly passes barely
 * moves. A greyscale or unparseable accent is returned as-is: there is no hue
 * to preserve and inventing one would be worse than leaving it.
 *
 * Grounds are composited onto the first one, so a translucent chip tint over a
 * card reads as the colour the eye actually sees rather than as its own alpha.
 */
export function readableAccentOn(accent: string, grounds: string[], target = 4.5): string {
  const rgb = (c: string): { r: number; g: number; b: number; a: number } | null => {
    const s = c.trim()
    if (s.startsWith('#')) {
      let h = s.slice(1)
      if (h.length === 3) h = h.split('').map(x => x + x).join('')
      if (h.length !== 6) return null
      const n = parseInt(h, 16)
      if (Number.isNaN(n)) return null
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
    }
    const m = s.match(/[\d.]+/g)
    if (!m || m.length < 3) return null
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }
  }
  const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const lum = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const over = (f: { r: number; g: number; b: number; a: number }, b: { r: number; g: number; b: number }) =>
    ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) })
  const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
    const x = lum(a), y = lum(b); const hi = Math.max(x, y), lo = Math.min(x, y)
    return (hi + 0.05) / (lo + 0.05)
  }

  const src = rgb(accent)
  if (!src) return accent

  // Composite each ground onto the first solid one it can find.
  const parsed = grounds.map(rgb).filter(Boolean) as { r: number; g: number; b: number; a: number }[]
  if (!parsed.length) return accent
  const base = parsed.find(g => g.a === 1) || parsed[0]
  const solids = parsed.map(g => (g.a === 1 ? g : over(g, base)))

  const passes = (c: { r: number; g: number; b: number }) => solids.every(g => ratio(c, g) >= target)
  if (passes(src)) return accent

  // HSL, so hue and saturation survive.
  const r = src.r / 255, g = src.g / 255, b = src.b / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2
  let h = 0, s = 0
  if (mx !== mn) {
    const d = mx - mn
    s = l0 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  if (s === 0) return accent // greyscale: no hue to keep, leave it alone

  const toRgb = (L: number) => {
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q
    const f = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 }
  }
  const hex = (c: { r: number; g: number; b: number }) =>
    '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

  // Nearest-first in both directions, so the result stays as close to their
  // colour as the contrast allows.
  for (let step = 1; step <= 200; step++) {
    for (const L of [l0 + step * 0.005, l0 - step * 0.005]) {
      if (L < 0 || L > 1) continue
      const cand = toRgb(L)
      if (passes(cand)) return hex(cand)
    }
  }
  return accent // no lightness works; leave their colour rather than invent one
}

// Circuit draws in two tones: the accent, and a companion rotated round the
// wheel from it. Gold and cyan on the reference card; whatever the user picked
// and its opposite number in practice, so the pairing follows their brand
// instead of hardcoding somebody else's.
//
// 150 degrees rather than a straight 180: a true complement of a warm gold
// lands on a cold blue that fights it, where a third of a turn keeps the two
// related. Saturation gets a floor and lightness a lift, so the companion
// reads as a highlight on a dark ground even when the accent is muted or
// nearly black. A greyscale accent stays greyscale - rotating the hue of
// something with no hue produces a colour out of nowhere.
export function companionHex(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 3 && h.length !== 6) return hex
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  if (d === 0) return hex
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue = (hue * 60 + 360) % 360
  const s = d / (1 - Math.abs(2 * l - 1))

  const hue2 = (hue + 150) % 360
  const s2 = Math.min(1, Math.max(0.45, s))
  const l2 = Math.min(0.72, Math.max(0.55, l + 0.12))

  const c = (1 - Math.abs(2 * l2 - 1)) * s2
  const x = c * (1 - Math.abs(((hue2 / 60) % 2) - 1))
  const m = l2 - c / 2
  const [rr, gg, bb] =
    hue2 < 60 ? [c, x, 0] : hue2 < 120 ? [x, c, 0] : hue2 < 180 ? [0, c, x] :
    hue2 < 240 ? [0, x, c] : hue2 < 300 ? [x, 0, c] : [c, 0, x]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}

// Is this colour light enough that we should be layering dark things on it?
// Shares the threshold with getReadableTextOn so the surface tints and the
// text colour can never disagree about which way round the card is.
// Non-hex values (gradients, rgba) are treated as dark, which is what every
// template that uses them actually is.
export function isLightBg(color: string | undefined): boolean {
  if (!color) return false
  return getReadableTextOn(color) === '#0a0a0a'
}

// Resolve the Save Contact button background. Falls back to accent if not set.
export function getButtonBg(design: CardDesign): string {
  if (design.buttonBgColor) return design.buttonBgColor
  return getAccentHex(design)
}

// Resolve the button text colour. Falls back to readable text on the resolved background.
export function getButtonText(design: CardDesign): string {
  if (design.buttonTextColor) return design.buttonTextColor
  return getReadableTextOn(getButtonBg(design))
}

// Resolve the button border colour. Returns null if not set (no border).
export function getButtonBorder(design: CardDesign): string | null {
  return design.buttonBorderColor || null
}

export const FONTS: Record<FontId, { label: string; heading: string; body: string; sample: string }> = {
  sans:    { label: 'Clean',    heading: 'Inter, system-ui, sans-serif',      body: 'Inter, system-ui, sans-serif',      sample: 'Aa' },
  serif:   { label: 'Classic',  heading: 'Georgia, "Times New Roman", serif', body: 'Georgia, serif',                    sample: 'Aa' },
  modern:  { label: 'Modern',   heading: '"DM Sans", system-ui, sans-serif',  body: '"DM Sans", system-ui, sans-serif',  sample: 'Aa' },
  rounded: { label: 'Friendly', heading: '"Nunito", system-ui, sans-serif',   body: '"Nunito", system-ui, sans-serif',   sample: 'Aa' },
  mono:    { label: 'Tech',     heading: '"Fira Code", monospace',            body: '"Fira Code", monospace',            sample: 'Aa' },
}

export interface TemplateConfig {
  id: TemplateId
  name: string
  description: string
  proOnly: boolean
  defaultBgMode: BgMode
  previewGradient: string
}

/**
 * Templates that do NOT render the shared booking button.
 *
 * Circuit draws its own booking control instead of the shared one, so
 * BottomSection is given omitBooking and everything downstream of it - the
 * card's own booking button AND a Context CTA of kind "booking" - correctly
 * renders nothing.
 *
 * Named here because the DASHBOARD needs to know it too. The Context editor was
 * hardcoding "booking is always available", so an owner on Circuit could pick a
 * booking CTA, type wording for it, see it summarised as though it were live,
 * and get no button on their card. The card was right; the editor was lying
 * about what the card would do.
 *
 * scripts/check-admin-auth.mjs is not the guard for this - see
 * check-card-context.mjs, which asserts this list matches the templates that
 * actually pass omitBooking in PublicCardView, so the two cannot drift.
 */
export const TEMPLATES_WITHOUT_BOOKING: readonly TemplateId[] = ['circuit']

/**
 * Templates that show no social icons at all.
 *
 * EMPTY, AND THAT IS THE POINT. It held 'neon' and 'editorial' for exactly as
 * long as it took to ask the question. Both rendered no social accounts, so a
 * customer on either design filled in LinkedIn and got silence - the same way
 * Minimal lost its Instagram and Minimal and Studio lost YouTube and TikTok.
 * Writing them down turned "we forgot" into a decision waiting to be made, and
 * the decision was to fix them. All fifteen templates now render the shared
 * list in their own style.
 *
 * The list stays, because the rule it serves is the part that matters:
 * check-socials.mjs holds every template to one of two states - renders the
 * shared list, or appears here with a reason. A sixteenth template that shows
 * no socials fails the build until somebody says which of the two it is.
 */
export const TEMPLATES_WITHOUT_SOCIALS: readonly TemplateId[] = []

/** Whether a Context CTA of kind "booking" can render on this template. */
export function templateOffersBooking(templateId: TemplateId | string | null | undefined): boolean {
  if (!templateId) return true
  return !(TEMPLATES_WITHOUT_BOOKING as readonly string[]).includes(templateId)
}

export const TEMPLATES: TemplateConfig[] = [
  { id: 'classic',   name: 'Classic',   description: 'Centred, clean and professional',    proOnly: false, defaultBgMode: 'dark',  previewGradient: 'from-gray-900 to-gray-800' },
  { id: 'modern',    name: 'Modern',    description: 'Left-aligned, bold typography',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-slate-900 to-slate-800' },
  { id: 'bold',      name: 'Bold',      description: 'Split hero — photo left, name right', proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-indigo-900 to-purple-900' },
  { id: 'minimal',   name: 'Minimal',   description: 'Vibrant icons on pure black or white', proOnly: true, defaultBgMode: 'dark',  previewGradient: 'from-black to-purple-950' },
  { id: 'executive', name: 'Executive', description: 'Magazine hero with bold diagonals',   proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-zinc-950 to-red-950' },
  { id: 'creative',  name: 'Creative',  description: 'Radial glow, accent avatar ring',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-violet-950 to-fuchsia-950' },
  { id: 'wave',      name: 'Wave',      description: 'Two-column hero with SVG wave',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-cyan-900 to-gray-900' },
  { id: 'split',     name: 'Split',     description: 'Accent sidebar, content right',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-blue-900 to-gray-900' },
  { id: 'splitpro',  name: 'Split Pro',  description: 'Sidebar runs the page, contacts live in it', proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-sky-900 to-gray-900' },
  { id: 'circuit',   name: 'Circuit',   description: 'Ribbons, star field and contact traces', proOnly: true, defaultBgMode: 'dark', previewGradient: 'from-slate-950 to-amber-900' },
  { id: 'meridian',  name: 'Meridian',  description: 'Full-bleed portrait, executive data grid', proOnly: true, defaultBgMode: 'dark', previewGradient: 'from-zinc-900 to-stone-800' },
  { id: 'neon',      name: 'Neon',      description: 'Glowing borders, dark cyberpunk',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-gray-950 to-purple-950' },
  { id: 'studio',    name: 'Studio',    description: 'Bold black header, curved accent bottom', proOnly: true, defaultBgMode: 'dark', previewGradient: 'from-black to-amber-900' },
  { id: 'frost',     name: 'Frost',     description: 'Glassmorphism on a soft gradient mesh',    proOnly: true, defaultBgMode: 'light', previewGradient: 'from-sky-200 to-violet-200' },
  { id: 'editorial', name: 'Editorial', description: 'Serif newspaper layout, traditional feel',  proOnly: true, defaultBgMode: 'light', previewGradient: 'from-stone-100 to-amber-50' },
]

// Card style visual effects — returns CSS properties to apply
// Blend two hex colours. Used to give Flat a genuinely opaque panel: a
// translucent white tint over the page and an opaque colour mixed from it look
// identical on their own, but the tint is glass-adjacent by construction and
// the mix is not, which is the whole distinction the style picker is selling.
// Returns null for anything that is not a plain hex - a custom background can
// be an rgba string - and callers fall back to a tint there.
function mixHex(base: string, towards: string, amount: number): string | null {
  const parse = (h: string) => {
    const c = h.replace('#', '')
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c
    if (!/^[0-9a-f]{6}$/i.test(full)) return null
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const a = parse(base), b = parse(towards)
  if (!a || !b) return null
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${a.map((v, i) => to(v + (b[i] - v) * amount)).join('')}`
}

// The alpha of a black scrim needed before white text clears `target` contrast
// against every colour given. Creative paints text over gradients built from
// the user's accent, and a fixed scrim cannot serve every accent: too light
// and a pale gold fails, too heavy and a deep purple is muddied for nothing.
// Solving it per card means the scrim is only ever as strong as that accent
// needs, and a dark accent gets none at all.
//
// Capped, because past a point the colour is closer to black than to the
// accent, and a card that cannot be loud legibly should stay legible.
//
// Lives here rather than in the template so the card and its editor thumbnail
// cannot drift apart - the same mistake that let Glass lose its blur.
export function scrimAlphaForWhite(hexes: string[], target = 4.5, cap = 0.62): number {
  const lum = (hex: string, a: number): number => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    if (!/^[0-9a-f]{6}$/i.test(full)) return 0
    const toLin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    const ch = [0, 2, 4].map(i => toLin((parseInt(full.slice(i, i + 2), 16) / 255) * (1 - a)))
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const worst = (a: number) => Math.min(...hexes.map(h => 1.05 / (lum(h, a) + 0.05)))
  for (let a = 0; a <= cap; a += 0.02) if (worst(a) >= target) return a
  return cap
}

export function getCardStyleEffect(style: CardStyle, accentHex: string, bgPage: string): {
  heroBg: string
  surfaceBg: string
  borderStyle: string
  /** Frosting for Glass, 'none' for the other two. Applied next to surfaceBg
   *  wherever a panel is drawn. Needs the -webkit- prefix as well: iOS Safari
   *  is where most of these cards are read and it still wants it. */
  backdropFilter: string
  /** The lit top edge. This, more than the blur, is what actually reads as
   *  glass: a blur has nothing to work with on a flat page, where a bright
   *  inner edge reads as a pane of something in any light. */
  surfaceShadow: string
} {
  // These tints used to be white-only, which silently assumed the page behind
  // them was dark. Pick a yellow background and the contact rows became a
  // white wash on yellow - technically applied, effectively invisible.
  const light = isLightBg(bgPage)
  const towards = light ? '#000000' : '#ffffff'
  switch (style) {
    case 'gradient':
      return {
        heroBg: `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 50%, ${bgPage} 100%)`,
        surfaceBg: `linear-gradient(135deg, ${accentHex}18 0%, transparent 100%)`,
        borderStyle: `1px solid ${accentHex}44`,
        backdropFilter: 'none',
        surfaceShadow: 'none',
      }
    case 'glass':
      // A sheen down the panel, not a flat tint. Glass had no blur, no lit
      // edge and no highlight, and then had all three at strengths too close
      // to Flat to tell apart: 7% white against 6%. It is meant to look like a
      // pane with light catching the top of it, so it is lighter, it has a
      // bright rim, and the fill falls off from top to bottom.
      // The hero keeps a wash on purpose: frosting needs something behind it.
      return {
        heroBg: `linear-gradient(135deg, ${accentHex}3d 0%, ${accentHex}14 100%)`,
        surfaceBg: light
          ? 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 100%)',
        borderStyle: light ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.38)',
        backdropFilter: 'blur(18px) saturate(160%)',
        surfaceShadow: light
          ? 'inset 0 1px 0 rgba(255,255,255,1), 0 8px 24px rgba(0,0,0,0.10)'
          : 'inset 0 1px 0 rgba(255,255,255,0.38), 0 10px 28px rgba(0,0,0,0.40)',
      }
    case 'flat':
    default:
      // Flat means flat. The hero was a linear-gradient under a control
      // labelled "Solid colours", and the panels were a translucent tint one
      // percent away from Glass. Both are opaque now: the panel is a colour
      // mixed off the page rather than a wash laid over it, so it reads matte
      // next to Glass instead of nearly identical to it.
      return {
        heroBg: mixHex(bgPage, accentHex, 0.22) ?? `${accentHex}2b`,
        surfaceBg: mixHex(bgPage, towards, 0.09) ?? (light ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'),
        borderStyle: `1px solid ${mixHex(bgPage, towards, 0.18) ?? 'transparent'}`,
        backdropFilter: 'none',
        surfaceShadow: 'none',
      }
  }
}

export function getBgColors(mode: BgMode, templateId: TemplateId, customBgColor?: string): {
  page: string; card: string; surface: string; text: string; subtext: string; border: string
} {
  // Helper: when a user picks a custom card background colour, override
  // page (and text where contrast demands it) on whichever palette the
  // template/mode would otherwise use.
  const applyCustomBg = (colors: ReturnType<typeof getBgColors>) => {
    if (!customBgColor) return colors
    // page and text were the only two overridden, so a light custom colour
    // kept the dark palette's card, surface, subtext and border underneath it:
    // grey-on-yellow subtext and panels that barely showed. Everything that
    // sits on the page has to follow the page.
    const light = isLightBg(customBgColor)
    return {
      ...colors,
      page: customBgColor,
      text: getReadableTextOn(customBgColor),
      card: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
      surface: light ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)',
      subtext: light ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.60)',
      border: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
    }
  }
  if (mode === 'light') {
    return applyCustomBg({ page: '#f8fafc', card: '#ffffff', surface: '#f1f5f9', text: '#0f172a', subtext: '#5e6d83', border: '#e2e8f0' })
  }
  // SUBTEXT IS MEASURED, NOT PICKED. It colours 35 separate things on a public
  // card - section headings, link sublabels, form labels, the POPIA capture
  // notice - and those sit on all three grounds below, so a value has to clear
  // AA against page, card AND surface, with the translucent ones composited.
  //
  // Six palettes did not, and the capture notice is what surfaced it:
  //
  //   neon       3.26    #6060a0 -> #7e7eb2   now 4.86
  //   executive  3.67    #71717a -> #85858e   now 4.86
  //   modern     4.04    #94a3b8 -> #a6b3c4   now 4.85
  //   split      4.04    #94a3b8 -> #a6b3c4   now 4.85
  //   editorial  4.40    #78716c -> #716a65   now 4.87
  //   light      4.34    #64748b -> #5e6d83   now 4.81   (the shared palette above)
  //
  // Each new value holds the original hue and saturation and moves only
  // lightness, by the smallest step that clears 4.8. The target is 4.8 rather
  // than 4.5 so a later nudge to a background does not silently drop a palette
  // back under the line.
  //
  // STUDIO IS THE EXCEPTION AND CANNOT BE FIXED THIS WAY. Its page is pure
  // black and its card is near-white, so one colour has to sit on both ends of
  // the range at once. The best grey that exists for that is #727272 at 4.37,
  // which is where it now sits, up from 2.69. Reaching AA would mean lifting
  // the page off pure black, which changes what the template is for, and no
  // live card uses studio. If one ever does, that is the fix.
  const dark: Record<TemplateId, ReturnType<typeof getBgColors>> = {
    classic:   { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    modern:    { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#a6b3c4', border: '#475569' },
    bold:      { page: '#09090b', card: '#18181b', surface: '#27272a', text: '#fafafa', subtext: '#a1a1aa', border: '#3f3f46' },
    minimal:   { page: '#000000', card: '#0a0a0a', surface: '#141414', text: '#ffffff', subtext: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.08)' },
    executive: { page: '#09090b', card: '#0c0c0e', surface: '#18181b', text: '#fafafa', subtext: '#85858e', border: '#27272a' },
    creative:  { page: '#0d0d1a', card: '#13132b', surface: '#1e1e3f', text: '#f0f0ff', subtext: '#a0a0c0', border: '#2d2d5e' },
    wave:      { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    split:     { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#a6b3c4', border: '#475569' },
    // Split Pro shares Split's palette but sits a shade darker: the rail runs
    // the whole page there, so the ground it runs down needs to stay behind it.
    splitpro:  { page: '#0b1220', card: '#161f33', surface: '#1e293b', text: '#f1f5f9', subtext: '#94a3b8', border: '#334155' },
    // Deep navy rather than near-black: the ribbons and the star field are
    // drawn in the accent, and they need a ground with some colour in it to
    // sit on or the whole card reads as line art on black.
    circuit:   { page: '#0a1428', card: '#101d38', surface: '#16294d', text: '#f4f7fb', subtext: '#93a4c4', border: '#22375f' },
    // Neutral graphite rather than a tinted navy or violet: the hero is a
    // full-bleed photograph and the ground has to sit under any skin tone,
    // wall colour and jacket without casting on it.
    meridian:  { page: '#0e1113', card: '#171b1f', surface: '#20262b', text: '#f2f4f5', subtext: '#9aa5ad', border: '#2b3238' },
    neon:      { page: '#050510', card: '#0a0a1a', surface: '#10102a', text: '#e0e0ff', subtext: '#7e7eb2', border: '#1a1a3a' },
    studio:    { page: '#000000', card: '#f5f5f5', surface: '#ffffff', text: '#0a0a0a', subtext: '#727272', border: '#e5e5e5' },
    // Frost's dark entry used to be a light palette - page #f8fafc, text
    // #0f172a - which was harmless while the template hardcoded its own
    // colours and ignored the palette. Now that it reads bg.text, a card set
    // to dark mode was drawing near-black text on a dark ground. This is a
    // real dark palette: night ice rather than day ice.
    frost:     { page: '#070d16', card: 'rgba(255,255,255,0.07)', surface: 'rgba(255,255,255,0.05)', text: '#eaf2fb', subtext: '#93a7bd', border: 'rgba(255,255,255,0.16)' },
    editorial: { page: '#fafaf9', card: '#ffffff', surface: '#f5f5f4', text: '#1c1917', subtext: '#716a65', border: '#e7e5e4' },
  }
  return applyCustomBg(dark[templateId] || dark.classic)
}

// Templates that have been renamed or replaced, pointing at what took their
// place. A card stores its template as a string in color_theme, so retiring an
// id orphans every card already saved with it - and both PublicCardView and
// TemplatedCardPreview end their template chain with `return null`, so an
// orphaned card does not fall back to anything: it renders a blank page.
// Sovereign shipped, was replaced by Meridian the same day, and took the cards
// that had already selected it dark.
const TEMPLATE_ALIASES: Record<string, TemplateId> = {
  sovereign: 'meridian',
}

// Anything that is not a live template and has no alias is coerced to the
// default. Blank is never the right answer for a card someone has printed on
// an NFC tag: the wrong template still shows their name and number.
function resolveTemplateId(id: unknown): TemplateId {
  if (typeof id !== 'string') return DEFAULT_DESIGN.templateId
  if (TEMPLATES.some(t => t.id === id)) return id as TemplateId
  return TEMPLATE_ALIASES[id] ?? DEFAULT_DESIGN.templateId
}

export function parseDesign(colorTheme: string | null): CardDesign {
  if (!colorTheme) return DEFAULT_DESIGN
  try {
    const parsed = JSON.parse(colorTheme)
    if (parsed.templateId) {
      parsed.templateId = resolveTemplateId(parsed.templateId)
      // Migrate old logo position values
      const oldToNew: Record<string, LogoPosition> = {
        'top-left': 'left', 'top-right': 'right',
        'below-name': 'center', 'below-photo': 'center',
        'bottom-left': 'left', 'bottom-right': 'right',
      }
      if (parsed.logoPosition && oldToNew[parsed.logoPosition]) {
        parsed.logoPosition = oldToNew[parsed.logoPosition]
      }
      // Migrate old boldTextX/Y to unified textX/Y
      if (parsed.boldTextX !== undefined && parsed.textX === undefined) {
        parsed.textX = parsed.boldTextX
        parsed.textY = parsed.boldTextY ?? 0
      }
      return { ...DEFAULT_DESIGN, ...parsed }
    }
  } catch {
    const legacyColors = ['blue','purple','green','red','orange','pink','teal','gray']
    if (legacyColors.includes(colorTheme)) {
      return { ...DEFAULT_DESIGN, accentColor: colorTheme as AccentColor }
    }
  }
  return DEFAULT_DESIGN
}

export function serializeDesign(design: CardDesign): string {
  return JSON.stringify(design)
}

export function calcPhotoSize(base: number, design: CardDesign): number {
  return Math.round(base * ((design.profilePhotoSize ?? 100) / 100))
}

export function calcLogoHeight(base: number, design: CardDesign): number {
  return Math.round(base * ((design.logoSize ?? 100) / 100))
}

// Typography helpers — every template reads from these so the design
// panel controls take effect uniformly across templates.

function applyPercent(base: number, percent?: number): number {
  return Math.round(base * ((percent ?? 100) / 100))
}

export function calcNameSize(base: number, design: CardDesign): number {
  return applyPercent(base, design.nameSize)
}

export function calcTitleSize(base: number, design: CardDesign): number {
  return applyPercent(base, design.titleSize)
}

export function calcCompanySize(base: number, design: CardDesign): number {
  return applyPercent(base, design.companySize)
}

export function calcBioSize(base: number, design: CardDesign): number {
  return applyPercent(base, design.bioSize)
}

export function getNameColor(design: CardDesign, fallbackHex: string): string {
  return design.nameColor || fallbackHex
}

export function getTitleColor(design: CardDesign, fallbackHex: string): string {
  return design.titleColor || fallbackHex
}

export function getCompanyColor(design: CardDesign, fallbackHex: string): string {
  return design.companyColor || fallbackHex
}

export function getBioColor(design: CardDesign, fallbackHex: string): string {
  return design.bioColor || fallbackHex
}

const BODY_SIZE_PX: Record<NonNullable<CardDesign['bodySize']>, number> = {
  small: 12,
  medium: 14,
  large: 16,
}

export function getBodyFontSize(design: CardDesign): number {
  return BODY_SIZE_PX[design.bodySize ?? 'medium']
}

const BUTTON_SIZE_PX: Record<NonNullable<CardDesign['buttonTextSize']>, number> = {
  small: 12,
  medium: 14,
  large: 16,
}

export function getButtonFontSize(design: CardDesign): number {
  return BUTTON_SIZE_PX[design.buttonTextSize ?? 'medium']
}
