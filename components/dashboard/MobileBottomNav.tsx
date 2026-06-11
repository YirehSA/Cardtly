'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import {
  Home, CreditCard, QrCode, BarChart2,
  Users, Mail, Monitor, Wifi, Building2, Settings as SettingsIcon,
  Sun, Moon, LogOut, Shield,
  ChevronUp, X,
} from 'lucide-react'

// Mobile-only bottom tab bar. Replaces the hamburger + slide-out
// sidebar pattern on small screens. 4 most-used destinations sit in
// the bar permanently; the rest live behind a "More" button that
// slides up a sheet from above the bar. Desktop is unaffected -
// this whole component is md:hidden.

// Each tab is the active state if the pathname matches the href
// exactly OR (for non-root tabs) starts with the href, mirroring
// the Sidebar's logic so deep pages keep the parent active.
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

interface Tab {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PRIMARY_TABS: Tab[] = [
  { href: '/dashboard',           label: 'Home',  icon: Home        },
  { href: '/dashboard/card',      label: 'Card',  icon: CreditCard  },
  { href: '/dashboard/qr',        label: 'QR',    icon: QrCode      },
  { href: '/dashboard/analytics', label: 'Stats', icon: BarChart2   },
]

const MORE_TABS: Tab[] = [
  { href: '/dashboard/contacts',         label: 'Contacts',        icon: Users        },
  { href: '/dashboard/email-signature',  label: 'Email Signature', icon: Mail         },
  { href: '/dashboard/virtual-bg',       label: 'Virtual BG',      icon: Monitor      },
  { href: '/dashboard/nfc',              label: 'NFC Cards',       icon: Wifi         },
  { href: '/dashboard/team',             label: 'Team Cards',      icon: Building2    },
  { href: '/dashboard/settings',         label: 'Settings',        icon: SettingsIcon },
]

interface Props {
  isAdmin?: boolean
}

export default function MobileBottomNav({ isAdmin = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)

  // Close the More sheet whenever we navigate away.
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Visible More items = the base 6 + Admin if granted
  const moreTabs: Tab[] = isAdmin
    ? [...MORE_TABS, { href: '/admin', label: 'Admin', icon: Shield }]
    : MORE_TABS

  // Active any time the current page is one of the More items
  const moreActive = moreTabs.some(t => isActive(pathname, t.href))

  async function signOut() {
    // Biometric stays enabled across sign-outs - the user can
    // disable it explicitly from /dashboard/settings if they want
    // to. Auto-clearing on every sign-out meant the next login
    // re-prompted "enable biometric?" forever.
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Expanded "More" sheet — sits above the bar, slides up. */}
      {moreOpen && (
        <>
          {/* Backdrop to dismiss */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[58] md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMoreOpen(false)}
          />

          {/* The sheet itself */}
          <div
            className="fixed left-0 right-0 z-[59] md:hidden animate-slide-up"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
              background: 'hsl(var(--card))',
              borderTop: '1px solid hsl(var(--border))',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              {moreTabs.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={true}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition active:scale-95"
                    style={{
                      background: active ? 'hsl(var(--sidebar-accent) / 0.15)' : 'transparent',
                      border: '1px solid',
                      borderColor: active ? 'hsl(var(--sidebar-accent) / 0.35)' : 'hsl(var(--border))',
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--foreground))' }}
                    />
                    <span
                      className="text-[11px] font-semibold text-center px-1 leading-tight"
                      style={{ color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--foreground))' }}
                    >
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Footer actions — theme toggle + sign out */}
            <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2 border-t border-border mt-2 pt-3">
              <button
                onClick={toggle}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-border bg-background hover:bg-muted transition"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                onClick={signOut}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/5 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* The bottom bar itself — always visible on mobile. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] md:hidden"
        style={{
          background: 'hsl(var(--card))',
          borderTop: '1px solid hsl(var(--border))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
        aria-label="Main"
      >
        <div className="grid grid-cols-5 px-1 pt-1.5 pb-1.5">
          {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className="flex flex-col items-center gap-1 py-1.5 rounded-xl transition active:scale-95"
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className="w-5 h-5 transition-transform"
                  style={{
                    color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--muted-foreground))',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--muted-foreground))' }}
                >
                  {label}
                </span>
              </Link>
            )
          })}

          {/* More button — toggles the sheet */}
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            className="flex flex-col items-center gap-1 py-1.5 rounded-xl transition active:scale-95"
            aria-expanded={moreOpen}
            aria-label="More options"
          >
            <ChevronUp
              className="w-5 h-5 transition-transform"
              style={{
                color: (moreOpen || moreActive) ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--muted-foreground))',
                transform: moreOpen ? 'rotate(180deg) scale(1.1)' : moreActive ? 'scale(1.1)' : 'rotate(0deg)',
              }}
            />
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: (moreOpen || moreActive) ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--muted-foreground))' }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      `}</style>
    </>
  )
}
