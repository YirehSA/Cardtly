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
import CardPreview from '@/components/card/CardPreview'

// Real template previews - renders the actual card the
// dashboard renders, with populated sample data so each tile looks
// like a real card. Larger tiles than before so the card content
// is readable, fewer templates (6 not 12) so each has breathing room.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// Realistic card content. Photo URL is hosted on the project's
// Supabase storage — same photo Andre uses on his real card, so the
// preview reads as a real person, not a placeholder.
// Tio's real card, which is Cardtly's own. A sample shown to every visitor
// and to every customer opening the template picker has to be a card the
// company actually owns - the previous one used a stock face that is not
// ours. It doubles as a fair test of the templates: a real photograph, a real
// logo, a bio long enough to wrap, and socials.
const SAMPLE_FORM = {
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

// All 15 templates. Tiles are small enough that showing the full set proves
// the claim instead of just teasing it. Each gets a hand-picked accent so it
// reads distinctly in the grid.
//
// This list is checked against TEMPLATES at module load: a template added to
// the product and not to here would quietly go unadvertised, which is how the
// grid came to be three short.
const FEATURED: Featured[] = [
  { id: 'classic',   name: 'Classic',   tag: 'Polished default',          accent: 'blue'   },
  { id: 'modern',    name: 'Modern',    tag: 'Glass + orbs',              accent: 'pink'   },
  { id: 'bold',      name: 'Bold',      tag: 'Split hero',                accent: 'purple' },
  { id: 'minimal',   name: 'Minimal',   tag: 'Neon ring',                 accent: 'purple' },
  { id: 'executive', name: 'Executive', tag: 'Editorial luxury',          accent: 'gold'   },
  { id: 'creative',  name: 'Creative',  tag: 'Radial glow',               accent: 'pink'   },
  { id: 'wave',      name: 'Wave',      tag: 'Curved hero',               accent: 'teal'   },
  { id: 'split',     name: 'Split',     tag: 'Sidebar accent',            accent: 'blue'   },
  { id: 'splitpro',  name: 'Split Pro',  tag: 'Contacts in the rail',      accent: 'blue'   },
  { id: 'circuit',   name: 'Circuit',   tag: 'Ribbons + traces',          accent: 'gold'   },
  { id: 'meridian',  name: 'Meridian',  tag: 'Full-bleed portrait',       accent: 'gold'   },
  { id: 'neon',      name: 'Neon',      tag: 'Cyberpunk glow',            accent: 'teal'   },
  { id: 'studio',    name: 'Studio',    tag: 'Smile-curve',               accent: 'orange' },
  { id: 'frost',     name: 'Frost',     tag: 'Soft glass',                accent: 'blue',  bgMode: 'light' },
  { id: 'editorial', name: 'Editorial', tag: 'Magazine spread',           accent: 'red',   bgMode: 'light' },
]

if (FEATURED.length !== TEMPLATE_CONFIGS.length) {
  throw new Error(
    `TemplatesShowcase: ${FEATURED.length} tiles for ${TEMPLATE_CONFIGS.length} templates. ` +
    'Every template has to appear in the grid.'
  )
}

export default function TemplatesShowcase() {
  return (
    <section className="py-20 px-6 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

      <div className="max-w-[1400px] mx-auto relative">
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
            Pro unlocks all 15 templates plus custom theming.
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

  // The link is a sibling laid over the tile, not a wrapper around it. The
  // preview renders the real card, and the real card is full of anchors -
  // an <a> inside an <a> is invalid HTML, and React's hydration gave up on
  // the whole section when it hit one, leaving the grid blank.
  return (
    <div className="group block relative">
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
          {/* The real card, cropped to its hero - which is where each
              template's identity lives. */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <CardPreview form={SAMPLE_FORM} isPro={true} design={design} frameHeight={900} />
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

      <Link
        href="/signup"
        className="absolute inset-0 z-20"
        aria-label={`Try the ${t.name} template`}
      />
    </div>
  )
}
