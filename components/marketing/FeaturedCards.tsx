'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

// Rotating showcase of REAL Cardtly users' cards. Pulls 8 cards
// daily from /api/homepage/featured-cards (server-side rotation,
// same 8 all day, fresh 8 tomorrow).
//
// Each tile is a stylised phone frame wrapping a lazy-loaded
// iframe of /card/[slug]. IntersectionObserver gates the iframe
// load so we only fetch them when the section scrolls into view.
// A click on a tile sends the visitor to that card's public page.

interface FeaturedCard {
  slug: string
  name: string
  title: string
  company: string
  profile_image_url: string | null
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function FeaturedCards() {
  const [cards, setCards] = useState<FeaturedCard[] | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/homepage/featured-cards')
      .then(r => r.ok ? r.json() : { cards: [] })
      .then((data: { cards: FeaturedCard[] }) => {
        if (cancelled) return
        if (!data.cards || data.cards.length === 0) {
          // No opted-in cards yet — hide the section quietly so the
          // homepage doesn't have a dead patch
          setHidden(true)
          return
        }
        setCards(data.cards)
      })
      .catch(() => setHidden(true))
    return () => { cancelled = true }
  }, [])

  if (hidden) return null

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
            Live · refreshed daily
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Real cards. <span style={{ background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Real people.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {cards === null
              ? <>Cardtly users featured here today. The lineup refreshes every day.</>
              : cards.length === 1
                ? <>One Cardtly user featured here today. <span className="text-white font-semibold">Be the next.</span></>
                : <>{cards.length} Cardtly {cards.length === 1 ? 'user' : 'users'} featured here today. The lineup refreshes every day.</>
            }
          </p>
        </div>

        {/* Tiles — pad with CTA tiles up to 4 if we don't have enough real
            cards yet. Once 5+ real cards are opted in, we extend to 8. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {cards === null
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonTile key={i} />)
            : (() => {
                const target = cards.length >= 5 ? 8 : 4
                const realTiles = cards.slice(0, target).map(c => <PhoneTile key={c.slug} card={c} />)
                const ctaCount = Math.max(0, target - cards.length)
                const ctaTiles = Array.from({ length: ctaCount }).map((_, i) => <BeNextTile key={`cta-${i}`} index={i} />)
                return [...realTiles, ...ctaTiles]
              })()
          }
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Cards are shown with the holder's explicit consent. Manage your own visibility in <Link href="/dashboard/settings" className="underline hover:text-white">Settings</Link>.
        </p>

        <div className="text-center mt-8">
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 hover:scale-[1.02]"
            style={{ background: grad, boxShadow: '0 8px 28px rgba(124,58,237,0.35)' }}>
            <Sparkles className="w-4 h-4" />
            Get featured here — sign up free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Phone-frame tile with lazy iframe ───────────────────────────

function PhoneTile({ card }: { card: FeaturedCard }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  // Lazy load the iframe only when this tile scrolls into view
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          io.disconnect()
          break
        }
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Link
      href={`/card/${card.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      aria-label={`View ${card.name}'s Cardtly card`}
    >
      {/* Phone bezel */}
      <div
        ref={wrapperRef}
        className="relative rounded-[36px] p-2 transition-all group-hover:scale-[1.03] group-hover:-translate-y-1"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #0a0a14)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 w-14 h-3 rounded-full pointer-events-none"
          style={{ background: '#000', zIndex: 2 }}
        />

        {/* Screen */}
        <div
          className="relative rounded-[28px] overflow-hidden"
          style={{ aspectRatio: '9 / 16', background: '#000' }}
        >
          {shouldLoad ? (
            <iframe
              src={`/card/${card.slug}`}
              title={`${card.name}'s Cardtly card`}
              className="w-full h-full pointer-events-none"
              loading="lazy"
              style={{ border: 0, transform: 'scale(0.85)', transformOrigin: 'top center', width: '117%', height: '117%', marginLeft: '-8.5%' }}
            />
          ) : (
            // Pre-iframe placeholder showing the user's profile photo
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0a0a14, #1a1a2e)' }}>
              {card.profile_image_url ? (
                // Use a regular img (no next/image) because these are arbitrary user URLs
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.profile_image_url}
                  alt={card.name}
                  className="w-20 h-20 rounded-full object-cover opacity-80"
                  style={{ border: '2px solid rgba(255,255,255,0.1)' }}
                />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white"
                  style={{ background: grad }}>
                  {card.name.charAt(0)}
                </div>
              )}
            </div>
          )}

          {/* Hover veil + CTA */}
          <div
            className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85) 100%)' }}
          >
            <div className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: grad, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              View card
            </div>
          </div>
        </div>
      </div>

      {/* Name + role */}
      <div className="text-center mt-4 px-2">
        <p className="font-bold text-sm text-white truncate">{card.name}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {card.title && card.company ? `${card.title} · ${card.company}` : card.title || card.company || 'Cardtly user'}
        </p>
      </div>
    </Link>
  )
}

// "Be the next one" placeholder tile shown when fewer than the
// target number of real cards have opted in. Doubles as a signup
// CTA and visually completes the grid so it never looks half-empty.
function BeNextTile({ index }: { index: number }) {
  return (
    <Link href="/signup" className="group block" aria-label="Sign up to get featured">
      <div
        className="relative rounded-[36px] p-2 transition-all group-hover:scale-[1.03] group-hover:-translate-y-1"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,58,237,0.08), rgba(236,72,153,0.06))',
          border: '1px dashed rgba(255,255,255,0.18)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div
          className="relative rounded-[28px] overflow-hidden flex flex-col items-center justify-center text-center p-6"
          style={{
            aspectRatio: '9 / 16',
            background: 'radial-gradient(circle at 50% 30%, rgba(0,212,255,0.10) 0%, transparent 60%), radial-gradient(circle at 50% 80%, rgba(236,72,153,0.10) 0%, transparent 60%), #0a0a14',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: grad, boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-bold text-white mb-1">Your card here</p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Sign up free<br />and opt in
          </p>
        </div>
      </div>
      <div className="text-center mt-4 px-2">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Open slot {index + 1}</p>
      </div>
    </Link>
  )
}

function SkeletonTile() {
  return (
    <div>
      <div
        className="rounded-[36px] p-2"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #0a0a14)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="rounded-[28px] animate-pulse" style={{ aspectRatio: '9 / 16', background: '#0a0a14' }} />
      </div>
      <div className="text-center mt-4 px-2 space-y-1.5">
        <div className="h-3 rounded animate-pulse mx-auto w-2/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="h-2 rounded animate-pulse mx-auto w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  )
}
