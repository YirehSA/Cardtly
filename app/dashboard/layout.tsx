import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, { data: profile }] = await Promise.all([
    getUserPlan(user.id),
    supabase.from('profiles').select('name').eq('id', user.id).single(),
  ])

  const isPro = plan.tier === 'pro' && plan.isActive

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          isPro={isPro}
          userName={profile?.name || ''}
          userEmail={user.email || ''}
        />
        <main className="min-h-screen transition-all duration-300 lg:[padding-left:var(--sidebar-width)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 lg:pt-10 pb-10">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}
