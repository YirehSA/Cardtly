import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import SettingsTabs, { type TeamBilling } from '@/components/settings/SettingsTabs'
import { orgEntitlesMembers, orgPaidUntilDaysLeft, orgTrialDaysLeft, orgBillingStartsInDays } from '@/lib/org-billing'

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
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Service role, because migration 076 puts row-level security on
  // whop_subscriptions and a user-scoped read would come back empty - showing
  // a paying subscriber that they have no subscription. Pinned to their own
  // user_id, which is the session's, so this shows them nothing but their own.
  const { data: sub } = await admin
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

  // THE TEAM BEHIND A TEAM-COVERED ACCOUNT, so Billing can say how long the
  // cover runs. It said only "your company pays for your seat", so the owner of
  // a team prepaid for a year could not see the year anywhere in their own
  // account (life360, 2026-10-09). The team they run comes first; otherwise
  // the team of the card they hold. Only what the page shows leaves the server.
  let team: TeamBilling | null = null
  if (plan.viaTeam) {
    const { data: owned } = await admin.from('organizations').select('*').eq('admin_user_id', user.id)
      .order('business_plan_active', { ascending: false }).order('created_at', { ascending: true })
      .limit(1).maybeSingle()
    const isOwner = !!owned && orgEntitlesMembers(owned)
    let org: any = isOwner ? owned : null
    if (!org) {
      const orgId = (allTeam || []).find((c: any) => c.organization_id)?.organization_id
      if (orgId) org = (await admin.from('organizations').select('*').eq('id', orgId).maybeSingle()).data
    }
    if (org) {
      const { count: used } = isOwner
        ? await admin.from('team_cards').select('id', { count: 'exact', head: true }).eq('organization_id', org.id)
        : { count: null }
      team = {
        name: org.name || null,
        isOwner,
        mode: org.billing_period || null,
        paidUntil: org.paid_until || null,
        paidUntilDaysLeft: orgPaidUntilDaysLeft(org.billing_period, org.paid_until || null),
        trialEndsAt: org.billing_period === 'trial' ? org.trial_ends_at || null : null,
        trialDaysLeft: orgTrialDaysLeft(org.billing_period, org.trial_ends_at || null),
        billingStartsOn: org.billing_starts_on || null,
        billingStartsInDays: orgBillingStartsInDays(org.billing_period, org.billing_starts_on || null),
        seats: isOwner ? org.max_seats ?? null : null,
        used: isOwner ? used ?? null : null,
      }
    }
  }

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
      team={team}
      subscription={sub || null}
      card={(card as any) || null}
    />
  )
}
