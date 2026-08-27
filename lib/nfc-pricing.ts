// What an NFC card costs, in one place.
//
// The price used to be a literal in five files: the order page, the marketing
// page's product schema, the pricing page, llms.txt and eleven blog posts.
// check-facts caught drift between llms.txt and the marketing page, and could
// only do that because it read the marketing page as the authority - a
// literal in a JSON-LD block standing in for a constant. Now both read this.

export type NfcTier = 'standard' | 'custom'

export const NFC_TIERS: Record<NfcTier, {
  id: NfcTier
  label: string
  price: number
  /** One line, for a radio option. */
  summary: string
  /** What the customer sends us, and what they get back. */
  detail: string
}> = {
  standard: {
    id: 'standard',
    label: 'Standard design',
    price: 150,
    summary: 'Your logo and colours on our layout',
    detail:
      'Send your logo and brand colours and we set them into the Cardtly ' +
      'layout. Clean, quick, and the same card everyone recognises. Proofed ' +
      'before printing.',
  },
  custom: {
    id: 'custom',
    label: 'Custom design',
    price: 200,
    summary: 'Designed around your brand, not our template',
    detail:
      'We design the card around your brand rather than fitting it into a ' +
      'template: your own layout, finish and artwork. Proofed before ' +
      'printing, with revisions until you are happy.',
  },
}

export const NFC_TIER_LIST = [NFC_TIERS.standard, NFC_TIERS.custom]

/** Shipping anywhere in South Africa, charged once per consignment. */
export const NFC_SHIPPING_RAND = 100

/** The headline figure marketing copy quotes, as in "from R150". */
export const NFC_FROM_RAND = Math.min(...NFC_TIER_LIST.map(t => t.price))
export const NFC_MAX_RAND = Math.max(...NFC_TIER_LIST.map(t => t.price))

export function nfcTier(id: string | null | undefined) {
  return (id && NFC_TIERS[id as NfcTier]) || NFC_TIERS.standard
}

export function nfcUnitPrice(id: string | null | undefined): number {
  return nfcTier(id).price
}

/**
 * Shipping is per consignment, not per card, so an order of ten cards is
 * charged one delivery. Quoting it per card would treble a team's estimate.
 */
export function nfcOrderTotal(tier: string | null | undefined, quantity: number): number {
  return nfcUnitPrice(tier) * Math.max(0, quantity) + NFC_SHIPPING_RAND
}

export const formatZAR = (n: number) => 'R' + n.toLocaleString('en-ZA')
