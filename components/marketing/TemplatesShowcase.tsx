'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ArrowRight, Sparkles, ImageIcon } from 'lucide-react'

// Marketing template showcase. Uses static screenshots from
// /public/templates/ so each tile shows a real, curated example
// of the template (a populated card with proper photo + branding)
// rather than a scaled-down live component with placeholder data.
//
// Drop screenshots into /public/templates/ with the filenames listed
// in FEATURED below. If a file is missing the tile falls back to a
// gradient placeholder so the page still renders cleanly.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface Featured {
  id: string
  name: string
  tag: string
  // Filename inside /public/templates/. Without the extension —
  // the component tries .webp first, then .png.
  image: string
  // Fallback gradient if the image is missing or still being prepared.
  fallback: string
}

const FEATURED: Featured[] = [
  { id: 'classic',   name: 'Classic',   tag: 'Polished default',
    image: 'template-classic',
    fallback: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' },
  { id: 'modern',    name: 'Modern',    tag: 'Glass + gradient orbs',
    image: 'template-modern',
    fallback: 'radial-gradient(circle at 20% 30%, rgba(0,212,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.4) 0%, transparent 50%), #0a0a14' },
  { id: 'executive', name: 'Executive', tag: 'Editorial luxury',
    image: 'template-executive',
    fallback: 'linear-gradient(180deg, #18181b 0%, #27272a 100%)' },
  { id: 'studio',    name: 'Studio',    tag: 'Smile-curve photo',
    image: 'template-studio',
    fallback: 'linear-gradient(180deg, #0a0a0a 0%, #0a0a0a 50%, #fb923c 50%, #fb923c 100%)' },
  { id: 'wave',      name: 'Wave',      tag: 'Curved hero band',
    image: 'template-wave',
    fallback: 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 60%, #fef3c7 60%, #fef3c7 100%)' },
  { id: 'bold',      name: 'Bold',      tag: 'Split hero',
    image: 'template-bold',
    fallback: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)' },
  { id: 'frost',     name: 'Frost',     tag: 'Soft glass pastel',
    image: 'template-frost',
    fallback: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 60%, #f3e8ff 100%)' },
  { id: 'editorial', name: 'Editorial', tag: 'Magazine spread',
    image: 'template-editorial',
    fallback: 'linear-gradient(135deg, #fef9c3 0%, #fbbf24 100%)' },
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
              One tap to switch.
            </span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Crafted by designers, fully customisable. Try a new look every week &mdash; your data follows you.
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
  // Try webp first (smaller), fall back to png, then fall back to
  // the gradient placeholder.
  const [errored, setErrored] = useState(false)
  const [src, setSrc] = useState(`/templates/${t.image}.webp`)

  return (
    <div
      className="group rounded-3xl overflow-hidden transition-all hover:scale-[1.03] hover:-translate-y-1"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Preview area — 2:3 portrait */}
      <div
        className="relative overflow-hidden"
        style={{
          height: 360,
          background: errored ? t.fallback : '#000',
        }}
      >
        {!errored ? (
          <Image
            src={src}
            alt={`${t.name} template`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover object-top transition-transform group-hover:scale-105"
            onError={() => {
              // Try png if webp failed, then give up to fallback
              if (src.endsWith('.webp')) {
                setSrc(`/templates/${t.image}.png`)
              } else {
                setErrored(true)
              }
            }}
          />
        ) : (
          // Fallback: gradient placeholder with template name
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <ImageIcon className="w-8 h-8 mb-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{t.name}</p>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>screenshot coming</p>
          </div>
        )}

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.85) 100%)' }}
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
