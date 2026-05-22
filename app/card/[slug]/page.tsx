import { createClient } from '@/lib/supabase/server'
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
    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabase
        .from('whop_subscriptions')
        .select('subscription_tier, status')
        .eq('user_id', (card as any).user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('last_active_at')
        .eq('user_id', (card as any).user_id)
        .maybeSingle(),
    ])

    const isPro = (sub as any)?.subscription_tier === 'pro' && (sub as any)?.status === 'active'
    const lastActiveAt = (profile as any)?.last_active_at || null

    return (
      <CardTracker cardId={(card as any).id}>
        <PublicCardView card={card as any} isPro={isPro} lastActiveAt={lastActiveAt} />
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
    const cardShaped = {
      ...teamCard,
      user_id: null,
      is_primary: true,
      view_count: 0,
      work_phone: teamCard.work_phone || null,
      whatsapp: teamCard.whatsapp || null,
      // Pass team_card_id so contact form saves correctly
      _team_card_id: teamCard.id,
    }

    return (
      <PublicCardView card={cardShaped as any} isPro={true} isTeamCard={true} />
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
