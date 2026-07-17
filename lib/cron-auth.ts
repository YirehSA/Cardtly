import { NextResponse } from 'next/server'

// Shared gate for the Vercel Cron routes.
//
// Returns a response to send back when the caller is NOT allowed to run, or
// null when it is. Call it first in the handler:
//
//   const denied = denyIfNotCron(request)
//   if (denied) return denied
//
// Why it fails closed: the original inline version only verified the token
// when CRON_SECRET happened to be set (`if (secret) { ...check... }`). Both
// of these routes send mail to every user, so an unset or mistyped variable
// would quietly turn a mass-email job into an endpoint anyone could fire by
// guessing the URL, and nothing would look broken. A missing secret in
// production is now a loud 503 instead.
export function denyIfNotCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('cron: CRON_SECRET is not set, refusing to run')
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
    }
    // Local dev without a secret: allow, so routes stay testable.
    return null
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
