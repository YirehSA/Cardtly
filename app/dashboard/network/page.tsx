import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchNetworkCards, groupIntoCompanies } from '@/lib/network'
import NetworkDirectory from '@/components/network/NetworkDirectory'

export const metadata = { title: 'Network' }

// The directory is signed-in only. That is the whole reason it can list
// everyone by default: it is a members' directory, not a public index, so it
// is not something a scraper or a search engine can walk.
export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceClient() as any
  const { cards, ready } = await fetchNetworkCards(admin)

  if (!ready) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Network is nearly ready</h1>
        <p className="mt-3 text-slate-600">
          The directory is waiting on a database update. It will appear here as soon
          as that is applied.
        </p>
      </div>
    )
  }

  const companies = groupIntoCompanies(cards)

  return <NetworkDirectory companies={companies} totalCards={cards.length} />
}
