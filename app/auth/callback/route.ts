import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureAccountReady } from '@/lib/account-setup'

// GET /auth/callback?code=...
//
// Where Microsoft (or any other OAuth provider) sends people back to.
//
// There was no callback route at all before this, because email links and
// passwords do not need one. An OAuth sign-in does: the provider returns a
// one-time code, and it has to be exchanged for a session on the server so the
// session cookie is set on our own domain.
//
// It also provisions the account. A user arriving this way has an auth record
// and nothing else - no profiles row, no card - because both were only ever
// created by the signup form. Without this they would land on a dashboard with
// nothing in it and no way to understand why.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/dashboard'

  // The provider reports its own failures here rather than by throwing:
  // a cancelled consent screen comes back as error=access_denied.
  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (providerError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(providerError)}`, url.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=Missing+sign-in+code', url.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data?.user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || 'Could not complete sign-in')}`, url.origin)
    )
  }

  // Best effort. A failure here leaves a signed-in account missing a card,
  // which the dashboard can survive - refusing the sign-in outright over it
  // would be worse, and the next sign-in runs this again.
  try {
    await ensureAccountReady(data.user)
  } catch (e) {
    console.error('auth callback provisioning', e)
  }

  // Only ever redirect within this site. `next` arrives in the URL, so
  // honouring an absolute one would make this an open redirect anybody could
  // point at their own domain from a link that looks like ours.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
