'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import {
  CreditCard, BarChart2, Mail, Monitor, Users,
  Settings, QrCode, Sun, Moon, LogOut, Sparkles, Home, Wifi
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard',             label: 'Overview',    icon: Home },
  { href: '/dashboard/card',        label: 'My Card',     icon: CreditCard },
  { href: '/dashboard/qr',          label: 'QR Code',     icon: QrCode },
  { href: '/dashboard/analytics',   label: 'Analytics',   icon: BarChart2 },
  { href: '/dashboard/contacts',    label: 'Contacts',    icon: Users },
  { href: '/dashboard/email-signature', label: 'Email Signature', icon: Mail },
  { href: '/dashboard/virtual-bg',  label: 'Virtual BG',  icon: Monitor },
  { href: '/dashboard/nfc',         label: 'NFC Cards',   icon: Wifi },
  { href: '/dashboard/settings',    label: 'Settings',    icon: Settings },
]

interface SidebarProps {
  isPro: boolean
  userName: string
  userEmail: string
}

export default function Sidebar({ isPro, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300"
      style={{
        width: 'var(--sidebar-width)',
        background: 'hsl(var(--sidebar-bg))',
        borderRight: '1px solid hsl(var(--sidebar-border))',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <img
          src="/logo.png"
          alt="Cardtly"
          className="h-8 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.removeAttribute('style')
          }}
        />
        <span className="font-black text-base tracking-tight sr-only" style={{ color: 'hsl(var(--sidebar-active))' }}>
          Cardtly
        </span>
        {isPro && (
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: 'hsl(var(--sidebar-accent) / 0.2)', color: 'hsl(var(--sidebar-accent))' }}
          >
            <Sparkles className="w-2.5 h-2.5" />Pro
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative"
              style={{
                color: active ? 'hsl(var(--sidebar-active))' : 'hsl(var(--sidebar-fg))',
                background: active ? 'hsl(var(--sidebar-accent) / 0.15)' : 'transparent',
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: 'hsl(var(--sidebar-accent))' }}
                />
              )}
              <Icon
                className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--sidebar-fg))' }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-1" style={{ borderTop: '1px solid hsl(var(--sidebar-border))', paddingTop: '12px' }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ color: 'hsl(var(--sidebar-fg))' }}
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-accent))' }} />
            : <Moon className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-accent))' }} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ color: 'hsl(var(--sidebar-fg))' }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>

        {/* User avatar */}
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-xl mt-1"
          style={{ background: 'hsl(var(--sidebar-border) / 0.5)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'hsl(var(--sidebar-accent) / 0.25)', color: 'hsl(var(--sidebar-accent))' }}
          >
            {initials}
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
