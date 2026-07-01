import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import NativeAppRedirect from '@/components/NativeAppRedirect'
import HeroSection from '@/components/marketing/HeroSection'
import ThreeWaysToShare from '@/components/marketing/ThreeWaysToShare'
import TemplatesShowcase from '@/components/marketing/TemplatesShowcase'
import FeaturedCards from '@/components/marketing/FeaturedCards'
import FaqSection from '@/components/marketing/FaqSection'
import StructuredData from '@/components/marketing/StructuredData'
import CustomizeShowcase from '@/components/marketing/CustomizeShowcase'
import TeamsSection from '@/components/marketing/TeamsSection'
import {
  Smartphone, Globe, BarChart2, Mail, Monitor, Users, Star, ArrowRight, Wifi, Sparkles, Zap, CalendarDays, ScanLine,
  FileSpreadsheet, CalendarClock, MessageCircle, Contact,
} from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Sales Director',     text: 'I handed out 200 paper cards a year. Now I just tap my phone. Best upgrade I\'ve made.' },
  { name: 'James K.', role: 'Freelance Designer', text: 'My clients always have my latest portfolio. The card updates itself as I add new work.' },
  { name: 'Priya N.', role: 'Real Estate Agent',  text: 'The analytics tell me exactly which properties people clicked after viewing my card.' },
]

// Synchronous pre-paint script.
//
// Lives inline in the document head so it runs BEFORE the browser
// paints any marketing content. Goal: in the Cardtly Android WebView,
// the homepage HTML should never visibly flash before the deep-link
// redirect kicks in.
//
// How it works:
//   - Reads navigator.userAgent immediately. We only act when the
//     " wv" token is present (Android WebView). Desktop browsers
//     and Chrome / Safari on mobile do NOT contain " wv", so they
//     skip the script entirely - zero impact on regular web visits.
//   - In a WebView, injects a <style> tag that hides everything
//     non-script inside <body> and paints the page black.
//   - Polls every 16ms for up to 220ms to see if Capacitor has
//     finished injecting window.Capacitor. If yes, the page stays
//     hidden - the React NativeAppRedirect component will handle
//     the actual navigation. If 220ms passes without detection
//     (in-app browsers like WhatsApp's that also use " wv"), the
//     hide style is removed and the marketing page becomes visible.
//
// The polling is a worst-case 220ms - normal users in any in-app
// browser tap a link, expect ~half a second of loading, and then
// see the page. The visual experience there is unchanged in
// practice. Cardtly app users get a clean black-then-card flow.
const PREVENT_FLASH_SCRIPT = `(function(){
  try {
    var ua = navigator.userAgent || '';
    if (ua.indexOf(' wv') === -1) return;
    var hide = document.createElement('style');
    hide.id = '__cardtly_prefetch_hide';
    hide.textContent = 'html,body{background:#000!important}body>*{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hide);
    function reveal(){
      var s = document.getElementById('__cardtly_prefetch_hide');
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
    // Hard ceiling: under no circumstances stay hidden longer than
    // 1500ms. If React or the redirect fails for any reason the user
    // sees the marketing page instead of a permanent black screen.
    setTimeout(reveal, 1500);
    var start = Date.now();
    var iv = setInterval(function(){
      var cap = window.Capacitor;
      var isNative = cap && cap.isNativePlatform && cap.isNativePlatform();
      if (isNative) {
        // Detected Cardtly app. Keep hidden until NativeAppRedirect
        // navigates us away - it explicitly calls revealCardtlyFlashBlock()
        // before any client-side navigation. The 1500ms safety net above
        // is still armed as a final backstop.
        clearInterval(iv);
        return;
      }
      if (Date.now() - start > 220) {
        clearInterval(iv);
        reveal();
      }
    }, 16);
    // Expose the reveal function so NativeAppRedirect can clear the
    // hide BEFORE doing a client-side router.replace - otherwise the
    // style would stay applied to the new route's DOM.
    window.__cardtlyRevealFlashBlock = reveal;
  } catch (e) { /* fail-open: do nothing, show the page */ }
})();`

// The homepage inherits the root layout's title, description and OG.
// It only needs its own canonical - without one it has none, since the
// root layout deliberately omits a canonical (see layout.tsx).
export const metadata = { alternates: { canonical: '/' } }

export default function HomePage() {
  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      {/* Synchronous head-script: hides body in Android WebViews until
          we know whether we're in the Cardtly app (-> stay hidden,
          redirect via React) or some other in-app browser (-> show
          after 220ms). Web visitors are unaffected. */}
      <script dangerouslySetInnerHTML={{ __html: PREVENT_FLASH_SCRIPT }} />
      {/* Organization + WebSite + SoftwareApplication JSON-LD */}
      <StructuredData />
      {/* In the native app, bypass the marketing page and go straight
          to login (or dashboard if signed in). No-op on web. */}
      <NativeAppRedirect />
      <Navbar />

      {/* Cinematic hero with parallax card */}
      <HeroSection />

      {/* ── Social proof bar — bigger, bolder ─────────────────────────────────── */}
      <section className="py-16 border-y" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { n: '10,000+',  label: 'Cards created' },
              { n: '500K+',    label: 'Views served' },
              { n: '12',       label: 'Designed templates' },
              { n: 'Free',     label: 'To get started' },
            ].map(({ n, label }, i) => (
              <Reveal key={label} delay={i * 90}>
                <div className="text-center">
                  <p className="text-4xl md:text-6xl font-black tracking-tight" style={gradText}>{n}</p>
                  <p className="text-xs md:text-sm mt-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Three ways to share */}
      <ThreeWaysToShare />

      {/* ── Bento features grid ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative">
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 70%)' }} />

        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#7c3aed' }}>Everything you need</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                One card. <span style={gradText}>Infinite connections.</span>
              </h2>
            </div>
          </Reveal>

          {/* Bento — mixed sizes */}
          <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Big featured tile — NFC */}
            <BentoTile
              span="md:col-span-2 md:row-span-2"
              icon={<Wifi className="w-6 h-6" />}
              accent="#00d4ff"
              title="NFC physical cards"
              desc="Order a tap-to-share NFC card from us in South Africa. Hold it to any phone and your profile opens instantly. No app needed on either end. Posted nationwide."
              visual={
                <div className="absolute inset-0 flex items-end justify-end p-8 pointer-events-none">
                  <div className="relative">
                    {/* Stack of NFC cards */}
                    <div className="absolute inset-0 w-48 h-32 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', transform: 'translate(-10px, -10px) rotate(-6deg)' }} />
                    <div className="absolute inset-0 w-48 h-32 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, #00d4ff44, #7c3aed44)', border: '1px solid rgba(0,212,255,0.3)', transform: 'translate(-5px, -5px) rotate(-3deg)' }} />
                    <div className="relative w-48 h-32 rounded-2xl p-4 flex flex-col justify-between"
                      style={{ background: grad, boxShadow: '0 20px 50px rgba(124,58,237,0.4)' }}>
                      <div className="text-white text-xs font-bold uppercase tracking-widest opacity-80">Cardtly</div>
                      <div>
                        <div className="text-white text-sm font-bold">Andre Nel</div>
                        <div className="text-white/70 text-[10px]">cardtly.com/andrenel</div>
                      </div>
                      <Wifi className="absolute top-3 right-3 w-4 h-4 text-white/70" />
                    </div>
                  </div>
                </div>
              }
            />

            {/* Smartphone */}
            <BentoTile
              icon={<Smartphone className="w-5 h-5" />}
              accent="#7c3aed"
              title="Share in one tap"
              desc="QR code, link, or NFC. Whichever way they prefer."
            />

            {/* Globe */}
            <BentoTile
              icon={<Globe className="w-5 h-5" />}
              accent="#ec4899"
              title="Always up to date"
              desc="Change your number once. Updates everywhere. No reprinting."
            />

            {/* Analytics — wider */}
            <BentoTile
              span="md:col-span-2"
              icon={<BarChart2 className="w-5 h-5" />}
              accent="#f59e0b"
              title="See who connected"
              desc="Track every view, click, and save. Know exactly which leads engaged."
              visual={
                <div className="absolute right-6 top-6 bottom-6 flex items-end gap-1.5 pointer-events-none">
                  {[40, 65, 50, 80, 55, 90, 75, 100, 70, 85].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-t"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(180deg, #f59e0b, #ec4899)`,
                        opacity: 0.3 + (i / 10) * 0.7,
                      }}
                    />
                  ))}
                </div>
              }
            />

            {/* Email signature */}
            <BentoTile
              icon={<Mail className="w-5 h-5" />}
              accent="#22c55e"
              title="Email signature"
              desc="Generate a branded signature from your card in seconds."
            />

            {/* Virtual BG */}
            <BentoTile
              icon={<Monitor className="w-5 h-5" />}
              accent="#3b82f6"
              title="Zoom backgrounds"
              desc="Branded virtual backgrounds with your name and QR."
            />

            {/* Lead capture — built-in mini-CRM */}
            <BentoTile
              icon={<Users className="w-5 h-5" />}
              accent="#a855f7"
              title="Capture leads, build your CRM"
              desc="Visitors share their details through your card and every lead lands in your contacts - a pocket CRM that builds itself."
            />

            {/* Card content — links, galleries, socials */}
            <BentoTile
              icon={<Sparkles className="w-5 h-5" />}
              accent="#ec4899"
              title="More than contact details"
              desc="Photo galleries, custom links, WhatsApp, socials, certifications, even an AI-written bio."
            />

            {/* Meeting booking from the card */}
            <BentoTile
              icon={<CalendarDays className="w-5 h-5" />}
              accent="#06b6d4"
              title="Book meetings from your card"
              desc="Visitors pick a date and time right on your card. You get the request by email and they land in your contacts."
            />

            {/* Paper card scanner */}
            <BentoTile
              icon={<ScanLine className="w-5 h-5" />}
              accent="#a855f7"
              title="Scan paper business cards"
              desc="Snap a photo of someone's paper card and AI pulls out their details, ready to save to your contacts or your phone."
            />

            {/* WhatsApp follow-up — wider tile with chat visual */}
            <BentoTile
              span="md:col-span-2"
              icon={<MessageCircle className="w-5 h-5" />}
              accent="#25D366"
              title="Follow up on WhatsApp"
              desc="Every lead comes with a one-tap WhatsApp button, so you can reply while you're still fresh in their mind. No copying out numbers."
              visual={
                <div className="absolute right-6 top-6 bottom-6 hidden lg:flex flex-col justify-center items-end gap-2 pointer-events-none">
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs font-medium text-white max-w-[180px]"
                    style={{ background: '#25D366' }}>
                    Great meeting you! Here&apos;s my card 👋
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-xs font-medium max-w-[160px]"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                    Thanks! Let&apos;s chat Monday.
                  </div>
                </div>
              }
            />

            {/* Excel export */}
            <BentoTile
              icon={<FileSpreadsheet className="w-5 h-5" />}
              accent="#0ea5e9"
              title="Export to Excel in a click"
              desc="Turn every lead into a clean, colour-branded spreadsheet - names, emails, companies, sources and answers - ready for your CRM or mailing list."
            />

            {/* Weekly digest */}
            <BentoTile
              icon={<CalendarClock className="w-5 h-5" />}
              accent="#14b8a6"
              title="Your week, in your inbox"
              desc="Every Monday we email you how your card performed - views and new leads from the past 7 days - so you always know what's working."
            />

            {/* Manage contacts */}
            <BentoTile
              icon={<Contact className="w-5 h-5" />}
              accent="#f43f5e"
              title="Manage your contacts"
              desc="Edit, tidy and save any lead straight to your phone. Your Cardtly contacts stay organised and always within reach."
            />
          </div>
          </Reveal>

          {/* See-all link to the full features page */}
          <Reveal className="text-center mt-12">
            <Link href="/features"
              className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
              style={{ color: '#7c3aed' }}>
              Explore every feature <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Real cards from real people, refreshed daily. Hides itself
          if there are fewer than 8 opted-in cards in the pool. */}
      <FeaturedCards />

      {/* Templates showcase */}
      <TemplatesShowcase />

      {/* Interactive customization demo — extends the templates story:
          12 templates, and every one is fully editable */}
      <CustomizeShowcase />

      {/* ── How it works — kept simple ──────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Simple as that</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                Up and running <span style={gradText}>in 2 minutes.</span>
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Create your card',   desc: 'Pick a template, fill in your details, choose your colours.' },
              { n: '02', title: 'Share your link',    desc: 'Your card lives at cardtly.com/yourname. Share it anywhere.' },
              { n: '03', title: 'Make connections',   desc: 'People scan, save your contact, and you track every interaction.' },
            ].map(({ n, title, desc }, i, arr) => (
              <Reveal key={n} delay={i * 90} className="relative text-center">
                {i < arr.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-px"
                    style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.4), transparent)' }} />
                )}
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                  {n}
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
              </Reveal>
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
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#f59e0b' }}>The people speak</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">Loved by <span style={gradText}>professionals.</span></h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, role, text }, i) => (
              <Reveal key={name} delay={i * 90} className="h-full">
                <div className="h-full p-6 rounded-3xl lift-card"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: '#f59e0b' }} />)}
                  </div>
                  <p className="text-base leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>&ldquo;{text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                      style={{ background: grad }}>
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cardtly for Teams — locked branding, member-owned details ────────── */}
      <TeamsSection />

      {/* ── App download ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Mobile</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Take Cardtly <span style={gradText}>with you.</span>
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                The full Cardtly experience plus tap-to-share with NFC, contact saving, and offline access. Available now on Android.
              </p>
            </div>
          </Reveal>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://play.google.com/store/apps/details?id=com.cardtly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 px-6 py-4 rounded-2xl transition hover:scale-[1.02] hover:bg-white/10"
              style={{ background: '#000', border: '1px solid rgba(255,255,255,0.18)', minWidth: 240 }}
              aria-label="Get Cardtly on Google Play"
            >
              <svg viewBox="0 0 512 512" className="w-9 h-9 flex-shrink-0" aria-hidden="true">
                <defs>
                  <linearGradient id="gp-blue-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00C3FF" />
                    <stop offset="100%" stopColor="#1A73E8" />
                  </linearGradient>
                  <linearGradient id="gp-red-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF3A44" />
                    <stop offset="100%" stopColor="#C31162" />
                  </linearGradient>
                  <linearGradient id="gp-yellow-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE000" />
                    <stop offset="100%" stopColor="#FFBD00" />
                  </linearGradient>
                  <linearGradient id="gp-green-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00F076" />
                    <stop offset="100%" stopColor="#00B569" />
                  </linearGradient>
                </defs>
                <path fill="url(#gp-blue-2)"   d="M61 19c-5 5-8 13-8 23v428c0 10 3 18 8 23l1 1 240-240v-2L62 18l-1 1z" />
                <path fill="url(#gp-red-2)"    d="M381 336L301 256v-2l80-80 2 1 95 54c27 15 27 40 0 56l-95 54-2 1z" />
                <path fill="url(#gp-yellow-2)" d="M383 335l-82-82L62 492c9 9 24 11 40 1l281-158" />
                <path fill="url(#gp-green-2)"  d="M383 173L102 14C86 5 71 6 62 16l239 238 82-81z" />
              </svg>
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Get it on</div>
                <div className="text-lg font-bold text-white" style={{ letterSpacing: '-0.01em' }}>Google Play</div>
              </div>
            </a>

            <div
              className="flex items-center gap-4 px-6 py-4 rounded-2xl cursor-not-allowed relative"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 240, opacity: 0.75 }}
              aria-label="Cardtly for iPhone coming soon"
              role="img"
            >
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
              <div
                className="absolute -top-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)', color: 'white' }}
              >
                Soon
              </div>
            </div>
          </div>

          <p className="text-center mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Free download. The web app at cardtly.com works identically in your browser.
          </p>
        </div>
      </section>

      {/* ── FAQ — long-tail SEO + FAQPage schema ─────────────────────────────── */}
      <FaqSection />

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <Reveal className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6"
                style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                <Zap className="w-3 h-3" />
                Win Pro for life — first 100 signups
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
                Ready to ditch<br /><span style={gradText}>paper cards?</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Join 10,000+ professionals sharing smarter. Takes 2 minutes. Free forever.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                  style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
                  Create your free card
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/promotions"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  See the prize ladder
                </Link>
              </div>
              <p className="text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>No credit card · No catch · Free forever tier</p>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}

// ── Bento tile ────────────────────────────────────────────────────────

function BentoTile({
  span, icon, accent, title, desc, visual,
}: {
  span?: string
  icon: React.ReactNode
  accent: string
  title: string
  desc: string
  visual?: React.ReactNode
}) {
  return (
    <div
      className={`relative rounded-3xl p-6 transition-all hover:scale-[1.01] hover:bg-white/5 overflow-hidden ${span || ''}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        minHeight: span?.includes('row-span-2') ? 380 : 200,
      }}
    >
      {visual}
      <div className="relative" style={{ zIndex: 1 }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white"
          style={{ background: accent }}
        >
          {icon}
        </div>
        <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
        <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
      </div>
    </div>
  )
}
