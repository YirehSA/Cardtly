import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/admin-check'

// The gate every /api/admin route already writes out by hand, in one place.
//
// The billing routes are about to add a dozen more of them, and a copy of an
// auth check is a copy that can drift. One that is 403 for staff-only data and
// one that forgot to await isAdminUser look identical in review.

export async function requireAdmin(): Promise<
  { user: { id: string; email?: string | null } } | { error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  if (!(await isAdminUser(user.id))) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  }
  return { user: { id: user.id, email: user.email } }
}

/** Service-role client. Bypasses RLS, so it is only ever reached after
 *  requireAdmin has returned a user. */
export function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

/** The billing tables live in migrations 064-066. A deployment that has not run
 *  them should say so rather than returning a raw Postgres error. */
export function migrationMissing(what = 'Billing') {
  return NextResponse.json(
    { error: `${what} is not set up on this database yet. Run migrations 064 to 066.` },
    { status: 503 },
  )
}
