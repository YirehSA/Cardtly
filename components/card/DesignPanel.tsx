'use client'

import {
  TEMPLATES, ACCENT_COLORS, FONTS, CardDesign,
  TemplateId, AccentColor, FontId, LogoPosition, CardStyle, BgMode,
} from '@/types/design'
import { Check, Lock, Sun, Moon } from 'lucide-react'
import Link from 'next/link'

interface Props {
  design: CardDesign
  onChange: (design: CardDesign) => void
  isPro: boolean
}

export default function DesignPanel({ design, onChange, isPro }: Props) {
  function update(patch: Partial<CardDesign>) {
    onChange({ ...design, ...patch })
  }

  return (
    <div className="space-y-8">

      {/* Template picker */}
      <div>
        <label className="block text-sm font-semibold mb-3">Template</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const locked = t.proOnly && !isPro
            const active = design.templateId === t.id
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (locked) return
                  update({ templateId: t.id, bgMode: t.defaultBgMode })
                }}
                className={`relative rounded-xl overflow-hidden border-2 transition text-left ${
                  active ? 'border-blue-500' : 'border-border hover:border-foreground/20'
                } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`h-16 bg-gradient-to-br ${t.previewGradient} relative`}>
                  {active && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {locked && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-black/40 rounded-full flex items-center justify-center">
                      <Lock className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 space-y-1">
                    <div className="h-1.5 bg-white/20 rounded w-3/4" />
                    <div className="h-1 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
                <div className="p-2 bg-card">
                  <p className="text-xs font-semibold leading-tight">{t.name}</p>
                  {locked && <p className="text-xs text-muted-foreground">Pro</p>}
                </div>
              </button>
            )
          })}
        </div>
        {!isPro && (
          <p className="text-xs text-muted-foreground mt-2">
            <Link href="/dashboard/upgrade" className="text-primary underline">Upgrade to Pro</Link>
            {' '}to unlock all templates.
          </p>
        )}
      </div>

      {/* Background mode */}
      <div>
        <label className="block text-sm font-semibold mb-3">Background</label>
        <div className="flex gap-3">
          {([
            { id: 'dark' as BgMode, label: 'Dark', icon: Moon },
            { id: 'light' as BgMode, label: 'Light', icon: Sun },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => update({ bgMode: id })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                design.bgMode === id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : 'border-border hover:border-foreground/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent colour */}
      <div>
        <label className="block text-sm font-semibold mb-3">Accent colour</label>
        <div className="flex flex-wrap gap-3">
          {(Object.entries(ACCENT_COLORS) as [AccentColor, typeof ACCENT_COLORS[AccentColor]][]).map(([id, color]) => (
            <button
              key={id}
              onClick={() => update({ accentColor: id })}
              title={color.label}
              className={`w-9 h-9 rounded-full border-2 transition hover:scale-110 ${
                design.accentColor === id ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <label className="block text-sm font-semibold mb-3">Font style</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.entries(FONTS) as [FontId, typeof FONTS[FontId]][]).map(([id, font]) => (
            <button
              key={id}
              onClick={() => update({ fontId: id })}
              className={`py-2.5 px-3 rounded-xl border-2 text-sm transition ${
                design.fontId === id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-border hover:border-foreground/20'
              }`}
              style={{ fontFamily: font.heading }}
            >
              <span className="text-lg font-bold block">{font.sample}</span>
              <span className="text-xs text-muted-foreground">{font.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Profile photo size */}
      <div>
        <label className="block text-sm font-semibold mb-1">Profile photo size</label>
        <p className="text-xs text-muted-foreground mb-3">Drag to resize your profile photo on the card</p>
        <input
          type="range" min="60" max="160" step="4"
          value={design.profilePhotoSize ?? 100}
          onChange={e => update({ profilePhotoSize: parseInt(e.target.value) })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Smaller</span>
          <span>{design.profilePhotoSize ?? 100}%</span>
          <span>Larger</span>
        </div>
      </div>

      {/* Logo size */}
      <div>
        <label className="block text-sm font-semibold mb-1">Logo size</label>
        <p className="text-xs text-muted-foreground mb-3">Drag to resize your company logo on the card</p>
        <input
          type="range" min="40" max="140" step="4"
          value={design.logoSize ?? 100}
          onChange={e => update({ logoSize: parseInt(e.target.value) })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Smaller</span>
          <span>{design.logoSize ?? 100}%</span>
          <span>Larger</span>
        </div>
      </div>

      {/* Logo position */}
      <div>
        <label className="block text-sm font-semibold mb-3">Logo position</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'top-left' as LogoPosition, label: 'Top left' },
            { id: 'top-right' as LogoPosition, label: 'Top right' },
            { id: 'below-name' as LogoPosition, label: 'Below name' },
            { id: 'hidden' as LogoPosition, label: 'Hidden' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => update({ logoPosition: id })}
              className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition ${
                design.logoPosition === id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : 'border-border hover:border-foreground/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Card style */}
      <div>
        <label className="block text-sm font-semibold mb-3">Card style</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'flat' as CardStyle, label: 'Flat' },
            { id: 'glass' as CardStyle, label: 'Glass' },
            { id: 'gradient' as CardStyle, label: 'Gradient' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => update({ cardStyle: id })}
              className={`py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                design.cardStyle === id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : 'border-border hover:border-foreground/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
