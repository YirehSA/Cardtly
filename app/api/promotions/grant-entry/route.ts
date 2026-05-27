import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/promotions/grant-entry
// Body: { user_id, source, idempotency_key?, tier? }
//
// Inserts a single promo_entries row for the user. Enforces:
//   - max 10 entries per user (deck rule: "Cap at 10 entries per
//     person to keep super-referrers from dominating")
//   - idempotency_key prevents double-granting on retries (e.g.
//     Paystack webhook fires twice for the same payment)
//
// Sources (must match the CHECK constraint on promo_entries):
//   paid               - became a paid Pro subscriber
//   referral           - referred someone who became paid 30+ days
//   social_instagram   - followed @cardtly on Instagram
//   social_facebook    - followed Cardtly on Facebook
//   hashtag            - shared their card with #Cardtly
//   tag_friend         - tagged a friend in a Cardtly post
//   email_alt          - no-purchase alternative entry via contest@cardtly.com
//
// Returns:
//   { success: true, granted: true, count: N }   - entry created
//   { success: true, granted: false, reason }    - skipped (capped, duplicate, etc.)

const VALID_SOURCES = new Set([
  'paid', 'referral',
  'social_instagram', 'social_facebook',
  'hashtag', 'tag_friend', 'email_alt',
])

const ENTRY_CAP = 10

export async function POST(request: Request) {
  let body: { user_id?: string; source?: string; idempotency_key?: string; tier?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { user_id, source, idempotency_key, tier } = body
  if (!user_id || !source) {
    return NextResponse.json({ error: 'Missing user_id or source' }, { status: 400 })
  }
  if (!VALID_SOURCES.has(source)) {
    return NextResponse.json({ error: `Invalid source: ${source}` }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  try {
    // Cap check: count existing entries for this user
    const { count: existingCount, error: countError } = await admin
      .from('promo_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)

    if (countError) {
      console.error('grant-entry count error:', countError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if ((existingCount ?? 0) >= ENTRY_CAP) {
      return NextResponse.json({
        success: true,
        granted: false,
        reason: 'cap_reached',
        count: existingCount,
      })
    }

    // Insert the entry. Idempotency unique index handles duplicate
    // attempts when idempotency_key is provided.
    const { error: insertError } = await admin
      .from('promo_entries')
      .insert({
        user_id,
        source,
        tier: tier || null,
        idempotency_key: idempotency_key || null,
      })

    if (insertError) {
      // 23505 = unique violation = duplicate idempotency_key. Treat
      // as a non-error since the entry is already counted.
      if ((insertError as any).code === '23505') {
        return NextResponse.json({
          success: true,
          granted: false,
          reason: 'duplicate_idempotency_key',
        })
      }
      console.error('grant-entry insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      granted: true,
      count: (existingCount ?? 0) + 1,
    })
  } catch (err) {
    console.error('grant-entry error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
