import { createClient as createAdminClient } from '@supabase/supabase-js'

// Everything a brand-new account needs before the dashboard makes sense.
//
// The signup form did all of this inline, which was fine while it was the only
// door in. Signing in with Microsoft is a second door, and it produces an auth
// user with no profiles row and no card at all - so the dashboard loads and
// there is nothing in it. This is the shared version both doors call.
//
// Deliberately idempotent. It runs on every OAuth sign-in, not only the first,
// because there is no reliable "is this their first time" signal: the same
// person signing in again, an account created by an invitation, and a genuine
// first arrival all look alike from here.

export function buildSlug(name: string, company?: string): string {
  const clean = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')

  const namePart = clean(name).slice(0, 30)
  const companyPart = company ? clean(company).slice(0, 20) : ''

  return companyPart ? `${companyPart}-${namePart}` : namePart
}

/**
 * A slug nothing else is using.
 *
 * Checks team_cards as well as cards. The public route resolves a personal
 * card first, so a personal slug colliding with a team slug would quietly
 * shadow somebody's team card - the URL keeps working and shows the wrong
 * person. The signup form only ever checked cards.
 */
export async function findFreeSlug(admin: any, base: string): Promise<string> {
  const taken = async (slug: string): Promise<boolean> => {
    const [{ data: personal }, { data: team }] = await Promise.all([
      admin.from('cards').select('id').eq('slug', slug).maybeSingle(),
      admin.from('team_cards').select('id').eq('slug', slug).maybeSingle(),
    ])
    return !!personal || !!team
  }

  const first = base || 'card'
  if (!(await taken(first))) return first
  for (let i = 2; i <= 99; i++) {
    const candidate = `${first}-${i}`
    if (!(await taken(candidate))) return candidate
  }
  // 99 collisions on one name. Random beats failing to create the account.
  return `${first}-${Math.random().toString(36).slice(2, 8)}`
}

export interface AccountSetupResult {
  profileCreated: boolean
  /** An existing profile row had no name and we filled it in. */
  nameFilled: boolean
  cardCreated: boolean
  cardSlug: string | null
  /** Why no card was made, when none was. */
  cardSkipped: 'already-has-personal' | 'has-team-card' | null
}

/**
 * Make sure a signed-in user has the rows the dashboard expects.
 *
 * Creates the profiles row if it is missing, and a personal card only if the
 * person has neither a personal card nor a team card. That last condition
 * matters: somebody invited into a team already has a card their employer
 * pays for, and handing them a second personal one is exactly the duplicate
 * the primary-card picker exists to clean up after.
 */
export async function ensureAccountReady(
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null },
): Promise<AccountSetupResult> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const meta = user.user_metadata || {}
  // Microsoft sends name in a few shapes depending on how the tenant is set
  // up; falling back to the local part of the address beats an empty card.
  const displayName: string =
    meta.full_name || meta.name ||
    [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
    (user.email ? user.email.split('@')[0] : 'My card')

  // The profiles row usually exists already: something in the database
  // creates one when the auth user appears, with no name in it. Measured on
  // live data, 48 of 72 profiles have a null name - the signup form inserts
  // one too, that insert loses to the existing row, and nobody checks the
  // error. So "create it if missing" is not enough; the name has to be filled
  // in when the row is there and empty, or every account arriving this way
  // has a blank name in Settings.
  let profileCreated = false
  let nameFilled = false
  const { data: profile } = await admin
    .from('profiles').select('user_id, name').eq('user_id', user.id).maybeSingle()

  if (!profile) {
    const { error } = await admin.from('profiles').insert({ user_id: user.id, name: displayName })
    // A duplicate here is a race with another tab, not a failure worth
    // stopping for: the row exists either way, which is all this needed.
    if (error && error.code !== '23505') console.error('ensureAccountReady profile', error)
    else profileCreated = !error
  } else if (!String(profile.name || '').trim()) {
    // Only when empty. Somebody who has set their own name keeps it, even if
    // their Microsoft directory says something different.
    const { error } = await admin
      .from('profiles').update({ name: displayName }).eq('user_id', user.id)
    if (error) console.error('ensureAccountReady profile name', error)
    else nameFilled = true
  }

  const [{ data: personal }, { data: teamCard }] = await Promise.all([
    admin.from('cards').select('id, slug').eq('user_id', user.id).limit(1).maybeSingle(),
    admin.from('team_cards').select('id, slug').eq('user_id', user.id).limit(1).maybeSingle(),
  ])

  if (personal) {
    return { profileCreated, nameFilled, cardCreated: false, cardSlug: personal.slug, cardSkipped: 'already-has-personal' }
  }
  if (teamCard) {
    return { profileCreated, nameFilled, cardCreated: false, cardSlug: teamCard.slug, cardSkipped: 'has-team-card' }
  }

  const slug = await findFreeSlug(admin, buildSlug(displayName))

  // assigned_user_id is what stops the card being archived on sight. A BEFORE
  // trigger, assert_card_assignment_consistency, sets archived = true when it
  // is null, and the policy serving public cards matches archived = false - so
  // a card created without it looks healthy in the dashboard and 404s in
  // public. That cost four days once.
  const { error } = await admin.from('cards').insert({
    user_id: user.id,
    assigned_user_id: user.id,
    name: displayName,
    email: user.email ?? null,
    slug,
    is_primary: true,
    color_theme: 'blue',
  })
  if (error) {
    console.error('ensureAccountReady card', error)
    return { profileCreated, nameFilled, cardCreated: false, cardSlug: null, cardSkipped: null }
  }

  return { profileCreated, nameFilled, cardCreated: true, cardSlug: slug, cardSkipped: null }
}
