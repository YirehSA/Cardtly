import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, UserPlus, Palette, Truck, Inbox } from 'lucide-react'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import PackageOffer from '@/components/marketing/PackageOffer'
import FaqSection from '@/components/marketing/FaqSection'
import Reveal from '@/components/marketing/Reveal'
import { graph, breadcrumb } from '@/lib/seo-schema'
import { NFC_TIERS } from '@/lib/nfc-pricing'
import { SEAT_PRICE_RAND } from '@/lib/org-billing'
import { BUNDLE_PRICE_RAND, bundleRenewalRand, bundleSavingRand } from '@/lib/pro-bundle'

// The R999 package on a page of its own: one address to put in an ad, a post
// or an email. Closed to the iOS app with every other page that quotes a price
// (lib/app-platform IOS_BLOCKED_ROUTES, middleware matcher).

export const metadata: Metadata = {
  title: `A Year of Pro and an NFC Business Card for R${BUNDLE_PRICE_RAND}`,
  description:
    `Twelve months of Cardtly Pro and your own NFC business card, printed in your design and delivered in South Africa, for R${BUNDLE_PRICE_RAND}. For individuals and businesses.`,
  alternates: { canonical: '/package' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}
const BODY = 'rgba(255,255,255,0.68)'

export default function PackagePage() {
  const renewal = bundleRenewalRand()

  const steps = [
    { icon: UserPlus, title: 'Create your account', text: 'Your digital card is live in minutes, on your own link.' },
    { icon: Palette, title: 'Choose your card', text: `${NFC_TIERS.standard.label} or ${NFC_TIERS.custom.label.toLowerCase()}, black or white, then pay R${BUNDLE_PRICE_RAND} once.` },
    { icon: Truck, title: 'Approve and receive', text: 'We email you a proof, print it once you approve, and deliver within 5 to 7 business days.' },
    { icon: Inbox, title: 'Hand it out', text: 'One tap opens your card. Everyone who saves your details or fills in your form comes back to you as a lead.' },
  ]

  const faqs = [
    { q: `What do I get for R${BUNDLE_PRICE_RAND}?`, a: `Twelve months of Cardtly Pro with every feature, and one NFC business card printed in your design and delivered to you anywhere in South Africa. Bought separately, the same costs R${bundleSavingRand()} or more extra.` },
    { q: 'Is it for individuals or for businesses?', a: 'Both. It is one card for one person: a consultant, an agent, a freelancer, or the owner of a business. A business that wants cards for its staff can add a team from the same account later, with each person on their own seat.' },
    { q: 'Which card designs can I choose?', a: `Either one, for the same price. The ${NFC_TIERS.standard.label.toLowerCase()} puts your logo and colours on the Cardtly layout. The ${NFC_TIERS.custom.label.toLowerCase()} is designed around your brand instead. Both are proofed before anything is printed.` },
    { q: 'What happens after the first year?', a: `Your Pro renews at R${renewal} a year, charged to the card you paid with, until you cancel. You can cancel at any time from Billing in your settings: you are not charged again, and your card stays live until the end of the year you have paid for. The renewal does not include another NFC card.` },
    { q: 'Can I start with the free trial first?', a: 'Yes. Every new account gets 7 days of the full product with no card needed, and you can choose the package at any point during the trial.' },
    { q: 'Can I order more cards later?', a: `Yes. Extra NFC cards are available from R${NFC_TIERS.standard.price} each, and team seats from R${SEAT_PRICE_RAND} a seat a month.` },
  ]

  const jsonLd = graph(breadcrumb([{ name: 'Pro and NFC card package', path: '/package' }]))

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <div className="pt-16">
        <PackageOffer as="h1" eyebrow="The Cardtly starter package" />
      </div>

      {/* How it works */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12">
              From sign-up to <span style={gradText}>card in hand.</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 80} className="h-full">
                <div className="h-full p-6 rounded-3xl lift-card"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.4)' }}>
                      <Icon className="w-5 h-5" style={{ color: '#a78bfa' }} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>Step {i + 1}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/signup?package=1"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.45)' }}>
              Get the package for R{BUNDLE_PRICE_RAND}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <FaqSection
        faqs={faqs}
        id="package-faq"
        eyebrow="Questions, answered"
        heading="The package, explained."
      />

      <Footer />
    </div>
  )
}
