import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { loadRepTeams } from '@/lib/rep-teams-server'
import RepTeams from '@/components/rep/RepTeams'

// My Teams: a rep's after-sales view of the teams assigned to them.
//
// A rep sees only their own teams (organizations.rep_id, see
// lib/rep-teams-server). A rep who has left (inactive) sees none: their
// clients are the company's now. An admin sees every rep's teams, or one rep's
// with ?rep=<id>, which is how Admin, Reps opens "what Anthony sees".

export const metadata = { title: 'My Teams' }
export const dynamic = 'force-dynamic'

export default async function MyTeamsPage({ searchParams }: { searchParams: Promise<{ rep?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = serviceClient()
  const [admin, rep] = await Promise.all([isAdminUser(user.id), getRepForUser(db, user.id, user.email)])
  if (!admin && !rep) redirect('/dashboard')

  const asked = (await searchParams)?.rep || null
  let repId: string | null = null
  let repName: string | null = null
  if (admin && asked) {
    const { data } = await db.from('reps').select('id, name').eq('id', asked).maybeSingle()
    repId = data?.id || null
    repName = data?.name || null
    if (!repId) redirect('/dashboard/my-teams')
  } else if (rep && !admin) {
    if (!rep.active) {
      return <RepTeams teams={[]} repName={rep.name} viewer="rep" inactive />
    }
    repId = rep.id
    repName = rep.name
  } else if (rep && admin && !asked) {
    // An admin who is also a rep starts on their own teams.
    repId = rep.id
    repName = rep.name
  }

  const teams = await loadRepTeams(db, repId)
  return <RepTeams teams={teams} repName={repName} viewer={admin && !repId ? 'admin_all' : admin && asked ? 'admin' : 'rep'} />
}
