'use client'

import { useState } from 'react'
import {
  TEMPLATES, ACCENT_COLORS, FONTS, CardDesign, TEXT_POSITION_TEMPLATES,
  AccentColor, FontId, LogoPosition, CardStyle, BgMode, getAccentHex,
  getButtonBg, getButtonText, DEFAULT_DESIGN,
} from '@/types/design'
import { Check, Lock, Sun, Moon, AlignLeft, AlignCenter, AlignRight, EyeOff, Pipette } from 'lucide-react'
import Link from 'next/link'
import CardPreview from './CardPreview'
import { useIosApp } from '@/components/dashboard/PlatformProvider'

interface Props {
  design: CardDesign
  onChange: (design: CardDesign) => void
  isPro: boolean
}

// Background colours that read well behind a whole card. Deliberately not the
// same palette as the accent swatches - these are page colours, and half of
// them are deep or muted in a way an accent never wants to be.
const BG_PRESETS = [
  { hex: '#0a0a0a', label: 'Black' },
  { hex: '#0f172a', label: 'Navy' },
  { hex: '#1c2e26', label: 'Forest' },
  { hex: '#3b1f2b', label: 'Burgundy' },
  { hex: '#f5d020', label: 'Yellow' },
  { hex: '#f5f0e6', label: 'Cream' },
  { hex: '#e8eef5', label: 'Ice' },
  { hex: '#ffffff', label: 'White' },
]

// Sample form data used to render real mini-previews inside the template
// picker tiles. Realistic-looking fake content so each tile shows what
// the actual template will look like with a populated card.
// Tio's real card, which is Cardtly's own. A sample shown to every visitor
// and to every customer opening the template picker has to be a card the
// company actually owns - the previous one used a stock face that is not
// ours. It doubles as a fair test of the templates: a real photograph, a real
// logo, a bio long enough to wrap, and socials.
const PICKER_SAMPLE_FORM = {
  name: 'Tio Geldenhuys',
  title: 'Co-Founder',
  company: 'Cardtly',
  bio: 'Helping teams generate more leads and secure more meetings.',
  email: 'tio@cardtly.com',
  phone: '+27 62 460 7440',
  work_phone: '',
  whatsapp: '+27624607440',
  address: 'Benoni, Gauteng',
  website: 'https://www.cardtly.com/',
  profile_image_url: 'https://xdrvryzsfrvfekntszcj.supabase.co/storage/v1/object/public/card-images/e32fd093-310a-490e-8d3c-68b7795afd6a/1784647251097.webp',
  company_logo_url: 'https://xdrvryzsfrvfekntszcj.supabase.co/storage/v1/object/public/company-logos/86ee397a-55a8-4664-9855-1f5bf42f25a4/1784625815181.webp',
  certifications: 'NFC, Networking',
  linkedin_url: 'https://www.linkedin.com/company/cardtly/',
  instagram_url: 'https://www.instagram.com/cardtlydigital/',
  link_1_title: 'See how it works', link_1_url: 'https://www.cardtly.com/features',
  link_2_title: '',         link_2_url: '',
  link_3_title: '',         link_3_url: '',
}

const LOGO_POSITIONS: { id: LogoPosition; label: string; icon: React.ReactNode }[] = [
  { id: 'left',   label: 'Left',   icon: <AlignLeft className="w-4 h-4" /> },
  { id: 'center', label: 'Centre', icon: <AlignCenter className="w-4 h-4" /> },
  { id: 'right',  label: 'Right',  icon: <AlignRight className="w-4 h-4" /> },
  { id: 'hidden', label: 'Hidden', icon: <EyeOff className="w-4 h-4" /> },
]

type DesignTabId = 'template' | 'colours' | 'text' | 'profile' | 'button'

// Coloured to match the editor's tabs, so a section is somewhere you recognise
// rather than one of five identical grey words.
const DESIGN_TABS: { id: DesignTabId; label: string; colour: string }[] = [
  { id: 'template', label: 'Layout',  colour: '#ec4899' },
  { id: 'colours',  label: 'Colours', colour: '#f59e0b' },
  { id: 'text',     label: 'Text',    colour: '#3b82f6' },
  { id: 'profile',  label: 'Photo',   colour: '#22c55e' },
  { id: 'button',   label: 'Button',  colour: '#8b5cf6' },
]

export default function DesignPanel({ design, onChange, isPro }: Props) {
  const iosApp = useIosApp()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  // Group the previously-scrolling design panel into five tabs so
  // navigation isn't a scroll marathon. Each tab renders its own
  // section. Defaults to Template since that's the most common entry.
  const [activeTab, setActiveTab] = useState<DesignTabId>('template')
  const currentAccentHex = getAccentHex(design)
  const supportsTextPosition = TEXT_POSITION_TEMPLATES.includes(design.templateId)
  const activeTemplate = TEMPLATES.find(t => t.id === design.templateId)

  function update(patch: Partial<CardDesign>) {
    onChange({ ...design, ...patch })
  }

  return (
    <div className="space-y-6">
      {/* Tab bar at the top - wraps on narrow widths */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {DESIGN_TABS.map(tab => {
          const on = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap text-center border-2 ${on ? '' : 'border-border text-muted-foreground hover:text-foreground hover:-translate-y-0.5'}`}
              style={on ? { borderColor: tab.colour, background: tab.colour + '14', color: tab.colour } : undefined}>
              {tab.label}
            </button>
          )
        })}
      </div>
      {/* Tab content - everything below this line is wrapped in
          conditional rendering based on activeTab. The space-y-8
          inside each tab is preserved so individual sections still
          have breathing room. */}
      <div className="space-y-8" style={{ display: activeTab === 'template' ? 'block' : 'none' }}>

      {/* Template picker - collapses to just the active tile + a
          "Change template" button when one is selected. Click that
          to expand the full grid. */}
      <div>
        <label className="block text-sm font-semibold mb-3">Template</label>

        {/* Collapsed view: show the active template card + a button
            to expand. Only shown when an active template exists and
            the picker isn't open. */}
        {activeTemplate && !templatePickerOpen && (() => {
          const previewDesign: CardDesign = {
            ...DEFAULT_DESIGN,
            ...design,
            templateId: activeTemplate.id,
            bgMode: activeTemplate.defaultBgMode,
          }
          return (
            <div className="flex items-stretch gap-3">
              {/* Active template preview tile - same render style as
                  the expanded grid so toggling feels seamless */}
              <div className="relative rounded-xl overflow-hidden border-2 border-blue-500 flex-1 max-w-[200px]">
                <div className="relative h-32 bg-card overflow-hidden">
                  <CardPreview form={PICKER_SAMPLE_FORM} isPro={true} design={previewDesign} frameHeight={820} />
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-10">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="p-2 bg-card">
                  <p className="text-xs font-semibold leading-tight">{activeTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>
                </div>
              </div>
              {/* Expand button */}
              <button
                onClick={() => setTemplatePickerOpen(true)}
                className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-border hover:border-foreground/40 hover:bg-muted/50 transition text-sm font-medium text-muted-foreground"
              >
                Change template
              </button>
            </div>
          )
        })()}

        {/* Expanded view: full grid of all templates, with their
            scaled-down real previews. Visible when the user clicks
            "Change template" or when no template is selected yet. */}
        {(templatePickerOpen || !activeTemplate) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEMPLATES.map(t => {
              const locked = t.proOnly && !isPro
              const active = design.templateId === t.id
              const previewDesign: CardDesign = {
                ...DEFAULT_DESIGN,
                ...design,
                templateId: t.id,
                bgMode: t.defaultBgMode,
              }
              return (
                // The button is an overlay sibling, not a wrapper. The
                // preview renders the real card, and the real card is full of
                // anchors - an <a> inside a <button> is invalid HTML, and
                // React refuses to hydrate it.
                <div
                  key={t.id}
                  className={`relative rounded-xl overflow-hidden border-2 transition text-left ${active ? 'border-blue-500' : 'border-border hover:border-foreground/20'} ${locked ? 'opacity-50' : ''}`}
                >
                  <div className="relative h-32 bg-card overflow-hidden">
                    <CardPreview form={PICKER_SAMPLE_FORM} isPro={true} design={previewDesign} frameHeight={820} />
                    {active && <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-10"><Check className="w-3 h-3 text-white" /></div>}
                    {locked && <div className="absolute top-2 right-2 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center z-10"><Lock className="w-3 h-3 text-white" /></div>}
                  </div>
                  <div className="p-2 bg-card">
                    <p className="text-xs font-semibold leading-tight">{t.name}</p>
                    {locked && <p className="text-xs text-muted-foreground">Pro</p>}
                  </div>
                  <button
                    onClick={() => {
                      if (locked) return
                      update({ templateId: t.id, bgMode: t.defaultBgMode })
                      setTemplatePickerOpen(false)
                    }}
                    aria-label={`Use the ${t.name} template`}
                    className={`absolute inset-0 z-20 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                </div>
              )
            })}
          </div>
        )}

        {!isPro && (
          <p className="text-xs text-muted-foreground mt-2">
            {iosApp
              // Says which templates are locked, offers nowhere to buy them.
              // Apple 3.1.1 counts the link itself as the violation.
              ? 'Some templates are part of Cardtly Pro.'
              : <><Link href="/dashboard/upgrade" className="text-primary underline">Upgrade to Pro</Link> to unlock all templates.</>}
          </p>
        )}
      </div>
      </div>{/* /Template tab */}

      {/* ── COLOURS TAB ─────────────────────────────────────────── */}
      <div className="space-y-8" style={{ display: activeTab === 'colours' ? 'block' : 'none' }}>

      {/* Card style — visible effect description */}
      <div>
        <label className="block text-sm font-semibold mb-1">Card style</label>
        <p className="text-xs text-muted-foreground mb-3">Controls how the hero area and surfaces are rendered</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'flat' as CardStyle, label: 'Flat', desc: 'Solid colours' },
            { id: 'glass' as CardStyle, label: 'Glass', desc: 'Frosted look' },
            { id: 'gradient' as CardStyle, label: 'Gradient', desc: 'Colour fade' },
          ]).map(({ id, label, desc }) => (
            <button key={id} onClick={() => update({ cardStyle: id })}
              className={`py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition text-center ${design.cardStyle === id ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
              <span className="block">{label}</span>
              <span className="text-xs font-normal text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card background: Dark / Light preset, or any colour at all.
          This used to be two buttons and a small unlabelled pipette, sitting
          directly above a row of nine bright accent swatches. People reached
          for the colourful row and changed their icons instead, so the third
          option is now a full-width labelled choice with its own swatches. */}
      <div>
        <label className="block text-sm font-semibold mb-1">Card background</label>
        <p className="text-xs text-muted-foreground mb-3">The colour behind everything on your card.</p>
        <div className="grid grid-cols-3 gap-2">
          {([{ id: 'dark' as BgMode, label: 'Dark', icon: Moon }, { id: 'light' as BgMode, label: 'Light', icon: Sun }]).map(({ id, label, icon: Icon }) => {
            // Active only when this mode matches AND there's no custom override
            const active = design.bgMode === id && !design.customBgColor
            return (
              <button key={id}
                onClick={() => { update({ bgMode: id, customBgColor: undefined }); setShowBgPicker(false) }}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition ${active ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            )
          })}
          <button
            onClick={() => setShowBgPicker(true)}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition ${design.customBgColor ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
            <span className="w-4 h-4 rounded-full border border-border"
              style={{ background: design.customBgColor || 'linear-gradient(135deg,#f5d020,#f53803,#8b5cf6,#0ea5e9)' }} />
            Colour
          </button>
        </div>

        {(showBgPicker || design.customBgColor) && (
          <div className="mt-3 p-3 bg-muted rounded-xl">
            <p className="text-xs font-semibold mb-2">Pick a background colour</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {BG_PRESETS.map(c => (
                <button key={c.hex} title={c.label}
                  onClick={() => update({ customBgColor: c.hex })}
                  className={`w-9 h-9 rounded-full border-2 transition hover:scale-110 ${design.customBgColor?.toLowerCase() === c.hex.toLowerCase() ? 'border-blue-500 scale-110' : 'border-border'}`}
                  style={{ backgroundColor: c.hex }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={design.customBgColor || '#0a0a0a'}
                onChange={e => update({ customBgColor: e.target.value })}
                className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <div className="flex-1">
                <p className="text-xs font-medium">Or any colour you like</p>
                <p className="text-xs text-muted-foreground font-mono">{design.customBgColor || '— none picked —'}</p>
              </div>
              {design.customBgColor && (
                <button
                  onClick={() => { update({ customBgColor: undefined }); setShowBgPicker(false) }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Background fill - shown for Classic and Wave (the two templates
          that read solidBackground). Other templates have their own
          hero treatment. */}
      {(design.templateId === 'classic' || design.templateId === 'wave') && (
        <div>
          <label className="block text-sm font-semibold mb-1">Hero fill</label>
          <p className="text-xs text-muted-foreground mb-3">Pick the colour treatment for the top band behind the photo</p>
          <div className="flex gap-3">
            <button onClick={() => update({ solidBackground: false })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${!design.solidBackground ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
              Gradient
            </button>
            <button onClick={() => update({ solidBackground: true })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${design.solidBackground ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
              Solid
            </button>
          </div>
        </div>
      )}

      {/* Accent colour + custom colour picker */}
      <div>
        <label className="block text-sm font-semibold mb-1">Accent colour</label>
        <p className="text-xs text-muted-foreground mb-3">Buttons, icons and highlights. Not the background.</p>

        {/* Preset swatches */}
        <div className="flex flex-wrap gap-3 mb-3">
          {(Object.entries(ACCENT_COLORS) as [Exclude<AccentColor, 'custom'>, typeof ACCENT_COLORS[Exclude<AccentColor, 'custom'>]][]).map(([id, color]) => (
            <button key={id} onClick={() => update({ accentColor: id, customAccentColor: undefined })} title={color.label}
              className={`w-9 h-9 rounded-full border-2 transition hover:scale-110 ${design.accentColor === id ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: color.hex }} />
          ))}

          {/* Custom colour swatch — shows current custom colour or a picker icon */}
          <button
            onClick={() => setShowColorPicker(p => !p)}
            title="Custom colour"
            className={`w-9 h-9 rounded-full border-2 transition hover:scale-110 flex items-center justify-center ${design.accentColor === 'custom' ? 'border-white scale-110' : 'border-dashed border-muted-foreground'}`}
            style={{ backgroundColor: design.accentColor === 'custom' ? design.customAccentColor : 'transparent' }}
          >
            {design.accentColor !== 'custom' && <Pipette className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Colour picker — expands when custom is clicked */}
        {showColorPicker && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <input
              type="color"
              value={design.customAccentColor || currentAccentHex}
              onChange={e => update({ accentColor: 'custom', customAccentColor: e.target.value })}
              className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <div className="flex-1">
              <p className="text-xs font-medium">Custom colour</p>
              <p className="text-xs text-muted-foreground font-mono">{design.customAccentColor || currentAccentHex}</p>
            </div>
            <button
              onClick={() => { update({ accentColor: 'blue', customAccentColor: undefined }); setShowColorPicker(false) }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Reset
            </button>
          </div>
        )}

        {/* Current accent preview */}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: currentAccentHex }} />
          <span className="text-xs text-muted-foreground font-mono">{currentAccentHex}</span>
        </div>
      </div>
      </div>{/* /Colours tab */}

      {/* ── BUTTON TAB ──────────────────────────────────────────── */}
      <div className="space-y-8" style={{ display: activeTab === 'button' ? 'block' : 'none' }}>

      {/* Save Contact button colours */}
      <div>
        <label className="block text-sm font-semibold mb-1">Save Contact button</label>
        <p className="text-xs text-muted-foreground mb-3">Leave any field blank to use the automatic colour.</p>

        <div className="space-y-2">
          {/* Background */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border">
            <input
              type="color"
              value={design.buttonBgColor || currentAccentHex}
              onChange={e => update({ buttonBgColor: e.target.value })}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Background</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {design.buttonBgColor || 'Auto (matches accent)'}
              </p>
            </div>
            {design.buttonBgColor && (
              <button onClick={() => update({ buttonBgColor: undefined })}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Reset
              </button>
            )}
          </div>

          {/* Text */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border">
            <input
              type="color"
              value={design.buttonTextColor || '#ffffff'}
              onChange={e => update({ buttonTextColor: e.target.value })}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Text</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {design.buttonTextColor || 'Auto (readable contrast)'}
              </p>
            </div>
            {design.buttonTextColor && (
              <button onClick={() => update({ buttonTextColor: undefined })}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Reset
              </button>
            )}
          </div>

          {/* Border */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border">
            <input
              type="color"
              value={design.buttonBorderColor || currentAccentHex}
              onChange={e => update({ buttonBorderColor: e.target.value })}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Border</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {design.buttonBorderColor || 'No border'}
              </p>
            </div>
            {design.buttonBorderColor && (
              <button onClick={() => update({ buttonBorderColor: undefined })}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Button text size */}
        <div className="mt-4">
          <label className="block text-xs font-medium mb-2">Text size</label>
          <div className="grid grid-cols-3 gap-2">
            {(['small', 'medium', 'large'] as const).map(size => (
              <button key={size}
                onClick={() => update({ buttonTextSize: size })}
                className={`py-2 px-2 rounded-lg border-2 text-xs font-medium transition capitalize ${(design.buttonTextSize ?? 'medium') === size ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3 p-3 rounded-xl bg-muted/40 flex items-center justify-center">
          <div className="px-5 py-2.5 rounded-xl font-semibold"
            style={{
              backgroundColor: getButtonBg(design),
              color: getButtonText(design),
              border: design.buttonBorderColor ? `2px solid ${design.buttonBorderColor}` : 'none',
              fontSize: { small: 12, medium: 14, large: 16 }[design.buttonTextSize ?? 'medium'],
            }}>
            Save Contact
          </div>
        </div>
      </div>
      </div>{/* /Button tab */}

      {/* ── TEXT TAB ────────────────────────────────────────────── */}
      <div className="space-y-8" style={{ display: activeTab === 'text' ? 'block' : 'none' }}>

      {/* Typography section - one row per element (Name, Title,
          Company, Bio). Each row exposes a colour swatch + native
          colour picker, and stepper buttons (-) (current %) (+) for
          font size in 10% increments. */}
      <div>
        <label className="block text-sm font-semibold mb-1">Typography</label>
        <p className="text-xs text-muted-foreground mb-4">Adjust the size and colour of each text element</p>

        <div className="space-y-2">
        {(() => {
          type Row = {
            label: string
            sizeKey: 'nameSize' | 'titleSize' | 'companySize' | 'bioSize'
            colorKey: 'nameColor' | 'titleColor' | 'companyColor' | 'bioColor'
            fallbackColor: string
            fallbackLabel: string
          }
          const ROWS: Row[] = [
            { label: 'Name',    sizeKey: 'nameSize',    colorKey: 'nameColor',    fallbackColor: '#ffffff',         fallbackLabel: 'Auto' },
            { label: 'Title',   sizeKey: 'titleSize',   colorKey: 'titleColor',   fallbackColor: currentAccentHex,  fallbackLabel: 'Accent' },
            { label: 'Company', sizeKey: 'companySize', colorKey: 'companyColor', fallbackColor: '#9ca3af',         fallbackLabel: 'Muted' },
            { label: 'Bio',     sizeKey: 'bioSize',     colorKey: 'bioColor',     fallbackColor: '#9ca3af',         fallbackLabel: 'Muted' },
          ]
          return ROWS.map(row => {
            const sizePct = design[row.sizeKey] ?? 100
            const colorValue = design[row.colorKey]
            const isModified = !!colorValue || sizePct !== 100
            return (
              <div key={row.label} className="rounded-xl border border-border bg-card/40 px-3 py-2.5">
                {/* Header row: element label + reset (only when modified) */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{row.label}</p>
                  {isModified && (
                    <button
                      onClick={() => update({ [row.colorKey]: undefined, [row.sizeKey]: 100 } as Partial<CardDesign>)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      title="Reset colour and size to defaults"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {/* Controls row: colour swatch + hex on the left,
                    tight inline size stepper on the right */}
                <div className="flex items-center gap-3">
                  {/* Colour swatch (clickable, opens native picker) */}
                  <input
                    type="color"
                    value={colorValue || row.fallbackColor}
                    onChange={e => update({ [row.colorKey]: e.target.value } as Partial<CardDesign>)}
                    className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent flex-shrink-0"
                    title="Pick a colour"
                  />
                  <span className="text-xs text-muted-foreground font-mono flex-1 min-w-0 truncate">
                    {colorValue || row.fallbackLabel}
                  </span>
                  {/* Tight inline size stepper - all three controls
                      grouped in one bordered pill */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      onClick={() => update({ [row.sizeKey]: Math.max(80, sizePct - 10) } as Partial<CardDesign>)}
                      disabled={sizePct <= 80}
                      className="w-7 h-7 flex items-center justify-center font-bold hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                      aria-label="Decrease size"
                    >
                      −
                    </button>
                    <span className="text-xs font-semibold tabular-nums w-10 text-center border-x border-border py-1">{sizePct}%</span>
                    <button
                      onClick={() => update({ [row.sizeKey]: Math.min(160, sizePct + 10) } as Partial<CardDesign>)}
                      disabled={sizePct >= 160}
                      className="w-7 h-7 flex items-center justify-center font-bold hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                      aria-label="Increase size"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        })()}
        </div>

        {/* Body text size (contact rows + custom links) - kept as a
            3-button toggle since this controls multiple elements at
            once and there's no individual sizing to do here */}
        <div>
          <label className="block text-xs font-medium mb-2">Body text size</label>
          <p className="text-xs text-muted-foreground mb-2">Contact rows and custom links</p>
          <div className="grid grid-cols-3 gap-2">
            {(['small', 'medium', 'large'] as const).map(size => (
              <button key={size}
                onClick={() => update({ bodySize: size })}
                className={`py-2 px-2 rounded-lg border-2 text-xs font-medium transition capitalize ${(design.bodySize ?? 'medium') === size ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Font */}
      <div>
        <label className="block text-sm font-semibold mb-3">Font style</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.entries(FONTS) as [FontId, typeof FONTS[FontId]][]).map(([id, font]) => (
            <button key={id} onClick={() => update({ fontId: id })}
              className={`py-2.5 px-3 rounded-xl border-2 text-sm transition ${design.fontId === id ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-foreground/20'}`}
              style={{ fontFamily: font.heading }}>
              <span className="text-lg font-bold block">{font.sample}</span>
              <span className="text-xs text-muted-foreground">{font.label}</span>
            </button>
          ))}
        </div>
      </div>
      </div>{/* /Text tab */}

      {/* ── PROFILE TAB ─────────────────────────────────────────── */}
      <div className="space-y-8" style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>

      {/* Profile photo border toggle - applies to every template via
          the shared Avatar component */}
      <div>
        <label className="block text-sm font-semibold mb-1">Profile border</label>
        <p className="text-xs text-muted-foreground mb-3">Show or hide the ring around the profile photo</p>
        <div className="flex gap-3">
          <button
            onClick={() => update({ profileBorder: true })}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${(design.profileBorder ?? true) ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
            On
          </button>
          <button
            onClick={() => update({ profileBorder: false })}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${design.profileBorder === false ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
            Off
          </button>
        </div>
      </div>

      {/* Profile photo size */}
      <div>
        <label className="block text-sm font-semibold mb-1">Profile photo size</label>
        <input type="range" min="60" max="160" step="4"
          value={design.profilePhotoSize ?? 100}
          onChange={e => update({ profilePhotoSize: parseInt(e.target.value) })}
          className="w-full accent-blue-500" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Smaller</span><span>{design.profilePhotoSize ?? 100}%</span><span>Larger</span>
        </div>
      </div>

      {/* Hero photo zoom - sits right below the profile photo size so the
          frame + zoom controls are grouped together. Shown for templates
          with a full-bleed hero image (Bold, Executive, Meridian).

          Meridian starts at 100, not 70. Its hero is cropped to fill the
          frame, so the photo is already scaled up to cover it and there is
          nothing to zoom out to: below 100 the image would pull away from
          the edges and leave gaps. Bold and Executive fit the whole photo
          inside their frame, so they have room in both directions. */}
      {(design.templateId === 'bold' || design.templateId === 'executive' || design.templateId === 'meridian') && (
        <div>
          <label className="block text-sm font-semibold mb-1">Photo zoom</label>
          <p className="text-xs text-muted-foreground mb-2">
            {design.templateId === 'meridian'
              ? 'Makes the person larger in the photo above. Use Profile photo size for how tall the photo is.'
              : 'Zooms the photo inside the frame above.'}
          </p>
          <input type="range" min={design.templateId === 'meridian' ? 100 : 70} max="160" step="4"
            value={Math.max(design.templateId === 'meridian' ? 100 : 70, design.boldImageZoom ?? 100)}
            onChange={e => update({ boldImageZoom: parseInt(e.target.value) })}
            className="w-full accent-blue-500" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{design.templateId === 'meridian' ? 'Fills frame' : 'Zoom out'}</span>
            <span>{Math.max(design.templateId === 'meridian' ? 100 : 70, design.boldImageZoom ?? 100)}%</span>
            <span>Zoom in</span>
          </div>
        </div>
      )}

      {/* Logo position */}
      <div>
        <label className="block text-sm font-semibold mb-1">Logo position</label>
        <p className="text-xs text-muted-foreground mb-3">Appears above the bio section</p>
        <div className="grid grid-cols-4 gap-2">
          {LOGO_POSITIONS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => update({ logoPosition: id })}
              className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border-2 text-xs font-medium transition ${design.logoPosition === id ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Logo size */}
      {design.logoPosition !== 'hidden' && (
        <div>
          <label className="block text-sm font-semibold mb-1">Logo size</label>
          {/* Up from 250. A logo is often the only mark a customer recognises,
              and the old ceiling stopped well short of "as big as the name". */}
          <input type="range" min="40" max="400" step="5"
            value={design.logoSize ?? 100}
            onChange={e => update({ logoSize: parseInt(e.target.value) })}
            className="w-full accent-blue-500" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Smaller</span><span>{design.logoSize ?? 100}%</span><span>Larger</span>
          </div>
        </div>
      )}

      {/* Text position — Bold, Executive, Wave, Modern, Neon only */}
      {supportsTextPosition && (
        <div className="border-t border-border pt-6 space-y-5">
          <div>
            <p className="text-sm font-semibold">Text position</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nudge the name and title left/right and up/down</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Left / Right</label>
            <input type="range" min="-40" max="40" step="2"
              value={design.textX ?? 0}
              onChange={e => update({ textX: parseInt(e.target.value) })}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>← Left</span><span>{design.textX ?? 0}px</span><span>Right →</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Up / Down</label>
            <input type="range" min="-40" max="40" step="2"
              value={design.textY ?? 0}
              onChange={e => update({ textY: parseInt(e.target.value) })}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>↑ Up</span><span>{design.textY ?? 0}px</span><span>Down ↓</span>
            </div>
          </div>

          {(design.textX !== 0 || design.textY !== 0) && (
            <button onClick={() => update({ textX: 0, textY: 0 })}
              className="text-xs text-muted-foreground hover:text-foreground underline transition">
              Reset position
            </button>
          )}
        </div>
      )}
      </div>{/* /Profile tab */}

    </div>
  )
}
