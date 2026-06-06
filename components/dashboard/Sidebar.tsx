'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import {
  CreditCard, BarChart2, Mail, Monitor, Users,
  Settings, QrCode, Sun, Moon, LogOut, Sparkles, Home, Wifi, Building2, Shield,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { disableBiometric } from '@/lib/biometric'

// Each nav item gets its own brand-pillar colour. Icons render
// inside a small chip - desaturated by default, fully lit on
// active/hover so the sidebar feels alive instead of flat grey.
const NAV = [
  { href: '/dashboard',                 label: 'Overview',        icon: Home,        color: '#3b82f6' }, // blue
  { href: '/dashboard/card',            label: 'My Card',         icon: CreditCard,  color: '#8b5cf6' }, // purple
  { href: '/dashboard/qr',              label: 'QR Code',         icon: QrCode,      color: '#ec4899' }, // pink
  { href: '/dashboard/analytics',       label: 'Analytics',       icon: BarChart2,   color: '#06b6d4' }, // cyan
  { href: '/dashboard/contacts',        label: 'Contacts',        icon: Users,       color: '#22c55e' }, // green
  { href: '/dashboard/email-signature', label: 'Email Signature', icon: Mail,        color: '#f59e0b' }, // amber
  { href: '/dashboard/virtual-bg',      label: 'Virtual BG',      icon: Monitor,     color: '#6366f1' }, // indigo
  { href: '/dashboard/nfc',             label: 'NFC Cards',       icon: Wifi,        color: '#14b8a6' }, // teal
  { href: '/dashboard/team',            label: 'Team Cards',      icon: Building2,   color: '#fb923c' }, // orange
  { href: '/dashboard/settings',        label: 'Settings',        icon: Settings,    color: '#94a3b8' }, // slate
]

interface SidebarProps {
  isPro: boolean
  isAdmin?: boolean
  userName: string
  userEmail: string
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function Sidebar({ isPro, isAdmin = false, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    try { await disableBiometric() } catch {}
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex-col z-50 hidden lg:flex lg:translate-x-0"
      style={{
        width: 'var(--sidebar-width)',
        background: 'hsl(var(--sidebar-bg))',
        borderRight: '1px solid hsl(var(--sidebar-border))',
      }}
    >
      {/* Logo + Pro badge */}
      <div className="flex items-center gap-3 px-6 py-6" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <Link href="/" className="flex items-center hover:opacity-80 transition" aria-label="Cardtly home">
          <img src="/cardtly-logo.png" alt="Cardtly" className="h-14 w-auto" />
        </Link>
        {isPro && (
          <span
            className="ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 text-white"
            style={{ background: grad, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
          >
            <Sparkles className="w-2.5 h-2.5" />Pro
          </span>
        )}
      </div>

      {/* Nav — colour-chip icons, animated active state */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className="sidebar-link group relative flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium overflow-hidden"
              data-active={active}
            >
              {/* Active row background — soft gradient using the item's colour */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
                style={{
                  background: `linear-gradient(90deg, ${color}22 0%, ${color}08 60%, transparent 100%)`,
                  opacity: active ? 1 : 0,
                }}
              />
              {/* Active left bar with glow */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                  style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                />
              )}
              {/* Icon chip — lights up on hover/active */}
              <span
                className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
                style={{
                  background: active ? color : `${color}1f`,
                  boxShadow: active ? `0 4px 14px ${color}66` : 'none',
                }}
              >
                <Icon
                  className="w-4 h-4 transition-colors"
                  style={{ color: active ? '#fff' : color }}
                />
                {/* Subtle outer pulse on hover (only when not active) */}
                {!active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `${color}26`, boxShadow: `0 0 16px ${color}40` }}
                  />
                )}
              </span>
              {/* Label */}
              <span
                className="relative z-10 transition-all duration-200 group-hover:translate-x-0.5"
                style={{
                  color: active ? 'hsl(var(--sidebar-active))' : 'hsl(var(--sidebar-fg))',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* Admin link — same chip pattern, gold gradient chip,
            subtle separator above so it reads as its own section. */}
        {isAdmin && (
          <>
            <div className="my-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--sidebar-border)), transparent)' }} />
            <Link
              href="/admin"
              prefetch={true}
              className="sidebar-link group relative flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium overflow-hidden"
              data-active={pathname.startsWith('/admin')}
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(90deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.05) 60%, transparent 100%)',
                  opacity: pathname.startsWith('/admin') ? 1 : 0,
                }}
              />
              {pathname.startsWith('/admin') && (
                <span
                  aria-hidden
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                  style={{ background: '#fbbf24', boxShadow: '0 0 12px #fbbf24' }}
                />
              )}
              <span
                className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
                style={{
                  background: pathname.startsWith('/admin')
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'rgba(251,191,36,0.16)',
                  boxShadow: pathname.startsWith('/admin') ? '0 4px 14px rgba(251,191,36,0.5)' : 'none',
                }}
              >
                <Shield
                  className="w-4 h-4 transition-colors"
                  style={{ color: pathname.startsWith('/admin') ? '#fff' : '#fbbf24' }}
                />
              </span>
              <span
                className="relative z-10 font-semibold transition-all duration-200 group-hover:translate-x-0.5"
                style={{ color: pathname.startsWith('/admin') ? 'hsl(var(--sidebar-active))' : 'hsl(var(--sidebar-fg))' }}
              >
                Admin
              </span>
            </Link>
          </>
        )}
      </nav>

      {/* Bottom section — theme toggle, sign out, user card */}
      <div className="px-3 pb-4 space-y-1" style={{ borderTop: '1px solid hsl(var(--sidebar-border))', paddingTop: '12px' }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full group relative flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium overflow-hidden transition-all hover:bg-white/5"
          style={{ color: 'hsl(var(--sidebar-fg))' }}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
            style={{ background: theme === 'dark' ? 'rgba(251,191,36,0.16)' : 'rgba(99,102,241,0.16)' }}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: '#fbbf24' }} />
              : <Moon className="w-4 h-4" style={{ color: '#6366f1' }} />}
          </span>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full group relative flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium overflow-hidden transition-all hover:bg-white/5"
          style={{ color: 'hsl(var(--sidebar-fg))' }}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
            style={{ background: 'rgba(239,68,68,0.14)' }}
          >
            <LogOut className="w-4 h-4" style={{ color: '#ef4444' }} />
          </span>
          Sign out
        </button>

        {/* User card with gradient avatar ring */}
        <div
          className="flex items-center gap-3 px-2 py-3 rounded-xl mt-1"
          style={{ background: 'hsl(var(--sidebar-border) / 0.4)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white relative"
            style={{ background: grad, boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }}
          >
            {initials}
            {/* Tiny green online dot */}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: '#22c55e', border: '2px solid hsl(var(--sidebar-bg))' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--sidebar-active))' }}>
              {userName || 'Your Name'}
            </p>
            <p className="text-xs truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>
              {userEmail}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
