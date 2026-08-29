import { companyKey, industryLabel } from './industries'
import { withResolvedBrand } from './resolve-card-brand'

// Building the Network directory from the two card tables.
//
// Personal cards and team cards live in separate tables and are joined here
// rather than in the database, because a "company" in the directory is not one
// thing: a team card belongs to a real organisation row, while a personal card
// just has a company name someone typed. Both end up as one entry keyed on the
// normalised name.

export interface NetworkCard {
  id: string
  slug: string
  name: string
  title: string | null
  company: string | null
  industry: string | null
  profileImageUrl: string | null
  companyLogoUrl: string | null
  colorTheme: string | null
  isTeamCard: boolean
  // The business unit this person sits in, for the filter inside a company.
  // Personal cards have none, and neither does a team card that was never
  // put in a department, so this is null far more often than not.
  department: string | null
}

export interface NetworkCompany {
  key: string
  name: string
  logoUrl: string | null
  industry: string | null
  industryLabel: string | null
  cardCount: number
  cards: NetworkCard[]
  // One person, no logo. Almost always a typo, a test row or a phone number
  // typed into the company field, so these are kept out of the browsable grid
  // but still turn up when someone searches for them by name.
  lowSignal: boolean
}

export interface NetworkGroups {
  companies: NetworkCompany[]
  // People with no company set at all. Real members worth finding, but they
  // are not companies and they make a wall of logos look broken, so they get
  // their own section.
  independents: NetworkCard[]
}

// Contact details are deliberately absent from this shape. The directory is
// behind dashboard auth, but a listing that carried every member's email and
// phone would still be a scrapeable contact database. Name, position, company
// and photo are all already visible on the public card; the phone number needs
// a deliberate visit to that card.
const CARD_FIELDS =
  'id, slug, name, title, company, industry, profile_image_url, company_logo_url, color_theme'


export interface NetworkData {
  cards: NetworkCard[]
  // companyKey -> the org's own brand logo. A team that has set a brand has
  // one authoritative logo; without this the directory shows whichever staff
  // member's upload happened to be read first.
  brandLogos: Record<string, string>
  // False when the 036 columns are not in the database yet. Code deploys on
  // commit but migrations are applied by hand, so there is a window where this
  // query names columns that do not exist - the page shows a "not set up yet"
  // notice for that window instead of a 500.
  ready: boolean
}

export async function fetchNetworkCards(admin: any): Promise<NetworkData> {
  const [personal, team, orgs, depts] = await Promise.all([
    admin
      .from('cards')
      .select(CARD_FIELDS)
      .not('slug', 'is', null)
      .eq('hide_from_network', false),
    admin
      .from('team_cards')
      // select('*') so the brand can be resolved below: that needs
      // use_team_brand, department_id and organization_id, none of which the
      // listing itself displays.
      //
      // The extra columns never leave the server. `map` picks the listed
      // fields explicitly, so the NetworkCard shape - and the deliberate
      // absence of email and phone from it - is unchanged.
      .select('*')
      .not('slug', 'is', null)
      .eq('hide_from_network', false)
      // The manager's separate veto. A team card is listed only when the
      // member and their org both allow it.
      .eq('org_hide_from_network', false)
      // Also what takes an offboarded person out of the directory: revoking
      // their access sets is_active false.
      .eq('is_active', true),
    admin.from('organizations').select('brand'),
    // Names for the department filter. select('*') rather than naming columns
    // because a missing column returns an empty result instead of an error,
    // which would quietly leave every card unfiled rather than saying so.
    admin.from('departments').select('*'),
  ])

  // Departments are a nicety here, not a dependency: if the table cannot be
  // read the directory still lists everyone, just without the unit filter.
  const deptNames = new Map<string, string>()
  for (const row of (depts?.data || []) as any[]) {
    if (row?.id && row?.name) deptNames.set(row.id, row.name)
  }

  // Resolve what each team card actually wears before anything reads a logo
  // off it.
  //
  // A company's logo can live on the organisation, or on the company node, or
  // on a department. The directory only ever consulted the ORG brand, keyed by
  // the company name written in that brand - so a group whose logo sits on a
  // department node, and whose cards write a shorter company name than the
  // brand does, matched nothing and fell back to a grey building icon.
  // Resolving first means the logo arrives on the card, where the grouping
  // below already knows to pick it up.
  // The resolved card is used for its LOGO, never for its company name.
  //
  // company is a brand field, so resolving overwrites whatever the card said
  // with whatever the brand says. The directory groups by that text, and the
  // two are not always the same string: cards written as "Vistio" against a
  // brand that calls itself "Vistio Group" split into two entries the moment
  // the brand was applied - eight people under one name with no logo, one
  // person under the other holding it. Keeping the card's own company keeps
  // everybody in the group they were already in, and the logo now arrives
  // with them.
  const resolvedTeam = await withResolvedBrand(admin, (team.data || []) as any[])
  const brandedTeam = resolvedTeam.map((r: any, i: number) => ({
    ...r,
    company: (team.data || [])[i]?.company ?? r.company,
  }))

  const map = (rows: any[], isTeamCard: boolean): NetworkCard[] =>
    (rows || []).map(r => ({
      id: r.id,
      slug: r.slug,
      name: r.name || 'Unnamed',
      title: r.title ?? null,
      company: r.company ?? null,
      industry: r.industry ?? null,
      profileImageUrl: r.profile_image_url ?? null,
      companyLogoUrl: r.company_logo_url ?? null,
      colorTheme: r.color_theme ?? null,
      isTeamCard,
      department: (isTeamCard && r.department_id && deptNames.get(r.department_id)) || null,
    }))

  // 42703 is undefined_column. Any other error is a genuine fault and should
  // not be disguised as an empty directory.
  const missingColumns = [personal.error, team.error].some(
    (e: any) => e && e.code === '42703'
  )
  if (missingColumns) return { cards: [], brandLogos: {}, ready: false }

  const realError = [personal.error, team.error].find(Boolean)
  if (realError) throw realError

  // An org brand only helps if it names the company it belongs to - that name
  // is the only thing tying it to the cards, which group by company text.
  const brandLogos: Record<string, string> = {}
  for (const row of orgs.data || []) {
    const brand = (row as any).brand
    if (!brand?.company || !brand?.company_logo_url) continue
    brandLogos[companyKey(brand.company)] = brand.company_logo_url
  }

  return {
    cards: [...map(personal.data, false), ...map(brandedTeam, true)],
    brandLogos,
    ready: true,
  }
}

// The two Network fields for one card, fetched on their own.
//
// Deliberately not folded into the dashboard's main card query: that query
// runs through getPrimaryCard, which swallows errors and returns no row at
// all, so naming a column that does not exist yet would not throw - it would
// silently log every user out of their own dashboard, placeholder card and
// all. Asking separately means the worst case is that this one prompt does
// not render.
export async function fetchCardNetworkPrefs(
  admin: any,
  cardId: string,
  isTeamCard: boolean
): Promise<{ industry: string | null; hideFromNetwork: boolean; ready: boolean }> {
  const { data, error } = await admin
    .from(isTeamCard ? 'team_cards' : 'cards')
    .select('industry, hide_from_network')
    .eq('id', cardId)
    .maybeSingle()

  if (error || !data) {
    return { industry: null, hideFromNetwork: false, ready: false }
  }
  return {
    industry: data.industry ?? null,
    hideFromNetwork: !!data.hide_from_network,
    ready: true,
  }
}

// Group cards into companies, splitting off the people who never set one.
//
// Grouping is by company name and deliberately not by organization_id: a
// Cardtly org is a billing account, not a company. One org here holds four
// unrelated businesses, and grouping by org would file all four under the
// account holder's name.
export function groupIntoCompanies(
  cards: NetworkCard[],
  brandLogos: Record<string, string> = {}
): NetworkGroups {
  const byKey = new Map<string, NetworkCompany>()
  const independents: NetworkCard[] = []

  for (const card of cards) {
    if (!card.company || !card.company.trim()) {
      independents.push(card)
      continue
    }
    const key = companyKey(card.company)
    if (!key) {
      independents.push(card)
      continue
    }

    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        key,
        name: card.company.trim(),
        logoUrl: brandLogos[key] ?? null,
        industry: null,
        industryLabel: null,
        cardCount: 0,
        cards: [],
        lowSignal: false,
      }
      byKey.set(key, entry)
    }

    entry.cards.push(card)
    entry.cardCount++
    // A card's own upload only fills the gap when the org has no brand logo,
    // so a team that has set its brand always shows that one.
    if (!entry.logoUrl && card.companyLogoUrl) entry.logoUrl = card.companyLogoUrl
    if (!entry.industry && card.industry) {
      entry.industry = card.industry
      entry.industryLabel = industryLabel(card.industry)
    }
  }

  for (const entry of byKey.values()) {
    entry.cards.sort((a, b) => a.name.localeCompare(b.name))
    entry.lowSignal = entry.cardCount === 1 && !entry.logoUrl
  }

  independents.sort((a, b) => a.name.localeCompare(b.name))

  // Companies with more people first - they are the more useful result - then
  // alphabetically so the order is stable between loads.
  const companies = [...byKey.values()].sort(
    (a, b) => b.cardCount - a.cardCount || a.name.localeCompare(b.name)
  )

  return { companies, independents }
}

// One search box covers company, person, job title and business unit, because
// people do not know in advance which of the four they remember.
export function searchCompanies(
  companies: NetworkCompany[],
  query: string,
  industry: string | null
): NetworkCompany[] {
  const q = query.trim().toLowerCase()
  return companies.filter(c => {
    // Browsing shows the real companies; typing a query reaches everything,
    // so a one-person entry is hidden from the grid but never unfindable.
    if (c.lowSignal && !q) return false
    if (industry && c.industry !== industry) return false
    if (!q) return true
    if (c.name.toLowerCase().includes(q)) return true
    return c.cards.some(
      card =>
        card.name.toLowerCase().includes(q) ||
        (card.title || '').toLowerCase().includes(q) ||
        (card.department || '').toLowerCase().includes(q)
    )
  })
}

// ── Filtering inside one company ────────────────────────────────────────────
//
// A group with four hundred people in one company entry is a wall of tiles,
// and scrolling it is the only way to find the buyer in Roofing. These drive
// the business-unit and job-title filters on the company page.

export interface Facet { value: string; count: number }

// Distinct values with counts, folded case-insensitively so "Sales Director"
// and "sales director" are one filter rather than two. The label shown is the
// spelling that occurs most often, so the chip reads the way the company
// writes it rather than however the first row happened to be typed.
function facet(values: Array<string | null>): Facet[] {
  const groups = new Map<string, Map<string, number>>()
  for (const raw of values) {
    const v = (raw || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    const spellings = groups.get(key) || new Map<string, number>()
    spellings.set(v, (spellings.get(v) || 0) + 1)
    groups.set(key, spellings)
  }
  return [...groups.values()]
    .map(spellings => {
      let best = '', bestN = 0, total = 0
      for (const [spelling, n] of spellings) {
        total += n
        if (n > bestN) { best = spelling; bestN = n }
      }
      return { value: best, count: total }
    })
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function companyFacets(cards: NetworkCard[]): { departments: Facet[]; titles: Facet[] } {
  return {
    departments: facet(cards.map(c => c.department)),
    titles: facet(cards.map(c => c.title)),
  }
}

export function filterCompanyCards(
  cards: NetworkCard[],
  query: string,
  department: string | null,
  title: string | null
): NetworkCard[] {
  const q = query.trim().toLowerCase()
  const eq = (a: string | null, b: string | null) =>
    (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
  return cards.filter(c => {
    if (department && !eq(c.department, department)) return false
    if (title && !eq(c.title, title)) return false
    if (!q) return true
    // Every word has to match somewhere, in any order: "naidoo sales" is two
    // true things about one person that are never adjacent in any one field.
    const hay = [c.name, c.title, c.department].filter(Boolean).join('  ').toLowerCase()
    return q.split(/\s+/).filter(Boolean).every(t => hay.includes(t))
  })
}

export function searchIndependents(
  independents: NetworkCard[],
  query: string,
  industry: string | null
): NetworkCard[] {
  const q = query.trim().toLowerCase()
  return independents.filter(card => {
    if (industry && card.industry !== industry) return false
    if (!q) return true
    return (
      card.name.toLowerCase().includes(q) ||
      (card.title || '').toLowerCase().includes(q)
    )
  })
}
