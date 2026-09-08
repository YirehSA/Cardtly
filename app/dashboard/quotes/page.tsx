import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { repForUser } from '@/lib/rep-check'
import RepQuotes from '@/components/billing/RepQuotes'

// Quotes for sales reps.
//
// The same screen the Accounting tab uses, on its own page, reachable by a rep
// who has no business seeing anything else in the books. The API is scoped to
// the rep independently - see lib/rep-check - so this page being reachable is
// never what decides what they can read.

export const metadata = { title: 'Quotes' }
export const dynamic = 'force-dynamic'

export default async function RepQuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [admin, rep] = await Promise.all([isAdminUser(user.id), repForUser(user.id)])
  if (!admin && !rep) redirect('/dashboard')

  return <RepQuotes repName={rep?.name || null} isAdmin={admin} />
}
