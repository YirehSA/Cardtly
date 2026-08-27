import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { Wifi, ArrowRight, Check, Smartphone, Zap, Shield, Package } from 'lucide-react'
import CardSamples from '@/components/marketing/CardSamples'
import { availableSamples } from '@/lib/nfc-samples'

export const metadata: Metadata = {
  // 72 characters with the "%s | Cardtly" template applied, so Google cut it.
  title: { absolute: 'NFC Business Cards South Africa | Tap to Share | Cardtly' },
  description:
    'Order an NFC business card in South Africa. One tap opens your digital card on any phone, no app needed. From R150 plus R100 shipping, 5-7 days.',
  alternates: { canonical: '/nfc' },
}

// Real printed cards, front and back. Files live in public/nfc-samples.
// The section only renders for samples whose images are actually present, so
// dropping the files in makes it appear and a missing file can never ship as a
// broken image on the marketing page.
import { NFC_TIERS, NFC_TIER_LIST, NFC_SHIPPING_RAND } from '@/lib/nfc-pricing'

const AVAILABLE_SAMPLES = availableSamples()

// Product schema: the NFC card is a physical product with a price,
// which makes it eligible for product rich results in search.
const NFC_PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Cardtly NFC Business Card',
  // Google's Merchant listing rich results REQUIRE an image. This was the
  // brand badge with a note to swap it for a real product photo once we had
  // one - we do now, so search results show the actual card rather than a logo.
  image: [
    'https://cardtly.com/nfc-samples/yireh-front.jpg',
    'https://cardtly.com/nfc-samples/cardtly-front.jpg',
    'https://cardtly.com/nfc-samples/sicon-front.jpg',
  ],
  description:
    'Physical NFC business card linked to your Cardtly digital business card. Tap any modern smartphone to share your details instantly - no app required.',
  brand: { '@type': 'Brand', name: 'Cardtly' },
  // Two design tiers means AggregateOffer with a low and a high price.
  // Declaring the range as a single Offer is what Google rejects.
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: String(NFC_TIERS.standard.price),
    highPrice: String(NFC_TIERS.custom.price),
    offerCount: NFC_TIER_LIST.length,
    priceCurrency: 'ZAR',
    availability: 'https://schema.org/InStock',
    offers: NFC_TIER_LIST.map(t => ({
      '@type': 'Offer',
      name: t.label,
      description: t.summary,
      price: String(t.price),
      priceCurrency: 'ZAR',
      availability: 'https://schema.org/InStock',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: String(NFC_SHIPPING_RAND), currency: 'ZAR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ZA' },
      },
      url: 'https://cardtly.com/nfc',
    })),
    url: 'https://cardtly.com/nfc',
  },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const FEATURES = [
  {
    icon: Zap,
    title: 'One tap. Done.',
    desc: 'Hold your card to any iPhone or Android phone. No app needed. Your full Cardtly profile opens instantly.',
  },
  {
    icon: Smartphone,
    title: 'Works on every phone',
    desc: 'NFC is built into every iPhone since 2018 and virtually every Android. No special app, no Bluetooth, no QR scan needed.',
  },
  {
    icon: Shield,
    title: 'Always up to date',
    desc: 'The card links to your live Cardtly profile. Update your number, add a new link, change your job — the card always shows the latest.',
  },
  {
    icon: Package,
    title: 'Built to last',
    desc: 'Premium PVC, the same material as a bank card. No battery, no charging, no expiry. One card for years.',
  },
]

const SPECS = [
  '85.6 × 54mm — standard credit card size',
  'NFC chip — tap to share, no app required',
  'Premium PVC print, matte finish',
  'Your own artwork, printed edge to edge',
  'Front: Logo, full name, job title',
  'Back: QR code linking to your Cardtly card',
  'Compatible with iPhone 7+ and all NFC-enabled Android phones',
  'Delivered in 5–7 business days',
  'South Africa only',
]

export default function NFCMarketingPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(NFC_PRODUCT_SCHEMA) }}
      />
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.1) 40%, transparent 70%)' }} />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6 border"
                style={{ border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', background: 'rgba(0,212,255,0.08)' }}>
                <Wifi className="w-3 h-3" />
                NFC Business Cards · Pro only · 🇿🇦 SA only
              </div>

              <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none mb-6">
                Tap once.<br />
                <span style={gradText}>Share everything.</span>
              </h1>

              <p className="text-lg leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                A physical NFC business card that opens your full digital business card with a single tap. No scanning, no typing, no app. Just tap and connect.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="/signup"
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
                  style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.4)' }}>
                  Get your NFC card <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/pricing"
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
                  See Pro pricing
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>From R{NFC_TIERS.standard.price} once-off</span>
                <span>·</span>
                <span>R{NFC_SHIPPING_RAND} shipping</span>
                <span>·</span>
                <span>Pro subscribers only</span>
              </div>
            </div>

            {/* Real cards, not a drawing of one. This used to be two divs
                styled to look like a card - a placeholder "C" logo, a made-up
                name and a demo QR - which is a strange thing to lead with when
                selling a physical object we have actually printed. */}
            <div className="relative pb-10">
              {/* Three real cards, fanned. A single black card on a black page
                  reads as an outline and nothing else, and one card cannot show
                  that the artwork is yours - three different ones do both. */}
              <div className="relative mx-auto" style={{ maxWidth: 470, aspectRatio: '1.08' }}>
                {[
                  { src: '/nfc-samples/sicon-front.jpg',   alt: 'Printed Cardtly NFC card for Sicon Group',
                    style: { top: '0%',  left: '14%', transform: 'rotate(-11deg)', width: '80%', zIndex: 1 } },
                  { src: '/nfc-samples/cardtly-front.jpg', alt: 'Printed Cardtly NFC card for Cardtly',
                    style: { top: '25%', left: '0%',  transform: 'rotate(-1deg)',  width: '80%', zIndex: 2 } },
                  { src: '/nfc-samples/yireh-front.jpg',   alt: 'Printed Cardtly NFC card for Yireh Business Solutions',
                    style: { top: '50%', left: '17%', transform: 'rotate(7deg)',   width: '80%', zIndex: 3 } },
                ].map(({ src, alt, style }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={alt} width={1200} height={767}
                    className="absolute rounded-2xl"
                    style={{
                      ...style,
                      border: '1px solid rgba(255,255,255,0.14)',
                      boxShadow: '0 26px 60px rgba(0,0,0,0.75)',
                    }} />
                ))}
              </div>

              {/* Floating tap indicator */}
              <div className="absolute right-0 top-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-xl"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(124,58,237,0.3))', border: '1px solid rgba(0,212,255,0.3)', backdropFilter: 'blur(12px)', zIndex: 4 }}>
                <Wifi className="w-4 h-4 inline mr-1.5" />
                Tap to share
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">
              Why physical <span style={gradText}>still matters.</span>
            </h2>
            <p className="mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              A tap is faster than a QR scan, more memorable than a link, and impossible to lose in a pocket.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))' }}>
                  <Icon className="w-5 h-5" style={{ color: '#00d4ff' }} />
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What goes on each side. The two lines about front and back used to be
          buried in the spec list; a photo of each side says it immediately. */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black tracking-tight">
              Two sides, <span style={gradText}>both working.</span>
            </h2>
            <p className="mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Tap it against a phone, or let them scan the back. Either way they land on your card.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {[
              { src: '/nfc-samples/sicon-front.jpg', label: 'Front',
                alt: 'The front of a printed Cardtly NFC card for Sicon Group',
                title: 'Your brand, full bleed',
                desc: 'Logo, name and job title on your own artwork. The NFC chip sits inside - one tap opens your card, no app.' },
              { src: '/nfc-samples/sicon-back.jpg', label: 'Back',
                alt: 'The back of a printed Cardtly NFC card, showing the QR code',
                title: 'A QR for everyone else',
                desc: 'Older phones and locked-down work devices can still scan. The code points at your live card, so it never goes stale.' },
            ].map(({ src, label, alt, title, desc }) => (
              <div key={label}>
                {/* Label sits above the card, not on it - overlaid it landed on
                    the Cardtly mark in the corner of the artwork. */}
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt} width={1200} height={767}
                  className="w-full rounded-2xl"
                  style={{ border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                <h3 className="font-bold text-lg mt-5 mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real printed cards. Front shows the brand, back carries the QR. */}
      {AVAILABLE_SAMPLES.length > 0 && (
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">
              Cards we&apos;ve <span style={gradText}>actually printed.</span>
            </h2>
            <p className="mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Artwork and proofing are included in both prices, with no design fee on top. Tap any card to see the back.
            </p>
          </div>
          <CardSamples samples={AVAILABLE_SAMPLES} />
        </div>
      </section>
      )}

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">
              Order in <span style={gradText}>3 steps.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { n: '01', title: 'Create your card',  desc: 'Sign up, no credit card needed, and get your Cardtly card set up first.' },
              { n: '02', title: 'Pick your design', desc: 'Standard puts your logo and colours on our layout. Custom is designed around your brand instead. Confirm your name, job title and shipping address.' },
              { n: '03', title: 'We ship to you',    desc: 'Pay the invoice and your NFC card arrives within 5–7 business days anywhere in SA. Shipping is R100 for the whole order, however many cards are on it.' },
            ].map(({ n, title, desc }) => (
              <div key={n}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                  {n}
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight">
              Card <span style={gradText}>specifications.</span>
            </h2>
          </div>
          <div className="rounded-3xl p-8"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SPECS.map(spec => (
                <div key={spec} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                  {spec}
                </div>
              ))}
            </div>

            {/* Pricing summary */}
            <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {NFC_TIER_LIST.map(t => (
                    <div key={t.id} className="flex items-baseline justify-between gap-8">
                      <span>
                        <span className="text-white font-semibold">{t.label}</span>
                        <span className="block text-xs">{t.summary}</span>
                      </span>
                      <span className="text-white font-semibold whitespace-nowrap">R{t.price}</span>
                    </div>
                  ))}
                  <div className="flex gap-8 justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <span>Shipping, per order</span><span className="text-white font-semibold">R{NFC_SHIPPING_RAND}</span>
                  </div>
                  <div className="flex gap-8 justify-between text-base font-black text-white">
                    <span>One standard card, delivered</span>
                    <span style={gradText}>R{NFC_TIERS.standard.price + NFC_SHIPPING_RAND}</span>
                  </div>
                </div>
                <Link href="/signup"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: grad, boxShadow: '0 6px 24px rgba(124,58,237,0.35)' }}>
                  Order now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Ready to tap <span style={gradText}>your way in?</span>
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Get a Pro account, order your card, and never run out of business cards again.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.4)' }}>
            Sign up <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            R97 a card a month · Order your NFC card
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
