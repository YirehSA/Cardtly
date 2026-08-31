// Which parts of a team card a member may not change.
//
// Locks are chosen as GROUPS, not raw columns. "Socials" is one decision to a
// human, but four columns, and "links" is ten. Storing the group means adding a
// sixth link later cannot silently leave it unlocked on every card in the
// country.
//
// The old behaviour was all-or-nothing: turning on use_team_brand locked every
// brand field at once, and it was enforced only by the browser stripping fields
// before the save. Anyone who could open dev tools could write them anyway.
// These groups are enforced server-side in /api/team/card/save.

export interface LockGroup {
  id: string
  label: string
  hint: string
  columns: string[]
}

export const LOCK_GROUPS: LockGroup[] = [
  {
    id: 'logo',
    label: 'Company logo',
    hint: 'Everyone shows the same logo',
    columns: ['company_logo_url'],
  },
  {
    id: 'company',
    label: 'Company name',
    hint: 'Nobody can rename the company on their card',
    columns: ['company'],
  },
  {
    id: 'office_phone',
    label: 'Office number',
    hint: 'The switchboard number stays as you set it',
    columns: ['work_phone'],
  },
  {
    id: 'website',
    label: 'Website',
    hint: 'All cards point at the company site',
    columns: ['website'],
  },
  {
    id: 'address',
    label: 'Address',
    hint: 'The office address stays the same on every card',
    columns: ['address'],
  },
  {
    id: 'socials',
    label: 'Social profiles',
    hint: 'LinkedIn, Facebook, Instagram and X',
    columns: ['linkedin_url', 'facebook_url', 'instagram_url', 'twitter_url'],
  },
  {
    id: 'links',
    label: 'Link buttons',
    hint: 'The custom buttons on the card',
    columns: [
      'link_1_title', 'link_1_url', 'link_2_title', 'link_2_url',
      'link_3_title', 'link_3_url', 'link_4_title', 'link_4_url',
      'link_5_title', 'link_5_url',
    ],
  },
  {
    id: 'images',
    label: 'Gallery photos',
    hint: 'The photos shown on the card',
    columns: [
      'image_1_url', 'image_1_link', 'image_2_url', 'image_2_link',
      'image_3_url', 'image_3_link', 'image_4_url', 'image_4_link',
      'image_5_url', 'image_5_link', 'image_6_url', 'image_6_link',
    ],
  },
  {
    id: 'design',
    label: 'Design',
    hint: 'Template, colours and fonts',
    columns: ['color_theme'],
  },
  {
    id: 'certifications',
    label: 'Skills and accreditations',
    hint: 'The same list of credentials on every card',
    columns: ['certifications'],
  },
]

export const LOCK_GROUP_IDS = LOCK_GROUPS.map(g => g.id)

function asIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && LOCK_GROUP_IDS.includes(v))
}

// The company's rules plus anything the department added. Union, deliberately:
// a department head can tighten their own team, never loosen what the company
// decided. Unknown ids are dropped rather than trusted.
export function resolveLocks(orgLocked: unknown, deptLocked: unknown): string[] {
  return [...new Set([...asIdArray(orgLocked), ...asIdArray(deptLocked)])]
}

/**
 * Every column a particular card is locked out of: what the company decided,
 * plus anything the departments above it added.
 *
 * The same union as resolveLocks, over a whole chain rather than one
 * department, because a card sits under a group, then a company, then its own
 * team, and each of them may tighten what the one above allowed.
 */
export function lockedColumnsFor(orgLocked: unknown, chainLocked: unknown[]): string[] {
  const ids = new Set(asIdArray(orgLocked))
  for (const level of chainLocked) for (const id of asIdArray(level)) ids.add(id)
  return lockedColumns([...ids])
}

// Every card column covered by a set of lock groups.
export function lockedColumns(lockedGroupIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of lockedGroupIds) {
    const group = LOCK_GROUPS.find(g => g.id === id)
    if (group) for (const c of group.columns) set.add(c)
  }
  return [...set]
}

// Removes locked columns from a payload. This is the enforcement point: it runs
// on the server, so it holds whatever the browser sent.
export function stripLocked<T extends Record<string, any>>(
  payload: T,
  lockedGroupIds: string[]
): { cleaned: T; removed: string[] } {
  const cleaned = { ...payload }
  const removed: string[] = []
  for (const column of lockedColumns(lockedGroupIds)) {
    if (column in cleaned) {
      delete cleaned[column]
      removed.push(column)
    }
  }
  return { cleaned, removed }
}

// Which groups a given column belongs to, for showing a reason in the editor.
export function groupForColumn(column: string): LockGroup | null {
  return LOCK_GROUPS.find(g => g.columns.includes(column)) || null
}
