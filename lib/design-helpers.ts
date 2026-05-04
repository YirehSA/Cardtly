// Shared size calculation helpers used by both TemplatedCardPreview and PublicCardView

import { CardDesign } from '@/types/design'

// Returns actual pixel size for profile photo
// base = the template's natural size, pct = user's slider value (60-160)
export function calcPhotoSize(base: number, design: CardDesign): number {
  return Math.round(base * ((design.profilePhotoSize ?? 100) / 100))
}

// Returns actual pixel height for logo
// base = the template's natural logo height, pct = user's slider value (40-140)
export function calcLogoHeight(base: number, design: CardDesign): number {
  return Math.round(base * ((design.logoSize ?? 100) / 100))
}
