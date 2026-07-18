import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamDashboard from '@/components/team/TeamDashboard'

export const metadata = { title: 'Team Cards' }

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Not .single(). Starting team setup creates the org row before payment, so
  // abandoning checkout leaves an inactive org behind - and the old code then
  // showed the setup screen again, which created a second row. From two rows
  // onward .single() returns nothing at all, so the admin was locked out of
  // their own team permanently, including after they had paid.
  //
  // Take the live org if there is one, otherwise the oldest attempt, so the
  // page always resolves to something.
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('admin_user_id', user.id)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: teamCards } = org
    ? await supabase
        .from('team_cards')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  return (
    <TeamDashboard
      user={{ id: user.id, email: user.email || '' }}
      org={org || null}
      teamCards={teamCards || []}
    />
  )
}
