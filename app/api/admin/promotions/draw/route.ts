import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/admin-check'

// POST /api/admin/promotions/draw
// Body: { tier: string, n_winners: number, prize: string, source_filter?: string, dry_run?: boolean }
//
// Picks N random *unique* users from promo_entries (weighted by entry
// count — more entries means higher odds), and either:
//   - dry_run=true:  returns the picks without writing anything
//   - dry_run=false: inserts the picks into promo_winners
//
// Excludes users who have already won in *this same tier* so we don't
// pick a duplicate winner for a milestone that's been partially drawn.
//
// Valid tiers (must match promo_winners CHECK):
//   tier1_founder_lifetime, tier1_founder_3m,
//   tier2_website_full, tier2_website_starter,
//   tier3_1000, tier3_2500, tier3_5000,
//   tier4_10000

const VALID_TIERS = new Set([
  'tier1_founder_lifetime', 'tier1_founder_3m',
  'tier2_website_full', 'tier2_website_starter',
  'tier3_1000', 'tier3_2500', 'tier3_5000',
  'tier4_10000',
])

export async function POST(request: Request) {
  // Promos paused: no draws can be run, not even by an admin. Running
  // one would create winners for a programme that is publicly 404.
  if (!PROMOS_ENABLED) {
    return NextResponse.json({ error: 'Promotions are paused' }, { status: 409 })
  }

  // 1. Auth gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!await isAdminUser(user?.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse body
  let body: { tier?: string; n_winners?: number; prize?: string; source_filter?: string; dry_run?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { tier, n_winners, prize, source_filter, dry_run } = body
  if (!tier || !VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid or missing tier' }, { status: 400 })
  }
  if (!n_winners || n_winners < 1 || n_winners > 100) {
    return NextResponse.json({ error: 'n_winners must be between 1 and 100' }, { status: 400 })
  }
  if (!dry_run && !prize) {
    return NextResponse.json({ error: 'prize is required for a live draw' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // 3. Pull the eligible entry pool. We pull all rows and shuffle in
  // JS — at our scale (10 entries per user, cap, 100k users worst
  // case = 1M rows) this is fine; if it ever isn't, switch to
  // postgres random sampling.
  let query = admin.from('promo_entries').select('user_id, source')
  if (source_filter) query = query.eq('source', source_filter)
  const { data: entries, error: entriesErr } = await query
  if (entriesErr) {
    console.error('draw: entries fetch error', entriesErr)
    return NextResponse.json({ error: 'Could not fetch entries' }, { status: 500 })
  }
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'No eligible entries yet' }, { status: 400 })
  }

  // 4. Exclude users who already won in this same tier
  const { data: existingWinners } = await admin
    .from('promo_winners')
    .select('user_id')
    .eq('tier', tier)
  const excluded = new Set((existingWinners || []).map((w: any) => w.user_id))

  // 5. Fisher-Yates shuffle, then walk through picking unique users
  const pool = entries.slice() as Array<{ user_id: string; source: string }>
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const picked: string[] = []
  const seen = new Set<string>()
  for (const row of pool) {
    if (excluded.has(row.user_id) || seen.has(row.user_id)) continue
    picked.push(row.user_id)
    seen.add(row.user_id)
    if (picked.length >= n_winners) break
  }

  if (picked.length === 0) {
    return NextResponse.json({ error: 'No eligible users remain (all already won this tier)' }, { status: 400 })
  }

  // 6. Look up emails for display
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailByUser: Record<string, string> = {}
  for (const u of authData?.users || []) {
    if (u.id && u.email) emailByUser[u.id] = u.email
  }

  const winnersWithEmails = picked.map((user_id) => ({
    user_id,
    email: emailByUser[user_id] || '(unknown)',
  }))

  // 7. Dry run: return picks, don't write
  if (dry_run) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      tier,
      n_requested: n_winners,
      n_picked: picked.length,
      winners: winnersWithEmails,
    })
  }

  // 8. Live draw: insert into promo_winners
  const rows = picked.map((user_id) => ({
    tier,
    prize: prize!,
    user_id,
    drawn_by: 'admin',
  }))
  const { error: insertErr } = await admin.from('promo_winners').insert(rows)
  if (insertErr) {
    console.error('draw: winners insert error', insertErr)
    return NextResponse.json({ error: 'Could not record winners' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    dry_run: false,
    tier,
    n_requested: n_winners,
    n_picked: picked.length,
    winners: winnersWithEmails,
  })
}
