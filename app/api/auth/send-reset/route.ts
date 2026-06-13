import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sendPasswordResetEmail } from '@/lib/password-reset'

// Public endpoint for the forgot-password page. Sends a token_hash
// based reset email (see lib/password-reset for why). Always returns
// success to the client so we never reveal whether an email is
// registered - the only failure surfaced is a hard config/send error.
export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    }

    const hdrs = await headers()
    const origin =
      hdrs.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://cardtly.com'

    const result = await sendPasswordResetEmail(email.trim().toLowerCase(), origin)

    // no_user -> still report success (don't leak account existence).
    if (result.ok || result.reason === 'no_user') {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: result.error || 'Could not send reset email' }, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
