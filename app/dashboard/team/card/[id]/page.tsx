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

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, admin_user_id')
    .eq('id', card.organization_id)
    .eq('admin_user_id', user.id)
    .single()

  if (!org) redirect('/dashboard/team')

  return (
    <TeamCardEditor
      card={card}
      org={org}
      userId={user.id}
    />
  )
}
