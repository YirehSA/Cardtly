import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buildGoogleWalletSaveUrl, isGoogleWalletConfigured } from '@/lib/google-wallet'

// GET /api/wallet/google/[slug]
//
// Returns a redirect to the Google Wallet save URL for the given
// card. Hitting this from a button click opens the user's Google
// Wallet "save pass" sheet directly.
//
// The lookup hits both personal cards and team cards by slug -
// either kind can be saved as a wallet pass.

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (!isGoogleWalletConfigured()) {
    return NextResponse.json(
      { error: 'Google Wallet is not configured on this deployment' },
      { status: 503 }
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Try personal card first
  let { data: card } = await admin
    .from('cards')
    .select('slug, name, title, company, email, phone, website, profile_image_url')
    .eq('slug', slug)
    .maybeSingle()

  // Fallback to team card
  if (!card) {
    const { data: teamCard } = await admin
      .from('team_cards')
      .select('slug, name, title, company, email, phone, website, profile_image_url')
      .eq('slug', slug)
      .maybeSingle()
    card = teamCard
  }

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  try {
    const url = buildGoogleWalletSaveUrl(card as any)
    if (!url) {
      return NextResponse.json(
        { error: 'Could not build wallet pass' },
        { status: 500 }
      )
    }
    // 302 the user straight to Google Wallet's save sheet.
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('google wallet jwt error', err)
    return NextResponse.json(
      { error: 'Could not generate wallet pass' },
      { status: 500 }
    )
  }
}
