import { createClient as createAdminClient } from '@supabase/supabase-js'

// Hardcoded original admin user id. Kept as a fallback so we can
// never accidentally lock ourselves out by flipping is_admin off
// on this row or deleting the profiles row.
export const FOUNDER_ADMIN_USER_ID = '6216ca40-72e5-47f2-af6a-a37d35f9d169'

/**
 * Is the given user id permitted to access /admin and admin APIs?
 *
 * Two sources of truth (either grants admin):
 *   1. Hardcoded founder admin id (always granted)
 *   2. profiles.is_admin = true (toggleable from /admin Users tab)
 *
 * Returns false if userId is null/undefined. Returns false on any
 * DB error so a flaky read can never silently elevate someone.
 */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  if (userId === FOUNDER_ADMIN_USER_ID) return true

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) return false
    return !!(data as any)?.is_admin
  } catch {
    return false
  }
}
