// The fixed industry list behind the Network directory's niche filter.
//
// A fixed list rather than free text on purpose: typed tags would give us
// "Real Estate", "real estate", "realtor" and "property" as four separate
// niches, and a directory that splits the thing you are searching for is worse
// than no filter at all.
//
// ids are stored in cards.industry / team_cards.industry and must not change
// once live - the label can be reworded freely, the id cannot.

export interface Industry {
  id: string
  label: string
}

export const INDUSTRIES: Industry[] = [
  { id: 'construction',    label: 'Construction & Trades' },
  { id: 'property',        label: 'Property & Real Estate' },
  { id: 'finance',         label: 'Finance & Insurance' },
  { id: 'legal',           label: 'Legal' },
  { id: 'medical',         label: 'Medical & Healthcare' },
  { id: 'it',              label: 'IT & Software' },
  { id: 'marketing',       label: 'Marketing & Design' },
  { id: 'retail',          label: 'Retail & E-commerce' },
  { id: 'hospitality',     label: 'Hospitality & Events' },
  { id: 'logistics',       label: 'Transport & Logistics' },
  { id: 'manufacturing',   label: 'Manufacturing' },
  { id: 'mining',          label: 'Mining & Energy' },
  { id: 'agriculture',     label: 'Agriculture' },
  { id: 'education',       label: 'Education & Training' },
  { id: 'motor',           label: 'Motor & Automotive' },
  { id: 'security',        label: 'Security' },
  { id: 'cleaning',        label: 'Cleaning & Facilities' },
  { id: 'beauty',          label: 'Beauty & Wellness' },
  { id: 'media',           label: 'Media & Photography' },
  { id: 'nonprofit',       label: 'Non-profit & Community' },
  { id: 'professional',    label: 'Other Professional Services' },
]

export const INDUSTRY_IDS = INDUSTRIES.map(i => i.id)

export function industryLabel(id: string | null | undefined): string | null {
  if (!id) return null
  return INDUSTRIES.find(i => i.id === id)?.label ?? null
}

export function isIndustryId(value: unknown): value is string {
  return typeof value === 'string' && INDUSTRY_IDS.includes(value)
}

// Companies are free text on personal cards, so "Yireh", "yireh " and
// "YIREH" are the same employer typed three ways. Everything the directory
// groups by goes through this first.
export function companyKey(name: string | null | undefined): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\b(pty)?\s*\(?ltd\)?\.?$/i, '')
    .replace(/\s*\(pty\)\s*$/i, '')
    .trim()
}
