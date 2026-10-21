import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResellerForUser, serviceDb } from '@/lib/reseller'
import ResellerPanel from '@/components/reseller/ResellerPanel'

// A reseller's own page. Only a login linked to a reseller reaches it; anyone
// else is sent back to their dashboard. Blocked in the iOS app (it quotes
// Cardtly's prices to the reseller), see IOS_BLOCKED_ROUTES.

export const metadata = { title: 'Reseller' }
export const dynamic = 'force-dynamic'

export default async function ResellerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const reseller = await getResellerForUser(serviceDb(), user.id)
  if (!reseller) redirect('/dashboard')
  return <ResellerPanel />
}
