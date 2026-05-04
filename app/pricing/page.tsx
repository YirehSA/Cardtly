import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { Check, ArrowRight, Zap } from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const FREE = [
  'Name, email, phone and company',
  'Profile photo',
  'Public card URL',
  'QR code download',
  'Contact save (vCard)',
  'Cardtly-branded QR',
]

const PRO = [
  'Everything in Free',
  '9 card templates',
  'Custom accent colour and fonts',
  'Job title, bio, address, WhatsApp',
  'Up to 14 custom links',
  'Social media profiles',
  'Gallery (up to 5 images)',
  'Certifications and awards',
  'Analytics dashboard',
  'Email signature generator',
  'Virtual background for Zoom & Teams',
  'Contact capture form',
  'QR code with your logo',
  'Remove Cardtly branding',
]

const FAQS = [
  { q: 'Is the free plan really free forever?', a: 'Yes. No trial period, no credit card needed. The free plan stays free as long as Cardtly exists.' },
  { q: 'Can I upgrade or downgrade anytime?', a: 'Absolutely. Upgrade when you need more, cancel any time. Your card stays live on the free plan even after cancelling Pro.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards. South African users can pay in ZAR via PayStack. International users pay via Whop.' },
  { q: 'Will my card URL change if I upgrade or downgrade?', a: 'Never. Your card URL is yours regardless of your plan. It never changes.' },
  { q: 'Can I try Pro features before paying?', a: 'Sign up for free and explore the dashboard. When you\'re ready, upgrade in Settings.' },
  { q: 'Is there a team or business plan?', a: 'Business plans for teams are coming soon. Contact us if you need something now and we\'ll sort you out.' },
]

export default function PricingPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)' }} />
        <div className="relative max-w-2xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#ec4899' }}>Pricing</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Simple pricing.<br /><span style={gradText}>No surprises.</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Start free and upgrade only when you need the extras.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Free */}
          <div className="p-8 rounded-3xl flex flex-col"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Free</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black">R0</span>
                <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ forever</span>
              </div>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Everything you need to get started. No credit card required.</p>
            </div>
            <div className="space-y-3 flex-1">
              {FREE.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/signup"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/08"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="p-8 rounded-3xl flex flex-col relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.14), rgba(236,72,153,0.08))', border: '1px solid rgba(124,58,237,0.35)' }}>
            {/* Popular badge */}
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
              <Zap className="w-3 h-3" />Most popular
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(124,58,237,0.2)', transform: 'translate(20%, -20%)' }} />

            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>Pro</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black">R65</span>
                <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ month</span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>International: $9 / month via Whop</p>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>Unlock the full Cardtly experience.</p>
            </div>

            <div className="relative space-y-3 flex-1">
              {PRO.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                  {f}
                </div>
              ))}
            </div>

            <Link href="/signup"
              className="relative mt-8 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 6px 30px rgba(124,58,237,0.4)' }}>
              Upgrade to Pro <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
          </div>
        </div>

        {/* Region note */}
        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
          South African users pay in ZAR via PayStack. All other regions pay in USD via Whop. Both are billed monthly, cancel anytime.
        </p>
      </section>

      {/* FAQs */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">
            Frequently asked <span style={gradText}>questions.</span>
          </h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="font-bold mb-2">{q}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Still unsure? <span style={gradText}>Start free.</span>
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No risk. No credit card. Upgrade any time when you\'re ready.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
            Create your free card <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
