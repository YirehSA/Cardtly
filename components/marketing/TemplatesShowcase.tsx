'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

// Compact templates strip — 12 stylised mini-previews showing the
// vibe of each template at a glance. Not photo-realistic; the point
// is "look how much design variety we have" not "look at this specific
// card". Real preview previews live in /dashboard/card/design.
//
// Each tile is a self-contained gradient mock — no screenshot loading,
// no placeholder boxes, never empty.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface MiniTemplate {
  name: string
  tag: string
  // Visual signature — the template's distinct look reduced to a small composition.
  render: () => React.ReactNode
}

const TEMPLATES: MiniTemplate[] = [
  {
    name: 'Classic', tag: 'Polished default',
    render: () => (
      <MockCard bg="linear-gradient(180deg, #1e293b, #0f172a)" accent="#3b82f6" textColor="#fff" avatarRound />
    ),
  },
  {
    name: 'Modern', tag: 'Glass orbs',
    render: () => (
      <MockCard
        bg="radial-gradient(circle at 15% 25%, rgba(0,212,255,0.55) 0%, transparent 50%), radial-gradient(circle at 85% 75%, rgba(236,72,153,0.55) 0%, transparent 50%), #0a0a14"
        accent="#7c3aed" textColor="#fff" glass avatarRound />
    ),
  },
  {
    name: 'Bold', tag: 'Split hero',
    render: () => (
      <div className="absolute inset-0 flex">
        <div className="w-2/5" style={{ background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)' }} />
        <div className="w-3/5 p-2 flex flex-col gap-1.5 justify-center" style={{ background: '#0a0a14' }}>
          <div className="h-1 rounded-full w-2/3" style={{ background: '#fff' }} />
          <div className="h-0.5 rounded-full w-1/2" style={{ background: '#a855f7' }} />
          <div className="h-0.5 rounded-full w-2/5" style={{ background: '#666' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'Minimal', tag: 'Icon-led, neon ring',
    render: () => (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="relative">
          <div className="w-10 h-10 rounded-full" style={{ background: '#0a0a0a', border: '2px solid', borderImage: 'linear-gradient(135deg, #00d4ff, #a855f7, #ec4899) 1' }} />
          <div className="absolute -inset-1 rounded-full blur-md opacity-60" style={{ background: 'linear-gradient(135deg, #00d4ff, #a855f7, #ec4899)' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'Executive', tag: 'Editorial luxury',
    render: () => (
      <MockCard
        bg="linear-gradient(180deg, #18181b, #27272a)"
        accent="#d4af37" textColor="#fff" avatarSquare
        extra={
          <div className="absolute top-0 right-0 w-1.5 h-full" style={{ background: '#d4af37' }} />
        } />
    ),
  },
  {
    name: 'Creative', tag: 'Radial glow',
    render: () => (
      <div className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 50% 40%, #8b5cf6 0%, #4c1d95 40%, #0a0a14 100%)' }}>
        <div className="w-9 h-9 rounded-full" style={{ background: '#ec4899', boxShadow: '0 0 16px rgba(236,72,153,0.7), 0 0 0 2px rgba(255,255,255,0.2)' }} />
      </div>
    ),
  },
  {
    name: 'Wave', tag: 'Curved hero',
    render: () => (
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, #0ea5e9, #0284c7)' }} />
        <svg className="absolute left-0 right-0" style={{ top: '46%' }} viewBox="0 0 100 12" preserveAspectRatio="none" width="100%" height="14">
          <path d="M0,6 Q25,12 50,6 T100,6 L100,12 L0,12 Z" fill="#fef3c7" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: '#fef3c7' }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-[34%] w-8 h-8 rounded-full" style={{ background: '#fff', border: '2px solid #fef3c7' }} />
        <div className="absolute inset-x-0 bottom-2 px-2 flex flex-col items-center gap-1">
          <div className="h-1 rounded-full w-1/2" style={{ background: '#0c4a6e' }} />
          <div className="h-0.5 rounded-full w-1/3" style={{ background: '#0c4a6e88' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'Split', tag: 'Sidebar accent',
    render: () => (
      <div className="absolute inset-0 flex" style={{ background: '#0a0a14' }}>
        <div className="w-1/4" style={{ background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)' }} />
        <div className="flex-1 p-2 flex flex-col justify-center gap-1.5">
          <div className="w-7 h-7 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="h-0.5 rounded-full w-2/3 mt-1" style={{ background: '#fff' }} />
          <div className="h-0.5 rounded-full w-1/2" style={{ background: '#3b82f6' }} />
          <div className="h-0.5 rounded-full w-2/5" style={{ background: '#666' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'Neon', tag: 'Cyberpunk glow',
    render: () => (
      <div className="absolute inset-2 rounded-lg flex items-center justify-center"
        style={{
          background: '#0a0a14',
          border: '1px solid #06b6d4',
          boxShadow: '0 0 12px rgba(6,182,212,0.6), inset 0 0 12px rgba(6,182,212,0.2)',
        }}>
        <div className="w-8 h-8 rounded-full"
          style={{ background: '#0a0a14', border: '1.5px solid #06b6d4', boxShadow: '0 0 8px rgba(6,182,212,0.8)' }} />
      </div>
    ),
  },
  {
    name: 'Studio', tag: 'Smile-curve',
    render: () => (
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{ background: '#0a0a0a' }} />
        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 100 50" preserveAspectRatio="none" height="50%">
          <path d="M0,50 L0,30 Q50,5 100,30 L100,50 Z" fill="#fb923c" />
        </svg>
        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full" style={{ background: '#fff', border: '2px solid #fb923c' }} />
      </div>
    ),
  },
  {
    name: 'Frost', tag: 'Soft glass',
    render: () => (
      <div className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #f3e8ff 100%)' }}>
        <div className="w-2/3 h-2/3 rounded-lg p-2 flex flex-col items-center justify-center gap-1"
          style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="w-6 h-6 rounded-full" style={{ background: '#3b82f6' }} />
          <div className="h-0.5 rounded-full w-2/3" style={{ background: '#1e3a8a' }} />
          <div className="h-0.5 rounded-full w-1/2" style={{ background: '#3b82f6aa' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'Editorial', tag: 'Magazine spread',
    render: () => (
      <div className="absolute inset-0 p-3 flex flex-col gap-1.5"
        style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)' }}>
        <div className="h-1 rounded-full w-full" style={{ background: '#000' }} />
        <div className="h-2 rounded-full w-4/5" style={{ background: '#000' }} />
        <div className="h-0.5 rounded-full w-2/3" style={{ background: '#a16207' }} />
        <div className="flex-1" />
        <div className="h-0.5 rounded-full w-full" style={{ background: '#000' }} />
        <div className="h-0.5 rounded-full w-3/4" style={{ background: '#a16207' }} />
      </div>
    ),
  },
]

export default function TemplatesShowcase() {
  return (
    <section className="py-16 px-6 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#ec4899' }}>Pick your look</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            12 designed templates.{' '}
            <span style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              One tap to switch.
            </span>
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            All 12 looks below. Switch any time &mdash; your data follows.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {TEMPLATES.map((t) => (
            <MiniTile key={t.name} t={t} />
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 hover:scale-[1.02]"
            style={{ background: grad, boxShadow: '0 8px 20px rgba(124,58,237,0.3)' }}>
            <Sparkles className="w-4 h-4" />
            Try them all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Tile ─────────────────────────────────────────────────────────

function MiniTile({ t }: { t: MiniTemplate }) {
  return (
    <div
      className="group rounded-xl overflow-hidden transition-all hover:scale-[1.05] hover:-translate-y-0.5 cursor-default"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <div className="relative" style={{ aspectRatio: '3 / 4', background: '#0a0a14' }}>
        {t.render()}
        {/* Subtle vignette so light templates don't blow out against the dark page */}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 -20px 30px -20px rgba(0,0,0,0.4)' }} />
      </div>
      <div className="px-2 py-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <p className="font-bold text-xs text-white truncate">{t.name}</p>
        <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.tag}</p>
      </div>
    </div>
  )
}

// Generic "mock card" used by several of the template miniatures.
// Renders a tiny avatar + content lines on a background.
function MockCard({
  bg, accent, textColor, avatarRound, avatarSquare, glass, extra,
}: {
  bg: string
  accent: string
  textColor: string
  avatarRound?: boolean
  avatarSquare?: boolean
  glass?: boolean
  extra?: React.ReactNode
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-2 gap-1" style={{ background: bg }}>
      {extra}
      <div
        className={avatarSquare ? 'rounded-md' : 'rounded-full'}
        style={{
          width: 30, height: 30,
          background: glass ? 'rgba(255,255,255,0.08)' : accent,
          border: glass ? '1px solid rgba(255,255,255,0.15)' : 'none',
          backdropFilter: glass ? 'blur(8px)' : undefined,
        }}
      />
      <div className="h-1 rounded-full w-1/2 mt-1" style={{ background: textColor }} />
      <div className="h-0.5 rounded-full w-2/5" style={{ background: accent }} />
      <div className="h-0.5 rounded-full w-1/3" style={{ background: textColor + '66' }} />
    </div>
  )
}
