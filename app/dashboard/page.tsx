import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import IndustryPrompt from '@/components/dashboard/IndustryPrompt'
import { fetchCardNetworkPrefs } from '@/lib/network'
import { parseDesign, getAccentHex } from '@/types/design'
import Link from 'next/link'
import CopyLinkButton from '@/components/dashboard/CopyLinkButton'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import OnboardingTour from '@/components/dashboard/OnboardingTour'
import { PROMOS_ENABLED } from '@/lib/promos'
import ReferralCard from '@/components/dashboard/ReferralCard'
import TapToShareButton from '@/components/nfc/TapToShareButton'
import WidgetSync from '@/components/dashboard/WidgetSync'
import TeammatesCard from '@/components/dashboard/TeammatesCard'
import AddToGoogleWalletButton from '@/components/wallet/AddToGoogleWalletButton'
import {
  CreditCard, BarChart2, Eye, Users, ArrowUpRight, QrCode, Mail, Monitor,
  Sparkles, ChevronRight, CheckCircle2, Circle, Rocket, TrendingUp,
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
  company_logo_url: string | null
  bio: string | null
  phone: string | null
  email: string | null
}

// Everything the card can carry, so the page can tell someone exactly what is
// still missing instead of leaving them to guess.
const CARD_FIELDS =
  'id, name, title, company, slug, view_count, color_theme, profile_image_url, company_logo_url, bio, phone, email'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, personalCard, { data: profile }] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<CardSummary>(user.id, CARD_FIELDS),
    supabase.from('profiles').select('referral_code').eq('user_id', user.id).maybeSingle(),
  ])

  // Team-member fallback: if the user has no personal card, see if they've
  // claimed a team card. The dashboard adapts so members see their card
  // without needing to know about team mechanics.
  const teamCard = personalCard ? null : await getMemberTeamCard<CardSummary & { organization_id?: string }>(
    user.id,
    `${CARD_FIELDS}, organization_id`
  )

  const card: (CardSummary & { id: string }) | null = personalCard || (teamCard as any) || null
  const cardKind: 'personal' | 'team' | 'none' = personalCard ? 'personal' : teamCard ? 'team' : 'none'
  const referralCode = (profile as any)?.referral_code as string | null

  const isPro = plan.tier === 'pro' && plan.isActive
  // A claimed team member's card is served by their organization and is never
  // gated on their personal trial (see app/card/[slug]/page.tsx, where team
  // cards render isPro unconditionally). Telling them their trial is ending,
  // or that their card is offline, would simply be false. The trial only
  // decides the fate of a personal card.
  const isTeamMember = cardKind === 'team'
  // A trial has every Pro feature, so isPro is true throughout it. These two
  // separate "paying" from "on the clock" so we can warn before the card goes
  // offline instead of surprising someone on day 61.
  const isTrial = !isTeamMember && !!plan.isTrial
  const isPaid = isTeamMember || (isPro && !plan.isTrial)
  const isExpired = !isTeamMember && plan.tier === 'expired'
  const trialDaysLeft = plan.trialDaysLeft ?? 0

  // Stats. Team cards live behind RLS the member cannot read directly, so
  // their events are counted with the service role - scoped to the one card id
  // we already resolved as theirs. Team members used to see a permanent zero
  // here because the team branch was never queried at all.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const [{ count: viewsThisMonth }, { count: contactCount }] = await Promise.all([
    !card
      ? { count: 0 }
      : cardKind === 'personal'
        ? supabase.from('card_events').select('*', { count: 'exact', head: true })
            .eq('card_id', card.id).eq('event_type', 'view').gte('created_at', thirtyDaysAgo)
        : admin.from('team_card_events').select('*', { count: 'exact', head: true })
            .eq('team_card_id', card.id).eq('event_type', 'view').gte('created_at', thirtyDaysAgo),
    !card
      ? { count: 0 }
      : cardKind === 'personal'
        ? supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('card_id', card.id)
        : admin.from('contacts').select('*', { count: 'exact', head: true }).eq('team_card_id', card.id),
  ])

  const design = card ? parseDesign(card.color_theme) : null
  const accentHex = design ? getAccentHex(design) : '#3b82f6'
  const firstName = (card?.name || 'there').split(' ')[0]

  // Asked for separately from the main card query - see fetchCardNetworkPrefs
  // for why naming these columns in CARD_FIELDS would be dangerous.
  const netPrefs = card
    ? await fetchCardNetworkPrefs(createServiceClient() as any, card.id, cardKind === 'team')
    : null

  // Team members edit their card on the team-card editor (so the locked-field
  // UI kicks in). Personal users go to the standard /dashboard/card editor.
  const editCardHref = cardKind === 'team' && card
    ? `/dashboard/team/card/${card.id}`
    : '/dashboard/card'

  // What is still missing from the card, in plain words. This is the whole
  // "what do I do next" answer, driven by the card itself rather than a
  // generic checklist that never changes.
  const checks = card ? [
    { done: !!card.profile_image_url, label: 'Add your photo',        why: 'People remember a face' },
    { done: !!card.title,             label: 'Add your job title',    why: 'Say what you do' },
    { done: !!card.company,           label: 'Add your company',      why: 'Where you work' },
    { done: !!card.phone,             label: 'Add your phone number', why: 'So people can call you' },
    { done: !!card.email,             label: 'Add your email',        why: 'So people can email you' },
    { done: !!card.bio,               label: 'Write a short intro',   why: 'A line or two about you' },
    { done: !!card.company_logo_url,  label: 'Add your company logo', why: 'Makes it look official' },
  ] : []
  const doneCount = checks.filter(c => c.done).length
  const percent = checks.length ? Math.round((doneCount / checks.length) * 100) : 0
  const todo = checks.filter(c => !c.done)

  const QUICK_ACTIONS = [
    { href: editCardHref,                 label: 'Edit my card',           icon: CreditCard, desc: 'Change your details, photo and design' },
    { href: '/dashboard/qr',              label: 'My QR code',             icon: QrCode,     desc: 'Download it to print or share' },
    { href: '/dashboard/analytics',       label: "Who's looking",          icon: BarChart2,  desc: 'See who opened your card' },
    { href: '/dashboard/contacts',        label: 'People who reached out', icon: Users,      desc: 'Their details, saved for you', pro: true },
    { href: '/dashboard/email-signature', label: 'Email signature',        icon: Mail,       desc: 'Put your card in every email', pro: true },
    { href: '/dashboard/virtual-bg',      label: 'Video call background',  icon: Monitor,    desc: 'For Zoom and Teams', pro: true },
  ]

  // No card at all: one thing to do, said plainly.
  if (!card) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl grid place-items-center text-white mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          <Rocket className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight">Let&apos;s make your card</h1>
        <p className="text-muted-foreground mt-2 mb-6">
          It takes about two minutes. Add your name and photo, and you will have a link you can share with anyone.
        </p>
        <Link href="/dashboard/card"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          Create my card <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  const statusLabel = isExpired ? 'Offline' : isTrial ? `Trial - ${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left` : 'Live'
  const statusTone = isExpired ? '#ef4444' : isTrial && trialDaysLeft <= 7 ? '#f59e0b' : '#22c55e'

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <OnboardingTour />
      {/* Pushes the card URL + name to the Android home-screen QR widget.
          Renders nothing; no-op on web. */}
      <WidgetSync slug={card?.slug ?? null} name={card?.name ?? null} />

      {/* Hero */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${accentHex}1f, transparent 65%)` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-medium mb-1 text-muted-foreground">
                {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
                Hey, {firstName} 👋
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: statusTone + '1f', color: statusTone }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusTone }} />
                  {statusLabel}
                </span>
                <p className="text-sm text-muted-foreground">
                  {isExpired ? 'Your card link no longer opens.' : 'Your card is out there working for you.'}
                </p>
              </div>
            </div>
            {!isPaid && (
              <Link href="/dashboard/upgrade"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`, boxShadow: `0 6px 24px ${accentHex}44` }}>
                <Sparkles className="w-4 h-4" />
                {isExpired ? 'Bring my card back' : 'Subscribe now'}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Trial countdown / expired notice. Nobody should lose their card
          without being told it was coming. */}
      {(isTrial || isExpired) && (
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
          style={isExpired
            ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }
            : trialDaysLeft <= 7
              ? { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }
              : { background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)' }}>
          <p className="text-sm flex-1 min-w-[240px]">
            {isExpired ? (
              <>
                <span className="font-bold">Your card is offline.</span>{' '}
                <span className="text-muted-foreground">
                  Your 60-day trial has ended, so {card?.slug ? `cardtly.com/card/${card.slug}` : 'your card link'} no longer opens.
                  Subscribe for R97 a month and it goes straight back live, same link, nothing lost.
                </span>
              </>
            ) : (
              <>
                <span className="font-bold">
                  {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your trial.
                </span>{' '}
                <span className="text-muted-foreground">
                  You have every Pro feature until then. Subscribe for R97 a month to keep your card live after that.
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Your card - the star of the page */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm flex items-center gap-2">
              Your card
              {cardKind === 'team' && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                  style={{ background: accentHex + '20', color: accentHex }}>Team</span>
              )}
            </p>
            <Link href={editCardHref}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition">
              Edit <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 grid sm:grid-cols-[minmax(0,200px)_1fr] gap-6 items-start">
            {/* Mini preview */}
            <div className="rounded-2xl overflow-hidden mx-auto w-full max-w-[200px]"
              style={{ background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}08)`, border: `1px solid ${accentHex}22` }}>
              <div className="h-14" style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}88)` }} />
              <div className="px-4 pb-4 text-center" style={{ marginTop: -26 }}>
                {card.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.profile_image_url} alt=""
                    className="w-13 h-13 rounded-full object-cover border-4 border-white mx-auto"
                    style={{ width: 52, height: 52 }} />
                ) : (
                  <div className="rounded-full mx-auto flex items-center justify-center text-white font-bold border-4 border-white"
                    style={{ background: accentHex, width: 52, height: 52 }}>
                    {card.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <p className="font-bold mt-2 text-sm leading-tight">{card.name || 'Your name'}</p>
                {card.title && <p className="text-[11px] mt-0.5" style={{ color: accentHex }}>{card.title}</p>}
                {card.company && <p className="text-[11px] text-muted-foreground mt-0.5">{card.company}</p>}
              </div>
            </div>

            {/* Actions */}
            {card.slug && (
              <div className="space-y-3">
                <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`, boxShadow: `0 6px 24px ${accentHex}44` }}>
                  <Eye className="w-4 h-4" /> Open my card
                </a>

                <TapToShareButton
                  cardUrl={`https://cardtly.com/card/${card.slug}`}
                  cardName={card.name || firstName}
                  accentHex={accentHex}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition min-w-0">
                    <span className="truncate">cardtly.com/card/{card.slug}</span>
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  </a>
                  <CopyLinkButton slug={card.slug} />
                </div>

                <div className="flex">
                  <AddToGoogleWalletButton slug={card.slug} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Numbers */}
        <div className="space-y-3">
          <p className="text-sm font-semibold px-1">Your numbers</p>
          {[
            { label: 'People who opened your card', value: card.view_count ?? 0, icon: Eye, color: accentHex },
            { label: 'Opened in the last 30 days', value: viewsThisMonth ?? 0, icon: TrendingUp, color: '#10b981' },
            { label: 'People who left their details', value: contactCount ?? 0, icon: Users, color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-4 border border-border bg-card flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0" style={{ background: color + '18' }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black tracking-tight leading-none" style={{ color }}>
                  <AnimatedCounter to={value as number} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ask for the industry once, only while it is missing. Someone who has
          opted out of the Network is not nagged for a field that only feeds it. */}
      {card && netPrefs?.ready && !netPrefs.industry && !netPrefs.hideFromNetwork && (
        <IndustryPrompt
          cardId={card.id}
          isTeamCard={cardKind === 'team'}
          accentHex={accentHex}
        />
      )}

      {/* Finish your card - the "what do I do next" answer */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-sm">
              {todo.length === 0 ? 'Your card is complete 🎉' : 'Finish your card'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todo.length === 0
                ? 'Nothing left to fill in. Go share it with someone.'
                : `${doneCount} of ${checks.length} done. Each one makes your card work harder.`}
            </p>
          </div>
          <span className="text-2xl font-black tracking-tight" style={{ color: accentHex }}>{percent}%</span>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}aa)` }} />
        </div>

        {todo.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todo.slice(0, 4).map(item => (
              <Link key={item.label} href={editCardHref}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-foreground/20 hover:-translate-y-0.5 transition-all group">
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.why}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Everything filled in - photo, title, company, contact details and logo.
          </div>
        )}
      </div>

      {/* Everything else */}
      <div>
        <p className="text-sm font-semibold mb-3 px-1">What else you can do</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, desc, pro }) => {
            const locked = pro && !isPro
            return (
              <Link key={href} href={locked ? '/dashboard/upgrade' : href}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: accentHex + '18', color: accentHex }}>
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{label}</p>
                    {locked && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                        style={{ background: accentHex + '18', color: accentHex }}>Pro</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Share a team card on the spot - shown to team members (their
          colleagues' cards) AND org admins (all their team's cards).
          The component self-hides when the API returns no cards, so
          rendering it unconditionally costs one light request for
          personal users and nothing visual. */}
      <TeammatesCard />

      {/* Referral card. Every line of it sells prize-draw entries, so it
          hides entirely while promos are paused rather than dangling a
          share link with no reward behind it. */}
      {PROMOS_ENABLED && referralCode && (
        <ReferralCard referralCode={referralCode} firstName={firstName} />
      )}

      {/* Pro upgrade banner for free users */}
      {!isPro && (
        <div className="rounded-3xl p-6 relative overflow-hidden"
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
                12 templates, analytics, email signature, virtual background, contact form, custom design and more.
              </p>
            </div>
            <Link href="/dashboard/upgrade"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 flex-shrink-0"
              style={{ background: accentHex, boxShadow: `0 4px 20px ${accentHex}44` }}>
              Upgrade to Pro <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
