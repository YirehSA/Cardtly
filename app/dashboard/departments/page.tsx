import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getManagedDepartments } from '@/lib/department-perms'
import { extractBrand } from '@/lib/team-brand'
import DepartmentManager from '@/components/departments/DepartmentManager'

export const metadata = { title: 'My departments' }

// A department manager's scoped view. The permission boundary is
// getManagedDepartments (verified adversarially): this page only ever loads
// the departments the signed-in user may manage, and every write goes through
// /api/department, which checks again. There is no path here to another
// department's data.
export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const managed = await getManagedDepartments(admin, user.id)
  // Not a manager of anything: nothing to show, back to the dashboard.
  if (managed.length === 0) redirect('/dashboard')

  const deptIds = managed.map(d => d.id)

  // Cards in the managed departments, with brand fields so a manager can set a
  // department's look from one of them, plus enough to list members.
  const { data: cards } = await admin
    .from('team_cards')
    .select('*')
    .in('department_id', deptIds)
    .order('created_at', { ascending: true })

  const cardIds = (cards || []).map((c: any) => c.id)

  // Scoped analytics: views and leads for THESE cards only. A manager never
  // sees the rest of the company.
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const [{ data: viewEvents }, { data: leads }] = await Promise.all([
    cardIds.length
      ? admin.from('team_card_events').select('team_card_id').eq('event_type', 'view').gte('created_at', thirtyAgo).in('team_card_id', cardIds)
      : { data: [] },
    cardIds.length
      ? admin.from('contacts').select('team_card_id').in('team_card_id', cardIds)
      : { data: [] },
  ])

  const views30d: Record<string, number> = {}
  for (const e of viewEvents || []) if (e.team_card_id) views30d[e.team_card_id] = (views30d[e.team_card_id] || 0) + 1
  const leadsByCard: Record<string, number> = {}
  for (const c of leads || []) if (c.team_card_id) leadsByCard[c.team_card_id] = (leadsByCard[c.team_card_id] || 0) + 1

  // Shape the departments for the client: cards trimmed to what the UI needs,
  // plus each card's own brand (so "use this card's look" works) and stats.
  const departments = managed.map(d => {
    const deptCards = (cards || []).filter((c: any) => c.department_id === d.id).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      claimed: !!c.claimed_at,
      inviteEmail: c.invite_email || null,
      views30d: views30d[c.id] || 0,
      leads: leadsByCard[c.id] || 0,
      viewCount: c.view_count || 0,
      brand: extractBrand(c),
    }))
    return {
      id: d.id,
      name: d.name,
      viaOwner: d.viaOwner,
      brand: d.brand,
      hasBrand: Object.keys(d.brand || {}).length > 0,
      cards: deptCards,
    }
  })

  return <DepartmentManager departments={departments} />
}
