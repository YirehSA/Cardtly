import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPrimaryCard } from '@/lib/card-server'
import { parseBundleOrder } from '@/lib/pro-bundle'
import { startBundleCheckout } from '@/lib/pro-bundle-server'
import { isIosAppUA } from '@/lib/app-platform'
import { soloResellerFor, serviceDb } from '@/lib/reseller'

// Start paying for the Pro year + NFC card bundle (R999). The browser sends
// the card and delivery details and which design was chosen, never a price.
// Nothing is saved here: the details travel in the Paystack metadata and the
// order is written once the payment has gone through (lib/pro-bundle-server).

export async function POST(request: Request) {
  // Selling inside the iOS app is what App Review rejected under 3.1.1. The
  // upgrade page is already closed to the app; so is this.
  if (isIosAppUA(request.headers.get('user-agent'))) {
    return NextResponse.json({ error: 'Not available in the app.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  // Cardtly Solo sold by a reseller (lib/reseller-solo): they pay the reseller.
  const reseller = await soloResellerFor(serviceDb(), user.id)
  if (reseller) {
    return NextResponse.json({ error: `Your card comes through ${reseller.name}. Speak to them about moving up to Pro.` }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseBundleOrder(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const card = await getPrimaryCard<{ id: string; slug: string | null }>(user.id, 'id, slug')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  const res = await startBundleCheckout(
    createServiceClient() as any,
    { id: user.id, email: user.email },
    parsed.order,
    card ? { id: card.id, slug: card.slug ?? null } : null,
    appUrl,
  )
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ authorization_url: res.url })
}
