// Deleting a reseller outright, from admin, Resellers.
//
// Andre, 2026-11-02: remove the C-Office, Yireh and Tinderbox resellers, which
// were set up to try the programme and to film the how-to videos. Ending one
// (app/api/admin/resellers 'end') keeps it, read-only, for its books; deleting
// is for a reseller that never had any: no invoice ever issued, no money, no
// cards in a client team, no NFC order paid for.
//
// What goes with it: its logins (not their accounts), its empty client teams,
// its seat counts, drafts and cancelled invoices that never got a number, its
// billing client once nothing else uses it, and its free card. Teams Cardtly
// bills itself stay, just no longer linked. Applications stay, as history.
//
// Admin only: not on MANAGER_RESELLER_ACTIONS (lib/reseller-programme).

export interface ResellerDeleteFacts {
  /** Client teams on the reseller's bill that hold any card. */
  teamsWithCards: number
  /** Client teams a recurring invoice schedule counts. */
  teamsWithSchedules: number
  /** Its invoices that were ever issued: a number, or any status past draft
   *  other than cancelled. */
  issuedInvoices: number
  /** Payments, credit notes, receipts, purchase orders, quotes or recurring
   *  schedules on its invoices or its billing client. */
  moneyRecords: number
  /** NFC orders paid for, or further along. */
  liveNfcOrders: number
}

/** NFC order states that mean money came in or cards were made. */
export const LIVE_NFC_STATUSES = ['paid', 'in_production', 'shipped', 'delivered'] as const

/** An invoice that never left the building: no number, draft or cancelled. */
export function neverIssued(inv: { number?: string | null; status?: string | null }): boolean {
  return !inv.number && (inv.status === 'draft' || inv.status === 'cancelled')
}

/** Why this reseller cannot be deleted, or null when it can. */
export function resellerDeleteBlocker(f: ResellerDeleteFacts): string | null {
  if (f.issuedInvoices > 0) {
    return `It has ${f.issuedInvoices} issued invoice${f.issuedInvoices === 1 ? '' : 's'}, which the books must keep. End it instead.`
  }
  if (f.moneyRecords > 0) {
    return 'It has payments, credit notes, receipts, quotes, purchase orders or a recurring schedule on its account, which the books must keep. End it instead.'
  }
  if (f.liveNfcOrders > 0) {
    return `It has ${f.liveNfcOrders} NFC order${f.liveNfcOrders === 1 ? '' : 's'} paid for or made. End it instead.`
  }
  if (f.teamsWithCards > 0) {
    return `${f.teamsWithCards} of its client teams still hold cards. Move or delete the cards, or move the team to another billing mode under Teams, first.`
  }
  if (f.teamsWithSchedules > 0) {
    return `${f.teamsWithSchedules} of its client teams are on a recurring invoice schedule. Remove the schedule first.`
  }
  return null
}
