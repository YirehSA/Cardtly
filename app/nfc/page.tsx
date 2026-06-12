import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { Wifi, ArrowRight, Check, Smartphone, Zap, Shield, Package } from 'lucide-react'

export const metadata: Metadata = {
  title: 'NFC Business Cards South Africa — Tap to Share | R150 Once-off',
  description:
    'Order your NFC business card in South Africa. One tap opens your full digital business card on any modern phone - no app needed. R150 once-off plus R100 shipping, delivered in 5-7 business days nationwide.',
  alternates: { canonical: '/nfc' },
}

// Product schema: the NFC card is a physical product with a price,
// which makes it eligible for product rich results in search.
const NFC_PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Cardtly NFC Business Card',
  description:
    'Physical NFC business card linked to your Cardtly digital business card. Tap any modern smartphone to share your details instantly - no app required.',
  brand: { '@type': 'Brand', name: 'Cardtly' },
  offers: {
    '@type': 'Offer',
    price: '150',
    priceCurrency: 'ZAR',
    availability: 'https://schema.org/InStock',
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '100', currency: 'ZAR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ZA' },
    },
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
  'Available in Black or White',
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
                <span>R150 once-off</span>
                <span>·</span>
                <span>R100 shipping</span>
                <span>·</span>
                <span>Pro subscribers only</span>
              </div>
            </div>

            {/* Card mockup */}
            <div className="relative flex flex-col gap-6">
              {/* Black card — front */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl"
                style={{ aspectRatio: '1.586', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, transparent 60%)' }} />
                <div className="absolute top-4 right-4 opacity-20">
                  <Wifi className="w-5 h-5 text-white rotate-90" />
                </div>
                {/* Logo placeholder */}
                <div className="absolute top-5 left-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                    style={{ background: grad }}>C</div>
                </div>
                {/* Name */}
                <div className="absolute bottom-5 left-5">
                  <p className="font-black text-base text-white">Andre Nel</p>
                  <p className="text-xs mt-0.5" style={{ color: '#00d4ff' }}>Founder & CEO</p>
                </div>
                <div className="absolute bottom-5 right-5">
                  <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>Cardtly</p>
                </div>
                {/* Front label */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>Front</div>
              </div>

              {/* White card — back */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center gap-3"
                style={{ aspectRatio: '1.586', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(124,58,237,0.05) 100%)' }} />
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://cardtly.com/card/demo&bgcolor=ffffff&color=111827&margin=2"
                  style={{ width: 80, height: 80, borderRadius: 6 }}
                  alt="QR preview"
                />
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-800">Scan to connect</p>
                  <p className="text-xs mt-0.5 text-gray-400">cardtly.com/card/yourname</p>
                </div>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.35)' }}>Back</div>
              </div>

              {/* Floating tap indicator */}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-xl"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(124,58,237,0.3))', border: '1px solid rgba(0,212,255,0.3)', backdropFilter: 'blur(12px)' }}>
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
              { n: '01', title: 'Upgrade to Pro',    desc: 'NFC cards are a Pro feature. Start with a free Cardtly account and upgrade when ready.' },
              { n: '02', title: 'Choose your card',  desc: 'Pick Black or White. Confirm your name, job title, and shipping address. Takes 2 minutes.' },
              { n: '03', title: 'We ship to you',    desc: 'Pay R250 (card + shipping) and your NFC card arrives within 5–7 business days anywhere in SA.' },
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
                <div className="space-y-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <div className="flex gap-8">
                    <span>NFC card</span><span className="text-white font-semibold">R150</span>
                  </div>
                  <div className="flex gap-8">
                    <span>Shipping</span><span className="text-white font-semibold">R100</span>
                  </div>
                  <div className="flex gap-8 text-base font-black text-white">
                    <span>Total</span><span style={gradText}>R250</span>
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
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Free account · Upgrade to Pro · Order your NFC card
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
