'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

// "Make it yours" section: a live mini-card the visitor restyles
// with real controls (accent colour, font, light/dark). Sits right
// after the templates showcase so the story reads "12 templates -
// and every one is fully yours". The chips below list the rest of
// the design system honestly (all features that exist in
// types/design.ts) without UI for each.

const ACCENTS = [
  { id: 'cyan',   hex: '#00d4ff' },
  { id: 'purple', hex: '#7c3aed' },
  { id: 'pink',   hex: '#ec4899' },
  { id: 'green',  hex: '#22c55e' },
  { id: 'orange', hex: '#f97316' },
  { id: 'gold',   hex: '#eab308' },
]

const FONTS = [
  { id: 'sans',  label: 'Modern',  family: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" },
  { id: 'serif', label: 'Elegant', family: "Georgia, 'Times New Roman', serif" },
  { id: 'mono',  label: 'Tech',    family: "ui-monospace, 'Cascadia Code', Consolas, monospace" },
]

const MORE_CHIPS = [
  'Logo size & position',
  'Custom background colour',
  'Per-text colours & sizes',
  'Button colours',
  'Photo size & border',
  'Glass, flat & gradient styles',
  'Custom hex - any colour',
  'Photo galleries & links',
]

const gradText: React.CSSProperties = {
  background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export default function CustomizeShowcase() {
  const [accent, setAccent] = useState(ACCENTS[0])
  const [font, setFont] = useState(FONTS[0])
  const [lightMode, setLightMode] = useState(false)

  const cardBg = lightMode ? '#f4f4f7' : '#0d0d1a'
  const textMain = lightMode ? '#0d0d1a' : '#ffffff'
  const textMuted = lightMode ? 'rgba(13,13,26,0.55)' : 'rgba(255,255,255,0.55)'
  const rowBg = lightMode ? 'rgba(13,13,26,0.06)' : 'rgba(255,255,255,0.08)'

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>
            Make it yours
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Every template. <span style={gradText}>Infinitely yours.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Colours, fonts, logo, backgrounds, even the size and colour of every line of text.
            Try it - restyle this card right here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Live mini card */}
          <div className="flex justify-center">
            <div className="w-72 rounded-3xl overflow-hidden transition-all duration-300"
              style={{
                background: cardBg,
                border: `1px solid ${lightMode ? 'rgba(13,13,26,0.12)' : 'rgba(255,255,255,0.12)'}`,
                boxShadow: `0 30px 80px ${accent.hex}40`,
              }}>
              <div className="h-20 transition-all duration-300"
                style={{ background: `linear-gradient(135deg, ${accent.hex}55, ${accent.hex}22)` }} />
              <div className="px-6 pb-6 text-center" style={{ marginTop: -32 }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white transition-all duration-300"
                  style={{ background: accent.hex, boxShadow: `0 8px 24px ${accent.hex}66` }}>
                  T
                </div>
                <p className="font-bold text-lg transition-all duration-300" style={{ color: textMain, fontFamily: font.family }}>
                  Thandi Mokoena
                </p>
                <p className="text-sm font-medium transition-all duration-300" style={{ color: accent.hex, fontFamily: font.family }}>
                  Sales Director
                </p>
                <p className="text-xs mt-0.5" style={{ color: textMuted, fontFamily: font.family }}>
                  Horizon Group
                </p>
                <div className="mt-4 space-y-2">
                  {['+27 83 555 0119', 'thandi@horizon.co.za'].map(item => (
                    <div key={item} className="text-xs py-2 px-3 rounded-xl text-left transition-all duration-300"
                      style={{ background: rowBg, color: textMuted, fontFamily: font.family }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-300"
                  style={{ background: accent.hex }}>
                  Save Contact
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Accent colour
              </p>
              <div className="flex gap-3 flex-wrap">
                {ACCENTS.map(a => (
                  <button key={a.id} onClick={() => setAccent(a)}
                    aria-label={`Set accent colour to ${a.id}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      background: a.hex,
                      boxShadow: accent.id === a.id ? `0 0 0 3px #000, 0 0 0 5px ${a.hex}` : 'none',
                    }}>
                    {accent.id === a.id && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60"
                  style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', filter: 'saturate(0.7)' }}
                  title="Pro: pick any custom hex colour">
                  ANY
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Font
              </p>
              <div className="flex gap-2 flex-wrap">
                {FONTS.map(f => (
                  <button key={f.id} onClick={() => setFont(f)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      fontFamily: f.family,
                      background: font.id === f.id ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${font.id === f.id ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: font.id === f.id ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Mode
              </p>
              <div className="flex gap-2">
                {[{ v: false, label: '🌙 Dark' }, { v: true, label: '☀️ Light' }].map(({ v, label }) => (
                  <button key={label} onClick={() => setLightMode(v)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: lightMode === v ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${lightMode === v ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: lightMode === v ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                And in the full editor
              </p>
              <div className="flex gap-2 flex-wrap">
                {MORE_CHIPS.map(chip => (
                  <span key={chip} className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
