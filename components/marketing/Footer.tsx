import Link from 'next/link'
import { Linkedin, Instagram, Facebook } from 'lucide-react'
import { PROMOS_ENABLED } from '@/lib/promos'
import FooterLinkList from './FooterLinkList'

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

// MEASURED ON PURE BLACK, which is the whole problem with the old values.
// This footer renders on every marketing page, so eighteen failures here were
// eighteen on each of them. White at alpha a over #000 gives:
//
//   0.20 -> 1.7:1     0.40 -> 3.7:1     0.55 -> 6.3:1
//   0.25 -> 2.0:1     0.45 -> 4.4:1     0.62 -> 7.9:1
//
// AA wants 4.5:1 for normal text, so everything from 0.45 down was failing and
// 0.45 itself missed by a hair. The old scale was chosen to look recessive,
// and it does, but "Privacy policy" and the copyright line are exactly the
// text somebody is hunting for when they bother to look at a footer.
const HEADING = 'rgba(255,255,255,0.6)'   // 7.4:1, the small-caps column titles
const BODY = 'rgba(255,255,255,0.6)'      // 7.4:1, the brand paragraph
const MUTED = 'rgba(255,255,255,0.55)'    // 6.3:1, copyright and the made-in line

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
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: BODY }}>
              The digital business card built for South Africa. Share who you are with a tap, a scan, or a link. For everyone.
            </p>
          </div>

          {/* Product - keyword-bearing anchors help Google understand
              what each page is about (internal anchor text is a real,
              if modest, ranking signal). */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: HEADING }}>Product</p>
            <FooterLinkList items={[
              { href: '/features',      label: 'Features' },
              { href: '/network', label: 'Business networking' },
              { href: '/how-it-works', label: 'How digital cards work' },
              { href: '/pricing',       label: 'Digital business card pricing' },
              { href: '/blog',          label: 'Digital business card blog' },
              { href: '/teams',         label: 'Digital business cards for teams' },
              ...(PROMOS_ENABLED ? [{ href: '/promotions', label: 'Win prizes 🏆' }] : []),
              { href: '/nfc',           label: 'NFC business cards 🇿🇦' },
              { href: '/signup',        label: 'Sign up' },
              { href: '/login',         label: 'Sign in' },
            ]} />
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: HEADING }}>Company</p>
            <FooterLinkList items={[
              { href: '/about',             label: 'About us' },
              { href: '/contact',           label: 'Contact' },
              { href: '/privacy',           label: 'Privacy policy' },
              { href: '/terms',             label: 'Terms of service' },
              ...(PROMOS_ENABLED ? [{ href: '/promotions/terms', label: 'Promotion rules' }] : []),
            ]} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs order-2 md:order-1" style={{ color: MUTED }}>
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
                className={`w-11 h-11 grid place-items-center rounded-full text-white/60 transition-colors ${hoverClass}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </a>
            ))}
          </div>

          <p className="text-xs order-3" style={{ color: MUTED }}>
            Made in South Africa 🇿🇦
          </p>
        </div>
      </div>
    </footer>
  )
}
