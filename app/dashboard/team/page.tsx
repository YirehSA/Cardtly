import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamDashboard from '@/components/team/TeamDashboard'

export const metadata = { title: 'Team Cards' }

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('admin_user_id', user.id)
    .single()

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
