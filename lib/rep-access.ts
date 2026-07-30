import { createClient as createAdminClient } from '@supabase/supabase-js'

// Which rep record, if any, the signed-in account belongs to.
//
// The boundary for everything a rep can do. A rep is an ordinary Cardtly
// account with reps.user_id pointing at it, so this is the only place that
// turns "who is signed in" into "which rep's meetings may they touch". Every
// write checks it, and the dashboard uses it to decide whether to show the
// Meetings nav at all.

export interface RepIdentity {
  id: string
  name: string
  active: boolean
}

export function serviceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
}

/**
 * The rep record linked to this account, or null.
 *
 * Read tolerantly: reps.user_id arrives with migration 047, applied by hand
 * after the deploy, and a missing column must mean "not a rep" rather than
 * throwing inside a dashboard layout that every page renders through.
 */
export async function getRepForUser(admin: any, userId: string | undefined): Promise<RepIdentity | null> {
  if (!userId) return null
  try {
    const { data, error } = await admin
      .from('reps')
      .select('id, name, active')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return null
    if (!data) return null
    // An inactive rep keeps their history but stops being able to add to it -
    // they have left, and their past meetings are still the company's record.
    return { id: data.id, name: data.name, active: data.active !== false }
  } catch {
    return null
  }
}
