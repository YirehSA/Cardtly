import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET /api/account/export
//
// Everything Cardtly holds about the signed-in user, as one JSON file they
// download themselves.
//
// POPIA gives a data subject the right to a copy of their personal
// information, and the privacy page promised portability while routing it to
// an email address with a 30-day turnaround. A tender asked whether it was
// self-service and the honest answer was no, which is what this fixes.
//
// The shape mirrors the deletion cascade in ../delete deliberately: if the
// two ever disagree, one of them is wrong about what the account contains.
// A reviewer can read them side by side and check.

export const dynamic = 'force-dynamic'

// Never leave the building. Invite and claim tokens grant access to a card,
// session identifiers are credentials, and a Paystack authorisation code can
// be charged against. None of them are the user's personal information in any
// useful sense, and all of them are dangerous in a file people email around
// and drop in cloud storage.
const REDACT = new Set([
  'invite_token', 'claim_token', 'token', 'access_token', 'refresh_token',
  'paystack_authorization_code', 'authorization_code', 'paystack_customer_code',
  'key_hash', 'secret', 'webhook_secret', 'password',
])

function scrub<T>(rows: T[] | null): T[] {
  return (rows || []).map(row => {
    if (!row || typeof row !== 'object') return row
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = REDACT.has(k) ? '[redacted]' : v
    }
    return out as T
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const userId = user.id

  // select('*') throughout: this has to return whatever the row actually
  // holds. Naming columns would silently omit anything added later, which is
  // the one failure mode a data-subject request must not have.
  const [profile, cards, orgs, heldTeamCards, nfcOrders, subs, bookings, meetings] =
    await Promise.all([
      admin.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('cards').select('*').eq('user_id', userId),
      admin.from('organizations').select('*').eq('admin_user_id', userId),
      // A team card the user holds belongs to their employer's account, not to
      // them, but their name and number are on it, so it is their personal
      // information and belongs in their copy.
      admin.from('team_cards').select('*').eq('user_id', userId),
      admin.from('nfc_orders').select('*').eq('user_id', userId),
      admin.from('whop_subscriptions').select('*').eq('user_id', userId),
      admin.from('bookings').select('*').eq('user_id', userId),
      admin.from('rep_meetings').select('*').eq('user_id', userId),
    ])

  const cardIds: string[] = (cards.data || []).map((c: any) => c.id)
  const orgIds: string[] = (orgs.data || []).map((o: any) => o.id)

  // Leads captured by the user's own cards, and the team cards belonging to
  // an organisation they administer. This is the user's CRM: portability
  // means they can take it with them.
  const [contacts, redirects, orgTeamCards, events] = await Promise.all([
    cardIds.length
      ? admin.from('contacts').select('*').in('card_id', cardIds)
      : Promise.resolve({ data: [] }),
    cardIds.length
      ? admin.from('slug_redirects').select('*').in('card_id', cardIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? admin.from('team_cards').select('*').in('organization_id', orgIds)
      : Promise.resolve({ data: [] }),
    cardIds.length
      ? admin.from('card_events').select('*').in('card_id', cardIds).limit(50_000)
      : Promise.resolve({ data: [] }),
  ])

  // A genuine failure has to be reported rather than exported as an absent
  // section: a file quietly missing someone's contacts still looks complete.
  const failed = [profile, cards, orgs, heldTeamCards, nfcOrders, subs, bookings,
    meetings, contacts, redirects, orgTeamCards, events]
    .map((r: any) => r?.error)
    .filter((e: any) => e && e.code !== '42P01' && e.code !== '42703')
  if (failed.length) {
    console.error('account export error', failed[0])
    return NextResponse.json({
      error: 'Could not assemble your export. Nothing was changed. Please try again, or email andre@cardtly.com.',
    }, { status: 500 })
  }

  const payload = {
    export_format: 'cardtly.account-export.v1',
    generated_at: new Date().toISOString(),
    about:
      'Everything Cardtly holds about this account. Tokens and payment ' +
      'authorisation codes are shown as [redacted] because they are ' +
      'credentials rather than personal information.',
    account: {
      id: userId,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: (user as any).last_sign_in_at ?? null,
    },
    profile: profile.data ? scrub([profile.data])[0] : null,
    cards: scrub(cards.data),
    // Analytics events are capped: an account with millions would otherwise
    // build a file too large to generate, and the cap is stated rather than
    // silently applied.
    card_events: scrub(events.data),
    card_events_truncated: (events.data || []).length >= 50_000,
    contacts: scrub(contacts.data),
    slug_redirects: scrub(redirects.data),
    team_cards_i_hold: scrub(heldTeamCards.data),
    organisations_i_administer: scrub(orgs.data),
    team_cards_in_my_organisations: scrub(orgTeamCards.data),
    nfc_orders: scrub(nfcOrders.data),
    subscriptions: scrub(subs.data),
    bookings: scrub(bookings.data),
    meetings: scrub(meetings.data),
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="cardtly-my-data-${stamp}.json"`,
      // A copy of someone's personal data has no business in any cache.
      'Cache-Control': 'no-store, private',
    },
  })
}
