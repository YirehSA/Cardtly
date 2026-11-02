import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { adminDb } from '@/lib/admin-api'

// Who runs the reseller programme, and what they may do.
//
// Andre, 2026-11-02: Anthony stays a rep and also runs the reseller programme.
// He sees every reseller and changes their prices, seat pools and details; he
// recommends or declines applications; the final approval comes from Andre or
// Tio. Andre chose the rest: invoices stay with the admins, his price and seat
// changes take effect straight away (logged), and an admin may approve an
// application he has not recommended yet.
//
// A rep runs it when reps.manages_resellers is on (migration 098, switched in
// admin, Reps). Admins can always do everything; a manager only what is below.

export type ProgrammeRole = 'admin' | 'manager'

/** The /api/admin/resellers PATCH actions a manager may take. Everything else
 *  (logins, ending or restarting a reseller, drafting invoices, the free card)
 *  stays with admins, as do creating a reseller and approving or sending any
 *  invoice, which are separate routes that still require an admin. */
export const MANAGER_RESELLER_ACTIONS = ['update', 'nfc_status'] as const

export function managerMay(action: unknown): boolean {
  return (MANAGER_RESELLER_ACTIONS as readonly string[]).includes(String(action))
}

/** 'admin', 'manager' or null. Fails closed: an unreadable reps table (or one
 *  before migration 098) means only admins. */
export async function resellerProgrammeRole(db: any, userId: string | null | undefined): Promise<ProgrammeRole | null> {
  if (!userId) return null
  if (await isAdminUser(userId)) return 'admin'
  try {
    const { data, error } = await db.from('reps').select('*').eq('user_id', userId).limit(1)
    if (error || !data?.length) return null
    const rep = data[0]
    return rep.active !== false && rep.manages_resellers === true ? 'manager' : null
  } catch {
    return null
  }
}

/** The gate for the reseller routes: an admin, or the rep who runs the
 *  programme. Callers still refuse a manager anything not theirs. */
export async function requireResellerProgramme(): Promise<
  { user: { id: string; email?: string | null }; role: ProgrammeRole } | { error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  const role = await resellerProgrammeRole(adminDb(), user.id)
  if (!role) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  return { user: { id: user.id, email: user.email }, role }
}

/** The refusal a manager sees for an admin-only action. */
export function adminOnly(what: string) {
  return NextResponse.json({ error: `Only Andre or Tio can ${what}.` }, { status: 403 })
}

async function emailsOf(db: any, ids: string[]): Promise<string[]> {
  const out: string[] = []
  for (const id of ids) {
    try {
      const { data } = await db.auth.admin.getUserById(id)
      if (data?.user?.email) out.push(data.user.email)
    } catch { /* skip one we cannot read */ }
  }
  return out
}

/** Sign-in addresses of the reps who run the programme, for new applications. */
export async function programmeManagerEmails(db: any): Promise<string[]> {
  try {
    const { data, error } = await db.from('reps').select('*').eq('manages_resellers', true)
    if (error) return []
    return emailsOf(db, (data || []).filter((r: any) => r.active !== false && r.user_id).map((r: any) => r.user_id))
  } catch {
    return []
  }
}

/** Sign-in addresses of the admins, who give the final approval. */
export async function adminEmails(db: any): Promise<string[]> {
  try {
    const { data, error } = await db.from('profiles').select('user_id').eq('is_admin', true)
    if (error) return []
    return emailsOf(db, (data || []).map((p: any) => p.user_id))
  } catch {
    return []
  }
}

/** A person's name for "Recommended by ...": their rep record, else their email. */
export async function staffNameOf(db: any, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  try {
    const { data } = await db.from('reps').select('name').eq('user_id', userId).limit(1)
    if (data?.[0]?.name) return data[0].name
    const { data: u } = await db.auth.admin.getUserById(userId)
    return u?.user?.email || null
  } catch {
    return null
  }
}
