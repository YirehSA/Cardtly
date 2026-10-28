'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'
import { getNativePlatform } from '@/lib/capacitor'
import { isIosBlockedPath } from '@/lib/app-platform'

// Five things in the bar, the rest under More (2026-10-29). Eleven links at
// one weight, with Home beside a logo that already goes home, read as a wall:
// the bar ran edge to edge, "Sign in" sat jammed against "Contact", and from
// 1024 to 1280 it did not fit at all. What people come to buy goes in the bar;
// what they come to read goes under More.
const PRIMARY = [
  { href: '/features',  label: 'Features' },
  { href: '/teams',     label: 'For teams' },
  { href: '/nfc',       label: 'NFC Cards' },
  { href: '/pricing',   label: 'Pricing' },
  // Hidden in the iOS app with the other selling pages (IOS_BLOCKED_ROUTES).
  { href: '/resellers', label: 'Resellers' },
]

const MORE = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/network',      label: 'Network' },
  { href: '/blog',         label: 'Blog' },
  { href: '/about',        label: 'About' },
  { href: '/contact',      label: 'Contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Every route that sells or quotes a price is dropped inside the iOS app -
  // which is most of the marketing site, since the home page alone quotes the
  // price three times.
  //
  // Detected in the browser rather than on the server, unlike the dashboard:
  // the marketing pages are static, and reading the request header to hide nav
  // items would make every one of them dynamic for every visitor. The routes
  // themselves are blocked in middleware, so the worst case here is a link
  // appearing for a moment before hydration - one that redirects to the
  // dashboard, not a purchase mechanism.
  const [iosApp, setIosApp] = useState(false)
  useEffect(() => { setIosApp(getNativePlatform() === 'ios') }, [])
  const allowed = (l: { href: string }) => !iosApp || !isIosBlockedPath(l.href)
  const primary = PRIMARY.filter(allowed)
  const more = MORE.filter(allowed)
  const inMore = more.some(l => pathname === l.href || pathname?.startsWith(l.href + '/'))

  // The logo goes home, and home is blocked. Inside the app it goes to the
  // dashboard, which is what tapping the logo in an app should do anyway.
  const logoHref = iosApp ? '/dashboard' : '/'

  // More closes on a page change, a click anywhere else, and Escape.
  useEffect(() => { setMoreOpen(false); setOpen(false) }, [pathname])
  useEffect(() => {
    if (!moreOpen) return
    const away = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [moreOpen])

  // TWO STATES: over the hero, and everywhere else.
  //
  // Transparent works while there is a dark scene behind the bar, and it stops
  // working the moment ordinary page content scrolls under it - the links and
  // the copy underneath occupy the same pixels and both become hard to read.
  // So the bar is transparent and tall while the hero is behind it, and solid
  // and compact once it is not.
  //
  // WHAT COUNTS AS "PAST THE HERO" is measured, not guessed: the bar looks for
  // #hero-scroll and asks where its bottom edge is. On a page with no hero
  // there is nothing to be transparent over, so it goes solid on the first
  // pixel of scroll.
  //
  // The at-rest height is one number in two files: --ct-header in
  // HeroScene.tsx has to match it (6rem: pt-4 plus h-20), or the headline goes
  // back under the bar. A ref rather than an id, deliberately: the hero's
  // bundled script toggles a class on any #site-head.
  const barRef = useRef<HTMLElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    // Read straight off the event: scroll events already arrive at most once a
    // frame, and a rAF wrapper only adds a frame of lag.
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

  const linkClass = 'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'
  const linkStyle = (active: boolean) => ({
    color: active ? '#fff' : 'rgba(255,255,255,0.62)',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  })

  return (
    <header
      ref={barRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,backdrop-filter] duration-300 ${stuck ? 'pt-0' : 'pt-4'}`}
      style={stuck ? {
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      } : undefined}>
      <div className={`max-w-7xl mx-auto px-6 flex items-center gap-6 transition-[height] duration-300 ${stuck ? 'h-16' : 'h-20'}`}>
        {/* Logo only - the badge carries the wordmark inside it. Sized rather
            than scaled when the bar compacts, so the row really does shrink. */}
        <Link href={logoHref} className="flex items-center group shrink-0" aria-label="Cardtly home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cardtly-icon.png" alt="Cardtly logo" width={72} height={72}
            className={`rounded-full transition-all duration-300 group-hover:scale-105 ${stuck ? 'w-11 h-11' : 'w-[72px] h-[72px]'}`} />
        </Link>

        {/* Desktop nav, centred between the logo and the buttons. Six items
            need about 560px, so it fits from 1024 (lg) with room to breathe. */}
        <nav aria-label="Main" className="hidden lg:flex flex-1 items-center justify-center gap-1">
          {primary.map(({ href, label }) => {
            const active = pathname === href || !!pathname?.startsWith(href + '/')
            return (
              <Link key={href} href={href} className={`${linkClass} hover:text-white`} style={linkStyle(active)}
                aria-current={active ? 'page' : undefined}>
                {label}
              </Link>
            )
          })}
          {more.length > 0 && (
            <div ref={moreRef} className="relative">
              <button type="button" onClick={() => setMoreOpen(o => !o)}
                aria-expanded={moreOpen} aria-haspopup="true"
                className={`${linkClass} inline-flex items-center gap-1 hover:text-white`}
                style={linkStyle(inMore || moreOpen)}>
                More
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {/* Always in the page, shown or hidden by class, so the links are
                  in the HTML for search engines as well as for people. */}
              <div className={`${moreOpen ? 'block' : 'hidden'} absolute right-0 top-full mt-2 w-52 rounded-xl p-1.5`}
                style={{ background: 'rgba(14,12,22,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>
                {more.map(({ href, label }) => {
                  const active = pathname === href || !!pathname?.startsWith(href + '/')
                  return (
                    <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className="flex items-center min-h-11 px-3 rounded-lg text-sm font-medium transition-colors hover:bg-white/[0.06] hover:text-white"
                      style={{ color: active ? '#fff' : 'rgba(255,255,255,0.72)' }}>
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <Link href="/login"
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:text-white hover:bg-white/[0.06]"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            Sign in
          </Link>
          {/* No signing up in the iOS app: it is for company teams, whose
              people arrive by invite (lib/app-platform, iosAppAdmits). */}
          {!iosApp && (
            <Link href="/signup"
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              Sign up
            </Link>
          )}
        </div>

        {/* Mobile toggle. The icon stays 20px; the button is the 44px touch
            minimum. -mr-2.5 pulls the padding back so the icon sits on the edge. */}
        <button onClick={() => setOpen(p => !p)} aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open} className="lg:hidden ml-auto text-white w-11 h-11 shrink-0 -mr-2.5 grid place-items-center rounded-lg">
          {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu: everything, the buying pages first. */}
      {open && (
        <div className="lg:hidden px-6 pb-6 pt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto" style={{ background: 'rgba(0,0,0,0.95)' }}>
          {[primary, more].filter(g => g.length > 0).map((group, g) => (
            <div key={g} className={`space-y-1 ${g > 0 ? 'mt-2 pt-2 border-t border-white/10' : ''}`}>
              {group.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  aria-current={pathname === href ? 'page' : undefined}
                  className="flex items-center px-4 py-3 rounded-xl text-sm font-medium transition hover:text-white hover:bg-white/5"
                  style={{ color: pathname === href ? '#fff' : 'rgba(255,255,255,0.72)' }}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
          <div className="pt-4 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)}
              className="block text-center py-2.5 rounded-xl text-sm font-medium border border-white/10 text-white/70">
              Sign in
            </Link>
            {!iosApp && (
              <Link href="/signup" onClick={() => setOpen(false)}
                className="block text-center py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                Sign up
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
