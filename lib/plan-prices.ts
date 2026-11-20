// The personal plan prices in rand, on their own with no imports, so anything
// can read them (the emails are compiled alone by their checks). lib/solo is
// where the rest of Cardtly Solo lives, and re-exports these.

export const SOLO_PRICE_RAND = { monthly: 49, yearly: 450 } as const
export const PRO_PRICE_RAND = { monthly: 97, yearly: 970 } as const
/** What Cardtly charges a reseller for one Solo card. */
export const SOLO_RESELLER_RAND = { monthly: 35, yearly: 350 } as const
