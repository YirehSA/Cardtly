'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { TEMPLATES, DEFAULT_DESIGN, CardDesign, TemplateId, AccentColor, BgMode } from '@/types/design'
import TemplatedCardPreview from '@/components/card/TemplatedCardPreview'

// Real template previews — same component the dashboard design picker
// uses, just scaled down inside a fixed-height tile so the whole card
// fits in a clean card-shaped frame. The user sees exactly what they
// would get if they picked that template.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// Realistic sample card so the templates look populated, not empty.
const SAMPLE_FORM = {
  name: 'Andre Nel',
  title: 'Founder & CEO',
  company: 'Yireh',
  bio: 'Building digital products that connect people across the African continent.',
  email: 'andre@yireh.co.za',
  phone: '+27 82 555 1234',
  whatsapp: '+27 82 555 1234',
  address: 'Pretoria, South Africa',
  website: 'yireh.co.za',
  profile_image_url: '',
  company_logo_url: '',
  certifications: 'Web Design, SEO, Brand',
  link_1_title: 'Portfolio', link_1_url: 'https://yireh.co.za',
  link_2_title: '',          link_2_url: '',
  link_3_title: '',          link_3_url: '',
}

// 8 of the 12 templates that have the most visual variety, paired
// with sensible accents so each tile looks distinct in the grid.
interface Featured {
  id: TemplateId
  name: string
  tag: string
  accent: AccentColor
  bgMode?: BgMode
}

const FEATURED: Featured[] = [
  { id: 'classic',   name: 'Classic',   tag: 'Polished default',         accent: 'blue'   },
  { id: 'modern',    name: 'Modern',    tag: 'Glass + gradient orbs',     accent: 'pink'   },
  { id: 'executive', name: 'Executive', tag: 'Editorial luxury',          accent: 'gold'   },
  { id: 'studio',    name: 'Studio',    tag: 'Smile-curve photo',         accent: 'orange' },
  { id: 'wave',      name: 'Wave',      tag: 'Curved hero band',          accent: 'teal'   },
  { id: 'bold',      name: 'Bold',      tag: 'Split hero',                accent: 'purple' },
  { id: 'frost',     name: 'Frost',     tag: 'Soft glass pastel',         accent: 'blue',  bgMode: 'light' },
  { id: 'editorial', name: 'Editorial', tag: 'Magazine spread',           accent: 'red',   bgMode: 'light' },
]

export default function TemplatesShowcase() {
  return (
    <section className="py-24 px-6 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>Pick your look</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            12 designed templates.<br />
            <span style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              All real. All yours.
            </span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Crafted by designers, fully customisable. Switch templates anytime &mdash; your data follows.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURED.map((t) => (
            <TemplateTile key={t.id} t={t} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 hover:scale-[1.02]"
            style={{ background: grad, boxShadow: '0 8px 28px rgba(124,58,237,0.35)' }}>
            <Sparkles className="w-4 h-4" />
            Try all 12 templates
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Free tier includes Classic. Pro unlocks the other 11 plus custom theming.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Tile ─────────────────────────────────────────────────────────

function TemplateTile({ t }: { t: Featured }) {
  // Build a CardDesign for this template (defaults + featured overrides)
  const templateConfig = TEMPLATES.find(tc => tc.id === t.id)
  const design: CardDesign = {
    ...DEFAULT_DESIGN,
    templateId: t.id,
    accentColor: t.accent,
    bgMode: t.bgMode || templateConfig?.defaultBgMode || 'dark',
  }

  return (
    <div
      className="group rounded-3xl overflow-hidden transition-all hover:scale-[1.03] hover:-translate-y-1"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Real template preview, scaled to fit the tile */}
      <div
        className="relative overflow-hidden"
        style={{ height: 320, background: '#000' }}
      >
        {/* Scaled inner — 0.4 means inner box is 250% the size of outer */}
        <div
          style={{
            transform: 'scale(0.4)',
            transformOrigin: 'top left',
            width: '250%',
            height: '250%',
            pointerEvents: 'none',
          }}
        >
          <TemplatedCardPreview
            form={SAMPLE_FORM}
            isPro={true}
            design={design}
          />
        </div>

        {/* Subtle hover overlay with "Try this" hint */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.8) 100%)' }}
        >
          <div
            className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: grad, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
          >
            Try this template
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="font-bold text-base text-white">{t.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.tag}</p>
      </div>
    </div>
  )
}
