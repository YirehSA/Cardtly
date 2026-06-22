import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { isAdminUser, FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'

export const metadata = { title: 'Admin' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!await isAdminUser(user?.id)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Rolling 30-day window. ISO so Supabase compares timestamps
  // correctly across timezones - we treat this as "last 30 days"
  // rather than "this calendar month" so the number is always
  // useful regardless of where we are in the month.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all data in parallel
  const [
    { data: authUsers },
    { data: subscriptions },
    { data: cards },
    { data: teamCards },
    { data: orgs },
    { data: nfcOrders },
    { data: contacts },
    { data: profiles },
    { data: recentCardViews },
    { data: recentTeamCardViews },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('whop_subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('cards').select('id, name, slug, user_id, view_count, addons, created_at').order('view_count', { ascending: false, nullsFirst: false }),
    admin.from('team_cards').select('id, name, slug, user_id, organization_id, view_count, claimed_at, addons, created_at').order('view_count', { ascending: false, nullsFirst: false }),
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('nfc_orders').select('*').order('created_at', { ascending: false }),
    admin.from('contacts').select('id, created_at').order('created_at', { ascending: false }),
    admin.from('profiles').select('user_id, signup_country, signup_country_code, signup_city, signup_region, signup_ip, is_admin'),
    // 30-day view events for personal cards. We pull just the
    // card_id column and aggregate in app code - simpler than
    // a Postgres count-grouped-by query and the data volume is
    // small at current scale.
    admin.from('card_events').select('card_id').eq('event_type', 'view').gte('created_at', thirtyDaysAgo),
    // Same for team cards. team_card_events came with migration
    // 010 - if it hasn't been applied yet, this returns an error
    // that we swallow below so the rest of admin still renders.
    admin.from('team_card_events').select('team_card_id').eq('event_type', 'view').gte('created_at', thirtyDaysAgo),
  ])

  const { data: activeAnnouncement } = await admin
    .from('app_announcements')
    .select('id, message, link_url, link_text, variant, display_style, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const users = authUsers?.users || []
  const subMap = Object.fromEntries((subscriptions || []).map((s: any) => [s.user_id, s]))
  const orgMap = Object.fromEntries((orgs || []).map((o: any) => [o.admin_user_id, o]))
  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]))

  // Tally 30-day views per card from the event rows. Personal
  // cards and team cards each have their own event table.
  const views30dByCard: Record<string, number> = {}
  for (const e of (recentCardViews as any[]) || []) {
    if (!e?.card_id) continue
    views30dByCard[e.card_id] = (views30dByCard[e.card_id] || 0) + 1
  }
  const views30dByTeamCard: Record<string, number> = {}
  for (const e of (recentTeamCardViews as any[]) || []) {
    if (!e?.team_card_id) continue
    views30dByTeamCard[e.team_card_id] = (views30dByTeamCard[e.team_card_id] || 0) + 1
  }

  // Sum personal + claimed-team-card views per owner so we can show
  // a "X views" chip next to each user in the Users tab. Unclaimed
  // team cards (user_id is null) only contribute to the Team Cards
  // table, not to any user's totals. Tracked both all-time (the
  // running counter) and last-30-days (from event rows).
  const viewsByUser: Record<string, number> = {}
  const views30dByUser: Record<string, number> = {}
  for (const c of (cards as any[]) || []) {
    if (!c?.user_id) continue
    viewsByUser[c.user_id] = (viewsByUser[c.user_id] || 0) + (c.view_count || 0)
    views30dByUser[c.user_id] = (views30dByUser[c.user_id] || 0) + (views30dByCard[c.id] || 0)
  }
  for (const tc of (teamCards as any[]) || []) {
    if (!tc?.user_id) continue
    viewsByUser[tc.user_id] = (viewsByUser[tc.user_id] || 0) + (tc.view_count || 0)
    views30dByUser[tc.user_id] = (views30dByUser[tc.user_id] || 0) + (views30dByTeamCard[tc.id] || 0)
  }

  // Resolve organization name + admin user id for each team card so
  // the Team Cards table can show which org they belong to. Also
  // attach the 30-day view count we just computed.
  const orgsById = Object.fromEntries((orgs as any[] || []).map((o: any) => [o.id, o]))

  // Team members are users who've claimed a team card (team_cards.user_id
  // matches their auth uid). They don't appear in orgMap (which is keyed
  // by admin_user_id), so without this they'd fall through to "Free"
  // even though they have access to a Pro team card via their org. We
  // also record which org each belongs to so the badge can name it.
  const teamMemberOrgByUser: Record<string, { org_name: string | null; org_admin_user_id: string | null }> = {}
  for (const tc of (teamCards as any[]) || []) {
    if (!tc?.user_id) continue
    if (teamMemberOrgByUser[tc.user_id]) continue
    const org = orgsById[tc.organization_id]
    teamMemberOrgByUser[tc.user_id] = {
      org_name: org?.name || null,
      org_admin_user_id: org?.admin_user_id || null,
    }
  }
  const enrichedTeamCards = (teamCards as any[] || [])
    .map((tc: any) => ({
      id: tc.id,
      name: tc.name,
      slug: tc.slug,
      user_id: tc.user_id,
      organization_id: tc.organization_id,
      view_count: tc.view_count || 0,
      views_30d: views30dByTeamCard[tc.id] || 0,
      claimed_at: tc.claimed_at,
      created_at: tc.created_at,
      org_name: orgsById[tc.organization_id]?.name || null,
    }))
    .sort((a, b) => (b.views_30d - a.views_30d) || (b.view_count - a.view_count))

  // Attach the 30-day view count to each personal card too,
  // then re-sort by 30d desc with all-time as the tie-breaker
  // so the most-active-this-month cards float to the top.
  const enrichedCards = (cards as any[] || [])
    .map((c: any) => ({ ...c, views_30d: views30dByCard[c.id] || 0 }))
    .sort((a, b) => (b.views_30d - a.views_30d) || ((b.view_count || 0) - (a.view_count || 0)))

  // Add-on flags live on the user's card (personal first, else their
  // claimed team card) - map them per user so the admin toggles show
  // the current state.
  // Org admins' add-ons live on the org (team-wide) - check those
  // first so the toggle reflects the right source.
  const addonsByUser: Record<string, any> = {}
  for (const o of (orgs as any[]) || []) {
    if (o?.admin_user_id) addonsByUser[o.admin_user_id] = o.addons || {}
  }
  for (const c of (cards as any[]) || []) {
    if (c?.user_id && !addonsByUser[c.user_id]) addonsByUser[c.user_id] = c.addons || {}
  }
  for (const tc of (teamCards as any[]) || []) {
    if (tc?.user_id && !addonsByUser[tc.user_id]) addonsByUser[tc.user_id] = tc.addons || {}
  }

  const enrichedUsers = users.map((u: any) => {
    const p = profileMap[u.id] || {}
    const teamMembership = teamMemberOrgByUser[u.id] || null
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed: !!u.email_confirmed_at,
      signup_country: p.signup_country || null,
      signup_country_code: p.signup_country_code || null,
      signup_city: p.signup_city || null,
      signup_region: p.signup_region || null,
      subscription: subMap[u.id] || null,
      org: orgMap[u.id] || null,
      isPro: subMap[u.id]?.status === 'active' && subMap[u.id]?.subscription_tier === 'pro',
      // is_admin from the profile row OR the hardcoded founder id.
      // Either grants admin access via the isAdminUser helper, so
      // we reflect both here for the UI.
      isAdmin: !!p.is_admin || u.id === FOUNDER_ADMIN_USER_ID,
      total_views: viewsByUser[u.id] || 0,
      views_30d: views30dByUser[u.id] || 0,
      // True if this user has claimed a team card. The badge UI
      // uses this to distinguish team members from genuinely-free
      // users - team members aren't on a paid plan themselves but
      // do have Pro access via their org's seat.
      isTeamMember: !!teamMembership,
      teamMemberOrg: teamMembership,
      addons: addonsByUser[u.id] || {},
    }
  })

  const stats = {
    totalUsers: users.length,
    proUsers: enrichedUsers.filter((u: any) => u.isPro).length,
    totalCards: cards?.length || 0,
    totalOrgs: orgs?.length || 0,
    totalNfcOrders: nfcOrders?.length || 0,
    totalContacts: contacts?.length || 0,
  }

  return (
    <AdminDashboard
      users={enrichedUsers}
      cards={enrichedCards}
      teamCards={enrichedTeamCards}
      orgs={orgs || []}
      nfcOrders={nfcOrders || []}
      stats={stats}
      announcement={activeAnnouncement || null}
    />
  )
}
