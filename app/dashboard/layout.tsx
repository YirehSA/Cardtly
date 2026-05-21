import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import Sidebar from '@/components/dashboard/Sidebar'
import CommandPalette from '@/components/CommandPalette'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import HeartbeatPing from '@/components/dashboard/HeartbeatPing'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, { data: card }] = await Promise.all([
    getUserPlan(user.id),
    supabase.from('cards').select('name').eq('user_id', user.id).maybeSingle(),
  ])

  const isPro = plan.tier === 'pro' && plan.isActive

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          isPro={isPro}
          userName={card?.name || ''}
          userEmail={user.email || ''}
        />
        <main className="min-h-screen transition-all duration-300 lg:[padding-left:var(--sidebar-width)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 lg:pt-10 pb-10">
            <AnnouncementBanner />
            <div className="animate-fade-in-page">
              {children}
            </div>
          </div>
        </main>
        <CommandPalette />
        <HeartbeatPing />
      </div>
    </ThemeProvider>
  )
}
