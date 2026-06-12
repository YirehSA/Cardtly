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
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('whop_subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('cards').select('id, name, slug, user_id, view_count, created_at').order('view_count', { ascending: false, nullsFirst: false }),
    admin.from('team_cards').select('id, name, slug, user_id, organization_id, view_count, claimed_at, created_at').order('view_count', { ascending: false, nullsFirst: false }),
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('nfc_orders').select('*').order('created_at', { ascending: false }),
    admin.from('contacts').select('id, created_at').order('created_at', { ascending: false }),
    admin.from('profiles').select('user_id, signup_country, signup_country_code, signup_city, signup_region, signup_ip, is_admin'),
  ])

  const { data: activeAnnouncement } = await admin
    .from('app_announcements')
    .select('id, message, link_url, link_text, variant, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const users = authUsers?.users || []
  const subMap = Object.fromEntries((subscriptions || []).map((s: any) => [s.user_id, s]))
  const orgMap = Object.fromEntries((orgs || []).map((o: any) => [o.admin_user_id, o]))
  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]))

  // Sum personal + claimed-team-card views per owner so we can show
  // a "X views" chip next to each user in the Users tab. Unclaimed
  // team cards (user_id is null) only contribute to the Team Cards
  // table, not to any user's totals.
  const viewsByUser: Record<string, number> = {}
  for (const c of (cards as any[]) || []) {
    if (!c?.user_id) continue
    viewsByUser[c.user_id] = (viewsByUser[c.user_id] || 0) + (c.view_count || 0)
  }
  for (const tc of (teamCards as any[]) || []) {
    if (!tc?.user_id) continue
    viewsByUser[tc.user_id] = (viewsByUser[tc.user_id] || 0) + (tc.view_count || 0)
  }

  // Resolve organization name + admin user id for each team card so
  // the Team Cards table can show which org they belong to.
  const orgsById = Object.fromEntries((orgs as any[] || []).map((o: any) => [o.id, o]))
  const enrichedTeamCards = (teamCards as any[] || []).map((tc: any) => ({
    id: tc.id,
    name: tc.name,
    slug: tc.slug,
    user_id: tc.user_id,
    organization_id: tc.organization_id,
    view_count: tc.view_count || 0,
    claimed_at: tc.claimed_at,
    created_at: tc.created_at,
    org_name: orgsById[tc.organization_id]?.name || null,
  }))

  const enrichedUsers = users.map((u: any) => {
    const p = profileMap[u.id] || {}
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
      cards={cards || []}
      teamCards={enrichedTeamCards}
      orgs={orgs || []}
      nfcOrders={nfcOrders || []}
      stats={stats}
      announcement={activeAnnouncement || null}
    />
  )
}
