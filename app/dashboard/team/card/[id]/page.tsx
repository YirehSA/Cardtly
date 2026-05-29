import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import TeamCardEditor from '@/components/team/TeamCardEditor'

export const metadata = { title: 'Edit Team Card' }

export default async function TeamCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: card } = await admin
    .from('team_cards')
    .select('*')
    .eq('id', id)
    .single()

  if (!card) notFound()

  // Resolve the org first (every team card belongs to one) so we
  // know who the admin is. Service-role lookup so members - who
  // don't have read RLS on organizations - can still be matched.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, admin_user_id')
    .eq('id', card.organization_id)
    .single()

  if (!org) notFound()

  // Two valid editor identities:
  //   admin   - the org's admin_user_id. Can edit everything.
  //   member  - the team card's claimed user_id (their own card).
  //             Personal fields editable, branded fields locked.
  // Anyone else gets bounced to the dashboard.
  const isOrgAdmin = org.admin_user_id === user.id
  const isCardOwner = (card as any).user_id === user.id
  if (!isOrgAdmin && !isCardOwner) redirect('/dashboard')

  const role: 'admin' | 'member' = isOrgAdmin ? 'admin' : 'member'

  return (
    <TeamCardEditor
      card={card}
      org={org}
      userId={user.id}
      role={role}
    />
  )
}
