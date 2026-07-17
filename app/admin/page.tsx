import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { isAdminUser } from '@/lib/admin-check'
import { loadAdminData } from '@/lib/admin-data'

export const metadata = { title: 'Admin' }

// Thin shell. Everything it needs is assembled in lib/admin-data, which is
// where the pagination, the counts, and the status precedence live.
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

  const data = await loadAdminData(admin)

  return (
    <AdminDashboard
      users={data.users}
      orgs={data.orgs}
      cards={data.cards}
      teamCards={data.teamCards}
      nfcOrders={data.nfcOrders}
      audit={data.audit}
      stats={data.stats}
      announcement={data.announcement}
    />
  )
}
