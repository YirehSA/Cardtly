import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { isAdminUser } from '@/lib/admin-check'
import { loadAdminData } from '@/lib/admin-data'

export const metadata = { title: 'Admin' }

// Thin shell. Everything it needs is assembled in lib/admin-data, which is
// where the pagination, the counts, and the status precedence live.
//
// searchParams rather than reading the URL in the client component. That is
// what the sidebar's Calendar shortcut depends on, and reading window.location
// there did not work: a Link is a soft navigation, and on the first render of
// the new page the browser URL is still the old one, so ?tab= was simply not
// there yet and every shortcut opened Overview.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
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
      initialTab={tab}
      users={data.users}
      orgs={data.orgs}
      cards={data.cards}
      teamCards={data.teamCards}
      nfcOrders={data.nfcOrders}
      audit={data.audit}
      reps={data.reps}
      meetings={data.meetings}
      trialCodes={data.trialCodes}
      stats={data.stats}
      announcement={data.announcement}
    />
  )
}
