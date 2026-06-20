import { createClient as createAdminClient } from '@supabase/supabase-js'

export interface OwnedContact {
  id: string
  card_id: string | null
  team_card_id: string | null
}

// Returns the contact if `userId` is allowed to edit/delete it, else
// null. A user owns a contact when it sits on:
//   - their personal card (cards.user_id), or
//   - a team card they claimed (team_cards.user_id), or
//   - a team card in an org they administer (organizations.admin_user_id).
export async function getOwnedContact(userId: string, contactId: string): Promise<OwnedContact | null> {
  if (!userId || !contactId) return null

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: contact } = await admin
    .from('contacts')
    .select('id, card_id, team_card_id')
    .eq('id', contactId)
    .maybeSingle()

  if (!contact) return null

  // Personal card ownership.
  if (contact.card_id) {
    const { data: card } = await admin
      .from('cards')
      .select('id')
      .eq('id', contact.card_id)
      .eq('user_id', userId)
      .maybeSingle()
    return card ? contact : null
  }

  // Team card: claimed member OR org admin.
  if (contact.team_card_id) {
    const { data: tc } = await admin
      .from('team_cards')
      .select('user_id, organization_id')
      .eq('id', contact.team_card_id)
      .maybeSingle()
    if (!tc) return null
    if (tc.user_id === userId) return contact
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('id', tc.organization_id)
      .eq('admin_user_id', userId)
      .maybeSingle()
    return org ? contact : null
  }

  return null
}
