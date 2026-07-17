// Who may manage which department. The whole RBAC boundary lives here, in one
// place, so every route asks the same question and none of them can drift.
//
// A user manages a department if EITHER:
//   - they are listed in department_managers for it, OR
//   - they are the admin_user_id of the org that owns it (the main admin
//     manages every department under them).
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
  // True when the user reaches it as the org owner rather than a named
  // manager, so the UI can say "you own this whole team".
  viaOwner: boolean
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
  const managedDeptIds = new Set((managerRows || []).map((m: any) => m.department_id))

  if (ownedOrgIds.size === 0 && managedDeptIds.size === 0) return []

  // Pull every candidate department in one query: those in owned orgs, or those
  // named. Then tag how each was reached.
  const { data: depts } = await admin
    .from('departments')
    .select('id, organization_id, name, brand')

  const out: ManagedDept[] = []
  for (const d of depts || []) {
    const viaOwner = ownedOrgIds.has(d.organization_id)
    const viaManager = managedDeptIds.has(d.id)
    if (!viaOwner && !viaManager) continue
    out.push({ id: d.id, organization_id: d.organization_id, name: d.name, brand: d.brand || {}, viaOwner })
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
