import { composeCardSlug, orgSlugPrefix, uniqueSlug, slugifyPart } from '@/lib/card-slug'

// The company prefix that applies to a PERSON, for their personal card.
//
// Team cards get their prefix from the organisation the card belongs to. A
// personal card has no organisation on it at all, so the company has to be
// found through the person: the org they run, or failing that the org they
// hold a team card in.
//
// This matters more than it looks. The owner of a company usually has a
// personal card rather than a team card - team cards are the seats they hand
// out - so without this the one card most likely to be shown to a customer is
// the only one in the company not carrying the company's name.
//
// Returns null for someone with no company, which is most people. Their card
// keeps a bare name slug, which is correct: there is nothing to prefix with.
export async function userOrgSlugPrefix(admin: any, userId: string): Promise<string | null> {
  const pick = (org: any): string | null =>
    org ? (org.card_slug_prefix || orgSlugPrefix(org.name) || null) : null

  try {
    // The org they run. business_plan_active first, because an abandoned
    // checkout can leave a second row against the same admin.
    const { data: owned } = await admin
      .from('organizations')
      .select('name, card_slug_prefix')
      .eq('admin_user_id', userId)
      .order('business_plan_active', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (owned) return pick(owned)

    // Otherwise the org they belong to, via their team card.
    const { data: seat } = await admin
      .from('team_cards')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (!seat?.organization_id) return null

    const { data: org } = await admin
      .from('organizations')
      .select('name, card_slug_prefix')
      .eq('id', seat.organization_id)
      .maybeSingle()
    return pick(org)
  } catch {
    // A personal card with no prefix is a working card. Failing the rename
    // because we could not look up a company would not be.
    return null
  }
}

// A free URL for a new PERSONAL card, given a prefix already resolved by
// userOrgSlugPrefix. Same collision handling as team cards: numbered, not
// random, so a name you can read down a phone.
export async function newPersonalCardSlug(
  admin: any,
  prefix: string | null,
  personName: string,
): Promise<string> {
  const base = composeCardSlug(prefix, personName) || 'card'
  const [{ data: personal }, { data: team }] = await Promise.all([
    admin.from('cards').select('slug').like('slug', `${base}%`),
    admin.from('team_cards').select('slug').like('slug', `${base}%`),
  ])
  const taken = [...(personal || []), ...(team || [])].map((r: any) => r.slug).filter(Boolean)
  return uniqueSlug(base, taken)
}

// The company's industry, for a card that is about to be created.
//
// Read tolerantly: the column arrives with migration 044, and a new card
// starting without an industry is a smaller problem than card creation
// failing. Returns null when there is nothing to inherit, which is exactly
// what the field was before.
export async function orgIndustry(admin: any, orgId: string | null): Promise<string | null> {
  if (!orgId) return null
  try {
    const { data, error } = await admin
      .from('organizations').select('industry').eq('id', orgId).maybeSingle()
    if (error) return null
    return (data as any)?.industry || null
  } catch {
    return null
  }
}

// Picking a free URL for a new team card.
//
// Separate from lib/card-slug.ts so that file stays pure and importable by
// client components (the editor previews the URL as you type). This half needs
// the database.
//
// Three routes create team cards - add_card, the department invite, and a head
// creating their own - and each had its own copy of the naming rule. They now
// all come through here, so "what a team card's URL looks like" has one answer.
export async function newTeamCardSlug(
  admin: any,
  orgId: string | null,
  personName: string,
): Promise<string> {
  let prefix: string | null = null
  if (orgId) {
    const { data: org } = await admin
      .from('organizations')
      .select('name, card_slug_prefix')
      .eq('id', orgId)
      .maybeSingle()
    // card_slug_prefix arrives with migration 044. Before it is run the column
    // is absent and this reads undefined, so fall back to deriving from the
    // name: a card created in that window still gets a company prefix, just
    // not an edited one.
    if (org) prefix = (org as any).card_slug_prefix || orgSlugPrefix(org.name)
  }

  const base = composeCardSlug(prefix, personName) || composeCardSlug(prefix, 'card') || 'card'

  // Only slugs that could actually collide with this one. Fetching every slug
  // in the database to build a Set would work today and stop working quietly
  // at scale; PostgREST caps rows, and the cap failing open means handing out
  // a duplicate.
  const [{ data: personal }, { data: team }] = await Promise.all([
    admin.from('cards').select('slug').like('slug', `${base}%`),
    admin.from('team_cards').select('slug').like('slug', `${base}%`),
  ])
  const taken = [...(personal || []), ...(team || [])]
    .map((r: any) => r.slug)
    .filter(Boolean)

  return uniqueSlug(base, taken)
}

/**
 * The person half of /card/<company>/<person>.
 *
 * Made unique within the ORGANISATION rather than within the company, which is
 * stricter than the URL space requires: two people with the same name in two
 * different companies of one group could each be /card/companya/thabo-nkosi
 * and /card/companyb/thabo-nkosi without colliding.
 *
 * Org-wide is used anyway because a card's company is not known at the moment
 * it is created - a card is assigned to a department afterwards - and a slug
 * that is unique only under an assumption about where the card will end up is
 * a slug that can silently start resolving to the wrong person. The cost is
 * that the second Thabo Nkosi in a group gets thabo-nkosi-2 even in a
 * different company. Narrow it once cards are created into a department
 * directly.
 */
export async function newTeamPersonSlug(admin: any, orgId: string, personName: string): Promise<string> {
  const base = slugifyPart(personName, 40) || 'card'
  const { data, error } = await admin
    .from('team_cards')
    .select('slug_person')
    .eq('organization_id', orgId)

  // Before migration 054 the column does not exist. Returning the base slug is
  // right: nothing reads it yet, and the two-part URL is not in use.
  if (error) return base

  const taken = (data || [])
    .map((r: any) => (r.slug_person || '').toLowerCase())
    .filter(Boolean)
  return uniqueSlug(base, taken)
}
