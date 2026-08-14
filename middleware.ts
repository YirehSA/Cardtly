import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isIosAppUA, isIosBlockedPath } from '@/lib/app-platform'

// Routes that sell, or that quote the price of what is being sold, are blocked
// outright inside the iOS app rather than merely unlinked: App Review rejected
// 1.0 (7) under Guideline 3.1.1 for both the Paystack checkout and the trial
// code box, and a page that is only unreachable by not linking to it is still
// reachable by typing the URL. Enforced here rather than in each page so a new
// link somewhere cannot quietly reopen a way in.
//
// The list itself is IOS_BLOCKED_ROUTES in lib/app-platform, because the navbar
// has to hide the same links and two copies would drift apart.
//
// Where a blocked request goes instead. Never '/', which is on the list now and
// would redirect to itself forever.
const IOS_FALLBACK = '/dashboard'

export async function middleware(request: NextRequest) {
  const { pathname: earlyPath } = request.nextUrl

  const blocked = isIosBlockedPath(earlyPath)

  if (blocked && isIosAppUA(request.headers.get('user-agent'))) {
    const url = request.nextUrl.clone()
    // Somewhere useful rather than an error: the person did not do anything
    // wrong, this simply is not a thing the iOS app does. Signed out, the
    // dashboard sends them on to /login, which is where an app should open.
    url.pathname = IOS_FALLBACK
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Public routes are only matched so the check above can see them, and must
  // not pay for a session refresh they have no use for. The home page is on
  // this list now, so getting it wrong costs an auth round trip on the busiest
  // page on the site.
  if (blocked && !earlyPath.startsWith('/dashboard')) {
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
    // Matched only so the iOS-app block above can see them. They all return
    // immediately for everyone else, so no marketing page gains an auth call.
    // Keep this list in step with BLOCKED_IN_IOS_APP - a route missing here is
    // never seen by the middleware at all, so the block silently does nothing.
    '/',
    '/about',
    '/features',
    '/how-it-works',
    '/nfc',
    '/nfc/:path*',
    '/blog',
    '/blog/:path*',
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
