'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Zap, QrCode, Wand2 } from 'lucide-react'

// Cinematic hero with a card that responds to mouse movement (3D tilt),
// floating "live" notification pills, and ambient animated orbs.
// All effects are CSS transforms — no canvas, no heavy libs.

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

  // Live personalization: visitor types their name and the demo card
  // becomes THEIR card in real time. People don't bounce from a page
  // with their own name on it - and the claim CTA below the card
  // carries the name into signup so the magic continues there.
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
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0..1
    const y = (e.clientY - rect.top) / rect.height   // 0..1
    // Map to ±10 degrees, inverted on Y so top-tilt feels natural
    const ry = (x - 0.5) * 18
    const rx = (0.5 - y) * 14
    setTilt({ rx, ry })
  }

  function handleLeave() {
    setHovering(false)
    setTilt({ rx: 0, ry: 0 })
  }

  // Subtle ambient float when not being hovered
  const [ambient, setAmbient] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = performance.now()
    function loop(now: number) {
      setAmbient(Math.sin((now - start) / 2000) * 1.5)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const rx = hovering ? tilt.rx : ambient
  const ry = hovering ? tilt.ry : ambient * 0.6

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 overflow-hidden">
      {/* Animated ambient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.20) 0%, rgba(124,58,237,0.12) 50%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 left-0 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 70%)' }} />

      <div className="relative max-w-4xl mx-auto" style={{ zIndex: 2 }}>
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8 border animate-fade-in"
          style={{ border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', background: 'rgba(0,212,255,0.08)', backdropFilter: 'blur(8px)' }}>
          <Sparkles className="w-3 h-3" />
          Now built for teams and sales
        </div>

        {/* H1 sells the outcome. The head term "digital business card" moves
            into the subheadline directly below so we keep the on-page SEO
            signal while the positioning leads with leads, meetings, sales. */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.0] mb-6">
          More leads. More meetings.
          <br />
          <span style={gradText}>More sales.</span>
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)' }}>
          Cardtly turns every handshake into a tracked lead. Your team shares one branded digital business card with a tap, the lead lands in your contacts, and the meeting books itself. <span className="text-white font-semibold">R97 a card, for one or for the whole team.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <Link href="#teams"
            className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-[1.03] hover:shadow-2xl"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
            Cardtly for your team
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/signup"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
            Create your free card
          </Link>
        </div>

        {/* Try-it-live input: types straight onto the demo card below */}
        <div className="max-w-sm mx-auto mb-12 animate-fade-in">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: trimmedName ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)',
              boxShadow: trimmedName ? '0 0 30px rgba(0,212,255,0.25)' : 'none',
            }}>
            <Wand2 className="w-4 h-4 flex-shrink-0" style={{ color: trimmedName ? '#00d4ff' : 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              value={visitorName}
              onChange={e => setVisitorName(e.target.value)}
              maxLength={50}
              placeholder="Type your name — watch the card change"
              aria-label="Type your name to preview your digital business card"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>
        </div>

        {/* ── Interactive card stage ─────────────────────────────────── */}
        <div
          className="relative inline-block"
          style={{ perspective: '1200px' }}
          onMouseMove={handleMove}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={handleLeave}
        >
          {/* Background card silhouettes (depth) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute w-64 rounded-3xl"
              style={{
                height: 400,
                background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,58,237,0.06))',
                border: '1px solid rgba(255,255,255,0.06)',
                transform: `translateX(-110px) translateY(20px) rotateZ(-12deg) rotateY(${ry * 0.4}deg)`,
                transition: hovering ? 'none' : 'transform 0.6s ease-out',
              }}
            />
            <div
              className="absolute w-64 rounded-3xl"
              style={{
                height: 400,
                background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(124,58,237,0.06))',
                border: '1px solid rgba(255,255,255,0.06)',
                transform: `translateX(110px) translateY(20px) rotateZ(12deg) rotateY(${ry * 0.4}deg)`,
                transition: hovering ? 'none' : 'transform 0.6s ease-out',
              }}
            />
          </div>

          {/* Main interactive card */}
          <div
            ref={cardRef}
            className="relative w-72 rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(124,58,237,0.18))',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
              transformStyle: 'preserve-3d',
              transition: hovering ? 'none' : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: '0 30px 80px rgba(124,58,237,0.35), 0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            {/* Sheen overlay reacting to tilt */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(${135 + ry * 4}deg, rgba(255,255,255,${0.08 + Math.abs(ry) * 0.005}) 0%, transparent 50%)`,
                mixBlendMode: 'overlay',
              }}
            />

            <div className="h-20" style={{ background: 'linear-gradient(135deg, #00d4ff33, #7c3aed33)' }} />
            <div className="px-6 pb-6" style={{ marginTop: -32, transform: 'translateZ(20px)' }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white"
                style={{ background: grad, boxShadow: '0 8px 24px rgba(124,58,237,0.45)' }}>
                {displayInitial}
              </div>
              <p className="font-bold text-white text-lg">{displayName}</p>
              <p className="text-sm font-medium" style={{ color: '#00d4ff' }}>Founder &amp; CEO</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{displayCompany}</p>
              <div className="mt-4 space-y-2">
                {['+27 82 000 0000', displayEmail, previewSlug ? `cardtly.com/card/${previewSlug}` : 'yireh.co.za'].map((item, i) => (
                  <div key={item} className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ['#00d4ff', '#7c3aed', '#ec4899'][i] }} />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <div className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center text-white"
                  style={{ background: grad }}>Save Contact</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)' }}>
                  <QrCode className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Floating "live" pills */}
          <FloatingPill
            position={{ top: 30, right: -90 }}
            color="#00d4ff"
            icon={<span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#22c55e' }} />}
            text="Just updated"
            delay={0}
          />
          <FloatingPill
            position={{ top: 160, right: -110 }}
            color="#ec4899"
            icon={<span style={{ fontSize: 12 }}>📊</span>}
            text="47 views today"
            delay={0.4}
          />
          <FloatingPill
            position={{ bottom: 80, left: -120 }}
            color="#7c3aed"
            icon={<Zap className="w-3 h-3" />}
            text="Tap to share"
            delay={0.8}
          />
          <FloatingPill
            position={{ bottom: 180, left: -100 }}
            color="#22c55e"
            icon={<span style={{ fontSize: 12 }}>✨</span>}
            text="3 new connections"
            delay={1.2}
          />
        </div>

        {/* Claim CTA appears once they've typed - their URL is right
            there, one click from being theirs. Falls back to the
            interaction hint when the input is empty. */}
        {previewSlug ? (
          <div className="mt-10 animate-fade-in">
            <Link
              href={`/signup?name=${encodeURIComponent(trimmedName)}`}
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(0,212,255,0.4)' }}>
              Claim cardtly.com/card/{previewSlug} — free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No credit card. Live in 2 minutes.
            </p>
          </div>
        ) : (
          <p className="mt-12 text-xs hidden md:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ✦ Move your mouse over the card — or type your name above
          </p>
        )}
      </div>

      {/* Inline keyframes (Tailwind doesn't ship these by default) */}
      <style>{`
        @keyframes float-pill {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1);   opacity: 1;   box-shadow: 0 0 0 0 rgba(34,197,94, 0.5); }
          50%      { transform: scale(1.2); opacity: 0.8; box-shadow: 0 0 0 6px rgba(34,197,94, 0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.9; }
          50%      { opacity: 0.6; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .animate-pulse-dot  { animation: pulse-dot 1.8s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-fade-in    { animation: fade-in 0.8s ease-out both; }
      `}</style>
    </section>
  )
}

// Small floating pill component
function FloatingPill({
  position,
  color,
  icon,
  text,
  delay,
}: {
  position: { top?: number; bottom?: number; left?: number; right?: number }
  color: string
  icon: React.ReactNode
  text: string
  delay: number
}) {
  return (
    <div
      className="absolute hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-2xl"
      style={{
        ...position,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        backdropFilter: 'blur(12px)',
        animation: `float-pill 4s ease-in-out ${delay}s infinite`,
        zIndex: 3,
      }}
    >
      {icon}
      {text}
    </div>
  )
}
