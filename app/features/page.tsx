import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import {
  Wifi, Smartphone, Globe, LayoutTemplate, Palette, Images, Link2, Share2, Award, Sparkles,
  Users, CalendarDays, ClipboardList, Repeat, ScanLine,
  MessageCircle, Contact, FileSpreadsheet, CalendarClock,
  BarChart2, Mail, Monitor, Building2, ArrowRight, Zap, Check,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Features — Everything Your Cardtly Digital Business Card Can Do',
  description:
    'Explore every Cardtly feature: NFC tap-to-share, QR codes, 12 editable templates, lead capture, meeting booking, paper card scanner, WhatsApp follow-up, one-click Excel export, a weekly performance digest, analytics and more. Free to start.',
  alternates: { canonical: '/features' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

type Feature = { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; isNew?: boolean }
type Group = { eyebrow: string; eyebrowColor: string; heading: string; features: Feature[] }

const GROUPS: Group[] = [
  {
    eyebrow: 'Share & connect',
    eyebrowColor: '#00d4ff',
    heading: 'Share your details any way they like',
    features: [
      { icon: Wifi, title: 'NFC physical cards', desc: 'Tap a Cardtly NFC card to any phone and your profile opens instantly. No app needed on either end. Posted across South Africa.' },
      { icon: Smartphone, title: 'Share in one tap', desc: 'QR code, short link, or NFC. Whichever way the person in front of you prefers to receive it.' },
      { icon: Globe, title: 'Always up to date', desc: 'Change your number, title or photo once. It updates everywhere your card lives. Never reprint a card again.' },
    ],
  },
  {
    eyebrow: 'Your card',
    eyebrowColor: '#7c3aed',
    heading: 'A card that does far more than contact details',
    features: [
      { icon: LayoutTemplate, title: '12 designer templates', desc: 'Professionally designed layouts for every profession, and every one is fully editable.' },
      { icon: Palette, title: 'Custom colours & fonts', desc: 'Match your brand with custom accent colours, fonts and logo sizes.' },
      { icon: Images, title: 'Photo gallery', desc: 'Show your work, products or portfolio with a built-in image gallery.' },
      { icon: Link2, title: 'Custom links', desc: 'Add up to 14 custom buttons - website, booking, menu, catalogue, anything.' },
      { icon: Share2, title: 'Socials & WhatsApp', desc: 'Link every social profile and add a one-tap WhatsApp chat button.' },
      { icon: Award, title: 'Certifications & awards', desc: 'Build trust by showcasing your qualifications and accreditations.' },
      { icon: Sparkles, title: 'AI-written bio', desc: 'Let AI write a polished professional bio from a few quick prompts.' },
    ],
  },
  {
    eyebrow: 'Capture & grow',
    eyebrowColor: '#a855f7',
    heading: 'Turn every tap into a lead',
    features: [
      { icon: Users, title: 'Lead capture, built-in CRM', desc: 'Visitors share their details through your card and every lead lands in your contacts - a pocket CRM that builds itself.' },
      { icon: CalendarDays, title: 'Book meetings from your card', desc: 'Visitors pick a date and time right on your card. You get the request by email and they land in your contacts.' },
      { icon: ClipboardList, title: 'Custom questionnaire', desc: 'Add your own short form - up to five questions - so leads tell you exactly what you need to know.' },
      { icon: Repeat, title: 'Reciprocal contact exchange', desc: 'After someone saves your details, prompt them to share theirs back. A two-way swap, not a one-way handout.' },
      { icon: ScanLine, title: 'Paper business card scanner', desc: 'Snap a photo of someone\'s paper card and AI pulls out their details, ready to save to your contacts or phone.' },
    ],
  },
  {
    eyebrow: 'Follow up & manage',
    eyebrowColor: '#25D366',
    heading: 'Close the loop after the tap',
    features: [
      { icon: MessageCircle, title: 'Follow up on WhatsApp', desc: 'Every lead comes with a one-tap WhatsApp button, so you can reply while you\'re still fresh in their mind.', isNew: true },
      { icon: Contact, title: 'Manage your contacts', desc: 'Edit, tidy and save any lead straight to your phone. Your Cardtly contacts stay organised and always within reach.', isNew: true },
      { icon: FileSpreadsheet, title: 'Export to Excel', desc: 'Turn every lead into a clean, colour-branded spreadsheet - names, emails, companies, sources and answers - in a click.', isNew: true },
      { icon: CalendarClock, title: 'Weekly performance digest', desc: 'Every Monday we email you how your card performed - views and new leads from the past 7 days - so you always know what\'s working.', isNew: true },
    ],
  },
  {
    eyebrow: 'Insights & extras',
    eyebrowColor: '#f59e0b',
    heading: 'Know what works, look sharp everywhere',
    features: [
      { icon: BarChart2, title: 'Analytics dashboard', desc: 'Track every view, click and save. Know exactly which leads engaged and when.' },
      { icon: Mail, title: 'Email signature generator', desc: 'Generate a branded email signature from your card in seconds.' },
      { icon: Monitor, title: 'Zoom & Teams backgrounds', desc: 'Branded virtual backgrounds with your name and QR code for video calls.' },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Features</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Everything your card<br /><span style={gradText}>can do.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            One digital business card that shares in a tap, captures leads, follows up for you and tells you what&apos;s working. Free to start, no credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.45)' }}>
              Create your free card
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-base font-medium transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Feature groups */}
      {GROUPS.map((group, gi) => (
        <section key={group.eyebrow} className="py-14 px-6" style={gi % 2 === 1 ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
          <div className="max-w-6xl mx-auto">
            <div className="mb-10">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: group.eyebrowColor }}>{group.eyebrow}</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight max-w-2xl">{group.heading}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.features.map(({ icon: Icon, title, desc, isNew }) => (
                <div key={title}
                  className="relative rounded-2xl p-6 transition-all hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {isNew && (
                    <span className="absolute top-5 right-5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
                      New
                    </span>
                  )}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-white"
                    style={{ background: group.eyebrowColor }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Teams callout */}
      <section className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl p-8 md:p-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(0,212,255,0.06))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-[260px]">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Cardtly for teams</h2>
                <p className="text-base leading-relaxed mb-5 max-w-2xl" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Roll out consistent, on-brand cards across your whole team. Company branding stays locked, each member manages their own name, title and photo, and one admin dashboard shows every card&apos;s views and leads. Priced per seat.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 max-w-xl">
                  {['Locked company branding', 'Member-managed details', 'Shared questionnaire & add-ons', 'One admin analytics dashboard'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />{t}
                    </div>
                  ))}
                </div>
                <Link href="/contact" className="text-sm font-semibold inline-flex items-center gap-1.5 transition hover:opacity-80"
                  style={{ color: '#a78bfa' }}>
                  Talk to us about Teams <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6"
                style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                <Zap className="w-3 h-3" />
                Every feature, free to try
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                Ready to <span style={gradText}>get started?</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Build your card in 2 minutes. Upgrade to Pro only when you need the extras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                  style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
                  Create your free card
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
