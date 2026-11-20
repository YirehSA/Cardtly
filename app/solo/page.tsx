import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Minus, LayoutTemplate, QrCode, Users, Link2, Wifi, BadgeCheck, Smartphone, RefreshCw, Coins } from 'lucide-react'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import PlanPrice from '@/components/marketing/PlanPrice'
import { graph, breadcrumb, faqPage, softwareApplication } from '@/lib/seo-schema'
import { PRO_PRICE_RAND, SOLO_PRICE_RAND } from '@/lib/plan-prices'
import { SOLO_MAX_IMAGES, SOLO_MAX_LINKS, SOLO_TEMPLATES } from '@/lib/solo'
import { SEAT_PRICE_RAND } from '@/lib/org-billing'
import { NFC_TIERS } from '@/lib/nfc-pricing'

// Cardtly Solo on a page of its own (Andre, 2026-11-20: "we want to be the best
// in the market for this"): one person's card from R49 a month, in rand. One
// address for ads, posts and the home page's "Just you?" link.
//
// Every figure comes from lib/plan-prices and lib/solo. No competitor is named:
// their prices change, and a comparison that was true last month is a false
// claim this month. What is said instead is true of the market as a whole: the
// big international card apps bill in dollars, at several times this.
//
// The trial is not advertised (Andre: people choose a plan). Closed to the iOS
// app with every page that quotes a price (IOS_BLOCKED_ROUTES, middleware).

export const metadata: Metadata = {
  title: { absolute: `Cardtly Solo: Your Digital Business Card from R${SOLO_PRICE_RAND.monthly} a Month | Cardtly` },
  description:
    `Your own digital business card with a QR code, contacts and NFC, from R${SOLO_PRICE_RAND.monthly} a month or R${SOLO_PRICE_RAND.yearly} a year, billed in rand. ${SOLO_TEMPLATES.length} templates, your own link, live in minutes.`,
  alternates: { canonical: '/solo' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
}
const BODY = 'rgba(255,255,255,0.68)'
const DIM = 'rgba(255,255,255,0.6)'
const MINT = '#34d399'
const panel: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }

const templateNames = SOLO_TEMPLATES.map(t => t[0].toUpperCase() + t.slice(1))

const FEATURES = [
  { icon: LayoutTemplate, title: `${SOLO_TEMPLATES.length} card templates`, text: `${templateNames.slice(0, -1).join(', ')} and ${templateNames.slice(-1)}, in your own colours and fonts.` },
  { icon: QrCode, title: 'Your QR code', text: 'Ready to share on your phone, print on a flyer or put on your email. It always opens your latest card.' },
  { icon: Users, title: 'Contacts', text: 'When someone saves your card they can send their details back, and they land in your contacts.' },
  { icon: Link2, title: 'Links and photos', text: `Up to ${SOLO_MAX_LINKS} link buttons and ${SOLO_MAX_IMAGES} gallery photos: your website, your menu, your reviews, your work.` },
  { icon: Wifi, title: 'Works with NFC cards', text: `Tap your Cardtly NFC card on any phone and your card opens. NFC cards are from R${NFC_TIERS.standard.price}, printed in South Africa.` },
  { icon: BadgeCheck, title: 'Your own link, for good', text: 'cardtly.com/card/your-name. It never changes, so nothing you print or share ever goes out of date.' },
]

const WHY = [
  { icon: Coins, title: 'Priced for South Africa', text: `R${SOLO_PRICE_RAND.monthly} a month is under R2 a day, billed in rand. The big international card apps bill in dollars, at several times that.` },
  { icon: Smartphone, title: 'Nothing to install', text: 'Your card opens in any phone browser. People save you to their contacts in one tap, with no app on either side.' },
  { icon: RefreshCw, title: 'Never reprint again', text: 'Change your number, title or photo and every QR code and NFC card you have handed out shows the new details straight away.' },
]

// Solo against Pro, row by row. Only what each plan really does (lib/solo).
const COMPARE: Array<[string, string | boolean, string | boolean]> = [
  ['Card templates', String(SOLO_TEMPLATES.length), '16'],
  ['Link buttons', `Up to ${SOLO_MAX_LINKS}`, 'Up to 10'],
  ['Gallery photos', `Up to ${SOLO_MAX_IMAGES}`, 'Up to 10'],
  ['Photo, logo, bio, socials, WhatsApp', true, true],
  ['QR code', true, 'With your logo'],
  ['Contacts who share their details back', true, true],
  ['Works with NFC cards', true, true],
  ['Lead capture form and your own questions', false, true],
  ['Book a meeting from your card', false, true],
  ['Analytics', false, true],
  ['Email signature and virtual backgrounds', false, true],
  ['Paper business card scanner', false, true],
]

export default function SoloPage() {
  const faqs = [
    { q: 'What is Cardtly Solo?', a: `Your own digital business card for R${SOLO_PRICE_RAND.monthly} a month, or R${SOLO_PRICE_RAND.yearly} a year. You get ${SOLO_TEMPLATES.length} templates, up to ${SOLO_MAX_LINKS} links and ${SOLO_MAX_IMAGES} gallery photos, your QR code, your contacts and your own link, and it works with Cardtly NFC cards.` },
    { q: 'What is the difference between Solo and Pro?', a: `Pro is R${PRO_PRICE_RAND.monthly} a month and adds everything else Cardtly does: all 16 templates, up to 10 links and photos, lead capture, meeting booking, analytics, an email signature, virtual backgrounds and the paper card scanner. Solo is the card itself, done properly.` },
    { q: 'Can I move to Pro later?', a: 'Yes, any time, from your dashboard. Your card keeps its link, and your Solo subscription stops when Pro starts, so you are never charged for both.' },
    { q: 'Can I use Solo for my team?', a: `Solo is one card for one person. For a team, Cardtly Teams is from R${SEAT_PRICE_RAND} a seat a month, with your company look on every card and one dashboard for all of them.` },
    { q: 'Do I need an NFC card?', a: `No. Your QR code and your link work on their own. If you want to tap your card on someone's phone, NFC cards are from R${NFC_TIERS.standard.price}, printed and delivered in South Africa.` },
    { q: 'How do I pay, and can I cancel?', a: `By card through Paystack, in rand, monthly or yearly (R${SOLO_PRICE_RAND.yearly} a year saves R${SOLO_PRICE_RAND.monthly * 12 - SOLO_PRICE_RAND.yearly}). Cancel any time from your settings: you are not charged again, and your card stays live until the end of the period you have paid for.` },
  ]

  const jsonLd = graph(
    faqPage(faqs),
    breadcrumb([{ name: 'Cardtly Solo', path: '/solo' }]),
    softwareApplication({
      name: 'Cardtly Solo',
      path: '/solo',
      description: "One person's digital business card with a QR code, contacts and NFC, billed in rand.",
      price: SOLO_PRICE_RAND.monthly,
      priceCurrency: 'ZAR',
      priceNote: 'per month',
    }),
  )

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      {/* Hero, with the price and the button beside it. */}
      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="absolute -top-32 left-[10%] w-[700px] h-[560px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.14) 0%, rgba(124,58,237,0.10) 55%, transparent 72%)' }} />
        <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 xl:gap-16 items-center" style={{ maxWidth: 1300, zIndex: 2 }}>
          <div className="text-center lg:text-left">
            <p className="animate-fade-up text-sm font-bold uppercase tracking-widest mb-4" style={{ color: MINT }}>Cardtly Solo</p>
            <h1 className="animate-fade-up font-black tracking-[-0.02em] leading-[1.04] mb-6" style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              Your digital business card.<br /><span style={gradText}>From R{SOLO_PRICE_RAND.monthly} a month.</span>
            </h1>
            <p className="animate-fade-up-delayed text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8" style={{ color: BODY }}>
              Everything one person needs to share their details with a tap, a scan or a link. Billed in rand, under R2 a day,
              and you can cancel any time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/signup?plan=solo"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
                Choose Solo
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/pricing#solo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}>
                Compare all plans
              </Link>
            </div>
            <p className="mt-5 text-sm" style={{ color: DIM }}>Your own link for good · No app to install · Works with NFC cards</p>
          </div>

          <div className="rounded-3xl p-8" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <PlanPrice tier="solo" />
            <div className="space-y-2.5">
              {FEATURES.map(f => (
                <div key={f.title} className="flex items-start gap-3 text-sm" style={{ color: BODY }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: MINT }} />
                  {f.title}
                </div>
              ))}
            </div>
            <Link href="/signup?plan=solo"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: grad }}>
              Choose Solo <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12">
              Everything your card <span style={gradText}>needs to do.</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 60} className="h-full">
                <div className="h-full p-6 rounded-3xl lift-card" style={panel}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)' }}>
                    <Icon className="w-5 h-5" style={{ color: MINT }} aria-hidden="true" />
                  </span>
                  <h3 className="font-bold mb-1.5">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why Solo */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {WHY.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 80} className="h-full">
              <div className="h-full p-6 rounded-3xl" style={panel}>
                <Icon className="w-6 h-6 mb-3" style={{ color: '#a78bfa' }} aria-hidden="true" />
                <h2 className="text-lg font-bold mb-1.5">{title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Solo or Pro */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-3">
              Solo or <span style={gradText}>Pro?</span>
            </h2>
            <p className="text-center mb-10" style={{ color: BODY }}>
              Solo is the card itself. Pro adds the tools that win you work. You can move up any time.
            </p>
          </Reveal>
          <div className="rounded-3xl overflow-hidden" style={panel}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="text-left font-semibold p-4" style={{ color: DIM }}><span className="sr-only">Feature</span></th>
                  <th className="p-4 font-bold" style={{ color: MINT }}>Solo<span className="block text-xs font-medium" style={{ color: DIM }}>R{SOLO_PRICE_RAND.monthly}/month</span></th>
                  <th className="p-4 font-bold" style={{ color: '#a78bfa' }}>Pro<span className="block text-xs font-medium" style={{ color: DIM }}>R{PRO_PRICE_RAND.monthly}/month</span></th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, solo, pro]) => (
                  <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="p-4" style={{ color: BODY }}>{label}</td>
                    {[solo, pro].map((v, i) => (
                      <td key={i} className="p-4 text-center">
                        {v === true ? <Check className="w-4 h-4 inline" style={{ color: i === 0 ? MINT : '#a78bfa' }} aria-label="included" />
                          : v === false ? <Minus className="w-4 h-4 inline" style={{ color: 'rgba(255,255,255,0.3)' }} aria-label="not included" />
                          : <span style={{ color: 'rgba(255,255,255,0.85)' }}>{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-black text-center mb-10">Questions about <span style={gradText}>Solo.</span></h2>
          </Reveal>
          <div className="space-y-4">
            {faqs.map(({ q, a }, i) => (
              <Reveal key={q} delay={i * 50}>
                <div className="p-6 rounded-2xl lift-card" style={panel}>
                  <h3 className="font-bold mb-2">{q}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>{a}</p>
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
            Your card, live <span style={gradText}>today.</span>
          </h2>
          <p className="mb-8" style={{ color: BODY }}>
            Cardtly Solo from R{SOLO_PRICE_RAND.monthly} a month. Set it up in minutes and cancel any time.
          </p>
          <Link href="/signup?plan=solo"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
            Choose Solo <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
