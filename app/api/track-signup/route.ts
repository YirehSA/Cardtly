import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Records where a new signup happened from. Called by the client
// signup page right after supabase.auth.signUp succeeds. We grab the
// caller's IP from Vercel's edge headers, look it up against the free
// ipapi.co API (no key required, generous rate limit), and write the
// country / city / region back to the user's profile so the admin
// panel can surface "this user signed up from Cape Town" etc.
//
// Failures are non-fatal. The signup flow itself does not depend on
// this route succeeding.

interface GeoLookup {
  country_name?: string
  country_code?: string
  region?: string
  city?: string
  ip?: string
}

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json()
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    // Grab the IP Vercel forwards. Falls back to a localhost marker
    // during local dev so we don't query ipapi for 127.0.0.1.
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const realIp = request.headers.get('x-real-ip') || ''
    const ip = (forwardedFor.split(',')[0] || realIp || '').trim()

    let geo: GeoLookup = {}
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { 'User-Agent': 'Cardtly/1.0' },
          // No-cache + short timeout so we don't slow down signups if
          // ipapi is having a bad day.
          signal: AbortSignal.timeout(2500),
        })
        if (res.ok) {
          geo = await res.json()
        }
      } catch {
        // Ignore lookup failures - we still record the IP below.
      }
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    await admin.from('profiles').update({
      signup_ip: ip || null,
      signup_country: geo.country_name || null,
      signup_country_code: geo.country_code || null,
      signup_city: geo.city || null,
      signup_region: geo.region || null,
    }).eq('user_id', user_id)

    return NextResponse.json({ success: true })
  } catch {
    // Always 200 - this is best-effort. Don't surface noise to the
    // signup UI if the location capture fails.
    return NextResponse.json({ success: true })
  }
}
