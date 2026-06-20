import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getMemberTeamCard } from '@/lib/card-server'
import ProGate from '@/components/card/ProGate'
import CardScanner from '@/components/scan/CardScanner'

export const metadata = { title: 'Scan Card' }

export default async function ScanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan = await getUserPlan(user.id)
  // Team members are always Pro (the org pays), like the other
  // Pro-gated pages - check for a claimed team card.
  const teamCard = await getMemberTeamCard<{ id: string }>(user.id, 'id')
  const isPro = (plan.tier === 'pro' && plan.isActive) || !!teamCard

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Card Scanner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Scan a card</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Turn a paper business card into a saved contact in seconds.
        </p>
      </div>
      <CardScanner />
    </div>
  )
}
