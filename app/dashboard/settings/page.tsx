import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import SettingsTabs from '@/components/settings/SettingsTabs'

interface CardSummary {
  id: string
  slug: string | null
  name: string | null
  allow_homepage_feature?: boolean | null
  hide_from_network?: boolean | null
  industry?: string | null
}

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan = await getUserPlan(user.id)

  const [{ data: profile }, card] = await Promise.all([
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle(),
    getPrimaryCard<CardSummary>(user.id, 'id, slug, name, allow_homepage_feature, hide_from_network, industry'),
  ])

  // This asked for whop_user_id, which does not exist on the table, so the
  // query errored and sub came back null for everybody - including paying
  // subscribers, who could never see when their subscription started.
  // billing_cycle is what separates a real payer from a comped account.
  const { data: sub } = await supabase
    .from('whop_subscriptions')
    .select('subscription_tier, status, created_at, billing_cycle, seats')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Every card this person holds, for the "which card does your link open"
  // picker. select('*') rather than naming redirect_to_slug: migration 058 is
  // applied by hand after the deploy, and naming a column that does not exist
  // yet returns an EMPTY result rather than an error - which would silently
  // hide every card and make the picker vanish instead of failing loudly.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
  const [{ data: allPersonal }, { data: allTeam }] = await Promise.all([
    admin.from('cards').select('*').eq('user_id', user.id),
    admin.from('team_cards').select('*').eq('user_id', user.id).eq('is_active', true),
  ])

  const leadCounts = async (col: string, ids: string[]) => {
    if (!ids.length) return {} as Record<string, number>
    const { data } = await admin.from('contacts').select(col).in(col, ids)
    const out: Record<string, number> = {}
    for (const r of data || []) out[(r as any)[col]] = (out[(r as any)[col]] || 0) + 1
    return out
  }
  const [pLeads, tLeads] = await Promise.all([
    leadCounts('card_id', (allPersonal || []).map((c: any) => c.id)),
    leadCounts('team_card_id', (allTeam || []).map((c: any) => c.id)),
  ])

  const myCards = [
    ...(allPersonal || []).map((c: any) => ({
      id: c.id, slug: c.slug, name: c.name, kind: 'personal' as const,
      redirectTo: c.redirect_to_slug ?? null,
      views: c.view_count || 0, leads: pLeads[c.id] || 0,
    })),
    ...(allTeam || []).map((c: any) => ({
      id: c.id, slug: c.slug, name: c.name, kind: 'team' as const,
      redirectTo: c.redirect_to_slug ?? null,
      views: c.view_count || 0, leads: tLeads[c.id] || 0,
    })),
  ].filter(c => c.slug)

  return (
    <SettingsTabs
      myCards={myCards}
      user={{ id: user.id, email: user.email || '' }}
      profile={{ fullName: profile?.name || (card as any)?.name || '' }}
      plan={plan}
      subscription={sub || null}
      card={(card as any) || null}
    />
  )
}
