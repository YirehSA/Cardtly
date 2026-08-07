import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isIosAppUA } from '@/lib/app-platform'

// Routes that sell, or that unlock a subscription without the App Store.
//
// Blocked outright inside the iOS app, not merely unlinked: App Review rejected
// 1.0 (7) under Guideline 3.1.1 for both the Paystack checkout and the trial
// code box, and a page that is only unreachable by not linking to it is still
// reachable by typing the URL. Handled here rather than in each page so there
// is one list to read, and so a new link somewhere cannot quietly reopen a way
// in. /pricing goes too - a price list is a call to action towards a purchase
// mechanism that is not Apple's.
const BLOCKED_IN_IOS_APP = ['/dashboard/upgrade', '/pricing', '/upgrade']

export async function middleware(request: NextRequest) {
  const { pathname: earlyPath } = request.nextUrl

  if (isIosAppUA(request.headers.get('user-agent'))
      && BLOCKED_IN_IOS_APP.some(p => earlyPath === p || earlyPath.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    // Somewhere useful rather than an error: the person did not do anything
    // wrong, this simply is not a thing the iOS app does.
    url.pathname = earlyPath.startsWith('/dashboard') ? '/dashboard' : '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Public marketing routes are only matched for the check above, and must not
  // pay for a session refresh they have no use for.
  if (earlyPath === '/pricing' || earlyPath.startsWith('/upgrade')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
    // Matched only so the iOS-app block above can see them. Both return
    // immediately for everyone else, so no marketing page gains an auth call.
    '/pricing',
    '/upgrade/:path*',
    // Refresh the Supabase session on authenticated API routes so
    // long-running tabs don't hit "Unauthorized" when their access
    // token quietly expires. Public endpoints (og, track-signup,
    // bookings/request) are listed by negation pattern below.
    '/api/team/:path*',
    '/api/admin/:path*',
    '/api/account/:path*',
    '/api/slug/:path*',
    '/api/heartbeat/:path*',
    '/api/ai/:path*',
    '/api/nfc/:path*',
  ],
}
