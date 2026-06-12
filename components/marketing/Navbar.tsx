'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/',              label: 'Home' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/nfc',           label: 'NFC Cards', badge: '🇿🇦' },
  { href: '/pricing',       label: 'Pricing' },
  { href: '/about',         label: 'About' },
  { href: '/contact',       label: 'Contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cardtly-icon.png" alt="Cardtly logo" className="w-9 h-9 rounded-full transition group-hover:scale-105" />
          <span className="font-black text-lg tracking-tight"
            style={{ background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Cardtly
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => {
            const { href, label } = link
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                {label}{link.badge && <span className="text-xs">{link.badge}</span>}
              </Link>
            )
          })}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium transition" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Sign in
          </Link>
          <Link href="/signup"
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(p => !p)} className="md:hidden text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-6 pb-6 pt-2 space-y-1" style={{ background: 'rgba(0,0,0,0.95)' }}>
          {LINKS.map(({ href, label, badge }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/05 transition">
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
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
