import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import { withResolvedBrand } from '@/lib/resolve-card-brand'
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
  ChevronRight, Check, Circle, TrendingUp,
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

// The label above every number and every panel. Small, tracked and uppercase:
// the convention corporate reporting uses to separate what a figure is from
// what it says, and the cheapest way to make a screen read as an instrument
// rather than a feed.
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'

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
  // select('*') so the team brand can be resolved below: that needs
  // use_team_brand, department_id and organization_id.
  //
  // Without resolving, this page reads the row and finds no logo and no
  // colour on a card that is wearing both - so the preview came out in the
  // default blue, and the checklist told the person to add a company logo
  // their own card was already showing. Same fix as the QR page, the email
  // signature, virtual backgrounds and the directory.
  const rawTeamCard = personalCard
    ? null
    : await getMemberTeamCard<CardSummary & Record<string, any>>(user.id, '*')

  const teamCard = rawTeamCard
    ? ((await withResolvedBrand(
        createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ),
        [rawTeamCard as Record<string, any>],
      ))[0] as typeof rawTeamCard)
    : null

  const card: (CardSummary & { id: string }) | null = personalCard || (teamCard as any) || null
  const cardKind: 'personal' | 'team' | 'none' = personalCard ? 'personal' : teamCard ? 'team' : 'none'
  const referralCode = (profile as any)?.referral_code as string | null

  // Inside the iOS app, nothing on this page may sell anything or name a price.
  // See lib/app-platform for why this is read from the request rather than
  // decided in the browser.
  const iosApp = await isIosApp()

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
    { done: !!card.profile_image_url, label: 'Profile photo',   why: 'People remember a face' },
    { done: !!card.title,             label: 'Job title',       why: 'Says what you do' },
    { done: !!card.company,           label: 'Company',         why: 'Where you work' },
    { done: !!card.phone,             label: 'Phone number',    why: 'So people can call you' },
    { done: !!card.email,             label: 'Email address',   why: 'So people can email you' },
    { done: !!card.bio,               label: 'Short intro',     why: 'A line or two about you' },
    { done: !!card.company_logo_url,  label: 'Company logo',    why: 'Carries the brand' },
  ] : []
  const doneCount = checks.filter(c => c.done).length
  const percent = checks.length ? Math.round((doneCount / checks.length) * 100) : 0
  const todo = checks.filter(c => !c.done)

  const QUICK_ACTIONS = [
    { href: editCardHref,                 label: 'Edit card',        icon: CreditCard, desc: 'Details, photo and design' },
    { href: '/dashboard/qr',              label: 'QR code',          icon: QrCode,     desc: 'Download to print or share' },
    { href: '/dashboard/analytics',       label: 'Analytics',        icon: BarChart2,  desc: 'Views, taps and sources' },
    { href: '/dashboard/contacts',        label: 'Contacts',         icon: Users,      desc: 'Everyone who left details', pro: true },
    { href: '/dashboard/email-signature', label: 'Email signature',  icon: Mail,       desc: 'Your card in every email', pro: true },
    { href: '/dashboard/virtual-bg',      label: 'Video background', icon: Monitor,    desc: 'For Zoom and Teams', pro: true },
  ]

  // No card at all: one thing to do, said plainly.
  if (!card) {
    return (
      <div className="max-w-lg mx-auto py-20 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="w-11 h-11 rounded-lg grid place-items-center mb-5"
            style={{ background: accentHex + '14', color: accentHex }}>
            <CreditCard className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Create your card</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6 leading-relaxed">
            Setup takes about two minutes. Add your name and photo, and you will have a
            link you can share with anyone.
          </p>
          <Link href="/dashboard/card"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: accentHex }}>
            Create card <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  const statusLabel = isExpired ? 'Offline' : isTrial ? `Trial - ${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left` : 'Live'
  const statusTone = isExpired ? '#ef4444' : isTrial && trialDaysLeft <= 7 ? '#f59e0b' : '#22c55e'
  const roleLine = [card.title, card.company].filter(Boolean).join(' · ')

  const METRICS = [
    { label: 'Total views',    value: card.view_count ?? 0, note: 'Since the card went live', icon: Eye },
    { label: 'Last 30 days',   value: viewsThisMonth ?? 0,  note: 'Views this period',        icon: TrendingUp },
    { label: 'Contacts',       value: contactCount ?? 0,    note: 'People who left details',  icon: Users },
  ]

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      <OnboardingTour />
      {/* Pushes the card URL + name to the Android home-screen QR widget.
          Renders nothing; no-op on web. */}
      <WidgetSync slug={card?.slug ?? null} name={card?.name ?? null} />

      {/* Header. A rule rather than a tinted gradient panel: the page opens on
          who this account is and what state it is in, and spends no vertical
          space decorating that. */}
      <header className="pb-5 border-b border-border">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className={LABEL}>
              {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1.5">
              {card.name || 'Your card'}
            </h1>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border"
                style={{ borderColor: statusTone + '40', background: statusTone + '12', color: statusTone }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusTone }} />
                {statusLabel}
              </span>
              {roleLine && <p className="text-sm text-muted-foreground truncate">{roleLine}</p>}
              {cardKind === 'team' && (
                <span className={`${LABEL} px-1.5 py-0.5 rounded border border-border`}>Team card</span>
              )}
            </div>
          </div>
          {!isPaid && !iosApp && (
            <Link href="/dashboard/upgrade"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 shrink-0"
              style={{ background: accentHex }}>
              {isExpired ? 'Reactivate card' : 'Subscribe'}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      {/* Trial countdown / expired notice. Nobody should lose their card
          without being told it was coming. */}
      {(isTrial || isExpired) && (
        <div className="rounded-lg px-4 py-3 border"
          style={isExpired
            ? { background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.30)' }
            : trialDaysLeft <= 7
              ? { background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.30)' }
              : { background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.24)' }}>
          {/* The iOS wording states the fact and stops there. Apple's 3.1.1
              covers "calls to action that direct customers to purchasing
              mechanisms other than IAP", and that includes naming the price or
              telling somebody to go and subscribe - so on iOS this says what is
              true about their card and offers nothing to buy. */}
          <p className="text-sm leading-relaxed">
            {isExpired ? (
              <>
                <span className="font-semibold">Your card is offline.</span>{' '}
                <span className="text-muted-foreground">
                  Your trial has ended, so {card?.slug ? `cardtly.com/card/${card.slug}` : 'your card link'} no longer opens.
                  {iosApp
                    ? ' Nothing has been deleted - your design, your details and every contact are exactly where you left them.'
                    : ' Subscribe for R97 a month and it goes straight back live, same link, nothing lost.'}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold">
                  {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left on your trial.
                </span>{' '}
                <span className="text-muted-foreground">
                  You have every Pro feature until then.
                  {iosApp ? '' : ' Subscribe for R97 a month to keep your card live after that.'}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Metrics. One panel divided by hairlines rather than three floating
          cards in three different hues - the figures are the same kind of
          thing, so they are read across one row and coloured the same. */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Three across at every width. Stacked, these three rows filled the
            whole of a phone screen and pushed the card itself under the fold,
            which put the least urgent thing on the page first. The icon and
            the note are what get dropped on a narrow screen, because the
            label and the figure are the only parts carrying information. */}
        <div className="grid grid-cols-3 divide-x divide-border">
          {METRICS.map(({ label, value, note, icon: Icon }) => (
            <div key={label} className="p-3 sm:p-5">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground hidden sm:block shrink-0" />
                <p className={LABEL}>{label}</p>
              </div>
              <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums mt-2 sm:mt-2.5 leading-none">
                <AnimatedCounter to={value as number} />
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 hidden sm:block">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* The card itself */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <p className={LABEL}>Your card</p>
            <Link href={editCardHref}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition">
              Edit <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-5 grid sm:grid-cols-[minmax(0,180px)_1fr] gap-5 items-start">
            {/* Mini preview */}
            <div className="rounded-lg overflow-hidden mx-auto w-full max-w-[180px] border border-border bg-background">
              <div className="h-1" style={{ background: accentHex }} />
              <div className="px-4 py-4 text-center">
                {card.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.profile_image_url} alt=""
                    className="rounded-full object-cover mx-auto"
                    style={{ width: 52, height: 52, border: '1px solid hsl(var(--border))' }} />
                ) : (
                  <div className="rounded-full mx-auto flex items-center justify-center text-white font-semibold"
                    style={{ background: accentHex, width: 52, height: 52 }}>
                    {card.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <p className="font-semibold mt-2.5 text-sm leading-tight">{card.name || 'Your name'}</p>
                {card.title && <p className="text-[11px] text-muted-foreground mt-1">{card.title}</p>}
                {card.company && <p className="text-[11px] text-muted-foreground">{card.company}</p>}
              </div>
            </div>

            {/* Actions */}
            {card.slug && (
              <div className="space-y-2.5">
                <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: accentHex }}>
                  <Eye className="w-4 h-4" /> Open card
                </a>

                <TapToShareButton
                  cardUrl={`https://cardtly.com/card/${card.slug}`}
                  cardName={card.name || firstName}
                  accentHex={accentHex}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition min-w-0">
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

        {/* Completeness */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className={LABEL}>Profile completeness</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-3xl font-bold tracking-tight tabular-nums leading-none">{percent}%</p>
              <p className="text-xs text-muted-foreground tabular-nums">{doneCount} of {checks.length}</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, background: accentHex }} />
            </div>
          </div>

          {todo.length > 0 ? (
            <div className="border-t border-border divide-y divide-border">
              {todo.slice(0, 4).map(item => (
                <Link key={item.label} href={editCardHref}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition group">
                  <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.why}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-t border-border px-5 py-3.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 shrink-0" style={{ color: '#22c55e' }} />
              Every field is filled in.
            </div>
          )}
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

      {/* Tools */}
      <div>
        <p className={`${LABEL} mb-2.5 px-0.5`}>Tools</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, desc, pro }) => {
            const locked = pro && !isPro
            return (
              // A locked tile normally sells the upgrade. In the iOS app it
              // goes to the feature instead, where the gate explains what Pro
              // is without offering anywhere to buy it.
              <Link key={href} href={locked && !iosApp ? '/dashboard/upgrade' : href}
                className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  <Icon style={{ width: 17, height: 17 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{label}</p>
                    {locked && (
                      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border shrink-0"
                        style={{ borderColor: accentHex + '40', color: accentHex }}>Pro</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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

      {/* Pro upgrade banner for free users. Gone entirely in the iOS app -
          the whole panel is a call to action towards a purchase Apple does
          not take a cut of, which is precisely what 3.1.1 forbids. */}
      {!isPro && !iosApp && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className={LABEL}>Cardtly Pro</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              15 templates, analytics, email signature, virtual background, contact form,
              custom design and more.
            </p>
          </div>
          <Link href="/dashboard/upgrade"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 flex-shrink-0"
            style={{ background: accentHex }}>
            Upgrade <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
