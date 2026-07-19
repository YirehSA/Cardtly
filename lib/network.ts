import { companyKey, industryLabel } from './industries'

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
  const [personal, team, orgs] = await Promise.all([
    admin
      .from('cards')
      .select(CARD_FIELDS)
      .not('slug', 'is', null)
      .eq('hide_from_network', false),
    admin
      .from('team_cards')
      .select(CARD_FIELDS)
      .not('slug', 'is', null)
      .eq('hide_from_network', false)
      .eq('is_active', true),
    admin.from('organizations').select('brand'),
  ])

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
    cards: [...map(personal.data, false), ...map(team.data, true)],
    brandLogos,
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

// One search box covers company, person and job title, because people do not
// know in advance which of the three they remember.
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
        (card.title || '').toLowerCase().includes(q)
    )
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
