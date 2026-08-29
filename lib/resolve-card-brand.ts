import { mergeBrand } from '@/lib/team-brand'
import { indexById, ancestorChain, resolveBrandChain, type DeptNode } from '@/lib/department-tree'

// What a team card actually LOOKS like, for the pages that generate something
// from it.
//
// A card on the team brand carries no logo, no website and no social links of
// its own: they live on the organisation, and a department may override them.
// Reading the row directly gives you a card that looks empty while the public
// version of the same card shows all of it.
//
// That caught the QR page, which told a member to upload a logo first, and the
// email signature, which greyed out the company logo and social toggles and
// left the accent colour at its default. Virtual backgrounds had it too. Three
// copies of this cascade is how three copies drift, so it lives here.
//
// The cascade matches components/card/TeamCardPublic exactly: group brand,
// then company, then department, each overriding only the fields it sets, and
// applied only where the card is opted in to the team brand.

/**
 * Merge the resolved team brand into each card that uses it.
 *
 * Cards are returned in the same order. Personal cards, and team cards with
 * use_team_brand off, come back untouched - somebody keeping their own
 * branding (a contractor, a family member) must not have the company's
 * painted over them.
 *
 * Needs use_team_brand, department_id and organization_id on each card, which
 * is why the callers select('*').
 */
export async function withResolvedBrand<T extends Record<string, any>>(
  admin: any,
  cards: T[],
): Promise<T[]> {
  const orgIds = [...new Set(
    cards.filter(c => c?.use_team_brand).map(c => c.organization_id).filter(Boolean)
  )]
  if (orgIds.length === 0) return cards

  const [{ data: orgRows }, { data: deptRows }] = await Promise.all([
    admin.from('organizations').select('id, brand').in('id', orgIds),
    // select('*') rather than naming parent_id: migration 053 is applied by
    // hand, and naming a column that does not exist yet returns an EMPTY
    // result, which would silently drop the department brand from every card
    // rather than failing loudly.
    admin.from('departments').select('*').in('organization_id', orgIds),
  ])

  const orgBrandById: Record<string, any> =
    Object.fromEntries((orgRows || []).map((o: any) => [o.id, o.brand || {}]))

  const byId = indexById((deptRows || []).map((d: any): DeptNode => ({
    id: d.id,
    organization_id: d.organization_id,
    name: d.name,
    parent_id: d.parent_id ?? null,
    kind: d.kind === 'company' ? 'company' : 'department',
    slug_segment: d.slug_segment ?? null,
    brand: d.brand || {},
  })))

  return cards.map(c => {
    if (!c?.use_team_brand) return c
    const chain = c.department_id ? ancestorChain(c.department_id, byId) : []
    return mergeBrand(c, resolveBrandChain(orgBrandById[c.organization_id] || {}, chain))
  })
}
