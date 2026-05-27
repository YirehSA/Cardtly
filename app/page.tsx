import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import {
  QrCode, Smartphone, Zap, Globe, BarChart2,
  Mail, Monitor, Users, Star, ArrowRight, Check, Wifi
} from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const FEATURES = [
  { icon: Smartphone,  title: 'One tap sharing',        desc: 'Share your card instantly via QR code, link, or NFC. No app needed on the other end.' },
  { icon: Globe,       title: 'Always up to date',       desc: 'Change your number or job? Your card updates everywhere. No reprinting, ever.' },
  { icon: BarChart2,   title: 'See who viewed you',      desc: 'Track views, link clicks, and saves so you know exactly who engaged.' },
  { icon: Mail,        title: 'Email signature built in', desc: 'Generate a professional email signature from your card in seconds.' },
  { icon: Monitor,     title: 'Virtual backgrounds',      desc: 'Branded Zoom and Teams backgrounds with your name and QR code.' },
  { icon: Users,       title: 'Capture leads',           desc: 'Visitors can share their info directly through your card. No forms needed.' },
  { icon: Wifi,        title: 'NFC physical cards',       desc: 'Order a tap-to-share NFC card. Hold it to any phone and your profile opens instantly. No app needed.' },
]

const STEPS = [
  { n: '01', title: 'Create your card',   desc: 'Fill in your details, choose a template, pick your colours.' },
  { n: '02', title: 'Share your link',    desc: 'Your card lives at cardtly.com/yourname. Share it anywhere.' },
  { n: '03', title: 'Make connections',   desc: 'People scan, save your contact, and you track every interaction.' },
]

const TESTIMONIALS = [
  { name: 'Sarah M.',    role: 'Sales Director',        text: 'I handed out 200 paper cards a year. Now I just tap my phone. Best upgrade I\'ve made.' },
  { name: 'James K.',    role: 'Freelance Designer',    text: 'My clients always have my latest portfolio. The card updates itself as I add new work.' },
  { name: 'Priya N.',    role: 'Real Estate Agent',     text: 'The analytics tell me exactly which properties people clicked after viewing my card.' },
]

export default function HomePage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(124,58,237,0.1) 50%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8 border"
            style={{ border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', background: 'rgba(0,212,255,0.08)' }}>
            <Zap className="w-3 h-3" />
            Your digital business card — free forever
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-6">
            Share who you are
            <br />
            <span style={gradText}>with a single tap.</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            Cardtly gives you a beautiful digital business card with your own link, QR code, and everything people need to connect with you — in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/signup"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.4)' }}>
              Create your free card <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/how-it-works"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
              See how it works
            </Link>
          </div>

          {/* Mock card preview */}
          <div className="relative inline-block">
            <div className="w-72 mx-auto rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
              <div className="h-20" style={{ background: 'linear-gradient(135deg, #00d4ff33, #7c3aed33)' }} />
              <div className="px-6 pb-6" style={{ marginTop: -32 }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white"
                  style={{ background: grad }}>
                  A
                </div>
                <p className="font-bold text-white text-lg">Andre Nel</p>
                <p className="text-sm font-medium" style={{ color: '#00d4ff' }}>Founder & CEO</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Yireh Business Solutions</p>
                <div className="mt-4 space-y-2">
                  {['📞 +27 82 000 0000', '✉️ hello@yireh.co.za', '🌐 yireh.co.za'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2 justify-center">
                  <div className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center text-white"
                    style={{ background: grad }}>Save Contact</div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                    <QrCode className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                  </div>
                </div>
              </div>
            </div>
            {/* Floating labels */}
            <div className="absolute -right-4 top-12 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg"
              style={{ background: 'rgba(0,212,255,0.2)', border: '1px solid rgba(0,212,255,0.3)', backdropFilter: 'blur(10px)' }}>
              ✓ Always updated
            </div>
            <div className="absolute -left-8 bottom-16 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg"
              style={{ background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.3)', backdropFilter: 'blur(10px)' }}>
              📊 47 views this week
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ─────────────────────────────────────────────────── */}
      <section className="py-12 border-y" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {[
            { n: '10,000+', label: 'cards created' },
            { n: '500,000+', label: 'views served' },
            { n: '9', label: 'card templates' },
            { n: 'Free', label: 'to get started' },
          ].map(({ n, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-black" style={gradText}>{n}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#7c3aed' }}>Everything you need</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              One card. <span style={gradText}>Infinite connections.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl transition-all hover:scale-[1.01]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
                  <Icon className="w-5 h-5" style={{ color: '#00d4ff' }} />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (mini) ───────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>Simple as that</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Up and running <span style={gradText}>in 2 minutes.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-px"
                    style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.4), transparent)' }} />
                )}
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                  {n}
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
              style={{ color: '#7c3aed' }}>
              See the full breakdown <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">People love <span style={gradText}>Cardtly.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text }) => (
              <div key={name} className="p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: '#f59e0b' }} />)}
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.65)' }}>"{text}"</p>
                <div>
                  <p className="font-bold text-sm">{name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App download ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Mobile</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Take Cardtly <span style={gradText}>with you.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              The full Cardtly experience plus tap-to-share with NFC, contact saving, and offline access. Available now on Android.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Google Play — live */}
            <a
              href="https://play.google.com/store/apps/details?id=com.cardtly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 px-6 py-4 rounded-2xl transition hover:scale-[1.02] hover:bg-white/10"
              style={{ background: '#000', border: '1px solid rgba(255,255,255,0.18)', minWidth: 240 }}
              aria-label="Get Cardtly on Google Play"
            >
              {/* Google Play icon (official 4-colour triangle) */}
              <svg viewBox="0 0 512 512" className="w-9 h-9 flex-shrink-0" aria-hidden="true">
                <defs>
                  <linearGradient id="gp-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00C3FF" />
                    <stop offset="100%" stopColor="#1A73E8" />
                  </linearGradient>
                  <linearGradient id="gp-red" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF3A44" />
                    <stop offset="100%" stopColor="#C31162" />
                  </linearGradient>
                  <linearGradient id="gp-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE000" />
                    <stop offset="100%" stopColor="#FFBD00" />
                  </linearGradient>
                  <linearGradient id="gp-green" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00F076" />
                    <stop offset="100%" stopColor="#00B569" />
                  </linearGradient>
                </defs>
                <path fill="url(#gp-blue)"   d="M61 19c-5 5-8 13-8 23v428c0 10 3 18 8 23l1 1 240-240v-2L62 18l-1 1z" />
                <path fill="url(#gp-red)"    d="M381 336L301 256v-2l80-80 2 1 95 54c27 15 27 40 0 56l-95 54-2 1z" />
                <path fill="url(#gp-yellow)" d="M383 335l-82-82L62 492c9 9 24 11 40 1l281-158" />
                <path fill="url(#gp-green)"  d="M383 173L102 14C86 5 71 6 62 16l239 238 82-81z" />
              </svg>
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Get it on</div>
                <div className="text-lg font-bold text-white" style={{ letterSpacing: '-0.01em' }}>Google Play</div>
              </div>
            </a>

            {/* Apple — coming soon, disabled */}
            <div
              className="flex items-center gap-4 px-6 py-4 rounded-2xl cursor-not-allowed relative"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 240, opacity: 0.75 }}
              aria-label="Cardtly for iPhone coming soon"
              role="img"
            >
              {/* Apple logo */}
              <svg viewBox="0 0 384 512" className="w-8 h-8 flex-shrink-0" aria-hidden="true">
                <path
                  fill="rgba(255,255,255,0.85)"
                  d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
                />
              </svg>
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Coming soon</div>
                <div className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>App Store</div>
              </div>
              {/* "Soon" pill */}
              <div
                className="absolute -top-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)', color: 'white' }}
              >
                Soon
              </div>
            </div>
          </div>

          <p className="text-center mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Cardtly is a free download. The web app at cardtly.com works identically in your browser.
          </p>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Pricing</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
            Start free. <span style={gradText}>Upgrade when ready.</span>
          </h2>
          <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Free forever with the basics. Pro unlocks everything — templates, analytics, virtual backgrounds and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}>
              Create your free card
            </Link>
            <Link href="/pricing"
              className="px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/05"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Ready to ditch<br /><span style={gradText}>paper cards forever?</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Join thousands of professionals sharing smarter.
              </p>
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
                style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.4)' }}>
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
