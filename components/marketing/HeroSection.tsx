'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Wand2 } from 'lucide-react'

// Two columns: the pitch on the left, the cards on the right.
//
// A full-width type-led version sized the headline at 8.6vw, which is 124px on
// the 1440 screen it was built on and 159px on an 1850 one. It looked deliberate
// where it was tested and wrong on a wider monitor. Type sizes are capped in rem
// here so they stop growing past a sensible point.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export default function HeroSection() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [hovering, setHovering] = useState(false)

  // Live personalisation: the visitor types their name and the demo card
  // becomes theirs. The claim button carries the name into signup.
  const [visitorName, setVisitorName] = useState('')
  const trimmedName = visitorName.trim()
  const firstName = trimmedName.split(/\s+/)[0] || ''
  const displayName = trimmedName || 'Andre Nel'
  const displayInitial = (firstName[0] || 'A').toUpperCase()
  const displayEmail = firstName
    ? `${firstName.toLowerCase().replace(/[^a-z]/g, '')}@yourcompany.co.za`
    : 'hello@yireh.co.za'
  const displayCompany = trimmedName ? 'Your Company Name' : 'Yireh Business Solutions'
  const previewSlug = trimmedName
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40)

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTilt({
      ry: ((e.clientX - r.left) / r.width - 0.5) * 16,
      rx: (0.5 - (e.clientY - r.top) / r.height) * 12,
    })
  }
  function handleLeave() { setHovering(false); setTilt({ rx: 0, ry: 0 }) }

  const [ambient, setAmbient] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      setAmbient(Math.sin((now - start) / 2000) * 1.4)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const rx = hovering ? tilt.rx : ambient
  const ry = hovering ? tilt.ry : ambient * 0.6

  return (
    <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-20 lg:pt-40 lg:pb-24">
      {/* Ambient light */}
      <div className="absolute -top-40 left-[8%] w-[760px] h-[760px] rounded-full blur-[150px] pointer-events-none animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.18) 0%, rgba(124,58,237,0.10) 50%, transparent 72%)' }} />
      <div className="absolute -bottom-56 right-[2%] w-[640px] h-[640px] rounded-full blur-[130px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16) 0%, transparent 72%)' }} />

      <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center"
        style={{ maxWidth: 1500, zIndex: 2 }}>

        {/* ── Left: the pitch ─────────────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <h1 className="font-black tracking-[-0.02em] leading-[1.04] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
            More leads.<br />
            More meetings.<br />
            <span style={gradText}>More sales.</span>
          </h1>

          <p className="text-lg xl:text-xl mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0"
            style={{ color: 'rgba(255,255,255,0.62)' }}>
            One branded <strong className="text-white font-semibold">digital business card</strong> for everyone on your
            team. They tap, the lead lands in your contacts, and you can see which reps are getting opened.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-7">
            <Link href="/signup"
              className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
              Get your card free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#teams"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(8px)' }}>
              Cardtly for teams
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm mb-8"
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            {['60 days free', 'No credit card', 'R97 a card after', 'Live in 2 minutes'].map(t => (
              <span key={t} className="flex items-center gap-1.5 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />{t}
              </span>
            ))}
          </div>

          <div className="max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: trimmedName ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                boxShadow: trimmedName ? '0 0 30px rgba(0,212,255,0.25)' : 'none',
              }}>
              <Wand2 className="w-4 h-4 flex-shrink-0" style={{ color: trimmedName ? '#00d4ff' : 'rgba(255,255,255,0.4)' }} />
              <input
                type="text" value={visitorName} onChange={e => setVisitorName(e.target.value)} maxLength={50}
                placeholder="Type your name — see your card"
                aria-label="Type your name to preview your digital business card"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
            {previewSlug && (
              <div className="mt-4 animate-fade-in">
                <Link href={`/signup?name=${encodeURIComponent(trimmedName)}`}
                  className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.03]"
                  style={{ background: grad, boxShadow: '0 8px 40px rgba(0,212,255,0.4)' }}>
                  Claim your link
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: the printed card and the live one ────────────────── */}
        <div className="flex justify-center">
          <div className="relative inline-block" style={{ perspective: '1200px' }}
            onMouseMove={handleMove} onMouseEnter={() => setHovering(true)} onMouseLeave={handleLeave}>

            {/* The printed card, behind and to the left */}
            <div className="absolute inset-0 hidden sm:block pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nfc-samples/sicon-front.jpg"
                alt="A printed Cardtly NFC business card with full-bleed custom artwork"
                width={1200} height={767}
                className="absolute rounded-2xl"
                style={{
                  width: 296, left: -238, top: -78,
                  transform: `rotateZ(-13deg) rotateY(${ry * 0.5}deg)`,
                  border: '1px solid rgba(255,255,255,0.16)',
                  boxShadow: '0 30px 70px rgba(0,0,0,0.8)',
                  transition: hovering ? 'none' : 'transform 0.6s ease-out',
                }}
              />
              <div className="absolute overflow-hidden rounded-2xl"
                style={{
                  width: 296, height: 189, left: -238, top: -78,
                  transform: `rotateZ(-13deg) rotateY(${ry * 0.5}deg)`,
                  transition: hovering ? 'none' : 'transform 0.6s ease-out',
                }}>
                <div className="hero-sheen" />
              </div>
              <div className="absolute" style={{ left: -186, top: -30 }}>
                {[0, 1, 2].map(i => <span key={i} className="hero-ripple" style={{ animationDelay: `${i * 0.9}s` }} />)}
              </div>
            </div>

            {/* The live card */}
            <div ref={cardRef} className="relative w-72 rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(124,58,237,0.20))',
                border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(20px)',
                transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
                transition: hovering ? 'none' : 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1)',
                boxShadow: '0 30px 80px rgba(124,58,237,0.4), 0 8px 30px rgba(0,0,0,0.5)',
              }}>
              <div className="h-16" style={{ background: 'linear-gradient(135deg, #00d4ff33, #7c3aed33)' }} />
              <div className="px-6 pb-6" style={{ marginTop: -28 }}>
                <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center text-xl font-black text-white"
                  style={{ background: grad, boxShadow: '0 8px 24px rgba(124,58,237,0.5)' }}>
                  {displayInitial}
                </div>
                <p className="font-bold text-white text-lg leading-tight truncate">{displayName}</p>
                <p className="text-sm font-medium" style={{ color: '#00d4ff' }}>Founder &amp; CEO</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.42)' }}>{displayCompany}</p>
                <div className="mt-4 space-y-2">
                  {['+27 82 000 0000', displayEmail].map((item, i) => (
                    <div key={item} className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ['#00d4ff', '#ec4899'][i] }} />
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 py-2.5 rounded-xl text-xs font-bold text-center text-white" style={{ background: grad }}>
                  Save Contact
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow { 0%,100% { opacity: 0.9 } 50% { opacity: 0.6 } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-fade-in    { animation: fade-in 0.8s ease-out both; }
        @keyframes hero-sheen {
          0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0 }
          12%  { opacity: 0.55 }
          55%  { opacity: 0 }
          100% { transform: translateX(240%) skewX(-18deg); opacity: 0 }
        }
        .hero-sheen {
          position: absolute; top: -20%; left: 0; width: 42%; height: 140%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: hero-sheen 5.5s ease-in-out infinite;
        }
        @keyframes hero-ripple {
          0%   { transform: scale(0.35); opacity: 0.6 }
          100% { transform: scale(1.9);  opacity: 0 }
        }
        .hero-ripple {
          position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px;
          border-radius: 9999px; border: 1.5px solid rgba(0,212,255,0.55);
          animation: hero-ripple 2.7s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-sheen, .hero-ripple, .animate-pulse-slow { animation: none; }
          .hero-sheen, .hero-ripple { opacity: 0; }
        }
      `}</style>
    </section>
  )
}
