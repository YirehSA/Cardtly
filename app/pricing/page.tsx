import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import { graph, faqPage, breadcrumb, softwareApplication } from '@/lib/seo-schema'
import Footer from '@/components/marketing/Footer'
import ProPlanPrice from '@/components/marketing/ProPlanPrice'
import Reveal from '@/components/marketing/Reveal'
import UsdEstimate from '@/components/marketing/UsdEstimate'
import { Check, ArrowRight, Zap, Building2, CreditCard, Sparkles } from 'lucide-react'
// Read from the billing code rather than typed in. The seat ceiling appears in
// four places on this page, and the Enterprise tile had drifted to "20+" while
// self-serve Teams already included the twentieth seat - so a team of exactly
// 20 was claimed by both tiers.
//
// THE PRICE HAD THE SAME PROBLEM AND WAS MISSED. That fix moved the seat count
// onto the constant and left "R97" typed out in six places: the title, the
// description, two FAQ answers, the Teams tile, the closing line and the USD
// estimate's zar prop. Changing SEAT_PRICE_RAND would have left the page
// quoting two different prices, which on a pricing page is the one mistake
// that costs money. Every one of them now reads from the constant.
import { MAX_SELF_SERVE_SEATS, SEAT_PRICE_RAND } from '@/lib/org-billing'

// Yearly is ten months for twelve. Derived rather than typed so it cannot
// drift from the monthly price either.
const YEAR_PRICE_RAND = SEAT_PRICE_RAND * 10
const TRIAL_DAYS = 7

export const metadata: Metadata = {
  title: `Digital Business Card Pricing, R${SEAT_PRICE_RAND} a Month`,
  description:
    `Free for ${TRIAL_DAYS} days, no credit card. Then R${SEAT_PRICE_RAND} per card a month or R${YEAR_PRICE_RAND} a year. Teams of 2 to ${MAX_SELF_SERVE_SEATS} seats at R${SEAT_PRICE_RAND} each. NFC cards from R150.`,
  alternates: { canonical: '/pricing' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// MEASURED, NOT CHOSEN BY EYE. Eleven text colours on this page failed WCAG AA
// against their real composited backgrounds, the worst of them the payment
// note at 2.02:1 and the price suffixes at 3.01:1. A suffix at 3:1 is not a
// detail here: "/ seat / month" is the half of the price that says what you
// are actually buying, and it was the least readable text in the block.
//
// #7c3aed is the deep brand purple. It measures 3.5:1 on this background and
// is used on borders and fills only; anything that is text uses the light
// variant, same rule as /teams.
const INK = 'rgba(255,255,255,0.92)'   // strong body
const BODY = 'rgba(255,255,255,0.68)'  // normal body, about 9:1
const DIM = 'rgba(255,255,255,0.6)'    // suffixes and captions, about 5.9:1
const LILAC = '#a78bfa'                // brand purple that passes as text
const MINT = '#34d399'

const PRO = [
  '12 card templates',
  'Custom accent colour and fonts',
  'Job title, bio, address, WhatsApp',
  'Up to 10 custom link buttons',
  'Social media profiles',
  'Gallery of up to 10 images',
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
  // The trial answer is new. Everything it says is already true and already
  // stated on the blog; it simply was not on the page where people decide.
  { q: `Is there a free trial?`, a: `Yes. Every signup gets ${TRIAL_DAYS} days of the full product with no credit card required: a customisable card, all three sharing methods, analytics, a contacts CRM and lead capture. Nothing is held back during the trial and nothing is charged if you walk away. After the ${TRIAL_DAYS} days it is R${SEAT_PRICE_RAND} a month to keep the card live.` },
  { q: `What does R${SEAT_PRICE_RAND} include?`, a: 'Everything. One card, every Cardtly feature: templates, custom branding, analytics, lead capture, meeting booking, WhatsApp follow-up, the paper card scanner and Excel export. There is no cut-down version.' },
  { q: 'Is there a team plan?', a: `Yes, and you can set it up yourself right now. Teams run from 2 to ${MAX_SELF_SERVE_SEATS} seats at R${SEAT_PRICE_RAND} a seat per month, with locked company branding, email invites, and one admin dashboard. Need more than ${MAX_SELF_SERVE_SEATS} seats? That is Enterprise, and we bill it by debit order.` },
  { q: `What happens above ${MAX_SELF_SERVE_SEATS} seats?`, a: 'You move to Enterprise. Same product, but billed by debit order instead of a card, with invoicing that suits your finance team. Talk to us and we will set it up.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel whenever you like, no lock-in and no cancellation fee. You keep Pro until the end of the period you have paid for.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards through Paystack, our secure payment partner. Billing is in South African rand (ZAR). International cards are welcome, your bank simply converts the rand amount at checkout. Enterprise is billed by debit order.' },
  { q: 'Will my card URL ever change?', a: 'Never. Your card URL is yours, and it stays the same no matter what you do with your plan. Anything you have printed or handed out keeps working.' },
]

export default function PricingPage() {
  // The FAQs are already on the page; this describes the same array, so the
  // schema cannot say something the reader cannot find.
  const jsonLd = graph(
    faqPage(FAQS),
    breadcrumb([{ name: 'Pricing', path: '/pricing' }]),
    softwareApplication({
      name: 'Cardtly',
      path: '/pricing',
      description:
        'Digital business card platform for individuals, teams and companies. One price per card with the full feature set, billed monthly or annually.',
      price: SEAT_PRICE_RAND,
      priceCurrency: 'ZAR',
      priceNote: 'per card per month',
    }),
  )

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

            {/* THE TRIAL, ON THE PAGE WHERE PEOPLE DECIDE. The comment that
                used to sit above this section said the trial was "the
                strongest thing in the offer, absent from the page where people
                decide" - and then it was never added. It is on the blog four
                times and was on this page nowhere. No credit card is the part
                that matters, so it is in the badge rather than a footnote. */}
            <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)', color: MINT }}>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Free for {TRIAL_DAYS} days, no credit card
            </div>

            <p className="animate-fade-up-delayed text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
              style={{ color: BODY }}>
              Then R{SEAT_PRICE_RAND} a card per month, whether it is just you or your whole team. No feature tiers,
              no surprises, with every feature included.
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
            {/* One tile per plan, in the order they scale. These were two
                identical R97 rows and a third about cancellation, which told
                nobody which plan they were on. */}
            {[
              { k: `R${SEAT_PRICE_RAND}`, v: 'Individual: per card, per month' },
              { k: `R${SEAT_PRICE_RAND} / seat`, v: `Pro Teams: 2 to ${MAX_SELF_SERVE_SEATS} seats, one invoice` },
              { k: `${MAX_SELF_SERVE_SEATS + 1}+ seats`, v: 'Enterprise: quoted on your seat count' },
            ].map(({ k, v }) => (
              <div key={v} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-black tracking-tight whitespace-nowrap" style={gradText}>{k}</p>
                <p className="text-sm mt-1" style={{ color: BODY }}>{v}</p>
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
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: BODY }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/signup"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.2)', color: INK }}>
              Start {TRIAL_DAYS} days free
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
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: LILAC }}>Teams</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black">R{SEAT_PRICE_RAND}</span>
                <span className="text-base pb-1" style={{ color: DIM }}>/ seat / month</span>
              </div>
              <UsdEstimate zar={SEAT_PRICE_RAND} suffix="/seat/mo" className="block text-sm font-medium mb-1 text-white/70" />
              <p className="text-sm mb-8 mt-1" style={{ color: BODY }}>
                2 to {MAX_SELF_SERVE_SEATS} seats. Set it up yourself in minutes.
              </p>
            </div>

            <div className="relative space-y-3 flex-1">
              {TEAMS.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: INK }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: LILAC }} />
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
              <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: DIM }}>
                <Building2 className="w-3.5 h-3.5" />Enterprise
              </p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black">{MAX_SELF_SERVE_SEATS + 1}+</span>
                <span className="text-base pb-1" style={{ color: DIM }}>seats</span>
              </div>
              <p className="text-sm mb-8 mt-1" style={{ color: BODY }}>
                Quoted on the number of seats you need, and billed by debit order.
              </p>
            </div>
            <div className="space-y-3 flex-1">
              {ENTERPRISE.map(f => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: BODY }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/contact"
              className="mt-8 block text-center py-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.2)', color: INK }}>
              Talk to us
            </Link>
          </div>
          </Reveal>
        </div>

        {/* Payment note. Was 12px at 0.25 alpha, which measures 2.02:1 and is
            the least readable text on the site: the line that tells somebody
            which currency they are charged in and that they can cancel. */}
        <p className="text-center text-sm mt-8 max-w-2xl mx-auto leading-relaxed" style={{ color: DIM }}>
          Secure payment in ZAR via Paystack. International cards welcome, your bank converts at checkout. Cancel anytime. Enterprise is billed by debit order.
        </p>

        {/* NFC add-on strip */}
        <div className="max-w-4xl mx-auto mt-10">
          <Reveal>
          <div className="p-6 rounded-2xl flex items-start gap-4 lift-card"
            style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
            {/* Was the 📇 emoji. Emoji render from whatever font the device
                happens to ship, so it was a different picture on every
                platform and the only non-lucide icon on the site. */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,212,255,0.14)', border: '1px solid rgba(0,212,255,0.3)' }}>
              <CreditCard className="w-5 h-5" style={{ color: '#22d3ee' }} aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-white mb-1">Want a physical NFC card too?</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: BODY }}>
                A sleek Cardtly NFC card you tap to any phone. R150 with your logo and colours on our layout, or R200 designed around your brand. Order a set for the whole team.
              </p>
              <Link href="/nfc" className="text-sm font-semibold inline-flex items-center gap-1 min-h-11 py-2 transition hover:opacity-80"
                style={{ color: '#22d3ee' }}>
                See the NFC cards <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
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
            Arm your team with <span style={gradText}>Cardtly.</span>
          </h2>
          <p className="mb-8" style={{ color: BODY }}>
            Free for {TRIAL_DAYS} days, then R{SEAT_PRICE_RAND} a card. Set up in minutes, cancel any time.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
            Start {TRIAL_DAYS} days free <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <p className="mt-4 text-sm" style={{ color: DIM }}>No credit card required.</p>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
