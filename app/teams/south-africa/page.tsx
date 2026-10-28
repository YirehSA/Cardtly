import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Phone, Banknote, Nfc, CreditCard, ShieldCheck, MessageCircle, KeyRound, Building2, Globe } from 'lucide-react'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import FaqSection from '@/components/marketing/FaqSection'
import { SEAT_PRICE_RAND, MAX_SELF_SERVE_SEATS } from '@/lib/org-billing'
import { graph, breadcrumb } from '@/lib/seo-schema'
import { COMPANY, COMPANY_TEL } from '@/lib/company'

// THE SOUTH AFRICA PAGE FOR TEAMS, added 2026-10-23. An SEO audit found the
// site outside the top 100 for "digital business cards for teams south
// africa". /teams is written for buyers anywhere, on purpose (see the comment
// on its metadata and lib/seo-schema areaServed), and the home page's h1 is a
// sales line, so neither says it. This page is the one answer to that search.
//
// It is NOT a copy of /teams with "South Africa" pasted in, which Google would
// treat as a doorway page. It carries what is specific to buying in South
// Africa: rand pricing, card or EFT, NFC cards made and delivered here, POPIA,
// WhatsApp, and where the data lives. Every fact is stated elsewhere on the
// site already (the /teams FAQ, the home page, the privacy policy, the PAIA
// manual); add nothing here that is not true there first.
//
// Under /teams, so it is blocked in the iOS app with its parent
// (IOS_BLOCKED_ROUTES is a prefix match, and middleware matches /teams/:path*),
// which is what lets it show prices.

export const metadata: Metadata = {
  title: { absolute: 'Digital Business Cards for Teams in South Africa | Cardtly' },
  description:
    'Branded digital business cards for South African teams. Priced in rand, NFC cards delivered across South Africa, EFT invoicing and a POPIA operator agreement.',
  alternates: { canonical: '/teams/south-africa' },
  openGraph: {
    title: 'Digital Business Cards for Teams in South Africa',
    description:
      'One branded card per employee, priced in rand, with NFC cards made and delivered in South Africa and a POPIA operator agreement.',
  },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}
const BODY = 'rgba(255,255,255,0.68)'
const DIM = 'rgba(255,255,255,0.5)'
const HAIR = 'rgba(255,255,255,0.1)'
const PANEL = 'rgba(255,255,255,0.03)'

const POINTS = [
  {
    icon: Banknote, title: 'Priced in rand',
    text: `From R${SEAT_PRICE_RAND} per card per month in South African rand, billed monthly or annually. Every card carries every feature, so the price never depends on what a team switches on.`,
  },
  {
    icon: CreditCard, title: 'Pay by card or EFT',
    text: `Teams of 2 to ${MAX_SELF_SERVE_SEATS} cards pay by card through Paystack, and an administrator issues cards without talking to anyone. Above ${MAX_SELF_SERVE_SEATS} seats we quote and invoice, and you pay by EFT or against a purchase order.`,
  },
  {
    icon: Nfc, title: 'NFC cards made for South Africa',
    text: 'Physical NFC cards are printed and delivered within South Africa in 5 to 7 days: R150 each for the standard design or R200 for one designed around your brand, plus R100 shipping per order rather than per card.',
  },
  {
    icon: ShieldCheck, title: 'POPIA in writing',
    text: 'Cardtly is your operator under POPIA, and section 5 of our terms is the written operator agreement sections 20 and 21 require. We have a named Information Officer and publish a PAIA manual.',
  },
  {
    icon: MessageCircle, title: 'Made for WhatsApp',
    text: 'Staff send their card to a phone number by WhatsApp or SMS, and follow up a captured lead on WhatsApp in one tap, straight from the lead.',
  },
  {
    icon: KeyRound, title: 'Sign in with Microsoft 365',
    text: 'Staff whose company runs Microsoft 365 sign in with their work account, so your own multi-factor and conditional access rules apply to Cardtly too.',
  },
]

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How much do digital business cards for teams cost in South Africa?',
    a: `Cardtly is from R${SEAT_PRICE_RAND} per card per month in South African rand, billed monthly or annually, and every card has the full feature set. Teams of 2 to ${MAX_SELF_SERVE_SEATS} cards are self-serve and pay by card. Above ${MAX_SELF_SERVE_SEATS} seats the arrangement is quoted and invoiced. Physical NFC cards are optional and separate: R150 each for the standard design or R200 for one designed around your brand, once off, plus R100 shipping per order, delivered within South Africa.`,
  },
  {
    q: 'Can a South African company pay by EFT?',
    a: `Yes. Invoiced teams, which includes every team above ${MAX_SELF_SERVE_SEATS} seats, receive a quote they can accept online, then an invoice they pay by EFT or against a purchase order. The team is switched on once the payment is received. Smaller teams can pay by card through Paystack instead and start straight away.`,
  },
  {
    q: 'How does Cardtly handle POPIA?',
    a: 'For the leads your cards capture and your staff\'s details on their cards, your organisation is the responsible party and Cardtly is its operator. Section 5 of our terms is the written operator agreement POPIA sections 20 and 21 require. We have a named Information Officer, publish a PAIA manual, will notify the Information Regulator and you of a breach as section 22 requires, and let you export or delete your data yourself.',
  },
  {
    q: 'Where is our information stored?',
    a: 'Our database and uploaded files are hosted by Supabase in its West Europe region, in the European Union. POPIA section 72 allows this where the recipient is bound by protection substantially similar to POPIA\'s, and the EU\'s GDPR is at least as strict. Storage only in South Africa is not offered as standard, so if your organisation requires it, tell us before you sign up.',
  },
  {
    q: 'How quickly can a team be up and running?',
    a: 'As soon as your people claim their cards. An administrator creates the cards one at a time or imports a spreadsheet of the whole company, each person is invited by email and claims a card that is already branded and filled in, and every card is live from the moment it is claimed, so a rollout needs no training session or launch date. Physical NFC cards follow in 5 to 7 days, delivered within South Africa.',
  },
]

const jsonLd = graph(breadcrumb([
  { name: 'For teams', path: '/teams' },
  { name: 'South Africa', path: '/teams/south-africa' },
]))

export default function TeamsSouthAfricaPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative px-5 sm:px-8 pt-28 sm:pt-32 pb-16">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] max-w-full h-[440px] rounded-full blur-[120px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-[900px] mx-auto">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#00d4ff' }}>
              <Link href="/teams" className="hover:underline">Cardtly for teams</Link> &middot; South Africa
            </p>

            {/* The phrase people search for, as one sentence; only the place
                is gradient. */}
            <h1 className="font-display text-[34px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] mt-6 text-white">
              Digital business cards for teams in{' '}
              <span className="whitespace-nowrap" style={gradText}>South Africa</span>
            </h1>

            <p className="text-base sm:text-lg mt-6 leading-relaxed" style={{ color: BODY }}>
              Cardtly is built in South Africa, for South African companies. Every employee gets a
              branded digital business card that the company owns and controls, shared by NFC tap, QR
              code or link, with no app for the person receiving it. It is priced in rand, the NFC
              cards are made and delivered here, and POPIA is covered in writing.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/contact"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}
              >
                Set up your team
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <a
                href={`tel:${COMPANY_TEL}`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-colors"
                style={{ border: `1px solid ${HAIR}`, background: PANEL }}
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                Call {COMPANY.phone}
              </a>
            </div>

            <dl className="grid grid-cols-3 gap-3 mt-10 pt-8" style={{ borderTop: `1px solid ${HAIR}` }}>
              {[
                { v: `From R${SEAT_PRICE_RAND}`, l: 'per card, per month' },
                { v: '5 to 7 days', l: 'NFC card delivery, SA' },
                { v: 'POPIA', l: 'operator agreement' },
              ].map(s => (
                <div key={s.l}>
                  <dt className="sr-only">{s.l}</dt>
                  <dd>
                    <span className="block font-display text-xl sm:text-2xl font-bold" style={gradText}>{s.v}</span>
                    <span className="block text-[11px] mt-1 leading-tight" style={{ color: DIM }}>{s.l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── What is specific to South Africa ───────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <h2 className="font-display text-[28px] sm:text-[40px] font-bold tracking-[-0.02em] leading-tight text-white max-w-[760px]">
                Built for how South African companies buy
              </h2>
              <p className="mt-4 max-w-[680px] leading-relaxed" style={{ color: BODY }}>
                Everything a team account does is on the{' '}
                <Link href="/teams" className="underline hover:text-white">digital business cards for teams</Link>{' '}
                page. These are the parts that matter when the company, the budget and the people are here.
              </p>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
              {POINTS.map(({ icon: Icon, title, text }, i) => (
                <Reveal key={title} delay={i * 60} className="h-full">
                  <div className="h-full p-6 rounded-3xl" style={{ background: PANEL, border: `1px solid ${HAIR}` }}>
                    <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center"
                      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <Icon className="w-4 h-4" style={{ color: '#a78bfa' }} aria-hidden="true" />
                    </span>
                    <h3 className="font-bold text-lg text-white mt-4">{title}</h3>
                    <p className="text-sm leading-relaxed mt-2" style={{ color: BODY }}>{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Groups, and where the data lives ───────────────────────── */}
        <section className="px-5 sm:px-8 pb-16 sm:pb-20">
          <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-4">
            <Reveal className="h-full">
              <div className="h-full p-8 rounded-3xl" style={{ background: PANEL, border: `1px solid ${HAIR}` }}>
                <Building2 className="w-5 h-5" style={{ color: '#00d4ff' }} aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-white mt-4">Groups with several companies</h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: BODY }}>
                  A group with businesses under it runs all of them from one account, on one invoice and
                  one seat pool, while each business keeps its own logo, colours, web address and manager.
                  Departments sit inside each company, each with its own head.
                </p>
              </div>
            </Reveal>
            <Reveal delay={80} className="h-full">
              <div className="h-full p-8 rounded-3xl" style={{ background: PANEL, border: `1px solid ${HAIR}` }}>
                <Globe className="w-5 h-5" style={{ color: '#00d4ff' }} aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-white mt-4">Where your information lives</h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: BODY }}>
                  Our database is hosted by Supabase in the European Union, under GDPR, which POPIA
                  section 72 allows. Card payments are made on Paystack and we never see a card number.
                  The details, and the documents a procurement team asks for, are in our{' '}
                  <Link href="/trust" className="underline hover:text-white">Trust Centre</Link>, our{' '}
                  <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link> and our{' '}
                  <Link href="/paia" className="underline hover:text-white">PAIA manual</Link>.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <FaqSection
          faqs={FAQ}
          id="faq"
          eyebrow="South Africa"
          heading={<>Teams in South Africa, <span style={gradText}>answered.</span></>}
        />

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-20 text-center">
          <div className="max-w-[720px] mx-auto">
            <h2 className="font-display text-[28px] sm:text-[40px] font-bold tracking-[-0.02em] leading-tight text-white">
              Give your team one card, <span style={gradText}>one brand.</span>
            </h2>
            <p className="mt-4 leading-relaxed" style={{ color: BODY }}>
              Tell us how many people and companies you have, and we will set the account up with you.
              Or order <Link href="/nfc" className="underline hover:text-white">NFC business cards</Link> for the
              whole team once the cards are live.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Link
                href="/contact"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}
              >
                Talk to us
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-colors"
                style={{ border: `1px solid ${HAIR}`, background: PANEL }}
              >
                Sign up
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
