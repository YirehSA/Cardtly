import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: '#000', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardtly-icon.png" alt="Cardtly logo" className="w-9 h-9 rounded-full" />
              <span className="font-black text-lg tracking-tight"
                style={{ background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Cardtly
              </span>
            </div>
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
                { href: '/how-it-works', label: 'How digital cards work' },
                { href: '/pricing',       label: 'Digital business card pricing' },
                { href: '/#teams',        label: 'Cardtly for Teams' },
                { href: '/promotions',    label: 'Win prizes 🏆' },
                { href: '/nfc',           label: 'NFC business cards 🇿🇦' },
                { href: '/signup',        label: 'Create your free card' },
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
                { href: '/promotions/terms',  label: 'Promotion rules' },
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

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} Cardtly. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Made in South Africa 🇿🇦
          </p>
        </div>
      </div>
    </footer>
  )
}
