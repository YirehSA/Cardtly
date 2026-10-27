// Deleting a team from Admin, Teams.
//
// Only an EMPTY team, and only one nothing is billing (Andre, 2026-10-27:
// C-Office was a comped promo team with no cards, and its owner is to become a
// reseller instead). Anything with cards in it is people's live links, and
// deleting it is never the quick fix: suspend it, or move the cards first.
//
// What goes with the team: its departments and their managers (both cascade),
// its API keys and webhooks. What stays: the owner's login and their own
// personal card, and every invoice already issued (billing_clients lets go of
// the team, on delete set null).
//
// The rules are pure and import nothing, so scripts/check-team-delete can
// compile this file alone and run them.

export interface TeamDeleteFacts {
  /** Team cards in it, claimed or not. */
  cards: number
  billingPeriod: string | null
  resellerId: string | null
  /** Bought through self-serve checkout, and that subscription still serves. */
  paystackStillCharging: boolean
  /** Recurring invoice schedules that count this team's seats. */
  recurringSchedules: number
}

/** Why this team cannot be deleted, or null when it can. */
export function teamDeleteBlocker(f: TeamDeleteFacts): string | null {
  if (f.cards > 0) {
    return `It still has ${f.cards} card${f.cards === 1 ? '' : 's'}. Only an empty team can be deleted: move or delete the cards first, or suspend the team instead.`
  }
  if (f.resellerId || f.billingPeriod === 'reseller') {
    return 'This team belongs to a reseller, who cancels it from their own page. Deleting it here would take it off their bill without them knowing.'
  }
  if (f.paystackStillCharging) {
    return 'Paystack is still charging for this team. Cancel it first (Users, the owner, Cancel subscription), then delete the team.'
  }
  if (f.recurringSchedules > 0) {
    return `It has ${f.recurringSchedules === 1 ? 'a recurring invoice schedule' : `${f.recurringSchedules} recurring invoice schedules`} under Billing. Delete ${f.recurringSchedules === 1 ? 'it' : 'them'} first, so nothing goes on invoicing a team that is gone.`
  }
  return null
}
