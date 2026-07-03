import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { updateGoogleWalletObject, isGoogleWalletConfigured } from '@/lib/google-wallet'

// POST /api/wallet/google/sync  { slug }
//
// Pushes a card's current details to its saved Google Wallet pass, so
// everyone who added that card to their Wallet sees the update. The card
// editors call this (fire-and-forget) after a successful save.
//
// Security: requires a signed-in session (blocks anonymous abuse). We do
// NOT enforce strict per-card ownership because this only re-pushes the
// card's own public data to its own pass - it can neither leak nor inject
// anything, and it no-ops if nobody has saved the pass yet.

export const dynamic = 'force-dynamic'

const WALLET_COLS = 'slug, name, title, company, email, phone, website, profile_image_url'

export async function POST(req: Request) {
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not_configured' })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })

  let slug: unknown
  try { slug = (await req.json())?.slug } catch { /* ignore */ }
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ ok: false, reason: 'no_slug' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  let { data: card } = await admin.from('cards').select(WALLET_COLS).eq('slug', slug).maybeSingle()
  if (!card) {
    const { data: teamCard } = await admin.from('team_cards').select(WALLET_COLS).eq('slug', slug).maybeSingle()
    card = teamCard
  }
  if (!card) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })

  const result = await updateGoogleWalletObject(card as any)
  return NextResponse.json({ ok: true, result })
}
