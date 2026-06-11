'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Home, CreditCard, QrCode, BarChart2, Users, Mail, Monitor,
  Wifi, Building2, Settings, Shield, LogOut, Sun, Moon, Sparkles,
} from 'lucide-react'
import { useTheme } from './dashboard/ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import { hasBiometricEnabled } from '@/lib/biometric'

interface Command {
  id: string
  label: string
  description?: string
  icon: typeof Home
  keywords?: string[]
  // Either a navigation target or an action
  href?: string
  action?: () => void | Promise<void>
  group: 'navigate' | 'create' | 'account'
}

// Global keyboard-driven launcher. Triggered by Cmd+K (Mac) or Ctrl+K
// (Windows/Linux). Provides a quick way to jump anywhere in the app
// without navigating menus. Used by both regular users and the admin
// (admin-only items are hidden from non-admin sessions).

export default function CommandPalette() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect admin so we can show admin-only commands
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      // Admin user ID from the existing admin gate
      setIsAdmin(user?.id === '6216ca40-72e5-47f2-af6a-a37d35f9d169')
    })
  }, [])

  // Global keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus the input when the palette opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      // Wait one tick for the modal to mount
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  async function signOut() {
    const supabase = createClient()
    // Local-only scope when biometric is enabled. See Sidebar.signOut
    // for the full rationale (keeps the server refresh token alive
    // so biometric can mint a new session next time).
    const scope: 'local' | 'global' = hasBiometricEnabled() ? 'local' : 'global'
    await supabase.auth.signOut({ scope })
    router.push('/login')
  }

  const allCommands: Command[] = [
    { id: 'home',        group: 'navigate', label: 'Dashboard',       icon: Home,        href: '/dashboard', keywords: ['overview', 'stats'] },
    { id: 'card',        group: 'navigate', label: 'My Card',         icon: CreditCard,  href: '/dashboard/card' },
    { id: 'qr',          group: 'navigate', label: 'QR Code',         icon: QrCode,      href: '/dashboard/qr' },
    { id: 'analytics',   group: 'navigate', label: 'Analytics',       icon: BarChart2,   href: '/dashboard/analytics', keywords: ['views', 'stats'] },
    { id: 'contacts',    group: 'navigate', label: 'Contacts',        icon: Users,       href: '/dashboard/contacts', keywords: ['leads'] },
    { id: 'email-sig',   group: 'navigate', label: 'Email Signature', icon: Mail,        href: '/dashboard/email-signature' },
    { id: 'virtual-bg',  group: 'navigate', label: 'Virtual Background', icon: Monitor,  href: '/dashboard/virtual-bg', keywords: ['zoom', 'teams'] },
    { id: 'nfc',         group: 'navigate', label: 'NFC Cards',       icon: Wifi,        href: '/dashboard/nfc' },
    { id: 'team',        group: 'navigate', label: 'Team Cards',      icon: Building2,   href: '/dashboard/team' },
    { id: 'settings',    group: 'account',  label: 'Settings',        icon: Settings,    href: '/dashboard/settings' },
    { id: 'upgrade',     group: 'account',  label: 'Upgrade to Pro',  icon: Sparkles,    href: '/upgrade', keywords: ['pro', 'plan', 'billing'] },
    { id: 'theme',       group: 'account',  label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: theme === 'dark' ? Sun : Moon, action: () => toggle(), keywords: ['theme', 'appearance', 'dark', 'light'] },
    { id: 'signout',     group: 'account',  label: 'Sign out',        icon: LogOut,      action: signOut },
    ...(isAdmin ? [
      { id: 'admin' as const, group: 'navigate' as const, label: 'Admin panel', icon: Shield, href: '/admin', keywords: ['admin'] },
    ] : []),
  ]

  const filtered = query
    ? allCommands.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.keywords || []).some((k) => k.toLowerCase().includes(q))
        )
      })
    : allCommands

  function executeCommand(cmd: Command) {
    setOpen(false)
    if (cmd.href) {
      router.push(cmd.href)
    } else if (cmd.action) {
      cmd.action()
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[highlight]
      if (cmd) executeCommand(cmd)
    }
  }

  if (!open) return null

  // Group filtered commands
  const groups: Record<string, Command[]> = { navigate: [], create: [], account: [] }
  filtered.forEach((c) => groups[c.group].push(c))
  const groupLabels: Record<string, string> = { navigate: 'Navigate', create: 'Create', account: 'Account' }

  let runningIndex = 0

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden border shadow-2xl"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
            onKeyDown={onInputKey}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border border-border bg-muted text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            (['navigate', 'create', 'account'] as const).map((groupKey) => {
              if (groups[groupKey].length === 0) return null
              return (
                <div key={groupKey}>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupLabels[groupKey]}
                  </div>
                  {groups[groupKey].map((cmd) => {
                    const currentIndex = runningIndex
                    runningIndex += 1
                    const isHighlighted = currentIndex === highlight
                    const Icon = cmd.icon
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setHighlight(currentIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition ${isHighlighted ? 'bg-accent/15' : ''}`}>
                        <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-foreground">{cmd.label}</span>
                        {isHighlighted && (
                          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border border-border bg-muted text-muted-foreground">↵</kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded font-mono border border-border bg-card">↑</kbd>
              <kbd className="px-1 py-0.5 rounded font-mono border border-border bg-card">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded font-mono border border-border bg-card">↵</kbd>
              <span>Select</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono border border-border bg-card">⌘</kbd>
            <kbd className="px-1 py-0.5 rounded font-mono border border-border bg-card">K</kbd>
            <span className="ml-1">to open</span>
          </div>
        </div>
      </div>
    </div>
  )
}
