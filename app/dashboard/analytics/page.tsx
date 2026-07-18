import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import { redirect } from 'next/navigation'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import ProGate from '@/components/card/ProGate'

export const metadata = { title: 'Analytics' }

interface CardRef {
  id: string
  name: string | null
  slug: string | null
  view_count: number | null
  color_theme: string | null
}

// Two periods' worth of history, so the page can compare the selected window
// against the one before it. 90 days is the longest window offered, so 180
// covers "last 90 against the 90 before that".
const HISTORY_DAYS = 180

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, personalCard] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<CardRef>(user.id, 'id, name, slug, view_count, color_theme'),
  ])

  // A team member has no personal card, and this page used to tell them
  // "No card found" - while their team card was collecting views the whole
  // time. Fall back to their claimed team card, as the dashboard does.
  const teamCard = personalCard
    ? null
    : await getMemberTeamCard<CardRef>(user.id, 'id, name, slug, view_count, color_theme')

  const card = personalCard || teamCard
  const isTeam = !personalCard && !!teamCard

  // A claimed team card is served by the organisation and is never gated on
  // the member's own plan (the dashboard treats them as paid for the same
  // reason). Only a personal card needs Pro for analytics.
  if (!isTeam && (plan.tier !== 'pro' || !plan.isActive)) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Analytics" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found. Create your card first.</p>
      </div>
    )
  }

  // Team rows sit behind RLS the member cannot read, so they are fetched with
  // the service role, scoped to the single card id already resolved as theirs.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
  const db: any = isTeam ? admin : supabase

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Fetched once here rather than per period in the browser: the history is
  // small, and it makes switching period instant instead of a round trip.
  const [{ data: events }, { data: contacts }] = await Promise.all([
    isTeam
      ? db.from('team_card_events').select('event_type, device, browser, os, referrer, created_at')
          .eq('team_card_id', card.id).gte('created_at', since).order('created_at')
      : db.from('card_events').select('event_type, device, browser, os, referrer, created_at')
          .eq('card_id', card.id).gte('created_at', since).order('created_at'),
    isTeam
      ? db.from('contacts').select('created_at').eq('team_card_id', card.id).gte('created_at', since)
      : db.from('contacts').select('created_at').eq('card_id', card.id).gte('created_at', since),
  ])

  return (
    <AnalyticsDashboard
      card={{
        name: card.name || 'Your card',
        slug: card.slug || '',
        colorTheme: card.color_theme,
        totalViews: card.view_count ?? 0,
      }}
      isTeam={isTeam}
      events={(events || []) as any}
      contactDates={((contacts || []) as any[]).map(c => c.created_at)}
    />
  )
}
