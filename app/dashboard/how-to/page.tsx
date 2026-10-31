import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getManagedDepartments, getOwnedOrgs } from '@/lib/department-perms'
import { getMemberTeamCard } from '@/lib/card-server'
import { HowToLibrary } from '@/components/howto/HowTo'
import type { Who } from '@/lib/howto-videos'

export const metadata = { title: 'How-to' }

// Every how-to video this person can use, their role's first. Which videos may
// show (never the web-only ones here, and only "anywhere" ones in the iPhone
// app) is decided in lib/howto-videos, through canShow.
export default async function HowToPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
  const [plan, { data: card }, managed, owned, teamCard] = await Promise.all([
    getUserPlan(user.id),
    supabase.from('cards').select('id').eq('user_id', user.id).maybeSingle(),
    getManagedDepartments(admin, user.id).catch(() => []),
    getOwnedOrgs(admin, user.id).catch(() => []),
    getMemberTeamCard<{ id: string }>(user.id, 'id').catch(() => null),
  ])
  const who: Who = {
    ownsTeam: owned.length > 0,
    managesDepartment: managed.some((d: any) => !d.viaOwner),
    teamMember: plan.viaTeam === true && owned.length === 0,
    hasCard: !!card || !!teamCard,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">How-to</h1>
        <p className="page-subtitle mt-1.5">Short videos for everything Cardtly does. Each one takes under a minute.</p>
      </div>
      <HowToLibrary who={who} />
    </div>
  )
}
