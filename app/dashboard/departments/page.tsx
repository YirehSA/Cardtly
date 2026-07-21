import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getManagedDepartments, getOwnedOrgs } from '@/lib/department-perms'
import { extractBrand } from '@/lib/team-brand'
import DepartmentManager from '@/components/departments/DepartmentManager'

export const metadata = { title: 'My departments' }

// A department manager's scoped view, and the org owner's structure controls.
// The boundary is getManagedDepartments (verified adversarially): this page
// only ever loads the departments the signed-in user may manage, plus the orgs
// they own (so an owner can create the first department). Every write goes
// through /api/department, which checks again.
export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const [managed, ownedOrgs] = await Promise.all([
    getManagedDepartments(admin, user.id),
    getOwnedOrgs(admin, user.id),
  ])
  // Truly nothing to do here: not a manager, not an owner.
  if (managed.length === 0 && ownedOrgs.length === 0) redirect('/dashboard')

  const deptIds = managed.map(d => d.id)

  const [{ data: cards }, { data: heads }, authList] = await Promise.all([
    deptIds.length
      ? admin.from('team_cards').select('*').in('department_id', deptIds).order('created_at', { ascending: true })
      : { data: [] },
    // Current heads, so an owner can see and remove them.
    deptIds.length
      ? admin.from('department_managers').select('department_id, user_id').in('department_id', deptIds)
      : { data: [] },
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])
  const emailById = Object.fromEntries((authList?.data?.users || []).map((u: any) => [u.id, u.email]))

  const cardIds = (cards || []).map((c: any) => c.id)
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

  const headsByDept: Record<string, { userId: string; email: string | null }[]> = {}
  for (const h of heads || []) (headsByDept[h.department_id] ||= []).push({ userId: h.user_id, email: emailById[h.user_id] || null })

  const departments = managed.map(d => ({
    id: d.id,
    name: d.name,
    organizationId: d.organization_id,
    // viaOwner means the viewer owns this department's org, so they get the
    // structure controls (rename, delete, appoint heads). A plain manager
    // reaches it via department_managers and does not.
    isOwner: d.viaOwner,
    brand: d.brand,
    hasBrand: Object.keys(d.brand || {}).length > 0,
    lockedFields: d.locked_fields || [],
    heads: headsByDept[d.id] || [],
    cards: (cards || []).filter((c: any) => c.department_id === d.id).map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, claimed: !!c.claimed_at, inviteEmail: c.invite_email || null,
      views30d: views30d[c.id] || 0, leads: leadsByCard[c.id] || 0, viewCount: c.view_count || 0, brand: extractBrand(c),
    })),
  }))

  // Whether the viewer already holds a card in each department's organisation.
  // A department head is appointed without one, so the UI offers to create it -
  // but only where they do not already have one, since the API refuses a second
  // and a button that always fails is worse than no button.
  const orgIds = [...new Set(managed.map(d => d.organization_id))]

  // The company look, so a head can start their department from it. Without
  // this the only source was a card already designed inside the department -
  // so a new department, whose people have not built anything yet, could not
  // be given any look at all.
  const { data: orgRows } = orgIds.length
    ? await admin.from('organizations').select('id, brand').in('id', orgIds)
    : { data: [] }
  const orgBrandById = Object.fromEntries((orgRows || []).map((o: any) => [o.id, o.brand || {}]))
  const { data: ownCards } = orgIds.length
    ? await admin.from('team_cards').select('organization_id').eq('user_id', user.id).in('organization_id', orgIds)
    : { data: [] }
  const hasCardInOrg = new Set((ownCards || []).map((c: any) => c.organization_id))

  return (
    <DepartmentManager
      departments={departments.map(d => ({
        ...d,
        viewerHasCard: hasCardInOrg.has(d.organizationId),
        orgBrand: orgBrandById[d.organizationId] || {},
      }))}
      ownedOrgs={ownedOrgs}
    />
  )
}
