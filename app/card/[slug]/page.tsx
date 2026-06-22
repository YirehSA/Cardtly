import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import PublicCardView from '@/components/card/PublicCardView'
import CardTracker from '@/components/card/CardTracker'

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
      admin
        .from('whop_subscriptions')
        .select('subscription_tier, status')
        .eq('user_id', (card as any).user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('last_active_at, is_founder, founder_number, founder_lifetime_pro')
        .eq('user_id', (card as any).user_id)
        .maybeSingle(),
    ])

    const isPro = (sub as any)?.subscription_tier === 'pro' && (sub as any)?.status === 'active'
    const lastActiveAt = (profile as any)?.last_active_at || null
    const founderNumber = (profile as any)?.is_founder ? (profile as any)?.founder_number ?? null : null
    const founderLifetime = !!(profile as any)?.founder_lifetime_pro

    return (
      <CardTracker cardId={(card as any).id}>
        <PublicCardView card={card as any} isPro={isPro} lastActiveAt={lastActiveAt} founderNumber={founderNumber} founderLifetime={founderLifetime} />
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
    // Add-ons (contact exchange, questionnaire) for a team are
    // configured once on the organization and apply to every team
    // card. Fetch the org's add-ons and merge them over the card's
    // own (org wins). Service role: organizations is RLS-protected.
    let orgAddons: Record<string, any> = {}
    if ((teamCard as any).organization_id) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      ) as any
      const { data: org } = await admin
        .from('organizations')
        .select('addons')
        .eq('id', (teamCard as any).organization_id)
        .maybeSingle()
      orgAddons = org?.addons || {}
    }

    const cardShaped = {
      ...teamCard,
      user_id: null,
      is_primary: true,
      view_count: (teamCard as any).view_count || 0,
      work_phone: (teamCard as any).work_phone || null,
      whatsapp: (teamCard as any).whatsapp || null,
      // Org add-ons fan out to every team card; card-level addons
      // (rarely used for teams) act as a fallback.
      addons: { ...((teamCard as any).addons || {}), ...orgAddons },
      // Pass team_card_id so contact form saves correctly
      _team_card_id: (teamCard as any).id,
    }

    return (
      <CardTracker teamCardId={(teamCard as any).id}>
        <PublicCardView card={cardShaped as any} isPro={true} isTeamCard={true} />
      </CardTracker>
    )
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
