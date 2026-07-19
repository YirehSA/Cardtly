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
  // False when the 036 columns are not in the database yet. Code deploys on
  // commit but migrations are applied by hand, so there is a window where this
  // query names columns that do not exist - the page shows a "not set up yet"
  // notice for that window instead of a 500.
  ready: boolean
}

export async function fetchNetworkCards(admin: any): Promise<NetworkData> {
  const [personal, team] = await Promise.all([
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
  if (missingColumns) return { cards: [], ready: false }

  const realError = [personal.error, team.error].find(Boolean)
  if (realError) throw realError

  return {
    cards: [...map(personal.data, false), ...map(team.data, true)],
    ready: true,
  }
}

// Group cards into companies. Cards with no company name are their own
// single-person entries under the person's name, so a freelancer is findable
// too rather than dropped from the directory entirely.
export function groupIntoCompanies(cards: NetworkCard[]): NetworkCompany[] {
  const byKey = new Map<string, NetworkCompany>()

  for (const card of cards) {
    const named = !!(card.company && card.company.trim())
    const key = named ? companyKey(card.company) : `solo:${card.slug}`
    if (!key) continue

    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        key,
        name: named ? card.company!.trim() : card.name,
        logoUrl: null,
        industry: null,
        industryLabel: null,
        cardCount: 0,
        cards: [],
      }
      byKey.set(key, entry)
    }

    entry.cards.push(card)
    entry.cardCount++
    // First logo wins, so a company whose staff have uploaded the logo
    // inconsistently still shows one.
    if (!entry.logoUrl && card.companyLogoUrl) entry.logoUrl = card.companyLogoUrl
    if (!entry.industry && card.industry) {
      entry.industry = card.industry
      entry.industryLabel = industryLabel(card.industry)
    }
  }

  for (const entry of byKey.values()) {
    entry.cards.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Companies with more people first - they are the more useful result - then
  // alphabetically so the order is stable between loads.
  return [...byKey.values()].sort(
    (a, b) => b.cardCount - a.cardCount || a.name.localeCompare(b.name)
  )
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
