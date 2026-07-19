import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import GeoPricing from '@/components/marketing/GeoPricing'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: { absolute: 'How Digital Business Cards Work | Set Up in 2 Minutes' },
  description:
    'Create your card, get your link and QR code, then share by NFC tap, scan or URL. Update it once and everyone who has your card sees the new version.',
  alternates: { canonical: '/how-it-works' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const STEPS = [
  {
    n: '01',
    time: '30 seconds',
    title: 'Sign up with an email',
    desc: 'No credit card, no sales call, no setup wizard. Your card exists the moment you sign up - blank, but live.',
    detail: 'You get your own address straight away: cardtly.com/card/yourname.',
    color: '#00d4ff',
  },
  {
    n: '02',
    time: '2 minutes',
    title: 'Type in your details',
    desc: 'Name, job title, number, email. Pick one of 12 templates and a colour. That is the whole build.',
    detail: 'No design skills. Every template already looks right - you are choosing, not designing.',
    color: '#7c3aed',
  },
  {
    n: '03',
    time: 'Instant',
    title: 'Share it however you like',
    desc: 'Send the link on WhatsApp, let them scan your QR, or tap an NFC card against their phone. Nothing to install on their side.',
    detail: 'The same card works all three ways. You do not choose one and lose the others.',
    color: '#a855f7',
  },
  {
    n: '04',
    time: 'From then on',
    title: 'Change it whenever',
    desc: 'New number, new job, new photo - edit once and every card you have ever shared shows the new version.',
    detail: 'Printed cards go in the bin when something changes. This one does not.',
    color: '#ec4899',
  },
]

// Kept deliberately in step with the Pro list on /pricing, which is
// the canonical page. There is no longer a free tier to compare
// against: every card is Pro, free for the first 60 days.
const PLAN_FEATURES = [
  'Your own card URL at cardtly.com/card/you',
  '12 card templates',
  'Custom accent colour and fonts',
  'Job title, bio, address, WhatsApp',
  'Up to 5 custom link buttons',
  'Social media profiles',
  'Gallery of up to 6 images',
  'Certifications and awards',
  'Analytics dashboard',
  'Email signature generator',
  'Virtual background for Zoom & Teams',
  'Contact capture form',
  'Book meetings from your card',
  'QR code with your logo',
]

export default function HowItWorksPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero. Left-aligned with the type capped in rem, matching home,
          features and pricing. The three things beside it answer the question
          the page exists to answer - how long, how hard, what does the other
          person need - before anyone scrolls. */}
      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="absolute -top-32 left-[10%] w-[700px] h-[560px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(0,212,255,0.10) 55%, transparent 72%)' }} />

        <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center"
          style={{ maxWidth: 1500, zIndex: 2 }}>
          <div className="text-center lg:text-left">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>How it works</p>
            <h1 className="font-black tracking-[-0.02em] leading-[1.04] mb-6"
              style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              From sign up to sharing<br /><span style={gradText}>in 2 minutes flat.</span>
            </h1>
            <p className="text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              Four steps, and only one of them takes any thought. No design skills, no setup wizard, and
              nothing for the person receiving your card to install.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
                Start your 60-day trial
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}>
                See every feature
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            {[
              { k: 'About 2 minutes', v: 'From empty account to a card you can send' },
              { k: 'Nothing to install', v: 'Not for you, and not for the person you share it with' },
              { k: 'Change it anytime', v: 'Edit once and every card you have shared updates' },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-lg font-black tracking-tight" style={gradText}>{k}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Steps */}
      <section className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto space-y-5">
          {STEPS.map(({ n, time, title, desc, detail, color }) => (
            <div key={n}
              className="p-8 rounded-3xl flex flex-col md:flex-row gap-8 items-start transition-all hover:scale-[1.005]"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}>
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
                  {n}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h3 className="text-2xl font-black" style={{ color }}>{title}</h3>
                  <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
                    {time}
                  </span>
                </div>
                <p className="text-base leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{desc}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight mb-3">
              One plan. <span style={gradText}>Everything included.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Try it free for 60 days. Keep it for R97 a month.</p>
          </div>
          <GeoPricing plan={PLAN_FEATURES} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Still have questions? <span style={gradText}>We've got answers.</span>
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Reach out and we'll get back to you within a day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
              Start your 60-day trial <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
            <Link href="/contact"
              className="px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
              Contact us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
