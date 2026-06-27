// The team brand: fields that are shared across a team and controlled
// centrally by the org admin. Everything NOT in this list is personal
// (name, title, bio, email, phone, work_phone, whatsapp,
// profile_image_url) and stays editable per member.

export const BRAND_FIELDS = [
  'company',
  'company_logo_url',
  'website',
  'address',
  'color_theme',            // design: template, colours, fonts
  'linkedin_url',
  'twitter_url',
  'instagram_url',
  'facebook_url',
  'link_1_title', 'link_1_url',
  'link_2_title', 'link_2_url',
  'link_3_title', 'link_3_url',
  'link_4_title', 'link_4_url',
  'link_5_title', 'link_5_url',
  'certifications',
  'image_1_url', 'image_1_link',
  'image_2_url', 'image_2_link',
  'image_3_url', 'image_3_link',
  'image_4_url', 'image_4_link',
  'image_5_url', 'image_5_link',
  'image_6_url', 'image_6_link',
] as const

export type BrandField = typeof BRAND_FIELDS[number]

// Pull just the brand fields out of a card (used by "use my card as
// the brand").
export function extractBrand(card: Record<string, any>): Record<string, any> {
  const brand: Record<string, any> = {}
  for (const f of BRAND_FIELDS) {
    if (card[f] !== undefined) brand[f] = card[f]
  }
  return brand
}

// Merge an org brand over a team card. Brand wins for any field the
// brand actually defines; if the brand is empty (not set up), the card
// renders its own fields unchanged. Returns a new object.
export function mergeBrand<T extends Record<string, any>>(card: T, brand: Record<string, any> | null | undefined): T {
  if (!brand || Object.keys(brand).length === 0) return card
  const merged: Record<string, any> = { ...card }
  for (const f of BRAND_FIELDS) {
    if (f in brand) merged[f] = brand[f]
  }
  return merged as T
}
