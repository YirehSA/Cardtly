'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { getNativePlatform } from '@/lib/capacitor'
import { isIosBlockedPath } from '@/lib/app-platform'

const LINKS = [
  { href: '/',              label: 'Home' },
  { href: '/features',      label: 'Features' },
  { href: '/teams',         label: 'For teams' },
  { href: '/network',       label: 'Network' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/nfc',           label: 'NFC Cards', badge: '🇿🇦' },
  { href: '/pricing',       label: 'Pricing' },
  { href: '/blog',          label: 'Blog' },
  { href: '/about',         label: 'About' },
  { href: '/contact',       label: 'Contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Every route that sells or quotes a price is dropped inside the iOS app -
  // which is most of the marketing site, since the home page alone says
  // "R97 a card a month" three times.
  //
  // Detected in the browser rather than on the server, unlike the dashboard:
  // the marketing pages are static, and reading the request header to hide nav
  // items would make every one of them dynamic for every visitor. The routes
  // themselves are blocked in middleware, so the worst case here is a link
  // appearing for a moment before hydration - one that redirects to the
  // dashboard, not a purchase mechanism.
  const [iosApp, setIosApp] = useState(false)
  useEffect(() => { setIosApp(getNativePlatform() === 'ios') }, [])
  const links = iosApp ? LINKS.filter(l => !isIosBlockedPath(l.href)) : LINKS

  // The logo goes home, and home is blocked. Inside the app it goes to the
  // dashboard, which is what tapping the logo in an app should do anyway.
  const logoHref = iosApp ? '/dashboard' : '/'

  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo only - the badge carries the wordmark inside it, so no
            text next to it. 72px = double the old 36px mark; the bar
            grew h-16 -> h-20 to give it room. */}
        <Link href={logoHref} className="flex items-center group" aria-label="Cardtly home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cardtly-icon.png" alt="Cardtly logo" className="w-[72px] h-[72px] rounded-full transition group-hover:scale-105" />
        </Link>

        {/* Desktop nav.
            lg, not md. Nine links plus a 72px logo plus two buttons need about
            980px, but this used to unfold at md (768px) - so from 768px up to
            roughly 1000px the row was wider than the window and the Sign up
            button sat off the right-hand edge, unreachable. An iPad in portrait
            is 820px, right in the middle of it, and that is the "button was cut
            off due to layout" Apple's reviewer reported.
            px-3 until xl buys back the ~70px that makes the row fit at 1024. */}
        <nav className="hidden lg:flex items-center gap-1">
          {links.map((link) => {
            const { href, label } = link
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className="px-3 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                {label}{link.badge && <span className="text-xs">{link.badge}</span>}
              </Link>
            )
          })}
        </nav>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <Link href="/login" className="text-sm font-medium transition" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Sign in
          </Link>
          <Link href="/signup"
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
            Sign up
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(p => !p)} aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open} className="lg:hidden text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden px-6 pb-6 pt-2 space-y-1" style={{ background: 'rgba(0,0,0,0.95)' }}>
          {links.map(({ href, label, badge }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition">
              {label}{badge && <span className="text-xs">{badge}</span>}
            </Link>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)}
              className="block text-center py-2.5 rounded-xl text-sm font-medium border border-white/10 text-white/60">
              Sign in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)}
              className="block text-center py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              Sign up
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
