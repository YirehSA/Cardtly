'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

// Lightweight template tiles. These don't render the real
// TemplatedCardPreview (heavy + depends on a full Card object); they're
// stylised mockups that capture each template's vibe. The point is
// "we have a lot of looks, pick yours" — actual previews live in
// /dashboard/card/design.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface TemplateVibe {
  name: string
  tag: string
  bg: string
  accent: string
  text: string
  isDark?: boolean
}

const TEMPLATES: TemplateVibe[] = [
  { name: 'Classic',    tag: 'Polished default',
    bg: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', accent: '#00d4ff', text: '#fff', isDark: true },
  { name: 'Modern',     tag: 'Glass + gradient orbs',
    bg: 'radial-gradient(circle at 20% 30%, rgba(0,212,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.4) 0%, transparent 50%), #0a0a14', accent: '#7c3aed', text: '#fff', isDark: true },
  { name: 'Wave',       tag: 'Curved hero',
    bg: 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 60%, #fef3c7 60%, #fef3c7 100%)', accent: '#fff', text: '#0c4a6e' },
  { name: 'Executive',  tag: 'Editorial luxury',
    bg: 'linear-gradient(180deg, #18181b 0%, #27272a 100%)', accent: '#d4af37', text: '#fff', isDark: true },
  { name: 'Studio',     tag: 'Smile-curve photo',
    bg: 'linear-gradient(180deg, #0a0a0a 0%, #0a0a0a 50%, #fb923c 50%, #fb923c 100%)', accent: '#fb923c', text: '#fff', isDark: true },
  { name: 'Minimal',    tag: 'Icon-led, neon ring',
    bg: '#0a0a0a', accent: '#a855f7', text: '#fff', isDark: true },
  { name: 'Frost',      tag: 'Cool glass',
    bg: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 60%, #f3e8ff 100%)', accent: '#3b82f6', text: '#1e293b' },
  { name: 'Editorial',  tag: 'Magazine spread',
    bg: 'linear-gradient(135deg, #fef9c3 0%, #fbbf24 100%)', accent: '#000', text: '#000' },
]

export default function TemplatesShowcase() {
  return (
    <section className="py-24 px-6 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>Pick your look</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            12 designed templates.<br />
            <span style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              All free to start.
            </span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Crafted by designers, fully customisable. Switch templates anytime — your data follows.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TEMPLATES.map((t, i) => (
            <TemplateTile key={t.name} t={t} index={i} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 28px rgba(124,58,237,0.35)' }}>
            <Sparkles className="w-4 h-4" />
            Browse all 12 templates
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Free tier includes 4 templates. Pro unlocks all 12 plus custom theming.
          </p>
        </div>
      </div>
    </section>
  )
}

function TemplateTile({ t, index }: { t: TemplateVibe; index: number }) {
  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all hover:scale-[1.03]"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Mini card preview */}
      <div
        className="aspect-[3/4] relative p-3 flex flex-col"
        style={{ background: t.bg, color: t.text }}
      >
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center font-black"
          style={{
            background: t.accent,
            color: t.isDark ? '#000' : '#fff',
            fontSize: 18,
          }}
        >
          {['A', 'M', 'S', 'L', 'J', 'P', 'R', 'K'][index % 8]}
        </div>

        {/* Name */}
        <div className="font-bold text-xs leading-tight mb-0.5">Andre Nel</div>
        <div className="text-[10px] opacity-70 mb-3">Founder &amp; CEO</div>

        {/* Mini info bars */}
        <div className="space-y-1 mt-auto">
          {[0.85, 0.65, 0.75].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full" style={{ background: `${t.text}25`, width: `${w * 100}%` }} />
          ))}
        </div>

        {/* CTA pill */}
        <div
          className="mt-3 h-5 rounded-md text-[8px] font-bold flex items-center justify-center"
          style={{
            background: t.accent,
            color: t.isDark ? '#000' : '#fff',
          }}
        >
          SAVE CONTACT
        </div>
      </div>

      {/* Label */}
      <div className="p-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <p className="font-bold text-sm text-white">{t.name}</p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.tag}</p>
      </div>
    </div>
  )
}
