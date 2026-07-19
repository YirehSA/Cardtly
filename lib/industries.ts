// The fixed industry list behind the Network directory's niche filter.
//
// A fixed list rather than free text on purpose: typed tags would give us
// "Real Estate", "real estate", "realtor" and "property" as four separate
// niches, and a directory that splits the thing you are searching for is worse
// than no filter at all.
//
// ids are stored in cards.industry / team_cards.industry and MUST NOT change
// once live - a renamed id orphans every card already carrying it. Labels can
// be reworded freely, and several here have been.
//
// The list is long deliberately. It costs nothing in the directory, where the
// filter only renders industries somebody is actually in, and the alternative
// is people picking "Other Professional Services" because nothing fits - which
// is the same as having no filter for them at all. It is grouped so the picker
// stays scannable at this length.

export interface Industry {
  id: string
  label: string
  group: string
}

export const INDUSTRY_GROUPS = [
  'Building & Trades',
  'Property & Professional',
  'Health & Wellbeing',
  'Technology',
  'Creative & Media',
  'Retail & Trade',
  'Hospitality & Travel',
  'Transport & Industry',
  'Education & Community',
] as const

export const INDUSTRIES: Industry[] = [
  // Building & Trades
  { id: 'construction',  label: 'Construction & Building',      group: 'Building & Trades' },
  { id: 'architecture',  label: 'Architecture & Engineering',   group: 'Building & Trades' },
  { id: 'interiors',     label: 'Interior Design & Decor',      group: 'Building & Trades' },
  { id: 'landscaping',   label: 'Landscaping & Garden',         group: 'Building & Trades' },
  { id: 'cleaning',      label: 'Cleaning & Facilities',        group: 'Building & Trades' },
  { id: 'security',      label: 'Security',                     group: 'Building & Trades' },

  // Property & Professional
  { id: 'property',      label: 'Property & Real Estate',       group: 'Property & Professional' },
  { id: 'legal',         label: 'Legal',                        group: 'Property & Professional' },
  { id: 'accounting',    label: 'Accounting & Tax',             group: 'Property & Professional' },
  { id: 'finance',       label: 'Finance & Insurance',          group: 'Property & Professional' },
  { id: 'consulting',    label: 'Business Consulting',          group: 'Property & Professional' },
  { id: 'hr',            label: 'HR & Recruitment',             group: 'Property & Professional' },
  { id: 'government',    label: 'Government & Public Sector',   group: 'Property & Professional' },
  { id: 'professional',  label: 'Other Professional Services',  group: 'Property & Professional' },

  // Health & Wellbeing
  { id: 'medical',       label: 'Medical & Healthcare',         group: 'Health & Wellbeing' },
  { id: 'veterinary',    label: 'Veterinary & Pets',            group: 'Health & Wellbeing' },
  { id: 'fitness',       label: 'Sport, Fitness & Recreation',  group: 'Health & Wellbeing' },
  { id: 'beauty',        label: 'Beauty & Wellness',            group: 'Health & Wellbeing' },

  // Technology
  { id: 'it',            label: 'IT & Software',                group: 'Technology' },
  { id: 'telecoms',      label: 'Telecoms & Connectivity',      group: 'Technology' },

  // Creative & Media
  { id: 'marketing',     label: 'Marketing & Design',           group: 'Creative & Media' },
  { id: 'media',         label: 'Media & Photography',          group: 'Creative & Media' },
  { id: 'printing',      label: 'Printing & Signage',           group: 'Creative & Media' },
  { id: 'entertainment', label: 'Music & Entertainment',        group: 'Creative & Media' },
  { id: 'arts',          label: 'Arts & Crafts',                group: 'Creative & Media' },

  // Retail & Trade
  { id: 'retail',        label: 'Retail & E-commerce',          group: 'Retail & Trade' },
  { id: 'wholesale',     label: 'Wholesale & Distribution',     group: 'Retail & Trade' },
  { id: 'fashion',       label: 'Fashion & Apparel',            group: 'Retail & Trade' },
  { id: 'food',          label: 'Food & Beverage',              group: 'Retail & Trade' },

  // Hospitality & Travel
  { id: 'travel',        label: 'Travel & Tourism',             group: 'Hospitality & Travel' },
  { id: 'hospitality',   label: 'Hospitality & Accommodation',  group: 'Hospitality & Travel' },
  { id: 'events',        label: 'Events & Weddings',            group: 'Hospitality & Travel' },
  { id: 'restaurants',   label: 'Restaurants & Catering',       group: 'Hospitality & Travel' },

  // Transport & Industry
  { id: 'logistics',     label: 'Transport & Logistics',        group: 'Transport & Industry' },
  { id: 'motor',         label: 'Motor & Automotive',           group: 'Transport & Industry' },
  { id: 'aviation',      label: 'Aviation & Marine',            group: 'Transport & Industry' },
  { id: 'manufacturing', label: 'Manufacturing',                group: 'Transport & Industry' },
  { id: 'mining',        label: 'Mining & Minerals',            group: 'Transport & Industry' },
  { id: 'energy',        label: 'Energy, Solar & Renewables',   group: 'Transport & Industry' },
  { id: 'agriculture',   label: 'Agriculture & Farming',        group: 'Transport & Industry' },

  // Education & Community
  { id: 'education',     label: 'Education & Training',         group: 'Education & Community' },
  { id: 'childcare',     label: 'Childcare & Early Learning',   group: 'Education & Community' },
  { id: 'nonprofit',     label: 'Non-profit & Community',       group: 'Education & Community' },
  { id: 'religious',     label: 'Religious & Faith',            group: 'Education & Community' },
  { id: 'funeral',       label: 'Funeral Services',             group: 'Education & Community' },
]

export const INDUSTRY_IDS = INDUSTRIES.map(i => i.id)

// For <optgroup> rendering. Groups with nothing in them are dropped, so the
// picker never shows an empty heading.
export const INDUSTRIES_BY_GROUP: { group: string; items: Industry[] }[] =
  INDUSTRY_GROUPS.map(group => ({
    group,
    items: INDUSTRIES.filter(i => i.group === group),
  })).filter(g => g.items.length > 0)

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
