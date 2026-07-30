import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import ProPlanPrice from '@/components/marketing/ProPlanPrice'
import Reveal from '@/components/marketing/Reveal'
import UsdEstimate from '@/components/marketing/UsdEstimate'
import { Check, ArrowRight, Zap, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Digital Business Card Pricing, R97 a Month',
  description:
    'R97 per card a month or R970 a year. Teams of 2 to 20 seats at R97 each, with departments and branding locks. NFC card R150.',
  alternates: { canonical: '/pricing' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const PRO = [
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
  'WhatsApp follow-up on every lead',
  'Paper business card scanner',
  'Manage contacts & save to phone',
  'One-click Excel contact export',
  'Weekly performance digest email',
  'QR code with your logo',
]

const TEAMS = [
  'Everything in Pro, for every member',
  'Lock only what you choose: logo, company name, website, address, socials, links, gallery, design',
  'Invite by email, members keep their own details current',
  'One admin dashboard for the whole team',
  'Departments, each with their own head',
  'Analytics and leads per member',
  'Branded Excel export of every lead',
  'Anyone can share a teammate\'s card',
  'Add seats whenever you grow',
]

const ENTERPRISE = [
  'Everything in Teams, unlimited seats',
  'Billed by debit order, not by card',
  'Invoicing to suit your finance team',
  'Onboarding help for your whole company',
  'Priority support',
  'NFC cards for the full team',
]

const FAQS = [
  { q: 'What does R97 include?', a: 'Everything. One card, every Cardtly feature: templates, custom branding, analytics, lead capture, meeting booking, WhatsApp follow-up, the paper card scanner and Excel export. There is no cut-down version.' },
  { q: 'Is there a team plan?', a: 'Yes, and you can set it up yourself right now. Teams run from 2 to 20 seats at R97 a seat per month, with locked company branding, email invites, and one admin dashboard. Need more than 20 seats? That is Enterprise, and we bill it by debit order.' },
  { q: 'What happens above 20 seats?', a: 'You move to Enterprise. Same product, but billed by debit order instead of a card, with invoicing that suits your finance team. Talk to us and we will set it up.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel whenever you like, no lock-in and no cancellation fee. You keep Pro until the end of the period you have paid for.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards through Paystack, our secure payment partner. Billing is in South African rand (ZAR). International cards are welcome, your bank simply converts the rand amount at checkout. Enterprise is billed by debit order.' },
  { q: 'Will my card URL ever change?', a: 'Never. Your card URL is yours, and it stays the same no matter what you do with your plan. Anything you have printed or handed out keeps working.' },
]

export default function PricingPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero. Left-aligned and capped in rem, matching the home and features
          heroes. The trial was not mentioned anywhere on this page -
          the strongest thing in the offer, absent from the page where people
          decide. */}
      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="absolute -top-32 left-[10%] w-[700px] h-[560px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16) 0%, rgba(124,58,237,0.10) 55%, transparent 72%)' }} />

        <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center"
          style={{ maxWidth: 1500, zIndex: 2 }}>
          <div className="text-center lg:text-left">
            <p className="animate-fade-up text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#ec4899' }}>Pricing</p>
            <h1 className="animate-fade-up font-black tracking-[-0.02em] leading-[1.04] mb-6"
              style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              One price.<br /><span style={gradText}>Everything included.</span>
            </h1>
            <p className="animate-fade-up-delayed text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              R97 a card per month, whether it is just you or your whole team. No feature tiers, no surprises -
              with every feature included.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
                Sign up
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}>
                See what is included
              </Link>
            </div>
          </div>

          {/* The three things people actually want to know before scrolling. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            {[
              { k: 'R97', v: 'A card a month, all features' },
              { k: 'R97', v: 'Per card, per month, everything included' },
              { k: 'Cancel anytime', v: 'No lock-in, no cancellation fee' },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-black tracking-tight whitespace-nowrap" style={gradText}>{k}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

          {/* Pro, for one person */}
          <Reveal className="h-full">
          <div className="h-full p-8 rounded-3xl flex flex-col lift-card"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ProPlanPrice />
            <div className="space-y-3 flex-1">
              {PRO.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/signup"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              Get your card
            </Link>
          </div>
          </Reveal>

          {/* Teams, the main event */}
          <Reveal delay={120} className="h-full">
          <div className="h-full p-8 rounded-3xl flex flex-col relative overflow-hidden lift-card"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.14), rgba(236,72,153,0.08))', border: '1px solid rgba(124,58,237,0.35)' }}>
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
              <Zap className="w-3 h-3" />Most popular
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(124,58,237,0.2)', transform: 'translate(20%, -20%)' }} />

            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7c3aed' }}>Teams</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black">R97</span>
                <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/ seat / month</span>
              </div>
              <UsdEstimate zar={97} suffix="/seat/mo" className="block text-sm font-medium mb-1 text-white/70" />
              <p className="text-sm mb-8 mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                2 to 20 seats. Set it up yourself in minutes.
              </p>
            </div>

            <div className="relative space-y-3 flex-1">
              {TEAMS.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                  {f}
                </div>
              ))}
            </div>

            <Link href="/dashboard/team"
              className="relative mt-8 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 6px 30px rgba(124,58,237,0.4)' }}>
              Set up your team <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
          </div>
          </Reveal>

          {/* Enterprise */}
          <Reveal delay={240} className="h-full">
          <div className="h-full p-8 rounded-3xl flex flex-col lift-card"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Building2 className="w-3.5 h-3.5" />Enterprise
              </p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black">20+</span>
                <span className="text-base pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>seats</span>
              </div>
              <p className="text-sm mb-8 mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Billed by debit order. We will quote you on the seats you need.
              </p>
            </div>
            <div className="space-y-3 flex-1">
              {ENTERPRISE.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/contact"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              Talk to us
            </Link>
          </div>
          </Reveal>
        </div>

        {/* Payment note */}
        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Secure payment in ZAR via Paystack. International cards welcome, your bank converts at checkout. Cancel anytime. Enterprise is billed by debit order.
        </p>

        {/* NFC add-on strip */}
        <div className="max-w-4xl mx-auto mt-10">
          <Reveal>
          <div className="p-6 rounded-2xl flex items-start gap-4 lift-card"
            style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
            <div className="text-2xl">📇</div>
            <div>
              <p className="font-bold text-white mb-1">Want a physical NFC card too?</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                A sleek Cardtly NFC card you tap to any phone, R150 once-off. Order a set for the whole team.
              </p>
              <Link href="/nfc" className="text-sm font-semibold inline-flex items-center gap-1 transition hover:opacity-80"
                style={{ color: '#22d3ee' }}>
                See the NFC cards <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-black text-center mb-12">
              Frequently asked <span style={gradText}>questions.</span>
            </h2>
          </Reveal>
          <div className="space-y-4">
            {FAQS.map(({ q, a }, i) => (
              <Reveal key={q} delay={i * 50}>
                <div className="p-6 rounded-2xl lift-card"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-bold mb-2">{q}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <Reveal className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Arm your team with <span style={gradText}>Cardtly.</span>
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            R97 a card. Set up in minutes, cancel any time.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
