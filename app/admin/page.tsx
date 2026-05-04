import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'

// Your user ID — only you can access this
const ADMIN_USER_ID = '6216ca40-72e5-47f2-af6a-a37d35f9d169'

export const metadata = { title: 'Admin' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== ADMIN_USER_ID) {
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
    { data: orgs },
    { data: nfcOrders },
    { data: contacts },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('whop_subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('cards').select('id, name, slug, user_id, created_at').order('created_at', { ascending: false }),
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('nfc_orders').select('*').order('created_at', { ascending: false }),
    admin.from('contacts').select('id, created_at').order('created_at', { ascending: false }),
  ])

  const users = authUsers?.users || []
  const subMap = Object.fromEntries((subscriptions || []).map((s: any) => [s.user_id, s]))
  const orgMap = Object.fromEntries((orgs || []).map((o: any) => [o.admin_user_id, o]))

  const enrichedUsers = users.map((u: any) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    subscription: subMap[u.id] || null,
    org: orgMap[u.id] || null,
    isPro: subMap[u.id]?.status === 'active' && subMap[u.id]?.subscription_tier === 'pro',
  }))

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
      orgs={orgs || []}
      nfcOrders={nfcOrders || []}
      stats={stats}
    />
  )
}
