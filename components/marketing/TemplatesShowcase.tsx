'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import {
  TEMPLATES as TEMPLATE_CONFIGS,
  DEFAULT_DESIGN,
  CardDesign,
  TemplateId,
  AccentColor,
  BgMode,
} from '@/types/design'
import TemplatedCardPreview from '@/components/card/TemplatedCardPreview'

// Real template previews — uses the actual TemplatedCardPreview the
// dashboard renders, with populated sample data so each tile looks
// like a real card. Larger tiles than before so the card content
// is readable, fewer templates (6 not 12) so each has breathing room.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// Realistic card content. Photo URL is hosted on the project's
// Supabase storage — same photo Andre uses on his real card, so the
// preview reads as a real person, not a placeholder.
const SAMPLE_FORM = {
  name: 'Andre Nel',
  title: 'Founder & CEO',
  company: 'Yireh Business Solutions',
  bio: 'Building digital products that connect South African businesses with their customers.',
  email: 'andre@yireh.co.za',
  phone: '+27 82 555 1234',
  whatsapp: '+27 82 555 1234',
  address: 'Pretoria',
  website: 'yireh.co.za',
  profile_image_url: 'https://xdrvryzsfrvfekntszcj.supabase.co/storage/v1/object/public/card-images/79fdac2e-b7d1-4433-8fc6-e28d23ef9495/1779866585813-nobg.png',
  company_logo_url: '',
  certifications: 'Web · Brand · NFC',
  link_1_title: 'Portfolio', link_1_url: 'https://yireh.co.za',
  link_2_title: '',          link_2_url: '',
  link_3_title: '',          link_3_url: '',
}

interface Featured {
  id: TemplateId
  name: string
  tag: string
  accent: AccentColor
  bgMode?: BgMode
}

// All 12 templates. Tiles are small enough that showing the full
// set proves the "12 vibes" claim instead of just teasing it. Each
// gets a hand-picked accent so it reads distinctly in the grid.
const FEATURED: Featured[] = [
  { id: 'classic',   name: 'Classic',   tag: 'Polished default',          accent: 'blue'   },
  { id: 'modern',    name: 'Modern',    tag: 'Glass + orbs',              accent: 'pink'   },
  { id: 'bold',      name: 'Bold',      tag: 'Split hero',                accent: 'purple' },
  { id: 'minimal',   name: 'Minimal',   tag: 'Neon ring',                 accent: 'purple' },
  { id: 'executive', name: 'Executive', tag: 'Editorial luxury',          accent: 'gold'   },
  { id: 'creative',  name: 'Creative',  tag: 'Radial glow',               accent: 'pink'   },
  { id: 'wave',      name: 'Wave',      tag: 'Curved hero',               accent: 'teal'   },
  { id: 'split',     name: 'Split',     tag: 'Sidebar accent',            accent: 'blue'   },
  { id: 'neon',      name: 'Neon',      tag: 'Cyberpunk glow',            accent: 'teal'   },
  { id: 'studio',    name: 'Studio',    tag: 'Smile-curve',               accent: 'orange' },
  { id: 'frost',     name: 'Frost',     tag: 'Soft glass',                accent: 'blue',  bgMode: 'light' },
  { id: 'editorial', name: 'Editorial', tag: 'Magazine spread',           accent: 'red',   bgMode: 'light' },
]

export default function TemplatesShowcase() {
  return (
    <section className="py-20 px-6 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>Pick your look</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
            One card.{' '}
            <span style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Twelve vibes.
            </span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Same card data, different templates. Switch any time, takes one tap.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FEATURED.map((t) => (
            <TemplateTile key={t.id} t={t} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 hover:scale-[1.02]"
            style={{ background: grad, boxShadow: '0 8px 28px rgba(124,58,237,0.35)' }}>
            <Sparkles className="w-4 h-4" />
            Pick yours
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Pro unlocks all 12 templates plus custom theming.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Tile ─────────────────────────────────────────────────────────

function TemplateTile({ t }: { t: Featured }) {
  const templateConfig = TEMPLATE_CONFIGS.find(tc => tc.id === t.id)
  const design: CardDesign = {
    ...DEFAULT_DESIGN,
    templateId: t.id,
    accentColor: t.accent,
    bgMode: t.bgMode || templateConfig?.defaultBgMode || 'dark',
  }

  return (
    <Link
      href="/signup"
      className="group block"
      aria-label={`Try the ${t.name} template`}
    >
      {/* Small phone-style frame */}
      <div
        className="relative rounded-2xl p-1 transition-all group-hover:scale-[1.04] group-hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #0a0a14)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Screen — 3:4 instead of 9:16 to keep tiles compact */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{ aspectRatio: '3 / 4', background: '#000' }}
        >
          {/* Real TemplatedCardPreview scaled down. Smaller tile +
              tighter scale so the visible portion is the card hero,
              which is where each template's identity lives. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '286%',
              height: '286%',
              transform: 'scale(0.35)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <TemplatedCardPreview
              form={SAMPLE_FORM}
              isPro={true}
              design={design}
            />
          </div>

          {/* Hover veil + CTA */}
          <div
            className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.85) 100%)' }}
          >
            <div className="px-2 py-1 rounded-full text-[10px] font-bold text-white"
              style={{ background: grad }}>
              Try this
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center mt-2 px-1">
        <p className="font-bold text-xs text-white truncate">{t.name}</p>
        <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.tag}</p>
      </div>
    </Link>
  )
}
