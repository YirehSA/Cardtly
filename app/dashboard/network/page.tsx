import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getMemberTeamCard } from '@/lib/card-server'
import ProGate from '@/components/card/ProGate'
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

  // The Network is a Pro feature, and /network says so publicly. It was
  // reachable by anyone signed in, which made that claim untrue for an expired
  // account. Trial counts as Pro, so this only stops accounts that have
  // actually lapsed. A claimed team member is served by their organisation and
  // is never gated on their own plan, matching Analytics and Contacts.
  const [plan, teamCard] = await Promise.all([
    getUserPlan(user.id),
    getMemberTeamCard<{ id: string }>(user.id, 'id'),
  ])
  const isTeamMember = !!teamCard
  if (!isTeamMember && (plan.tier !== 'pro' || !plan.isActive)) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Network" />
      </div>
    )
  }

  const admin = createServiceClient() as any
  const { cards, brandLogos, ready } = await fetchNetworkCards(admin)

  // Anyone this person has blocked simply is not here. Filtered after the
  // fetch rather than in it, so a database without migration 056 still renders
  // the directory instead of failing on a table that does not exist yet.
  let blockedCardIds = new Set<string>()
  try {
    const { data: blocks } = await admin
      .from('network_blocks')
      .select('card_id, team_card_id')
      .eq('user_id', user.id)
    blockedCardIds = new Set(
      (blocks || []).flatMap((b: any) => [b.card_id, b.team_card_id]).filter(Boolean),
    )
  } catch {
    blockedCardIds = new Set()
  }
  const visibleCards = blockedCardIds.size
    ? cards.filter((c: any) => !blockedCardIds.has(c.id))
    : cards

  if (!ready) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Network is nearly ready</h1>
        <p className="mt-3 text-muted-foreground">
          The directory is waiting on a database update. It will appear here as soon
          as that is applied.
        </p>
      </div>
    )
  }

  const { companies, independents } = groupIntoCompanies(visibleCards, brandLogos)

  return (
    <NetworkDirectory
      companies={companies}
      independents={independents}
      totalCards={visibleCards.length}
      blockedCount={cards.length - visibleCards.length}
    />
  )
}
