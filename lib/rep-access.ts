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

// An inactive rep keeps their history but stops being able to add to it - they
// have left, and their past meetings are still the company's record.
function identity(row: any): RepIdentity {
  return { id: row.id, name: row.name, active: row.active !== false }
}

/**
 * The rep record linked to this account, or null.
 *
 * Pass the signed-in address as `email` wherever it is to hand. A rep whose
 * record carries their address but whom nobody ever pressed "Give them a login"
 * for is matched on it and linked on the spot - see below for why that is safe,
 * and why it is worth doing.
 *
 * Read tolerantly throughout: reps.user_id arrives with migration 047, applied
 * by hand after the deploy, and a missing column must mean "not a rep" rather
 * than throwing inside a dashboard layout that every page renders through.
 */
export async function getRepForUser(
  admin: any,
  userId: string | undefined,
  email?: string | null,
): Promise<RepIdentity | null> {
  if (!userId) return null
  try {
    // The link, if somebody made it.
    const { data, error } = await admin
      .from('reps')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
    if (error) return null
    if (data?.length) return identity(data[0])

    // No link. That is the whole of what a rep sees - their diary, and the nav
    // item leading to it - resting on one button in the admin panel that
    // nobody has to press and nothing complains about. Anthony McGregor sat
    // signed in with an account, an email address on his rep record, and no
    // calendar, and the product had no way to say so: not a rep and not linked
    // yet look identical from here.
    //
    // So match the address instead and link it. reps holds a handful of rows,
    // and this only runs for accounts that are not already linked.
    const addr = String(email || '').trim().toLowerCase()
    if (!addr) return null

    const { data: unlinked, error: unlinkedErr } = await admin
      .from('reps')
      .select('*')
      .is('user_id', null)
    if (unlinkedErr || !unlinked?.length) return null

    // Compared here rather than with ilike: an underscore is a legal character
    // in an address and a single-character wildcard in a pattern, so matching
    // in the query would let first_last@x.com claim firstXlast@x.com's diary.
    const matches = unlinked.filter(
      (r: any) => String(r.email || '').trim().toLowerCase() === addr
    )
    // Two rep records sharing one address is a data problem, not something to
    // guess at - whose meetings would these be?
    if (matches.length !== 1) return null

    // An address admin typed on a rep record is an invitation, not a key.
    // Without this check, anyone who registered that address before the rep got
    // round to it would inherit the diary, the notes and the contacts in them.
    // Costs one call, once, on the request that does the linking.
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    const account = authUser?.user
    if (!account?.email_confirmed_at) return null
    if (String(account.email || '').trim().toLowerCase() !== addr) return null

    // is('user_id', null) makes two simultaneous requests safe: the second
    // matches nothing and the row keeps the id the first one wrote.
    await admin
      .from('reps')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', matches[0].id)
      .is('user_id', null)

    return identity(matches[0])
  } catch {
    return null
  }
}
