import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getManagedDepartments } from '@/lib/department-perms'
import TeamMemberNotice from '@/components/team/TeamMemberNotice'
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

  // Already part of somebody else's organisation?
  //
  // This page only ever looked for an org the user ADMINISTERS, so a
  // department head or an ordinary member found nothing and was shown the
  // "set up your team" checkout - an invitation to create and pay for a
  // second organisation while already belonging to one. A department head
  // who followed it through would have produced a duplicate org and a real
  // monthly charge.
  //
  // Service role: team_cards and departments are RLS-protected and a member
  // cannot reliably read their own rows through the user-scoped client.
  if (!org) {
    const admin = createServiceClient() as any
    const [{ data: myCard }, managed] = await Promise.all([
      admin
        .from('team_cards')
        .select('id, organization_id, department_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      getManagedDepartments(admin, user.id),
    ])

    const orgId = myCard?.organization_id || managed[0]?.organization_id || null
    if (orgId) {
      const { data: theirOrg } = await admin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle()
      return (
        <TeamMemberNotice
          orgName={theirOrg?.name || 'your team'}
          departments={managed.map(d => d.name)}
          hasCard={!!myCard}
        />
      )
    }
  }

  return (
    <TeamDashboard
      user={{ id: user.id, email: user.email || '' }}
      org={org || null}
      teamCards={teamCards || []}
    />
  )
}
