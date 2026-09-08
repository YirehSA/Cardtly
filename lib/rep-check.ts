import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/admin-check'

// Who may touch quotes.
//
// Admins, and sales reps - and only reps. A rep can raise a quote for a
// prospect they are working, and can see nothing else in the accounting
// system: no invoices, no payments, no statements, no banking settings and no
// other rep's quotes. Quoting is the whole of their access.
//
// Written as its own module rather than a flag on requireAdmin because the
// two answer different questions. "Is this person staff" and "may this person
// quote" drifting apart later is how a rep quietly ends up seeing the books.

export interface Actor {
  userId: string
  isAdmin: boolean
  /** The reps row, when this actor is a rep. Null for a plain admin. */
  repId: string | null
  repName: string | null
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

/** The active rep row for a user, or null. Inactive reps keep their history
 *  and lose their access, which is what deactivating is for. */
export async function repForUser(userId: string | null | undefined) {
  if (!userId) return null
  const { data } = await admin()
    .from('reps').select('id, name, active, user_id')
    .eq('user_id', userId).eq('active', true).maybeSingle()
  return data || null
}

/**
 * Admin OR active rep. Everything downstream must then decide what a rep is
 * allowed to see, which is why the result says WHICH it is rather than just
 * letting them through.
 */
export async function requireQuoteAccess(): Promise<{ actor: Actor } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  if (await isAdminUser(user.id)) {
    return { actor: { userId: user.id, isAdmin: true, repId: null, repName: null } }
  }

  const rep = await repForUser(user.id)
  if (rep) {
    return { actor: { userId: user.id, isAdmin: false, repId: rep.id, repName: rep.name } }
  }

  return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
}
