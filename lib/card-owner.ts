// Resolves who owns a card (personal or team) and where to store +
// notify leads from it. Used by /api/contact and /api/bookings/request
// so both behave identically:
//   - the card owner gets the email (their card display email AND, for
//     a claimed team card, the team member's account email)
//   - the lead is stored under the correct column (card_id for personal,
//     team_card_id for team) so it shows in the right dashboards - the
//     team admin's Team Contacts view queries by team_card_id.

export interface CardOwner {
  found: boolean
  isTeam: boolean
  // Exactly one of these is set when found - the correct column to
  // store a contacts row against.
  personalCardId: string | null
  teamCardId: string | null
  cardName: string
  // De-duplicated inboxes to notify (card display email + claimed
  // account email). Empty if the card has no reachable email.
  ownerEmails: string[]
}

const EMPTY: CardOwner = {
  found: false, isTeam: false, personalCardId: null, teamCardId: null, cardName: '', ownerEmails: [],
}

// `id` may be a personal card id OR a team card id - we detect which.
// Pass a service-role admin client so the lookups bypass RLS (the
// caller is an anonymous card visitor).
export async function resolveCardOwner(admin: any, id: string): Promise<CardOwner> {
  if (!id) return EMPTY

  async function accountEmail(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null
    try {
      const { data } = await admin.auth.admin.getUserById(userId)
      return data?.user?.email || null
    } catch {
      return null
    }
  }

  // Personal card first.
  const { data: personal } = await admin
    .from('cards')
    .select('id, name, email, user_id')
    .eq('id', id)
    .maybeSingle()

  if (personal) {
    const emails = new Set<string>()
    if (personal.email) emails.add(personal.email)
    const acct = await accountEmail(personal.user_id)
    if (acct) emails.add(acct)
    return {
      found: true,
      isTeam: false,
      personalCardId: personal.id,
      teamCardId: null,
      cardName: personal.name || '',
      ownerEmails: [...emails],
    }
  }

  // Team card.
  const { data: team } = await admin
    .from('team_cards')
    .select('id, name, email, user_id, organization_id')
    .eq('id', id)
    .maybeSingle()

  if (team) {
    const emails = new Set<string>()
    if (team.email) emails.add(team.email)
    const acct = await accountEmail(team.user_id)
    if (acct) emails.add(acct)
    return {
      found: true,
      isTeam: true,
      personalCardId: null,
      teamCardId: team.id,
      cardName: team.name || '',
      ownerEmails: [...emails],
    }
  }

  return EMPTY
}
