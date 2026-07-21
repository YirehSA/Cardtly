import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { isAdminUser } from '@/lib/admin-check'
import { getManagedDepartments, getOwnedOrgs } from '@/lib/department-perms'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import CommandPalette from '@/components/CommandPalette'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import PastDueBanner from '@/components/dashboard/PastDueBanner'
import NetworkNotice from '@/components/dashboard/NetworkNotice'
import ArchivedCardBanner, { type ArchivedCard } from '@/components/dashboard/ArchivedCardBanner'
import AnnouncementModal from '@/components/AnnouncementModal'
import HeartbeatPing from '@/components/dashboard/HeartbeatPing'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deptAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
  const [plan, { data: card }, isAdmin, managedDepts, noticeSeen, archivedCards] = await Promise.all([
    getUserPlan(user.id),
    supabase.from('cards').select('name, addons, hide_from_network').eq('user_id', user.id).maybeSingle(),
    isAdminUser(user.id),
    Promise.all([getManagedDepartments(deptAdmin, user.id), getOwnedOrgs(deptAdmin, user.id)]),
    // Asked on its own and tolerantly. This column arrives with migration 042
    // while the code deploys on commit, and the dashboard layout is the last
    // place that should throw on a column that is not there yet - treating it
    // as "already seen" just means the notice waits for the migration.
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('network_notice_seen_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) return true
        return !!(data as any)?.network_notice_seen_at
      } catch {
        return true
      }
    })(),
    // Archived cards, which are the ones silently 404ing for the public.
    //
    // Read with the service-role client rather than the user's: every policy
    // that would let a member see their own card requires archived = false,
    // so the user-scoped client returns nothing for exactly the rows this
    // needs to find. Ownership is still scoped by user_id.
    //
    // Asked separately and tolerantly, like the notice above - the dashboard
    // layout is the last place that should throw, and a banner that fails to
    // load is far better than every page failing to render.
    (async (): Promise<ArchivedCard[]> => {
      try {
        const { data, error } = await deptAdmin
          .from('cards')
          .select('id, name, slug')
          .eq('user_id', user.id)
          .eq('archived', true)
        if (error) return []
        return (data || []) as ArchivedCard[]
      } catch {
        return []
      }
    })(),
  ])
  const [managedDeptsList, ownedOrgsList] = managedDepts
  // Show the Departments link to anyone who manages a department OR owns a
  // team. An owner with no departments yet still needs the entry point to
  // create the first one, and getManagedDepartments is empty until one exists.
  const managesDepartments = managedDeptsList.length > 0 || ownedOrgsList.length > 0

  // Team Cards is the account owner's console: seats, billing, and every card
  // in the company. Hide it from anyone who sits inside a team they do not own,
  // because for them it was never their page - it renders a notice saying so.
  // A department head clicking it is looking for their people's cards, and
  // those live under Departments.
  //
  // The test is deliberately NOT "owns no org". A user with no team at all
  // must keep this link: for them /dashboard/team is the team upsell, and
  // hiding it would quietly remove the only route into selling a team.
  const inSomeoneElsesTeam =
    ownedOrgsList.length === 0 && (managedDeptsList.length > 0 || plan.viaTeam === true)
  const showTeamCards = !inSomeoneElsesTeam

  const isPro = plan.tier === 'pro' && plan.isActive
  // Lead capture is standard on Pro and switched on by the user, so the nav
  // item just follows the plan. This used to resolve the add-on target on
  // every dashboard request with a service-role client purely to decide
  // whether to render one link.

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          isPro={isPro}
          isAdmin={isAdmin}
          managesDepartments={managesDepartments}
          showTeamCards={showTeamCards}
          userName={card?.name || ''}
          userEmail={user.email || ''}
        />
        <main className="min-h-screen transition-all duration-300 lg:[padding-left:var(--sidebar-width)]">
          {/* Bottom padding leaves room for the mobile bottom nav so
              the last scroll item isn't covered. lg:pb-10 reverts to
              the original spacing on desktop where the bar is hidden. */}
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 lg:pt-10 pb-28 lg:pb-10">
            <AnnouncementBanner />
            {/* A failed payment used to be invisible in here: the card went
                dark and nothing in the product said why. Rendered from the
                layout rather than one page, because the person who needs to
                see it may land anywhere in the dashboard. */}
            {/* First, because a card nobody can open outranks everything else
                on the page. */}
            {archivedCards.length > 0 && <ArchivedCardBanner cards={archivedCards} />}
            {plan.isPastDue && <PastDueBanner graceDaysLeft={plan.graceDaysLeft} />}
            {/* One-time: the Network lists people by default, so it only works
                as a fair deal if they are actually told. Not shown to anyone
                who has already switched their listing off. */}
            {!noticeSeen && !(card as any)?.hide_from_network && <NetworkNotice />}
            <div className="animate-fade-in-page">
              {children}
            </div>
          </div>
        </main>
        <CommandPalette />
        <HeartbeatPing />
        <AnnouncementModal />
        <MobileBottomNav isAdmin={isAdmin} isPro={isPro} managesDepartments={managesDepartments} showTeamCards={showTeamCards} />
      </div>
    </ThemeProvider>
  )
}
