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
  // Human label for a target switcher (e.g. "My personal card", "Acme team").
  label?: string
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

// Like resolveAddonTarget, but returns EVERY place a user can manage
// add-ons - because a team admin can also have their own personal card,
// and those are two separate questionnaires. The UI uses this to offer a
// switcher so the admin can edit either. Order: teams first, then the
// personal card, then (only if nothing else) a claimed team card.
export async function resolveAddonTargets(admin: any, userId: string): Promise<AddonTarget[]> {
  if (!userId) return []
  const targets: AddonTarget[] = []

  const { data: orgs } = await admin
    .from('organizations').select('id, name, addons')
    .eq('admin_user_id', userId)
    .order('created_at', { ascending: true })
  for (const o of orgs || []) {
    targets.push({ table: 'organizations', id: o.id, addons: o.addons || {}, isOrg: true, label: `${o.name} team` })
  }

  const { data: card } = await admin
    .from('cards').select('id, name, addons')
    .eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (card) targets.push({ table: 'cards', id: card.id, addons: card.addons || {}, isOrg: false, label: 'My personal card' })

  if (targets.length === 0) {
    const { data: tc } = await admin
      .from('team_cards').select('id, name, addons')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (tc) targets.push({ table: 'team_cards', id: tc.id, addons: tc.addons || {}, isOrg: false, label: tc.name || 'My card' })
  }

  return targets
}

// Verify a user actually owns/administers a given target before we let
// them write add-ons to it (the switcher posts an explicit target).
export async function loadOwnedTarget(admin: any, userId: string, table: string, id: string): Promise<AddonTarget | null> {
  if (!userId || !id) return null
  if (table === 'organizations') {
    const { data } = await admin.from('organizations').select('id, addons, admin_user_id').eq('id', id).maybeSingle()
    if (data && data.admin_user_id === userId) return { table: 'organizations', id: data.id, addons: data.addons || {}, isOrg: true }
  } else if (table === 'cards') {
    const { data } = await admin.from('cards').select('id, addons, user_id').eq('id', id).maybeSingle()
    if (data && data.user_id === userId) return { table: 'cards', id: data.id, addons: data.addons || {}, isOrg: false }
  } else if (table === 'team_cards') {
    const { data } = await admin.from('team_cards').select('id, addons, user_id').eq('id', id).maybeSingle()
    if (data && data.user_id === userId) return { table: 'team_cards', id: data.id, addons: data.addons || {}, isOrg: false }
  }
  return null
}
