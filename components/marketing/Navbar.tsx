'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
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

  // TWO STATES: over the hero, and everywhere else.
  //
  // Transparent works while there is a dark scene behind the bar, and it stops
  // working the moment ordinary page content scrolls under it - the links and
  // the copy underneath occupy the same pixels and both become hard to read.
  // So the bar is transparent and tall while the hero is behind it, and solid
  // and compact once it is not.
  //
  // WHAT COUNTS AS "PAST THE HERO" is measured, not guessed. The hero is a
  // 6.4-viewport section with a sticky stage, so a fixed scroll threshold would
  // either fire immediately, while the scene is still the backdrop, or wait for
  // a number that is wrong on every other page. Instead the bar looks for
  // #hero-scroll and asks where its bottom edge is: while that edge is below
  // the bar, the hero is what is behind the bar. On a page with no hero there
  // is nothing to be transparent over, so it goes solid on the first pixel of
  // scroll.
  //
  // pt-4 gives the bar air above it, at every width. It was lg:pt-4 for one
  // commit, desktop only, and that was worse than it looked: the header was
  // then 5rem on phones and 6rem from lg up, and the hero reserves room for
  // this header BY HAND, so a breakpoint here needed a matching breakpoint in
  // HeroScene.tsx and the two could drift apart silently. Padding at every size
  // makes the header one number again.
  //
  // It is still one number in two files. --ct-header in HeroScene.tsx has to
  // match the AT-REST height, 6rem, or the headline goes back under the bar.
  // The compact height is free: by the time it applies, the hero is behind you.
  // A ref rather than an id, deliberately. The hero's bundled script looks for
  // an element called #site-head and toggles its own is-stuck class on it - that
  // is the demo page's header, not this one. Giving this bar that id would hand
  // a third party a class on our nav and a second scroll listener to drive it,
  // for a rule that does not exist in our stylesheet.
  const barRef = useRef<HTMLElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    // Read straight off the event, with no rAF wrapper around it.
    //
    // The wrapper is the reflex, and here it buys nothing: scroll events are
    // dispatched during the rendering steps, so the browser already delivers at
    // most one per frame. Coalescing something that is coalesced adds a frame of
    // lag to the one transition anybody will notice, and it hides the work from
    // anything that drives the page without painting it.
    const read = () => {
      const hero = document.getElementById('hero-scroll')
      const barBottom = barRef.current?.getBoundingClientRect().height ?? 96
      setStuck(hero
        ? hero.getBoundingClientRect().bottom <= barBottom
        : window.scrollY > 4)
    }
    read()
    addEventListener('scroll', read, { passive: true })
    addEventListener('resize', read, { passive: true })
    return () => {
      removeEventListener('scroll', read)
      removeEventListener('resize', read)
    }
  }, [pathname])

  return (
    <header
      ref={barRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,backdrop-filter] duration-300 ${stuck ? 'pt-0' : 'pt-4'}`}
      style={stuck ? {
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      } : undefined}>
      <div className={`max-w-7xl mx-auto px-6 flex items-center justify-between transition-[height] duration-300 ${stuck ? 'h-16' : 'h-20'}`}>
        {/* Logo only - the badge carries the wordmark inside it, so no
            text next to it. 72px = double the old 36px mark; the bar
            grew h-16 -> h-20 to give it room. */}
        <Link href={logoHref} className="flex items-center group" aria-label="Cardtly home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* 72px does not fit a 4rem bar, so the mark comes down with it.
              Sized rather than scaled: transform:scale would leave the original
              footprint in the layout and the row would not actually compact. */}
          <img src="/cardtly-icon.png" alt="Cardtly logo"
            className={`rounded-full transition-all duration-300 group-hover:scale-105 ${stuck ? 'w-11 h-11' : 'w-[72px] h-[72px]'}`} />
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
