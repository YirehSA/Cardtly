// Resolves WHERE a user's add-ons live, so enabling/building/reading
// them is consistent everywhere. A team admin's add-ons live on the
// ORGANIZATION (so they apply to every team card); a solo user's on
// their personal card; a team member's on their claimed team card.

export type AddonTable = 'organizations' | 'cards' | 'team_cards'

export interface AddonTarget {
  table: AddonTable
  id: string
  addons: Record<string, any>
  // True when this is an org - i.e. the config fans out to all the
  // org's team cards.
  isOrg: boolean
}

// Pass a service-role admin client (these tables are RLS-protected).
export async function resolveAddonTarget(admin: any, userId: string): Promise<AddonTarget | null> {
  if (!userId) return null

  // Org admin first - team-wide config.
  const { data: org } = await admin
    .from('organizations').select('id, addons')
    .eq('admin_user_id', userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (org) return { table: 'organizations', id: org.id, addons: org.addons || {}, isOrg: true }

  // Personal card.
  const { data: card } = await admin
    .from('cards').select('id, addons')
    .eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (card) return { table: 'cards', id: card.id, addons: card.addons || {}, isOrg: false }

  // Claimed team card (member).
  const { data: tc } = await admin
    .from('team_cards').select('id, addons')
    .eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (tc) return { table: 'team_cards', id: tc.id, addons: tc.addons || {}, isOrg: false }

  return null
}
