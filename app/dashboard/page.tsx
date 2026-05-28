import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import { parseDesign, getAccentHex } from '@/types/design'
import Link from 'next/link'
import CopyLinkButton from '@/components/dashboard/CopyLinkButton'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import OnboardingTour from '@/components/dashboard/OnboardingTour'
import ReferralCard from '@/components/dashboard/ReferralCard'
import {
  CreditCard, BarChart2, Eye, Users, ArrowUpRight,
  QrCode, Mail, Monitor, Sparkles, ChevronRight
} from 'lucide-react'

interface CardSummary {
  id: string
  name: string | null
  title: string | null
  company: string | null
  slug: string | null
  view_count: number | null
  color_theme: string | null
  profile_image_url: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, card, { data: profile }] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<CardSummary>(user.id, 'id, name, title, company, slug, view_count, color_theme, profile_image_url'),
    supabase.from('profiles').select('referral_code').eq('user_id', user.id).maybeSingle(),
  ])
  const referralCode = (profile as any)?.referral_code as string | null

  const isPro = plan.tier === 'pro' && plan.isActive

  // Fetch analytics summary (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: viewsThisMonth }, { count: contactCount }] = await Promise.all([
    card ? supabase
      .from('card_events')
      .select('*', { count: 'exact', head: true })
      .eq('card_id', card.id)
      .eq('event_type', 'view')
      .gte('created_at', thirtyDaysAgo) : { count: 0 },
    card ? supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('card_id', card.id) : { count: 0 },
  ])

  const design = card ? parseDesign(card.color_theme) : null
  const accentHex = design ? getAccentHex(design) : '#3b82f6'
  const firstName = (card?.name || 'there').split(' ')[0]

  const QUICK_ACTIONS = [
    { href: '/dashboard/card',        label: 'Edit Card',       icon: CreditCard, desc: 'Update your info & design' },
    { href: '/dashboard/qr',          label: 'QR Code',         icon: QrCode,     desc: 'Download and share' },
    { href: '/dashboard/analytics',   label: 'Analytics',       icon: BarChart2,  desc: 'Views, clicks & more' },
    { href: '/dashboard/email-signature', label: 'Email Sig',   icon: Mail,       desc: 'Generate your signature', pro: true },
    { href: '/dashboard/virtual-bg',  label: 'Virtual BG',      icon: Monitor,    desc: 'For Zoom & Teams', pro: true },
    { href: '/dashboard/contacts',    label: 'Contacts',        icon: Users,      desc: 'People who reached out', pro: true },
  ]

  return (
    <div className="space-y-10 animate-fade-in">
      <OnboardingTour />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: accentHex }}>
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display, inherit)' }}>
            Hey, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isPro ? 'Your Pro card is live and looking great.' : 'Your card is live. Upgrade for the full experience.'}
          </p>
        </div>
        {!isPro && (
          <Link href="/dashboard/settings"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`, boxShadow: `0 4px 24px ${accentHex}44` }}>
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
        {[
          { label: 'Total views', value: card?.view_count ?? 0, icon: Eye, color: accentHex, isText: false },
          { label: 'This month', value: viewsThisMonth ?? 0, icon: BarChart2, color: '#10b981', isText: false },
          { label: 'Contacts', value: contactCount ?? 0, icon: Users, color: '#f59e0b', isText: false },
          { label: 'Plan', value: isPro ? 'Pro' : 'Free', icon: Sparkles, color: '#8b5cf6', isText: true },
        ].map(({ label, value, icon: Icon, color, isText }) => (
          <div key={label}
            className="rounded-2xl p-5 border border-border bg-card lift group cursor-default"
            style={{ boxShadow: `inset 0 1px 0 hsl(var(--card-foreground) / 0.04)` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className={`mt-2 font-black tracking-tight ${isText ? 'text-2xl' : 'text-3xl'}`}
                  style={{ color }}>
                  {isText
                    ? value
                    : <AnimatedCounter to={value as number} />}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ background: color + '18' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Card preview */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card overflow-hidden h-full">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-sm">Your card</p>
              <Link href="/dashboard/card"
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition">
                Edit <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              {/* Mini card preview */}
              <div className="w-full rounded-xl overflow-hidden mb-5"
                style={{ background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}08)`, border: `1px solid ${accentHex}22` }}>
                <div className="h-16" style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}88)` }} />
                <div className="px-5 pb-5" style={{ marginTop: -28 }}>
                  {card?.profile_image_url ? (
                    <img src={card.profile_image_url}
                      className="w-14 h-14 rounded-full object-cover border-4 border-white mx-auto" />
                  ) : (
                    <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg border-4 border-white"
                      style={{ background: accentHex }}>
                      {card?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <p className="font-bold mt-2 text-sm">{card?.name || 'Your Name'}</p>
                  {card?.title && <p className="text-xs mt-0.5" style={{ color: accentHex }}>{card.title}</p>}
                  {card?.company && <p className="text-xs text-muted-foreground mt-0.5">{card.company}</p>}
                </div>
              </div>

              {/* Card URL + Copy */}
              {card?.slug && (
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
                    cardtly.com/card/{card.slug}
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                  <CopyLinkButton slug={card.slug} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-3 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick actions</p>
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, desc, pro }) => {
            const locked = pro && !isPro
            return (
              <Link key={href} href={locked ? '/dashboard/settings' : href}
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:shadow-md transition-all group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: accentHex + '18', color: accentHex }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    {pro && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: accentHex + '18', color: accentHex }}>
                        {isPro ? 'Pro' : 'Upgrade'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Referral card — surfaces the personal ?ref= link where users
          actually land daily, instead of hiding it on /promotions */}
      {referralCode && (
        <ReferralCard referralCode={referralCode} firstName={firstName} />
      )}

      {/* Pro upgrade banner for free users */}
      {!isPro && (
        <div className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentHex}22 0%, ${accentHex}08 100%)`, border: `1px solid ${accentHex}33` }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
            style={{ background: accentHex + '10', transform: 'translate(30%, -30%)' }} />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" style={{ color: accentHex }} />
                <p className="font-bold text-sm" style={{ color: accentHex }}>Unlock everything with Pro</p>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                9 templates, analytics, email signature, virtual background, contact form, custom design and more.
              </p>
            </div>
            <Link href="/dashboard/settings"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex-shrink-0"
              style={{ background: accentHex, boxShadow: `0 4px 20px ${accentHex}44` }}>
              Upgrade to Pro <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
