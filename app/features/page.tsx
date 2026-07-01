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
    'Explore every Cardtly feature with examples: NFC tap-to-share, QR codes, editable templates, lead capture and CRM, meeting booking, paper card scanner, WhatsApp follow-up, one-click Excel export, weekly performance digest and analytics. See what is free and what is Pro.',
  alternates: { canonical: '/features' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

type Tier = 'Free' | 'Pro' | 'Add-on'

// ── Small UI atoms ─────────────────────────────────────────────────────

function TierPill({ tier }: { tier: Tier }) {
  const s = {
    Free: { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', border: 'rgba(255,255,255,0.16)' },
    Pro: { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
    'Add-on': { bg: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: 'rgba(0,212,255,0.35)' },
  }[tier]
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {tier}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
      New
    </span>
  )
}

function IconBox({ Icon, accent, big }: { Icon: React.ComponentType<{ className?: string }>; accent: string; big?: boolean }) {
  return (
    <div className={`${big ? 'w-12 h-12' : 'w-11 h-11'} rounded-xl flex items-center justify-center text-white flex-shrink-0`}
      style={{ background: accent }}>
      <Icon className={big ? 'w-6 h-6' : 'w-5 h-5'} />
    </div>
  )
}

function HowLine({ how, accent }: { how: string; accent: string }) {
  return (
    <p className="text-sm leading-relaxed">
      <span className="font-semibold" style={{ color: accent }}>How it works: </span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{how}</span>
    </p>
  )
}

// ── Visual mockups (used beside key features) ──────────────────────────

function MockPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl p-6 sm:p-8 overflow-hidden flex items-center justify-center min-h-[240px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 70% 15%, ${accent}22, transparent 60%)` }} />
      <div className="relative w-full flex items-center justify-center">{children}</div>
    </div>
  )
}

function CardMock() {
  return (
    <div className="relative">
      <div className="absolute inset-0 w-56 h-36 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', transform: 'translate(-9px,-9px) rotate(-5deg)' }} />
      <div className="relative w-56 h-36 rounded-2xl p-4 flex flex-col justify-between"
        style={{ background: grad, boxShadow: '0 20px 50px rgba(124,58,237,0.4)' }}>
        <div className="text-white text-[10px] font-bold uppercase tracking-widest opacity-80">Cardtly</div>
        <div>
          <div className="text-white text-sm font-bold">Andre Nel</div>
          <div className="text-white/70 text-[10px]">cardtly.com/andrenel</div>
        </div>
        <Wifi className="absolute top-3 right-3 w-4 h-4 text-white/70" />
      </div>
    </div>
  )
}

function TemplatesMock() {
  const cards = [{ c: '#00d4ff' }, { c: '#ec4899' }, { c: '#22c55e' }]
  return (
    <div className="flex gap-3 justify-center">
      {cards.map((t, i) => (
        <div key={i} className="w-24 h-36 rounded-xl p-2.5 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', transform: `rotate(${(i - 1) * 5}deg)` }}>
          <div className="w-9 h-9 rounded-full mb-2 mx-auto" style={{ background: t.c }} />
          <div className="h-1.5 rounded w-3/4 mx-auto mb-1.5" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="h-1 rounded w-1/2 mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="mt-auto h-5 rounded" style={{ background: t.c, opacity: 0.85 }} />
        </div>
      ))}
    </div>
  )
}

function ContactsMock() {
  const rows = [
    { n: 'Sarah Mokoena', s: 'Meeting request', c: '#06b6d4' },
    { n: 'James Kruger', s: 'Contact form', c: '#22c55e' },
    { n: 'Priya Naidoo', s: 'Scanned card', c: '#a855f7' },
  ]
  return (
    <div className="w-full max-w-[320px] space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: grad }}>
            {r.n.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{r.n}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.s}</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.c }} />
        </div>
      ))}
    </div>
  )
}

function ChatMock() {
  const bubbles: { text: string; me?: boolean }[] = [
    { text: 'Great meeting you! Here is my card 👋' },
    { text: 'Thanks! Let us chat Monday.', me: true },
    { text: 'Perfect, I will send an invite 📅' },
  ]
  return (
    <div className="w-full max-w-[300px] flex flex-col gap-2">
      {bubbles.map((b, i) => (
        <div key={i}
          className={`px-4 py-2.5 text-xs font-medium max-w-[85%] ${b.me ? 'self-end rounded-2xl rounded-br-sm' : 'self-start rounded-2xl rounded-tl-sm text-white'}`}
          style={b.me
            ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }
            : { background: '#25D366' }}>
          {b.text}
        </div>
      ))}
    </div>
  )
}

function SheetMock() {
  const rows = [['Sarah M.', 'sarah@…', 'Meeting'], ['James K.', 'james@…', 'Form'], ['Priya N.', 'priya@…', 'Scan']]
  return (
    <div className="w-full max-w-[320px] rounded-lg overflow-hidden text-[10px]" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="grid grid-cols-3 font-bold text-white" style={{ background: '#0284c7' }}>
        <div className="px-2.5 py-2">Name</div><div className="px-2.5 py-2">Email</div><div className="px-2.5 py-2">Source</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-3" style={{ background: i % 2 ? 'rgba(240,249,255,0.06)' : 'transparent', color: 'rgba(255,255,255,0.7)' }}>
          {r.map((c, j) => (
            <div key={j} className="px-2.5 py-2 border-t truncate" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function DigestMock() {
  return (
    <div className="w-full max-w-[280px] rounded-xl p-4" style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="text-white text-xs font-bold mb-0.5">Your Cardtly week</div>
      <div className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Last 7 days</div>
      <div className="flex gap-2 mb-3">
        {[{ n: '128', l: 'views' }, { n: '6', l: 'new leads' }].map((s, i) => (
          <div key={i} className="flex-1 rounded-lg py-3 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-lg font-black text-white">{s.n}</div>
            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div className="h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white" style={{ background: grad }}>
        See your new leads
      </div>
    </div>
  )
}

function ChartMock() {
  const bars = [40, 65, 50, 80, 55, 90, 75, 100, 70, 85]
  return (
    <div className="flex items-end justify-center gap-1.5 h-32">
      {bars.map((h, i) => (
        <div key={i} className="w-3 rounded-t"
          style={{ height: `${h}%`, background: 'linear-gradient(180deg, #f59e0b, #ec4899)', opacity: 0.4 + (i / 10) * 0.6 }} />
      ))}
    </div>
  )
}

// ── Feature data ───────────────────────────────────────────────────────

type Feature = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  how: string
  tier: Tier
  isNew?: boolean
  visual?: React.ReactNode
}
type Group = { eyebrow: string; color: string; heading: string; features: Feature[] }

const GROUPS: Group[] = [
  {
    eyebrow: 'Share & connect',
    color: '#00d4ff',
    heading: 'Share your details any way they like',
    features: [
      {
        icon: Wifi, title: 'NFC physical cards', tier: 'Add-on', visual: <CardMock />,
        desc: 'Tap a Cardtly NFC card to any phone and your profile opens instantly. No app needed on either end. Posted across South Africa.',
        how: 'Order a card, we encode your link, then tap it to any phone to open your live profile.',
      },
      {
        icon: Smartphone, title: 'Share in one tap', tier: 'Free',
        desc: 'QR code, short link or NFC. Whichever way the person in front of you prefers to receive it.',
        how: 'Download your QR code or copy your cardtly.com link and share it anywhere, on or offline.',
      },
      {
        icon: Globe, title: 'Always up to date', tier: 'Free',
        desc: 'Change your number, title or photo once. It updates everywhere your card lives. Never reprint a card again.',
        how: 'Edit your card in the dashboard and every shared link, QR code and NFC tap reflects it instantly.',
      },
    ],
  },
  {
    eyebrow: 'Your card',
    color: '#7c3aed',
    heading: 'A card that does far more than contact details',
    features: [
      {
        icon: LayoutTemplate, title: 'Designer templates', tier: 'Pro', visual: <TemplatesMock />,
        desc: 'Professionally designed layouts for every profession, and every one is fully editable to fit your brand.',
        how: 'Pick a template, then tweak colours, fonts, logo size and content in the design panel.',
      },
      {
        icon: Palette, title: 'Custom colours & fonts', tier: 'Pro',
        desc: 'Match your brand exactly with custom accent colours, font choices and logo sizing.',
        how: 'Set your colour and font in the design panel; the whole card restyles live as you edit.',
      },
      {
        icon: Images, title: 'Photo gallery', tier: 'Pro',
        desc: 'Show your work, products or portfolio with a built-in image gallery right on your card.',
        how: 'Upload up to six images; visitors swipe through them without leaving your card.',
      },
      {
        icon: Link2, title: 'Custom links', tier: 'Pro',
        desc: 'Add your own buttons linking anywhere: website, booking page, menu, catalogue, price list.',
        how: 'Add up to 14 custom link buttons and reorder them however you like.',
      },
      {
        icon: Share2, title: 'Socials & WhatsApp', tier: 'Pro',
        desc: 'Link every social profile and add a one-tap WhatsApp chat button to your card.',
        how: 'Drop in your handles and WhatsApp number; icons appear for people to tap.',
      },
      {
        icon: Award, title: 'Certifications & awards', tier: 'Pro',
        desc: 'Build instant trust by showcasing your qualifications and accreditations.',
        how: 'List your certifications in a dedicated section that renders as neat badges.',
      },
      {
        icon: Sparkles, title: 'AI-written bio', tier: 'Pro',
        desc: 'Let AI write a polished, professional bio for you from a few quick prompts.',
        how: 'Answer a couple of prompts and AI drafts your bio; edit it until it sounds like you.',
      },
    ],
  },
  {
    eyebrow: 'Capture & grow',
    color: '#a855f7',
    heading: 'Turn every tap into a lead',
    features: [
      {
        icon: Users, title: 'Lead capture, built-in CRM', tier: 'Pro', visual: <ContactsMock />,
        desc: 'Visitors share their details through your card and every lead lands in your contacts: a pocket CRM that builds itself.',
        how: 'Switch on the capture form; every submission appears under Contacts and emails you instantly.',
      },
      {
        icon: CalendarDays, title: 'Book meetings from your card', tier: 'Pro',
        desc: 'Visitors pick a date and time right on your card. You get the request by email and they land in your contacts.',
        how: 'Enable booking; requests arrive by email and save automatically to your Contacts.',
      },
      {
        icon: ClipboardList, title: 'Custom questionnaire', tier: 'Add-on',
        desc: 'Add your own short form, up to five questions, so leads tell you exactly what you need to know.',
        how: 'Build your questions in the dashboard; answers save alongside each captured lead.',
      },
      {
        icon: Repeat, title: 'Reciprocal contact exchange', tier: 'Add-on',
        desc: 'After someone saves your details, prompt them to share theirs back. A two-way swap, not a one-way handout.',
        how: 'Turn it on and a share-your-details prompt appears right after someone saves your contact.',
      },
      {
        icon: ScanLine, title: 'Paper business card scanner', tier: 'Pro',
        desc: 'Snap a photo of someone’s paper card and AI pulls out their details, ready to save to your contacts or phone.',
        how: 'Photograph a paper card; AI reads the name, email and number and pre-fills a new contact.',
      },
    ],
  },
  {
    eyebrow: 'Follow up & manage',
    color: '#25D366',
    heading: 'Close the loop after the tap',
    features: [
      {
        icon: MessageCircle, title: 'Follow up on WhatsApp', tier: 'Pro', isNew: true, visual: <ChatMock />,
        desc: 'Every lead comes with a one-tap WhatsApp button, so you can reply while you are still fresh in their mind.',
        how: 'Open any lead and tap WhatsApp; it opens a chat to their number, no copying required.',
      },
      {
        icon: FileSpreadsheet, title: 'Export to Excel', tier: 'Pro', isNew: true, visual: <SheetMock />,
        desc: 'Turn every lead into a clean, colour-branded spreadsheet: names, emails, companies, sources and answers.',
        how: 'Hit Export on your Contacts page to download a styled .xlsx, ready for your CRM or mailing list.',
      },
      {
        icon: CalendarClock, title: 'Weekly performance digest', tier: 'Pro', isNew: true, visual: <DigestMock />,
        desc: 'Every Monday we email you how your card performed: views and new leads from the past 7 days.',
        how: 'Nothing to set up. If your card had activity that week, the summary lands in your inbox.',
      },
      {
        icon: Contact, title: 'Manage your contacts', tier: 'Pro', isNew: true,
        desc: 'Edit, tidy and save any lead straight to your phone. Your Cardtly contacts stay organised and within reach.',
        how: 'Edit or delete any lead, or tap Save to phone to add them to your device in one step.',
      },
    ],
  },
  {
    eyebrow: 'Insights & extras',
    color: '#f59e0b',
    heading: 'Know what works, look sharp everywhere',
    features: [
      {
        icon: BarChart2, title: 'Analytics dashboard', tier: 'Pro', visual: <ChartMock />,
        desc: 'Track every view, click and save. Know exactly which leads engaged with your card and when.',
        how: 'Your dashboard charts views over time so you can see what is landing and what is not.',
      },
      {
        icon: Mail, title: 'Email signature generator', tier: 'Pro',
        desc: 'Generate a branded email signature straight from your card in seconds.',
        how: 'Generate the signature, copy it, and paste it into Gmail, Outlook or Apple Mail.',
      },
      {
        icon: Monitor, title: 'Zoom & Teams backgrounds', tier: 'Pro',
        desc: 'Branded virtual backgrounds with your name and QR code for video calls.',
        how: 'Download your background image and set it in Zoom or Teams; guests can scan your QR mid-call.',
      },
    ],
  },
]

const FAQS = [
  {
    q: 'Is Cardtly free?',
    a: 'Yes. Creating and sharing a Cardtly digital business card is free forever, with no credit card required. Pro at R65 per month unlocks templates, custom branding, analytics, lead capture, follow-up tools and more.',
  },
  {
    q: 'What is a digital business card?',
    a: 'A digital business card is a shareable web page with your contact details, links and branding. People open it by tapping an NFC card, scanning a QR code or clicking a link, and save you to their phone in one tap. There is nothing to print or reprint.',
  },
  {
    q: 'Do I need an app to use it?',
    a: 'No. Your card opens in any web browser, and the person receiving it needs nothing installed. There is also an optional Android app that adds tap-to-share NFC and offline access.',
  },
  {
    q: 'Can I capture leads with my card?',
    a: 'Yes. Switch on the contact capture form and every visitor who shares their details lands in your Contacts, emails you instantly, and can be followed up on WhatsApp. It is a lightweight CRM built into your card.',
  },
  {
    q: 'Can I export my contacts to Excel?',
    a: 'Yes. One click on the Contacts page downloads a clean, colour-branded Excel spreadsheet of every lead, including names, emails, companies, sources and questionnaire answers, ready for your CRM or mailing list.',
  },
  {
    q: 'Does Cardtly work with NFC cards?',
    a: 'Yes. Order a Cardtly NFC card and tap it to any phone to open your profile instantly, with no app needed on either end. Cards are posted across South Africa.',
  },
  {
    q: 'Can I use Cardtly for my whole team?',
    a: 'Yes. Cardtly for Teams gives every member an on-brand card with locked company branding, member-managed details, and one admin dashboard showing every card’s views and leads. It is priced per seat.',
  },
  {
    q: 'What is the difference between Free and Pro?',
    a: 'Free covers the essentials: your profile, a public card URL, QR code and contact saving. Pro adds designer templates, custom branding, galleries and links, analytics, lead capture, meeting booking, the paper card scanner, WhatsApp follow-up, Excel export and the weekly digest.',
  },
]

export default function FeaturesPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-14 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Features</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Everything your card<br /><span style={gradText}>can do.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            One digital business card that shares in a tap, captures leads, follows up for you and tells you what is working. Free to start, no credit card needed.
          </p>
          {/* Tier legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-8 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="flex items-center gap-1.5"><TierPill tier="Free" /> included free</span>
            <span className="flex items-center gap-1.5"><TierPill tier="Pro" /> with Pro</span>
            <span className="flex items-center gap-1.5"><TierPill tier="Add-on" /> optional extra</span>
          </div>
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
      {GROUPS.map((group, gi) => {
        const featured = group.features.filter(f => f.visual)
        const compact = group.features.filter(f => !f.visual)
        return (
          <section key={group.eyebrow} className="py-14 px-6" style={gi % 2 === 1 ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
            <div className="max-w-6xl mx-auto">
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: group.color }}>{group.eyebrow}</p>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight max-w-2xl">{group.heading}</h2>
              </div>

              {/* Featured rows: text + visual, alternating sides */}
              <div className="space-y-8 mb-8">
                {featured.map((f, fi) => (
                  <div key={f.title} className="grid md:grid-cols-2 gap-6 lg:gap-10 items-center">
                    <div className={fi % 2 === 1 ? 'md:order-2' : ''}>
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <IconBox Icon={f.icon} accent={group.color} big />
                        <div className="flex items-center gap-1.5">
                          {f.isNew && <NewBadge />}
                          <TierPill tier={f.tier} />
                        </div>
                      </div>
                      <h3 className="text-2xl font-black tracking-tight text-white mb-3">{f.title}</h3>
                      <p className="text-base leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{f.desc}</p>
                      <HowLine how={f.how} accent={group.color} />
                    </div>
                    <div className={fi % 2 === 1 ? 'md:order-1' : ''}>
                      <MockPanel accent={group.color}>{f.visual}</MockPanel>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compact cards for the rest */}
              {compact.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compact.map(f => (
                    <div key={f.title} className="rounded-2xl p-6 transition-all hover:bg-white/5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <IconBox Icon={f.icon} accent={group.color} />
                        <div className="flex items-center gap-1.5">
                          {f.isNew && <NewBadge />}
                          <TierPill tier={f.tier} />
                        </div>
                      </div>
                      <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>{f.desc}</p>
                      <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <HowLine how={f.how} accent={group.color} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}

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

      {/* FAQ */}
      <section className="py-16 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Questions</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
              Frequently asked <span style={gradText}>questions.</span>
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="font-bold mb-2">{q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{a}</p>
              </div>
            ))}
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
