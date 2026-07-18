export type TemplateId = 'classic' | 'modern' | 'bold' | 'minimal' | 'executive' | 'creative' | 'wave' | 'split' | 'neon' | 'studio' | 'frost' | 'editorial'
export type FontId = 'sans' | 'serif' | 'modern' | 'rounded' | 'mono'
export type AccentColor = 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'pink' | 'teal' | 'gold' | 'custom'
export type LogoPosition = 'left' | 'center' | 'right' | 'hidden'
export type CardStyle = 'flat' | 'glass' | 'gradient'
export type BgMode = 'dark' | 'light'

// Templates that support text position nudging
export const TEXT_POSITION_TEMPLATES: TemplateId[] = ['bold', 'executive', 'wave', 'modern', 'neon']

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

export const TEMPLATES: TemplateConfig[] = [
  { id: 'classic',   name: 'Classic',   description: 'Centred, clean and professional',    proOnly: false, defaultBgMode: 'dark',  previewGradient: 'from-gray-900 to-gray-800' },
  { id: 'modern',    name: 'Modern',    description: 'Left-aligned, bold typography',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-slate-900 to-slate-800' },
  { id: 'bold',      name: 'Bold',      description: 'Split hero — photo left, name right', proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-indigo-900 to-purple-900' },
  { id: 'minimal',   name: 'Minimal',   description: 'Vibrant icons on pure black or white', proOnly: true, defaultBgMode: 'dark',  previewGradient: 'from-black to-purple-950' },
  { id: 'executive', name: 'Executive', description: 'Magazine hero with bold diagonals',   proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-zinc-950 to-red-950' },
  { id: 'creative',  name: 'Creative',  description: 'Radial glow, accent avatar ring',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-violet-950 to-fuchsia-950' },
  { id: 'wave',      name: 'Wave',      description: 'Two-column hero with SVG wave',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-cyan-900 to-gray-900' },
  { id: 'split',     name: 'Split',     description: 'Accent sidebar, content right',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-blue-900 to-gray-900' },
  { id: 'neon',      name: 'Neon',      description: 'Glowing borders, dark cyberpunk',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-gray-950 to-purple-950' },
  { id: 'studio',    name: 'Studio',    description: 'Bold black header, curved accent bottom', proOnly: true, defaultBgMode: 'dark', previewGradient: 'from-black to-amber-900' },
  { id: 'frost',     name: 'Frost',     description: 'Glassmorphism on a soft gradient mesh',    proOnly: true, defaultBgMode: 'light', previewGradient: 'from-sky-200 to-violet-200' },
  { id: 'editorial', name: 'Editorial', description: 'Serif newspaper layout, traditional feel',  proOnly: true, defaultBgMode: 'light', previewGradient: 'from-stone-100 to-amber-50' },
]

// Card style visual effects — returns CSS properties to apply
export function getCardStyleEffect(style: CardStyle, accentHex: string, bgPage: string): {
  heroBg: string
  surfaceBg: string
  borderStyle: string
} {
  // These tints used to be white-only, which silently assumed the page behind
  // them was dark. Pick a yellow background and the contact rows became a
  // white wash on yellow - technically applied, effectively invisible.
  const light = isLightBg(bgPage)
  switch (style) {
    case 'gradient':
      return {
        heroBg: `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 50%, ${bgPage} 100%)`,
        surfaceBg: `linear-gradient(135deg, ${accentHex}18 0%, transparent 100%)`,
        borderStyle: `1px solid ${accentHex}44`,
      }
    case 'glass':
      return {
        heroBg: `linear-gradient(135deg, ${accentHex}33 0%, ${accentHex}11 100%)`,
        surfaceBg: light ? `rgba(0,0,0,0.05)` : `rgba(255,255,255,0.04)`,
        borderStyle: light ? `1px solid rgba(0,0,0,0.10)` : `1px solid rgba(255,255,255,0.12)`,
      }
    case 'flat':
    default:
      return {
        heroBg: `linear-gradient(180deg, ${accentHex}33 0%, ${bgPage} 100%)`,
        surfaceBg: light ? `rgba(0,0,0,0.07)` : `rgba(255,255,255,0.06)`,
        borderStyle: `1px solid transparent`,
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
    return applyCustomBg({ page: '#f8fafc', card: '#ffffff', surface: '#f1f5f9', text: '#0f172a', subtext: '#64748b', border: '#e2e8f0' })
  }
  const dark: Record<TemplateId, ReturnType<typeof getBgColors>> = {
    classic:   { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    modern:    { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#94a3b8', border: '#475569' },
    bold:      { page: '#09090b', card: '#18181b', surface: '#27272a', text: '#fafafa', subtext: '#a1a1aa', border: '#3f3f46' },
    minimal:   { page: '#000000', card: '#0a0a0a', surface: '#141414', text: '#ffffff', subtext: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.08)' },
    executive: { page: '#09090b', card: '#0c0c0e', surface: '#18181b', text: '#fafafa', subtext: '#71717a', border: '#27272a' },
    creative:  { page: '#0d0d1a', card: '#13132b', surface: '#1e1e3f', text: '#f0f0ff', subtext: '#a0a0c0', border: '#2d2d5e' },
    wave:      { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    split:     { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#94a3b8', border: '#475569' },
    neon:      { page: '#050510', card: '#0a0a1a', surface: '#10102a', text: '#e0e0ff', subtext: '#6060a0', border: '#1a1a3a' },
    studio:    { page: '#000000', card: '#f5f5f5', surface: '#ffffff', text: '#0a0a0a', subtext: '#525252', border: '#e5e5e5' },
    frost:     { page: '#f8fafc', card: 'rgba(255,255,255,0.6)', surface: 'rgba(255,255,255,0.4)', text: '#0f172a', subtext: '#64748b', border: 'rgba(255,255,255,0.4)' },
    editorial: { page: '#fafaf9', card: '#ffffff', surface: '#f5f5f4', text: '#1c1917', subtext: '#78716c', border: '#e7e5e4' },
  }
  return applyCustomBg(dark[templateId] || dark.classic)
}

export function parseDesign(colorTheme: string | null): CardDesign {
  if (!colorTheme) return DEFAULT_DESIGN
  try {
    const parsed = JSON.parse(colorTheme)
    if (parsed.templateId) {
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
