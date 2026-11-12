import Link from 'next/link'
import { ArrowRight, Check, Wifi, User, Building2, Sparkles } from 'lucide-react'
import Reveal from '@/components/marketing/Reveal'
import PriceEstimate, { RandChargeNote } from '@/components/marketing/PriceEstimate'
import { formatZAR } from '@/lib/nfc-pricing'
import { BUNDLE_PRICE_RAND, bundleRenewalRand, bundleSavingRand, bundleSeparateRand } from '@/lib/pro-bundle'

// The R999 package (a year of Pro and an NFC card), as an offer on the
// marketing pages: home, pricing, NFC and its own page at /package. One
// component so the figures and the wording are the same everywhere, and every
// figure comes from lib/pro-bundle.
//
// The button goes to sign-up with ?package=1, which leads straight on to the
// package form after the account is made (and middleware sends someone already
// signed in straight there). Every page this appears on is closed to the iOS
// app, which may not show prices (lib/app-platform IOS_BLOCKED_ROUTES).

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}
// Measured against the black page, as on /pricing: body about 9:1, dim 5.9:1.
const INK = 'rgba(255,255,255,0.92)'
const BODY = 'rgba(255,255,255,0.68)'
const DIM = 'rgba(255,255,255,0.6)'
const LILAC = '#a78bfa'

export default function PackageOffer({
  id = 'package',
  eyebrow = 'The starter package',
  as: Heading = 'h2',
}: {
  id?: string
  eyebrow?: string
  /** h1 on /package, where this is the page's main heading. */
  as?: 'h1' | 'h2'
}) {
  const renewal = bundleRenewalRand()
  const included = [
    '12 months of Cardtly Pro: every feature, nothing held back',
    'Your own NFC card, standard or custom design, proofed before printing',
    'Printed and delivered anywhere in South Africa',
    'Lead capture, follow-up and analytics from your first day',
  ]

  return (
    <section id={id} className="py-24 px-6 relative overflow-hidden scroll-mt-20">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full blur-[150px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto relative">
        <Reveal>
          <div className="rounded-[2rem] p-8 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,58,237,0.12), rgba(236,72,153,0.06))', border: '1px solid rgba(124,58,237,0.35)' }}>

            {/* ── The offer ─────────────────────────────────────────── */}
            <div>
              <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.4)', color: LILAC }}>
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />{eyebrow}
              </p>
              <Heading className="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] mb-5">
                A year of Pro and your NFC card. <span style={gradText}>R{BUNDLE_PRICE_RAND}.</span>
              </Heading>
              <p className="text-lg leading-relaxed mb-8" style={{ color: BODY }}>
                Everything you need to start handing out a card that brings leads back: twelve months of
                Cardtly Pro and your own NFC card, printed in your design and delivered to your door.
              </p>

              <ul className="space-y-3 mb-8">
                {included.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm sm:text-base" style={{ color: INK }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(52,211,153,0.15)' }}>
                      <Check className="w-3.5 h-3.5" style={{ color: '#34d399' }} aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {/* Who it is for. Same package either way: a business starts
                  with its own card and adds the team from the same account. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                    <User className="w-4 h-4" style={{ color: '#22d3ee' }} aria-hidden="true" />For you
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                    Consultants, agents, freelancers and sales people: one card that keeps working after the handshake.
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                    <Building2 className="w-4 h-4" style={{ color: '#f472b6' }} aria-hidden="true" />For your business
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                    Your brand on the card and every lead in one place. Add your team later from the same account.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Link href="/signup?package=1"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white whitespace-nowrap transition-all hover:scale-[1.03]"
                  style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.45)' }}>
                  Get the package
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link href="/login?redirectTo=/dashboard/upgrade/bundle"
                  className="inline-flex items-center justify-center min-h-11 px-2 text-sm font-medium transition hover:text-white"
                  style={{ color: DIM }}>
                  Already have an account? Sign in
                </Link>
              </div>
            </div>

            {/* ── The card and the price ────────────────────────────── */}
            <div className="relative flex flex-col items-center gap-10">
              {/* Decoration: the card mockup. The price box below is read out. */}
              <div className="relative mt-4" aria-hidden="true">
                <div className="absolute inset-0 w-64 h-40 sm:w-72 sm:h-44 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', transform: 'translate(-16px, -14px) rotate(-7deg)' }} />
                <div className="absolute inset-0 w-64 h-40 sm:w-72 sm:h-44 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #00d4ff44, #7c3aed44)', border: '1px solid rgba(0,212,255,0.3)', transform: 'translate(-8px, -7px) rotate(-3.5deg)' }} />
                <div className="relative w-64 h-40 sm:w-72 sm:h-44 rounded-2xl p-5 flex flex-col justify-between"
                  style={{ background: grad, boxShadow: '0 24px 60px rgba(124,58,237,0.45)' }}>
                  <div className="text-white text-xs font-bold uppercase tracking-widest opacity-85">Cardtly</div>
                  <div>
                    <div className="text-white text-base font-bold">Your name</div>
                    <div className="text-white/75 text-xs">Your business</div>
                  </div>
                  <Wifi className="absolute top-4 right-4 w-5 h-5 text-white/75" />
                </div>
                <div className="absolute -top-5 -right-6 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                  style={{ background: '#111827', border: '1px solid rgba(124,58,237,0.5)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  + 12 months of Pro
                </div>
              </div>

              <div className="w-full max-w-xs rounded-2xl p-6 text-center"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DIM }}>Once-off today</p>
                <p className="text-6xl font-black leading-none" style={gradText}>R{BUNDLE_PRICE_RAND}</p>
                <PriceEstimate zar={BUNDLE_PRICE_RAND} className="block text-sm font-medium mt-2 text-white/70" />
                <p className="text-sm mt-3" style={{ color: BODY }}>
                  <span className="line-through" style={{ color: DIM }}>{formatZAR(bundleSeparateRand('standard'))}</span>{' '}
                  bought separately
                </p>
                <p className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-2"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  You save R{bundleSavingRand()} or more
                </p>
                <p className="text-xs mt-4 leading-relaxed" style={{ color: DIM }}>
                  Then R{renewal} a year from year two. Cancel whenever you like.
                </p>
                <RandChargeNote className="block text-xs mt-1 text-white/60" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
