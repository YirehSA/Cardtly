import Link from 'next/link'
import { Linkedin, Instagram, Facebook } from 'lucide-react'
import { PROMOS_ENABLED } from '@/lib/promos'

// Cardtly's own social profiles. These URLs are the SAME strings that go in
// the Organization schema's sameAs array (components/marketing/StructuredData
// .tsx) - the footer icons are for people, the sameAs is for Google, and they
// must not drift, so if one changes here change it there too. Brand colours
// match SOCIAL_BRAND_COLORS in PublicCardView.
// hoverClass is a full literal string, not `hover:text-[${colour}]`, because
// Tailwind's scanner only sees class names that appear verbatim in the source
// - an interpolated one is never generated. This keeps the footer a server
// component: the brand-colour hover is pure CSS, no client JS.
const SOCIALS = [
  { label: 'Cardtly on LinkedIn',  href: 'https://www.linkedin.com/company/cardtly',  icon: Linkedin,  hoverClass: 'hover:text-[#0a66c2]' },
  { label: 'Cardtly on Instagram', href: 'https://www.instagram.com/cardtlydigital/', icon: Instagram, hoverClass: 'hover:text-[#E4405F]' },
  { label: 'Cardtly on Facebook',  href: 'https://www.facebook.com/cardtly',          icon: Facebook,  hoverClass: 'hover:text-[#1877F2]' },
]

export default function Footer() {
  return (
    <footer style={{ background: '#000', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" aria-label="Cardtly home" className="flex items-center gap-2.5 mb-4 w-fit hover:opacity-80 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardtly-icon.png" alt="Cardtly logo" className="w-9 h-9 rounded-full" />
              <span className="font-black text-lg tracking-tight"
                style={{ background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Cardtly
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              The digital business card built for South Africa. Share who you are with a tap, a scan, or a link. For everyone.
            </p>
          </div>

          {/* Product - keyword-bearing anchors help Google understand
              what each page is about (internal anchor text is a real,
              if modest, ranking signal). */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Product</p>
            <div className="space-y-2.5">
              {[
                { href: '/features',      label: 'Features' },
                { href: '/network', label: 'Business networking' },
                { href: '/how-it-works', label: 'How digital cards work' },
                { href: '/pricing',       label: 'Digital business card pricing' },
                { href: '/blog',          label: 'Digital business card blog' },
                { href: '/#teams',        label: 'Cardtly for Teams' },
                ...(PROMOS_ENABLED ? [{ href: '/promotions', label: 'Win prizes 🏆' }] : []),
                { href: '/nfc',           label: 'NFC business cards 🇿🇦' },
                { href: '/signup',        label: 'Start your free trial' },
                { href: '/login',         label: 'Sign in' },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="block text-sm transition hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Company</p>
            <div className="space-y-2.5">
              {[
                { href: '/about',             label: 'About us' },
                { href: '/contact',           label: 'Contact' },
                { href: '/privacy',           label: 'Privacy policy' },
                { href: '/terms',             label: 'Terms of service' },
                ...(PROMOS_ENABLED ? [{ href: '/promotions/terms', label: 'Promotion rules' }] : []),
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="block text-sm transition hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs order-2 md:order-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} Cardtly. All rights reserved.
          </p>

          {/* Follow links. rel="me" backs up the schema sameAs as a second
              signal that these profiles are ours; noopener for the new tab,
              and each hovers to its own brand colour. 44px hit area so they
              are tappable on a phone without a precise press. */}
          <div className="flex items-center gap-1 order-1 md:order-2">
            {SOCIALS.map(({ label, href, icon: Icon, hoverClass }) => (
              <a key={href} href={href} target="_blank" rel="me noopener noreferrer"
                aria-label={label} title={label}
                className={`w-11 h-11 grid place-items-center rounded-full text-white/45 transition-colors ${hoverClass}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </a>
            ))}
          </div>

          <p className="text-xs order-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Made in South Africa 🇿🇦
          </p>
        </div>
      </div>
    </footer>
  )
}
