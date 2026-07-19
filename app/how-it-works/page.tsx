import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import GeoPricing from '@/components/marketing/GeoPricing'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How Digital Business Cards Work — Set Up in 2 Minutes',
  description:
    'See how a Cardtly digital business card works: create your card, get your link and QR code, then share by NFC tap, scan, or URL. Update anytime - everyone always sees your latest details.',
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
    title: 'Sign up in seconds',
    desc: "Create your account with just your email. No credit card needed to start your 60-day trial. You're up in under a minute.",
    detail: "Your card is created automatically when you sign up. Just fill in your details and you're live.",
    color: '#00d4ff',
  },
  {
    n: '02',
    title: 'Build your card',
    desc: 'Add your name, photo, contact details, social links, bio, and anything else you want people to see.',
    detail: 'Every card gets 12 templates, custom colours, gallery images, certifications, custom links and more.',
    color: '#7c3aed',
  },
  {
    n: '03',
    title: 'Share your link',
    desc: 'Your card lives at cardtly.com/card/yourname. Share it anywhere: WhatsApp, email, Instagram bio, LinkedIn.',
    detail: 'You also get a unique QR code. Print it on your packaging, desk, or old-school paper cards.',
    color: '#a855f7',
  },
  {
    n: '04',
    title: 'Make real connections',
    desc: 'People visit your card, save your contact, click your links, and reach out directly through your card.',
    detail: 'Your analytics dashboard shows how many people have viewed your card, so you can see what is working.',
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

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>How it works</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            From sign up to sharing<br /><span style={gradText}>in 2 minutes flat.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Cardtly is designed to be effortless. No design skills needed, no complicated setup. Just your details and a digital business card link that works everywhere.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {STEPS.map(({ n, title, desc, detail, color }) => (
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
                <h3 className="text-2xl font-black mb-3" style={{ color }}>{title}</h3>
                <p className="text-base leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{desc}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
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
              className="px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/05"
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
