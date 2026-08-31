import { BRAND_FIELDS } from './team-brand'

// A team look that follows the card it came from.
//
// "Use this person's look" copied the brand fields once. Nothing said it was a
// copy, so changing that card did nothing and the only way to find out was to
// update an address, open a card, and see the old one still there.
//
// Where brand_source is set, the look is read from that card as the page
// renders, so an edit to it reaches everyone following it. Where it is null,
// the stored brand column is used exactly as before - linking is a choice, not
// a change forced on every team that already had a look.

export interface BrandSource {
  table: 'cards' | 'team_cards'
  id: string
}

export function parseBrandSource(v: unknown): BrandSource | null {
  if (!v || typeof v !== 'object') return null
  const t = (v as any).table
  const id = (v as any).id
  if ((t !== 'cards' && t !== 'team_cards') || typeof id !== 'string' || !id) return null
  return { table: t, id }
}

/** A brand field worth taking from the source card. */
function set(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  return true
}

/**
 * The brand fields a card is actually carrying.
 *
 * Empty ones are left out on purpose, and the caller lays this over the stored
 * copy rather than replacing it. A source card with a blank website must not
 * blank the company's - and on a LOCKED field that would put an empty value on
 * every card in the company at once, from one person clearing one box.
 */
export function liveBrandFrom(card: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of BRAND_FIELDS) if (set(card[f])) out[f] = card[f]
  return out
}

/**
 * Is this a card the caller may point a look at?
 *
 * An id taken from a request body is otherwise an invitation to follow anybody's
 * card. Brand fields are not secret, but a look is rendered on every card in the
 * team, so following a stranger's would put their logo, their colours and their
 * address on people who never chose them - and keep doing it, because the point
 * of a link is that it goes on updating.
 *
 * A personal card must be the caller's own. A team card must belong to the same
 * organisation as the thing being branded.
 */
export async function verifyBrandSource(
  admin: any,
  source: BrandSource,
  scope: { userId: string; departmentId?: string; organizationId?: string },
): Promise<BrandSource | null> {
  try {
    if (source.table === 'cards') {
      const { data } = await admin
        .from('cards').select('id').eq('id', source.id).eq('user_id', scope.userId).limit(1)
      return data?.length ? source : null
    }

    let orgId = scope.organizationId
    if (!orgId && scope.departmentId) {
      const { data } = await admin
        .from('departments').select('organization_id').eq('id', scope.departmentId).limit(1)
      orgId = data?.[0]?.organization_id
    }
    if (!orgId) return null

    const { data } = await admin
      .from('team_cards').select('id').eq('id', source.id).eq('organization_id', orgId).limit(1)
    return data?.length ? source : null
  } catch {
    return null
  }
}

/**
 * Replace the stored brand with the live one, for every record that follows a
 * card.
 *
 * Records are returned in the same order, as shallow copies. Anything without a
 * source comes back untouched, and so does anything whose source has been
 * deleted - the stored copy is the fallback, so removing a card cannot strip a
 * company of its branding.
 *
 * Two queries at most, and none at all when nothing is linked, so a team that
 * never used this pays nothing for it.
 */
export async function hydrateBrandSources<T extends Record<string, any>>(
  admin: any,
  records: T[],
): Promise<T[]> {
  const wanted = records.map(r => parseBrandSource(r?.brand_source))
  if (!wanted.some(Boolean)) return records

  const ids = { cards: [] as string[], team_cards: [] as string[] }
  for (const w of wanted) if (w) ids[w.table].push(w.id)

  // The source is read RAW, never through the brand resolver. A team card that
  // wears the company brand would otherwise resolve through the very brand it
  // is being asked to define, and a group linked to one of its own cards would
  // chase its own tail.
  //
  // select('*') for the usual reason: naming a column a pending migration has
  // not added returns an empty result, which here would look exactly like every
  // source card having been deleted.
  const fetchAll = async (table: 'cards' | 'team_cards') => {
    const list = [...new Set(ids[table])]
    if (list.length === 0) return {} as Record<string, any>
    try {
      const { data, error } = await admin.from(table).select('*').in('id', list)
      if (error) return {}
      return Object.fromEntries((data || []).map((c: any) => [c.id, c]))
    } catch {
      return {}
    }
  }

  const [byCardId, byTeamCardId] = await Promise.all([fetchAll('cards'), fetchAll('team_cards')])

  return records.map((r, i) => {
    const w = wanted[i]
    if (!w) return r
    const source = (w.table === 'cards' ? byCardId : byTeamCardId)[w.id]
    if (!source) return r
    // Over the stored copy, not instead of it: see liveBrandFrom.
    return { ...r, brand: { ...(r.brand || {}), ...liveBrandFrom(source) } }
  })
}
