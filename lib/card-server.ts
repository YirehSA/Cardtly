import { createClient as createAdminClient } from '@supabase/supabase-js'

// Shared server-side helper for resolving a user's primary personal card.
//
// We had a bug where the dashboard pages used a regular user-scoped
// Supabase client with .eq('is_primary', true).single() to find the
// user's main card. That breaks for accounts where:
//   - The row exists but RLS hides it from the user-scoped client
//     (cards created by an admin script or team-invite flow)
//   - The user has multiple is_primary=true rows from old data drift
//   - The single primary card has is_primary=null instead of true
//
// The symptoms: dashboard shows "Hey, there" instead of the user's
// name, "Your Name" placeholder card, edit page can't save, etc.
//
// This helper uses the service-role admin client to bypass RLS for
// the lookup, picks the oldest is_primary=true row when there are
// multiples, and falls back to the oldest personal card if nothing
// is marked primary so the user always sees their real data.

export async function getPrimaryCard<T = Record<string, unknown>>(
  userId: string,
  columns: string = '*'
): Promise<T | null> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data } = await admin
    .from('cards')
    .select(columns)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const cards = (data || []) as Array<{ is_primary?: boolean | null }>
  const primary = cards.find((c) => c.is_primary === true)
  return ((primary || cards[0]) as T | undefined) || null
}

/**
 * Find the team card claimed by this user, if any. Used to power
 * the dashboard for team members - they don't have a personal
 * card in the `cards` table but DO have one in `team_cards` once
 * they've claimed their invite.
 */
export async function getMemberTeamCard<T = Record<string, unknown>>(
  userId: string,
  columns: string = '*'
): Promise<T | null> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data } = await admin
    .from('team_cards')
    .select(columns)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as T | null) || null
}

/**
 * Resolves the right card to show on a user's dashboard. Tries
 * personal first, falls back to a claimed team card. Returns a
 * tagged result so callers can know which kind they got and route
 * Edit links etc. accordingly.
 */
export async function getDashboardCard(
  userId: string
): Promise<{ kind: 'personal' | 'team' | 'none'; card: any | null }> {
  const personal = await getPrimaryCard<any>(
    userId,
    'id, name, title, company, slug, view_count, color_theme, profile_image_url'
  )
  if (personal) return { kind: 'personal', card: personal }

  const team = await getMemberTeamCard<any>(
    userId,
    'id, name, title, company, slug, color_theme, profile_image_url, organization_id'
  )
  if (team) return { kind: 'team', card: team }

  return { kind: 'none', card: null }
}
