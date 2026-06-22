import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { isAdminUser } from '@/lib/admin-check'
import { resolveAddonTarget } from '@/lib/addon-target'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import CommandPalette from '@/components/CommandPalette'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import AnnouncementModal from '@/components/AnnouncementModal'
import HeartbeatPing from '@/components/dashboard/HeartbeatPing'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, { data: card }, isAdmin] = await Promise.all([
    getUserPlan(user.id),
    supabase.from('cards').select('name, addons').eq('user_id', user.id).maybeSingle(),
    isAdminUser(user.id),
  ])

  const isPro = plan.tier === 'pro' && plan.isActive
  // Show the Questionnaire builder in the nav only for clients with
  // the add-on on. Resolves to the org for team admins (team-wide),
  // else the user's own card.
  const addonAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
  const addonTarget = await resolveAddonTarget(addonAdmin, user.id)
  const hasQuestionnaire = !!addonTarget?.addons?.questionnaireEnabled

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          isPro={isPro}
          isAdmin={isAdmin}
          hasQuestionnaire={hasQuestionnaire}
          userName={card?.name || ''}
          userEmail={user.email || ''}
        />
        <main className="min-h-screen transition-all duration-300 lg:[padding-left:var(--sidebar-width)]">
          {/* Bottom padding leaves room for the mobile bottom nav so
              the last scroll item isn't covered. lg:pb-10 reverts to
              the original spacing on desktop where the bar is hidden. */}
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 lg:pt-10 pb-28 lg:pb-10">
            <AnnouncementBanner />
            <div className="animate-fade-in-page">
              {children}
            </div>
          </div>
        </main>
        <CommandPalette />
        <HeartbeatPing />
        <AnnouncementModal />
        <MobileBottomNav isAdmin={isAdmin} hasQuestionnaire={hasQuestionnaire} />
      </div>
    </ThemeProvider>
  )
}
