import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResellerForUser, serviceDb } from '@/lib/reseller'
import { isAdminUser } from '@/lib/admin-check'
import ResellerPanel, { type Tab } from '@/components/reseller/ResellerPanel'

// A reseller's own page. Only a login linked to a reseller reaches it; anyone
// else is sent back to their dashboard. Blocked in the iOS app (it quotes
// Cardtly's prices to the reseller), see IOS_BLOCKED_ROUTES.
//
// ?as=<reseller id> is "View as reseller" from Admin, Resellers: an admin sees
// that reseller's page as its main login does, with every control switched
// off. /api/reseller checks the admin again before it answers.

export const metadata = { title: 'Reseller' }
export const dynamic = 'force-dynamic'

export default async function ResellerPage({ searchParams }: { searchParams: Promise<{ tab?: string; as?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // ?tab=nfc opens on NFC cards, for the NFC Cards page's "Order NFC cards";
  // ?tab=listing on their listing, for the level-up email.
  const { tab, as } = await searchParams
  const initialTab: Tab = tab === 'nfc' || tab === 'invoices' || tab === 'listing' ? tab : 'clients'

  if (as) {
    if (!(await isAdminUser(user.id))) redirect('/dashboard')
    const { data: r } = await serviceDb().from('resellers').select('id, name').eq('id', as).maybeSingle()
    if (!r) redirect('/admin?tab=resellers')
    return <ResellerPanel initialTab={initialTab} previewOf={{ id: r.id, name: r.name }} />
  }

  const reseller = await getResellerForUser(serviceDb(), user.id)
  if (!reseller) redirect('/dashboard')
  return <ResellerPanel initialTab={initialTab} />
}
