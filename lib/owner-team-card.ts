import { orgEntitlesMembers } from '@/lib/org-billing'
import { subscriptionState, latestSubscriptionFor } from '@/lib/plan-server'
import { movePersonalCardIntoTeam, type MoveResult } from '@/lib/move-card-to-team'
import { newTeamCardSlug, newTeamPersonSlug } from '@/lib/card-slug-server'

// THE RULE: a team owner's own card lives in their team, as one of its seats,
// unless they pay for it some other way.
//
// Why it has to be automatic (Andre, 2026-10-07): JETOUR's administrator made
// his card from the dashboard before anybody thought about it, so it sat
// outside the team as a seventh card on a six-seat invoice and - being
// personal - was served by his 7-day signup trial, not by the team his company
// had paid for. An admin-only fix does nothing for a company that sets itself
// up, so the product does it at the moments the situation arises:
//
//   - a team goes live (admin create_org, a paid prepaid invoice):
//     settleOwnerCard moves the owner's existing card in
//   - an owner of a live team opens their Card page, or signs in for the
//     first time (ensureAccountReady), with no card: the card is created
//     inside the team (ownerTeamNeedingCard + createOwnerTeamCard)
//   - an owner of a live team opens their Card page with a personal card:
//     settleOwnerCard moves it in, same link
//
// "Unless they pay some other way": an owner whose own subscription serves
// their card is left exactly as they are. That includes every self-serve
// Paystack team, because the Paystack webhook writes the team's subscription
// onto the owner's user, which is why app/api/team/verify is not hooked.
// Nothing changes for a paying customer; this is for the owners whose card
// would otherwise go dark when their trial ends.

/** Does this person's own subscription already keep their card live? */
async function paysOwnWay(db: any, userId: string): Promise<boolean> {
  try {
    const sub = await latestSubscriptionFor(db, userId)
    return subscriptionState(sub as any).serves
  } catch {
    // Unreadable: assume they pay, and leave them alone. Doing nothing is the
    // safe failure for something that rebuilds a card.
    return true
  }
}

interface LiveTeam { id: string; name: string; admin_user_id: string; max_seats: number }

/** The owner's live team with a free seat and no card of theirs in it, if any. */
async function teamNeedingOwnerCard(db: any, orgId: string): Promise<LiveTeam | null> {
  const { data: org } = await db.from('organizations')
    .select('id, name, admin_user_id, max_seats, suspended_at, business_plan_active, billing_period, trial_ends_at')
    .eq('id', orgId).maybeSingle()
  if (!org?.admin_user_id || !orgEntitlesMembers(org)) return null
  const { data: cards } = await db.from('team_cards').select('user_id').eq('organization_id', org.id)
  if ((cards || []).some((c: any) => c.user_id === org.admin_user_id)) return null
  if ((cards || []).length >= Number(org.max_seats || 0)) return null
  return org
}

/**
 * A team just went live, or its owner opened their Card page: if the owner's
 * own card belongs in it, move it in. Returns null when there is nothing to
 * do, which is the usual answer. Never throws: the caller's real work (a
 * payment, a team being set up) must not fail over this.
 */
export async function settleOwnerCard(db: any, orgId: string): Promise<MoveResult | null> {
  try {
    const org = await teamNeedingOwnerCard(db, orgId)
    if (!org) return null
    if (await paysOwnWay(db, org.admin_user_id)) return null
    const { data: personal } = await db.from('cards')
      .select('id, is_primary, created_at').eq('user_id', org.admin_user_id)
      .order('created_at', { ascending: true })
    const pick = (personal || []).find((c: any) => c.is_primary) || (personal || [])[0]
    if (!pick) return null
    return await movePersonalCardIntoTeam(db, { orgId: org.id, cardId: pick.id })
  } catch (e) {
    console.error('settleOwnerCard', orgId, e)
    return null
  }
}

/** Every live team this user owns that their card belongs in, for the Card page. */
export async function ownerTeamNeedingCard(db: any, userId: string): Promise<LiveTeam | null> {
  const { data: owned } = await db.from('organizations').select('id').eq('admin_user_id', userId)
  for (const o of owned || []) {
    const org = await teamNeedingOwnerCard(db, o.id)
    if (org && !(await paysOwnWay(db, userId))) return org
  }
  return null
}

/** The owner's card, made inside their team rather than as a personal one. */
export async function createOwnerTeamCard(
  db: any, org: LiveTeam, user: { id: string; email?: string | null }, name: string,
): Promise<string | null> {
  const [slug, slugPerson] = await Promise.all([
    newTeamCardSlug(db, org.id, name),
    newTeamPersonSlug(db, org.id, name),
  ])
  const { data, error } = await db.from('team_cards').insert({
    organization_id: org.id,
    user_id: user.id,
    claimed_at: new Date().toISOString(),
    is_active: true,
    name,
    email: user.email ?? null,
    company: org.name,
    slug,
    slug_person: slugPerson,
  }).select('id').maybeSingle()
  if (error || !data) {
    console.error('createOwnerTeamCard', org.id, error)
    return null
  }
  return data.id
}
