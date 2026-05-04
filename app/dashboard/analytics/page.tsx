import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'
import { redirect } from 'next/navigation'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import ProGate from '@/components/card/ProGate'

export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: card }, plan] = await Promise.all([
    supabase
      .from('cards')
      .select('id, name, slug, view_count')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single(),
    getUserPlan(user.id),
  ])

  if (plan.tier !== 'pro' || !plan.isActive) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Analytics" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found.</p>
      </div>
    )
  }

  return <AnalyticsDashboard card={card} />
}
