'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import {
  CreditCard, BarChart2, Mail, Monitor, Users,
  Settings, QrCode, Sun, Moon, LogOut, Sparkles, Home, Wifi, Building2, Shield, ScanLine, ClipboardList,
  Layers, Network, CalendarClock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Each nav item gets its own brand-pillar colour. Icons render
// inside a small chip. Every item used to carry its own hue - blue, purple,
// pink, cyan, green, violet, sky, amber, indigo, teal, slate, orange - which
// put a nine-colour rainbow down the side of every single page. The nav now
// works the way the mobile bar already did: one accent marks where you are,
// everything else is quiet.
const NAV = [
  { href: '/dashboard',                 label: 'Overview',        icon: Home },
  { href: '/dashboard/card',            label: 'My Card',         icon: CreditCard },
  { href: '/dashboard/qr',              label: 'QR Code',         icon: QrCode },
  { href: '/dashboard/analytics',       label: 'Analytics',       icon: BarChart2 },
  { href: '/dashboard/contacts',        label: 'Contacts',        icon: Users },
  { href: '/dashboard/scan',            label: 'Scan Card',       icon: ScanLine },
  { href: '/dashboard/network',         label: 'Network',         icon: Network },
  { href: '/dashboard/email-signature', label: 'Email Signature', icon: Mail },
  { href: '/dashboard/virtual-bg',      label: 'Virtual BG',      icon: Monitor },
  { href: '/dashboard/nfc',             label: 'NFC Cards',       icon: Wifi },
  { href: '/dashboard/settings',        label: 'Settings',        icon: Settings },
]

// Team Cards, which not everybody should be offered. See showTeamCards below.
const TEAM_TAB = { href: '/dashboard/team', label: 'Team Cards', icon: Building2 }

// Only a sales rep sees this: their own meetings and notes.
const MEETINGS_TAB = { href: '/dashboard/meetings', label: 'My Calendar', icon: CalendarClock }

interface SidebarProps {
  isPro: boolean
  isAdmin?: boolean
  managesDepartments?: boolean
  // A department head gets the same tab, scoped to their own people and
  // labelled for them. See app/dashboard/layout.
  teamTabLabel?: string
  showTeamCards?: boolean
  isRep?: boolean
  userName: string
  userEmail: string
}

const grad = 'hsl(var(--accent))'

export default function Sidebar({ isPro, isAdmin = false, managesDepartments = false, showTeamCards = true, isRep = false, teamTabLabel, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  // Lead capture (contact popup + questionnaire) is standard on Pro. The
  // user switches each one on inside; the link is always there so nobody has
  // to know it exists before they can find it.
  const nav = [
    ...(isPro ? [...NAV, { href: '/dashboard/questionnaire', label: 'Lead capture', icon: ClipboardList }] : NAV),
    // Hidden from anyone who is in a team they do not own. Team Cards is the
    // payer's console - seats, billing, every card in the company - so for a
    // department head or a member it is somebody else's page, and clicking it
    // only ever produced a notice explaining that. Their equivalent is
    // Departments, right below.
    ...(showTeamCards ? [{ ...TEAM_TAB, label: teamTabLabel || TEAM_TAB.label }] : []),
    // Only a department manager sees this. Their whole scoped surface lives
    // behind it.
    ...(managesDepartments ? [{ href: '/dashboard/departments', label: 'Departments', icon: Layers }] : []),
    ...(isRep ? [MEETINGS_TAB] : []),
  ]
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    // Sign out everywhere. Biometric sign-in was removed, so there is no
    // longer a reason to keep the server session alive for this device.
    const scope: 'local' | 'global' = 'global'
    await supabase.auth.signOut({ scope })
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
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition" aria-label="Cardtly home">
          <img src="/cardtly-icon.png" alt="Cardtly" className="h-11 w-11 rounded-full" />
          <span className="font-bold text-base tracking-tight"
            style={{ background: 'hsl(var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Cardtly
          </span>
        </Link>
        {isPro && (
          <span
            className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 text-white"
            style={{ background: grad }}
          >
            <Sparkles className="w-2.5 h-2.5" />Pro
          </span>
        )}
      </div>

      {/* Nav - two tiles per row.
          A single column of full-width rows ran past the bottom of the
          viewport and made the whole nav scroll, which hides the last few
          destinations behind a gesture nobody thinks to make. Stacking the
          icon above a small label halves the rows and lets every item fit
          without scrolling. overflow-y-auto stays as a fallback for very
          short windows rather than as the normal state. */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-2 gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <NavTile
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={active}
              />
            )
          })}
        </div>

        {/* Staff only - its own section under a divider, so it does not read as
            just another destination.
            Calendar sits beside Admin rather than inside it: every booking any
            rep makes is in there, and getting to it meant opening Admin and
            finding the right tab first. It deep-links to that tab. */}
        {isAdmin && (
          <>
            <div className="my-2 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--sidebar-border)), transparent)' }} />
            <div className="grid grid-cols-2 gap-1">
              <NavTile
                href="/admin"
                label="Admin"
                Icon={Shield}
                active={pathname.startsWith('/admin')}
              />
              <NavTile
                href="/admin?tab=meetings"
                label="Calendar"
                Icon={CalendarClock}
                active={false}
              />
            </div>
          </>
        )}
      </nav>

      {/* Bottom section - theme toggle and sign out sit side by side for the
          same reason the nav is a grid: two full-width rows here cost about
          fifty pixels that the nav needs to fit. */}
      <div className="px-3 pb-4 space-y-1.5" style={{ borderTop: '1px solid hsl(var(--sidebar-border))', paddingTop: '12px' }}>
        <div className="grid grid-cols-2 gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="sidebar-tile group relative flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl overflow-hidden"
            data-active="false"
            style={{ color: 'hsl(var(--sidebar-fg))' }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
              style={{ background: theme === 'dark' ? 'rgba(251,191,36,0.16)' : 'rgba(99,102,241,0.16)' }}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-fg))' }} />
                : <Moon className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-fg))' }} />}
            </span>
            <span className="text-[11px] font-medium leading-tight">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Sign out */}
          <button
            onClick={signOut}
            title="Sign out"
            className="sidebar-tile group relative flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl overflow-hidden"
            data-active="false"
            style={{ color: 'hsl(var(--sidebar-fg))' }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
              style={{ background: 'rgba(239,68,68,0.14)' }}
            >
              <LogOut className="w-4 h-4" style={{ color: '#ef4444' }} />
            </span>
            <span className="text-[11px] font-medium leading-tight">Sign out</span>
          </button>
        </div>

        {/* User card with gradient avatar ring */}
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-xl mt-0.5"
          style={{ background: 'hsl(var(--sidebar-border) / 0.4)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white relative"
            style={{ background: grad }}
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

// One nav destination. Stacked icon-over-label so two fit side by side in a
// 240px sidebar; `wide` spans both columns for the admin entry.
function NavTile({
  href,
  label,
  Icon,
  active,
  wide = false,
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  active: boolean
  wide?: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      title={label}
      data-active={active}
      className={`sidebar-tile group relative flex rounded-xl overflow-hidden transition-all duration-200 ${
        wide
          ? 'flex-row items-center gap-3 px-3 py-2'
          : 'flex-col items-center justify-center gap-1 px-1.5 py-1.5'
      }`}
      style={{
        // Three things say "you are here", not one: a wash that is brighter at
        // the top left where the light would fall, a hairline ring, and the
        // icon in the accent. A flat tint alone was legible and inert.
        background: active
          ? 'linear-gradient(145deg, hsl(var(--sidebar-accent) / 0.22), hsl(var(--sidebar-accent) / 0.08))'
          : 'transparent',
        boxShadow: active
          ? 'inset 0 0 0 1px hsl(var(--sidebar-accent) / 0.38), 0 6px 16px -10px hsl(var(--sidebar-accent) / 0.55)'
          : 'none',
      }}
    >
      {/* The lit top edge, the same move the panels use, so the sidebar and
          the page look like they were made by the same hand. */}
      {active && (
        <span aria-hidden className="absolute top-0 left-2 right-2 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--sidebar-accent) / 0.7), transparent)' }} />
      )}
      <span className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon
          className="w-4 h-4 transition-transform duration-200 group-hover:scale-110"
          style={{ color: active ? 'hsl(var(--sidebar-accent))' : 'hsl(var(--sidebar-fg))' }}
        />
      </span>
      <span
        className={`relative z-10 leading-tight transition-colors ${
          wide ? 'text-sm' : 'text-[11px] text-center'
        }`}
        style={{
          color: active ? 'hsl(var(--sidebar-active))' : 'hsl(var(--sidebar-fg))',
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </span>
    </Link>
  )
}
