import { subtreeIdsForMany, type DeptNode } from '@/lib/department-tree'

// Who may manage which department. The whole RBAC boundary lives here, in one
// place, so every route asks the same question and none of them can drift.
//
// A user manages a department if ANY of:
//   - they are listed in department_managers for it, OR
//   - they are listed for one of its ANCESTORS, so the head of a company
//     manages every department inside that company, OR
//   - they are the admin_user_id of the org that owns it (the main admin
//     manages every department under them, across every company).
//
// That middle rule is what walls the seven businesses in a group off from each
// other: the head of Company A reaches Company A's subtree and nothing else,
// while the group admin still reaches all of it.
//
// Cardtly super-admins go through /api/admin, not here, so this file does not
// grant them anything: it is strictly the customer-side department boundary.
//
// These run with the service-role key (the tables are RLS-locked to the org
// admin, and adding manager-aware RLS would be a second, riskier copy of this
// logic). The service-role client only ever SELECTs to decide permission, then
// the caller acts. The point is that the CHECK is explicit and central.

export interface ManagedDept {
  id: string
  organization_id: string
  name: string
  brand: Record<string, any>
  locked_fields: string[]
  // True when the user reaches it as the org owner rather than a named
  // manager, so the UI can say "you own this whole team".
  viaOwner: boolean
  // Hierarchy, null and 'department' for an organisation that has not opted in.
  parent_id: string | null
  kind: 'company' | 'department'
  slug_segment: string | null
  // Migration 063. Optional because the rows are read with select('*') and the
  // columns are simply absent until it is applied by hand.
  inherit_brand?: boolean | null
  inherit_brand_locked?: boolean | null
}

// Every department this user may manage, resolved once.
export async function getManagedDepartments(admin: any, userId: string): Promise<ManagedDept[]> {
  if (!userId) return []

  // Orgs where the user is the main admin: they manage all departments in them.
  const { data: ownedOrgs } = await admin
    .from('organizations').select('id').eq('admin_user_id', userId)
  const ownedOrgIds = new Set((ownedOrgs || []).map((o: any) => o.id))

  // Departments where the user is a named manager.
  const { data: managerRows } = await admin
    .from('department_managers').select('department_id').eq('user_id', userId)
  const managedDeptIds = new Set<string>((managerRows || []).map((m: any) => m.department_id as string))

  if (ownedOrgIds.size === 0 && managedDeptIds.size === 0) return []

  // Pull every candidate department in one query: those in owned orgs, or those
  // named. Then tag how each was reached.
  // locked_fields arrives with migration 035. Migrations are applied by hand,
  // so this must not depend on the deploy and the migration landing in a
  // particular order - if the column is not there yet, carry on without it and
  // treat everything as unlocked, which is exactly how it behaved before.
  // parent_id, kind and slug_segment arrive with migration 053, applied by hand
  // like 035 before it. Each step down is explicit: with hierarchy, then
  // without it, then without locks.
  // brand_source arrives with migration 059, and slots into the same cascade:
  // a database without it fails this select and falls through to the one below,
  // where a look simply never reports that it is following anything.
  let depts: any[] | null = null
  const withSource = await admin
    .from('departments')
    .select('id, organization_id, name, brand, brand_source, locked_fields, parent_id, kind, slug_segment')
  const withTree = withSource.error
    ? await admin
        .from('departments')
        .select('id, organization_id, name, brand, locked_fields, parent_id, kind, slug_segment')
    : withSource
  if (!withTree.error) {
    depts = withTree.data
  } else {
    const withLocks = await admin
      .from('departments')
      .select('id, organization_id, name, brand, locked_fields')
    if (!withLocks.error) {
      depts = withLocks.data
    } else {
      const fallback = await admin
        .from('departments')
        .select('id, organization_id, name, brand')
      depts = fallback.data
    }
  }

  const all = (depts || []) as any[]

  // Managing a company means managing everything inside it.
  //
  // Without this, appointing the MD of Company A as its manager would give
  // them the company row and none of its departments, so they could see the
  // unit they run but not one card in it. Descendants are resolved through the
  // tree walk, which is cycle-safe.
  //
  // Before migration 053 no row has a parent, so every subtree is one node and
  // this resolves to exactly the previous behaviour.
  const nodes: DeptNode[] = all.map(d => ({
    id: d.id,
    organization_id: d.organization_id,
    name: d.name,
    parent_id: d.parent_id ?? null,
    kind: (d.kind === 'company' ? 'company' : 'department'),
    slug_segment: d.slug_segment ?? null,
  }))
  const reachable = subtreeIdsForMany(managedDeptIds, nodes)

  const out: ManagedDept[] = []
  for (const d of all) {
    const viaOwner = ownedOrgIds.has(d.organization_id)
    const viaManager = reachable.has(d.id)
    if (!viaOwner && !viaManager) continue
    out.push({
      id: d.id,
      organization_id: d.organization_id,
      name: d.name,
      brand: d.brand || {},
      locked_fields: d.locked_fields || [],
      viaOwner,
      parent_id: d.parent_id ?? null,
      kind: (d.kind === 'company' ? 'company' : 'department'),
      slug_segment: d.slug_segment ?? null,
    })
  }
  return out
}

// Can this user manage this specific department? The single gate every write
// goes through.
export async function canManageDepartment(admin: any, userId: string, departmentId: string): Promise<boolean> {
  if (!userId || !departmentId) return false
  const managed = await getManagedDepartments(admin, userId)
  return managed.some(d => d.id === departmentId)
}

// The department a card currently sits in, and its org. Used to check that a
// caller may act on a given card (move it, invite over it, remove it).
export async function cardDepartment(admin: any, teamCardId: string): Promise<{ organizationId: string | null; departmentId: string | null } | null> {
  const { data: card } = await admin
    .from('team_cards').select('organization_id, department_id').eq('id', teamCardId).maybeSingle()
  if (!card) return null
  return { organizationId: card.organization_id ?? null, departmentId: card.department_id ?? null }
}

// ── Owner-level checks ──────────────────────────────────────────────────────
// Creating departments and appointing heads is a HIGHER privilege than
// managing one. A department manager must never be able to do these: only the
// org owner (the company's main admin) can. These are the gate for that.

export interface OwnedOrg { id: string; name: string; lockedFields: string[] }

export async function getOwnedOrgs(admin: any, userId: string): Promise<OwnedOrg[]> {
  if (!userId) return []
  // locked_fields arrives with a hand-applied migration. Select it separately so
  // a database that has not had 035 applied yet still returns the orgs rather
  // than failing the whole query on an unknown column.
  const { data } = await admin.from('organizations').select('id, name').eq('admin_user_id', userId)
  const orgs = (data || []).map((o: any) => ({ id: o.id, name: o.name, lockedFields: [] as string[] }))
  if (orgs.length === 0) return orgs
  const { data: locks } = await admin
    .from('organizations').select('id, locked_fields').eq('admin_user_id', userId)
  if (locks) {
    const byId = new Map(locks.map((l: any) => [l.id, l.locked_fields || []]))
    for (const o of orgs) o.lockedFields = (byId.get(o.id) as string[]) || []
  }
  return orgs
}

export async function isOrgOwner(admin: any, userId: string, orgId: string): Promise<boolean> {
  if (!userId || !orgId) return false
  const { data } = await admin.from('organizations').select('id').eq('id', orgId).eq('admin_user_id', userId).maybeSingle()
  return !!data
}

// Does this user own the org that this department belongs to? The gate for
// renaming, deleting, and appointing heads on a department.
export async function ownsOrgOfDepartment(admin: any, userId: string, departmentId: string): Promise<boolean> {
  if (!userId || !departmentId) return false
  const { data: dept } = await admin.from('departments').select('organization_id').eq('id', departmentId).maybeSingle()
  if (!dept) return false
  return isOrgOwner(admin, userId, dept.organization_id)
}

// Find a Cardtly user by email, for appointing a head by email rather than
// shipping the whole user list to an org owner's browser.
export async function findUserByEmail(admin: any, email: string): Promise<{ id: string; email: string } | null> {
  const want = String(email || '').trim().toLowerCase()
  if (!want) return null
  // listUsers is paged; at current scale one page covers everyone, but page
  // through to be correct if it grows.
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const users = data?.users || []
    const hit = users.find((u: any) => String(u.email || '').toLowerCase() === want)
    if (hit) return { id: hit.id, email: hit.email }
    if (users.length < 200) break
  }
  return null
}
