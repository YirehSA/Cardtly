// Is this request coming from the iOS app?
//
// App Review rejected 1.0 (7) under Guideline 3.1.1 twice over: the reviewer
// reached a Paystack card form inside the app, and separately flagged the trial
// code box as "unlocking subscriptions by means other than In-App Purchase".
// Apple's rule covers the checkout AND every button, link or call to action
// pointing at it, so on iOS none of it may exist.
//
// Detected from the user agent, which capacitor.config.ts appends a tag to, for
// one reason: it lets the server leave the markup OUT rather than the browser
// hide it after the fact. Hidden markup is still in the page source, still
// flashes before hydration, and would still be there for a reviewer who looks.
//
// iOS only. Android is on Play, already approved, and Google's terms are not
// the ones that rejected us - so nothing here touches it.

export const IOS_APP_UA_TAG = 'CardtlyiOS'

/**
 * Routes the iOS app may not open, because each one either sells a
 * subscription or quotes its price.
 *
 * Lives here rather than in middleware because the navigation has to hide the
 * same links, and two lists would drift. Middleware is the enforcement; the
 * navbar filter only stops a link dead-ending at a redirect.
 *
 * '/' is on it. The app's launch URL is the marketing home page, which quotes
 * the monthly price three times - so before this list grew, the first screen
 * of the iOS app was a price list.
 *
 * '/signup', '/network' and '/promotions' since 2026-09-30, when the app became
 * company teams only (see iosAppAdmits below). Signing up makes an individual
 * account, which the app no longer serves; team members get their account from
 * the invite link at /team/claim instead. The public /network page sells the
 * Network as "included with every Cardtly Pro account", which is individual Pro
 * again, and /promotions is a prize ladder for individual signups.
 */
export const IOS_BLOCKED_ROUTES = [
  '/dashboard/upgrade', '/pricing', '/upgrade',
  '/', '/about', '/features', '/how-it-works', '/nfc', '/blog', '/teams',
  '/signup', '/network', '/promotions',
] as const

/** Exact match for '/', prefix match for the rest. */
export function isIosBlockedPath(pathname: string): boolean {
  return IOS_BLOCKED_ROUTES.some(p =>
    p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')))
}

/**
 * Who the iOS app is for: company teams, and nobody else.
 *
 * App Review rejected build 8 on 2026-09-30 under Guidelines 3.1.1 and
 * 3.1.3(c). Apple accepts that a company pays Cardtly outside the App Store for
 * its staff (enterprise services), but not that an individual buys Pro on the
 * website and then uses it in the app. Their own suggested fix, and Andre's
 * choice, was to make the app serve organisations only.
 *
 * So the app opens the dashboard for someone whose access comes from a
 * company: they own a team, head a department in one, or hold a card in one.
 * Cardtly staff too, who are not customers at all. Everyone else is shown a
 * screen saying the app is for company teams, with sign-out and account
 * deletion and nothing about buying. The web and Android are untouched.
 *
 * Deliberately NOT keyed on whether the company is paid up. A team whose
 * invoice is late is still a company team, and telling its members "this app
 * is not for you" would be wrong. Their card's live state is decided where it
 * always was.
 */
export interface IosAccess {
  isStaff: boolean
  ownsTeam: boolean
  managesDepartment: boolean
  holdsTeamCard: boolean
}

export function iosAppAdmits(a: IosAccess): boolean {
  return a.isStaff || a.ownsTeam || a.managesDepartment || a.holdsTeamCard
}

export function isIosAppUA(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(IOS_APP_UA_TAG)
}

/**
 * For server components. Reading headers opts the caller into dynamic
 * rendering, which is why this is called from the dashboard - already dynamic
 * because it is behind auth - and never from a static marketing page. Those are
 * handled by middleware instead.
 */
export async function isIosApp(): Promise<boolean> {
  const { headers } = await import('next/headers')
  const ua = (await headers()).get('user-agent')
  return isIosAppUA(ua)
}
