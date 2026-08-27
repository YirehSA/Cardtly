import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import PublicCardView from '@/components/card/PublicCardView'
import CardTracker from '@/components/card/CardTracker'
import TeamCardPublic from '@/components/card/TeamCardPublic'
import { mergeBrand, resolveTeamBrand } from '@/lib/team-brand'
import { planFromTrial, subscriptionState } from '@/lib/plan-server'
import { liveMirror } from '@/lib/questionnaire'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  // Check personal cards
  let card: any = null
  const { data: personalCard } = await supabase
    .from('cards')
    .select('name, company, title, bio, profile_image_url')
    .eq('slug', slug)
    .single()

  if (personalCard) {
    card = personalCard
  } else {
    const { data: teamCard } = await supabase
      .from('team_cards')
      .select('name, company, title, bio, profile_image_url')
      .eq('slug', slug)
      .single()
    if (teamCard) card = teamCard
  }

  if (!card) return { title: 'Card not found' }

  const ogTitle = [card.name, card.company].filter(Boolean).join(' — ')
  const description = card.bio || `Connect with ${card.name}${card.title ? `, ${card.title}` : ''}${card.company ? ` at ${card.company}` : ''}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const ogImageUrl = `${appUrl}/api/og/card/${slug}`

  return {
    title: ogTitle,
    description,
    // Canonical strips query params (?t=, utm_) so shared variants
    // all consolidate ranking signal onto the clean card URL.
    alternates: { canonical: `/card/${slug}` },
    openGraph: {
      title: ogTitle,
      description,
      type: 'profile',
      siteName: 'Cardtly',
      images: [{
        url: ogImageUrl,
        width: 630,
        height: 630,
        alt: `${card.name} — Digital Business Card`,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function PublicCardPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Check personal cards first
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('slug', slug)
    .single()

  if (card) {
    // Use the service-role admin client for the profile + subscription
    // reads. These power the public card's "Online now" badge, Pro
    // feature gates, and Founder ribbon — all intended to be visible to
    // anonymous viewers, but the underlying tables have row-level
    // security that blocks anon reads. Service role bypasses RLS;
    // safe because we only SELECT, never expose user-only fields, and
    // the page already only renders fields meant to be public.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    const [{ data: sub }, { data: profile }] = await Promise.all([
      // Not filtered to status = 'active': a past_due subscription still
      // serves inside its grace window, and filtering it out here would have
      // made a single declined charge look exactly like never having paid.
      admin
        .from('whop_subscriptions')
        .select('subscription_tier, status, past_due_since')
        .eq('user_id', (card as any).user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('last_active_at, is_founder, founder_number, trial_ends_at')
        .eq('user_id', (card as any).user_id)
        .maybeSingle(),
    ])

    const hasSubscription = subscriptionState(sub as any).serves

    // No subscription: the card only serves while the trial is still running.
    // planFromTrial fails open on a missing/unreadable date, so a data gap can
    // never take a live card down.
    const trialPlan = planFromTrial((profile as any)?.trial_ends_at ?? null)
    if (!hasSubscription && trialPlan.tier === 'expired') {
      notFound()
    }

    // The trial is the full product, so it unlocks the same fields as Pro.
    const isPro = hasSubscription || trialPlan.isActive
    const lastActiveAt = (profile as any)?.last_active_at || null
    const founderNumber = (profile as any)?.is_founder ? (profile as any)?.founder_number ?? null : null

    return (
      <CardTracker cardId={(card as any).id}>
        <PublicCardView card={card as any} isPro={isPro} lastActiveAt={lastActiveAt} founderNumber={founderNumber} />
      </CardTracker>
    )
  }

  // Check team cards — always Pro
  const { data: teamCard } = await supabase
    .from('team_cards')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (teamCard) {
    // Rendering lives in components/card/TeamCardPublic, shared with
    // /card/<company>/<person> so the same card cannot look different
    // depending on which of its two URLs was opened.
    return <TeamCardPublic teamCard={teamCard as any} />
  }

  // Check slug redirects
  const { data: redirectRecord } = await supabase
    .from('slug_redirects')
    .select('new_slug')
    .eq('old_slug', slug)
    .single()

  if (redirectRecord?.new_slug) {
    redirect(`/card/${redirectRecord.new_slug}`)
  }

  notFound()
}
