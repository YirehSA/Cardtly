import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import { graph, breadcrumb } from '@/lib/seo-schema'
import Footer from '@/components/marketing/Footer'
import { ArrowRight, Heart, Zap, Globe, Users } from 'lucide-react'

export const metadata: Metadata = {
  // 69 characters once the "%s | Cardtly" template was applied, so Google cut
  // it. absolute skips the template; this is 51.
  title: { absolute: 'About Cardtly | Digital Business Cards, South Africa' },
  description:
    'Cardtly is a South African digital business card platform out to retire the paper card. Rand pricing, local NFC delivery, and R97 a card a month.',
  alternates: { canonical: '/about' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const VALUES = [
  { icon: Zap,   title: 'Simple by design',   desc: 'We believe the best tools get out of the way. Cardtly is fast to set up, easy to share, and effortless to maintain.' },
  { icon: Globe, title: 'Built for everyone',  desc: 'Whether you\'re a freelancer, a corporate executive, a student, or a street vendor — if you want to connect with people, Cardtly works for you.' },
  { icon: Heart, title: 'Proudly South African', desc: 'We built Cardtly in South Africa, for South Africa first — then the world. ZAR pricing, local support, global product.' },
  { icon: Users, title: 'Community first',     desc: 'We listen to our users. The features we build come directly from real conversations with real people who use Cardtly every day.' },
]

export default function AboutPage() {
  const jsonLd = graph(
    { '@type': 'AboutPage', url: 'https://cardtly.com/about', name: 'About Cardtly' },
    breadcrumb([{ name: 'About', path: '/about' }]),
  )

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      {/* Hero. Left-aligned with the type capped in rem, matching the rest of
          the marketing pages. */}
      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="absolute -top-32 left-[10%] w-[680px] h-[540px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.14) 0%, rgba(124,58,237,0.10) 55%, transparent 72%)' }} />
        <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center"
          style={{ maxWidth: 1500, zIndex: 2 }}>
          <div className="text-center lg:text-left">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>About</p>
            <h1 className="font-black tracking-[-0.02em] leading-[1.04] mb-6"
              style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              Retiring the<br /><span style={gradText}>paper business card.</span>
            </h1>
            <p className="text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              Cardtly is a South African digital business card platform. Built here, priced in rand, and made for
              the way people actually swap details - a tap, a scan, or a link.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
                Sign up
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            {[
              { k: 'Built in South Africa', v: 'Priced in rand, NFC cards delivered locally' },
              { k: 'One plan, everything in it', v: 'No feature tiers to compare' },
              { k: 'Answered by a person', v: 'Email replied to inside a business day' },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-lg font-black tracking-tight" style={gradText}>{k}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Story */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="p-10 rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-bold uppercase tracking-widest mb-6" style={{ color: '#7c3aed' }}>Our story</p>
            <div className="space-y-5 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <p>
                Cardtly started with a simple frustration. We kept handing out paper business cards at events, only to wonder if anyone ever called. The cards sat in pockets, got thrown away, went out of date when numbers changed, and gave us zero insight into whether networking was actually working.
              </p>
              <p>
                So we built something better. A card that lives on a link. One that updates instantly, shows you who viewed it, and lets people save your contact with a single tap — no paper, no printing, no waste.
              </p>
              <p>
                We built Cardtly in South Africa, and we priced it for South Africa. Too many great SaaS tools price out the African market entirely. We don\'t. Cardtly is R97 a card per month, a price that respects what people actually earn.
              </p>
              <p>
                We are just getting started. The roadmap is full and the community is growing. If you have an idea, a complaint, or just want to say hello — we actually read our inbox.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">
              What we <span style={gradText}>stand for.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))' }}>
                  <Icon className="w-5 h-5" style={{ color: '#00d4ff' }} />
                </div>
                <h3 className="text-xl font-black mb-3">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Made in SA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-6 py-3 rounded-2xl text-4xl mb-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            🇿🇦
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-4">
            Proudly built in <span style={gradText}>South Africa.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'rgba(255,255,255,0.45)' }}>
            We are a South African company building tools that work for the African market. ZAR pricing, English-first, and a real person answering the email inside a business day.
          </p>
          <Link href="/contact"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
            Get in touch <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
