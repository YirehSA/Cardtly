export type TemplateId = 'classic' | 'modern' | 'bold' | 'minimal' | 'executive' | 'creative' | 'wave' | 'split' | 'neon'
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
  { id: 'minimal',   name: 'Minimal',   description: 'Luxury editorial style',              proOnly: true,  defaultBgMode: 'light', previewGradient: 'from-gray-50 to-white' },
  { id: 'executive', name: 'Executive', description: 'Large photo left, name right',        proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-zinc-950 to-zinc-900' },
  { id: 'creative',  name: 'Creative',  description: 'Radial glow, accent avatar ring',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-violet-950 to-fuchsia-950' },
  { id: 'wave',      name: 'Wave',      description: 'Two-column hero with SVG wave',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-cyan-900 to-gray-900' },
  { id: 'split',     name: 'Split',     description: 'Accent sidebar, content right',       proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-blue-900 to-gray-900' },
  { id: 'neon',      name: 'Neon',      description: 'Glowing borders, dark cyberpunk',     proOnly: true,  defaultBgMode: 'dark',  previewGradient: 'from-gray-950 to-purple-950' },
]

// Card style visual effects — returns CSS properties to apply
export function getCardStyleEffect(style: CardStyle, accentHex: string, bgPage: string): {
  heroBg: string
  surfaceBg: string
  borderStyle: string
} {
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
        surfaceBg: `rgba(255,255,255,0.04)`,
        borderStyle: `1px solid rgba(255,255,255,0.12)`,
      }
    case 'flat':
    default:
      return {
        heroBg: `linear-gradient(180deg, ${accentHex}33 0%, ${bgPage} 100%)`,
        surfaceBg: `rgba(255,255,255,0.06)`,
        borderStyle: `1px solid transparent`,
      }
  }
}

export function getBgColors(mode: BgMode, templateId: TemplateId): {
  page: string; card: string; surface: string; text: string; subtext: string; border: string
} {
  if (mode === 'light') {
    return { page: '#f8fafc', card: '#ffffff', surface: '#f1f5f9', text: '#0f172a', subtext: '#64748b', border: '#e2e8f0' }
  }
  const dark: Record<TemplateId, ReturnType<typeof getBgColors>> = {
    classic:   { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    modern:    { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#94a3b8', border: '#475569' },
    bold:      { page: '#09090b', card: '#18181b', surface: '#27272a', text: '#fafafa', subtext: '#a1a1aa', border: '#3f3f46' },
    minimal:   { page: '#f8fafc', card: '#ffffff', surface: '#f1f5f9', text: '#0f172a', subtext: '#64748b', border: '#e2e8f0' },
    executive: { page: '#09090b', card: '#0c0c0e', surface: '#18181b', text: '#fafafa', subtext: '#71717a', border: '#27272a' },
    creative:  { page: '#0d0d1a', card: '#13132b', surface: '#1e1e3f', text: '#f0f0ff', subtext: '#a0a0c0', border: '#2d2d5e' },
    wave:      { page: '#030712', card: '#111827', surface: '#1f2937', text: '#f9fafb', subtext: '#9ca3af', border: '#374151' },
    split:     { page: '#0f172a', card: '#1e293b', surface: '#334155', text: '#f1f5f9', subtext: '#94a3b8', border: '#475569' },
    neon:      { page: '#050510', card: '#0a0a1a', surface: '#10102a', text: '#e0e0ff', subtext: '#6060a0', border: '#1a1a3a' },
  }
  return dark[templateId] || dark.classic
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
