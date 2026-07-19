import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/cards/visibility
// Body: { card_id: string, allow_homepage_feature?: boolean, hide_from_network?: boolean }
//
// Toggles a card's listing flags. Works for personal cards (owner) and team
// cards (the claimed member OR the org admin). We verify ownership via the
// signed-in user id, never trust the body alone.
//
// Two independent flags share this route because they share the ownership
// check: allow_homepage_feature (show me on the public homepage) and
// hide_from_network (keep me out of the Network directory). Either may be
// sent alone.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: {
    card_id?: string
    allow_homepage_feature?: boolean
    hide_from_network?: boolean
    org_hide_from_network?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { card_id, allow_homepage_feature, hide_from_network, org_hide_from_network } = body
  if (!card_id) {
    return NextResponse.json({ error: 'Missing card_id' }, { status: 400 })
  }

  const updatedAt = new Date().toISOString()

  // Only the flags actually sent get written, so toggling one never silently
  // resets the other.
  const patch: Record<string, any> = { updated_at: updatedAt }
  if (typeof allow_homepage_feature === 'boolean') {
    patch.allow_homepage_feature = allow_homepage_feature
  }
  if (typeof hide_from_network === 'boolean') {
    patch.hide_from_network = hide_from_network
  }
  // org_hide_from_network is the org admin's veto over a team card and is
  // handled further down, where we know whether the caller is that admin. It
  // is never applied to a personal card, which has no org.
  const wantsOrgFlag = typeof org_hide_from_network === 'boolean'
  if (Object.keys(patch).length === 1 && !wantsOrgFlag) {
    return NextResponse.json(
      { error: 'Nothing to update: send allow_homepage_feature, hide_from_network or org_hide_from_network' },
      { status: 400 }
    )
  }
  const result = { allow_homepage_feature, hide_from_network, org_hide_from_network }

  // 1. Personal card owned by the caller. Skipped when the request carries
  //    only the org flag, which no personal card has a column for.
  if (Object.keys(patch).length > 1) {
    const { data: personal, error: personalErr } = await supabase
      .from('cards')
      .update(patch as any)
      .eq('id', card_id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (personalErr) {
      console.error('visibility update error (personal)', personalErr)
      return NextResponse.json({ error: personalErr.message }, { status: 500 })
    }
    if (personal) {
      // Without org_hide_from_network: a personal card has no org and no such
      // column, so echoing it back would report applying something we did not.
      return NextResponse.json({
        success: true,
        allow_homepage_feature,
        hide_from_network,
      })
    }
  }

  // 2. Team card. Authorize the caller as the claimed member OR the
  //    org admin, then update with the service-role client (team_cards
  //    RLS only exposes a member's own row).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: teamCard } = await admin
    .from('team_cards')
    .select('id, user_id, organization_id')
    .eq('id', card_id)
    .maybeSingle()

  if (teamCard) {
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('id', teamCard.organization_id)
      .eq('admin_user_id', user.id)
      .maybeSingle()
    const isOrgAdmin = !!org
    const authorized = teamCard.user_id === user.id || isOrgAdmin
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized for this card' }, { status: 403 })
    }

    // The org veto is the admin's alone. A member may hide themselves via
    // hide_from_network, but must not be able to clear their manager's
    // decision - and a manager must not be able to clear the member's, which
    // is why these are two columns and not one.
    if (wantsOrgFlag) {
      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: 'Only the team admin can change who from the team is listed' },
          { status: 403 }
        )
      }
      patch.org_hide_from_network = org_hide_from_network
    }

    const { error: teamErr } = await admin
      .from('team_cards')
      .update(patch)
      .eq('id', card_id)
    if (teamErr) {
      console.error('visibility update error (team)', teamErr)
      return NextResponse.json({ error: teamErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, ...result })
  }

  return NextResponse.json({ error: 'Card not found or not owned by you' }, { status: 404 })
}
