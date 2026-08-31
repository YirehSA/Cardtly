import { mergeBrand } from './team-brand'
import { lockedColumnsFor } from './team-locks'
import { hydrateBrandSources } from './brand-source'
import { indexById, ancestorChain, resolveBrandChain, type DeptNode } from './department-tree'

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
    // select('*') for locked_fields, for the same reason as below: it decides
    // which brand fields override the card, and naming it would return nothing
    // on a database that has not got it.
    admin.from('organizations').select('*').in('id', orgIds),
    // select('*') rather than naming parent_id: migration 053 is applied by
    // hand, and naming a column that does not exist yet returns an EMPTY
    // result, which would silently drop the department brand from every card
    // rather than failing loudly.
    admin.from('departments').select('*').in('organization_id', orgIds),
  ])

  // A look that follows a card is read from that card, not from the copy taken
  // when somebody chose it. Both levels, batched. See lib/brand-source.
  const [orgs, depts] = await Promise.all([
    hydrateBrandSources(admin, orgRows || []),
    hydrateBrandSources(admin, deptRows || []),
  ])

  const orgBrandById: Record<string, any> =
    Object.fromEntries(orgs.map((o: any) => [o.id, o.brand || {}]))
  const orgLockedById: Record<string, unknown> =
    Object.fromEntries(orgs.map((o: any) => [o.id, o.locked_fields ?? null]))

  const byId = indexById(depts.map((d: any): DeptNode => ({
    id: d.id,
    organization_id: d.organization_id,
    name: d.name,
    parent_id: d.parent_id ?? null,
    kind: d.kind === 'company' ? 'company' : 'department',
    slug_segment: d.slug_segment ?? null,
    brand: d.brand || {},
    locked_fields: d.locked_fields ?? null,
  })))

  return cards.map(c => {
    if (!c?.use_team_brand) return c
    const chain = c.department_id ? ancestorChain(c.department_id, byId) : []
    // Same rule as the public card: the brand wins on what the company locked,
    // and fills in what the member left blank. Anything else they set is theirs.
    return mergeBrand(
      c,
      resolveBrandChain(orgBrandById[c.organization_id] || {}, chain),
      lockedColumnsFor(orgLockedById[c.organization_id], chain.map(d => d.locked_fields)),
    )
  })
}
