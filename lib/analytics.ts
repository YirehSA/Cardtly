// Google Analytics (GA4): where it may run, and whether it runs at all.
//
// Added 2026-10-23 so visits and sign-ups from the marketing site can be
// measured. It is OFF until NEXT_PUBLIC_GA_MEASUREMENT_ID is set in Vercel to
// the property's "G-..." ID: no ID, no tag, and the privacy policy and trust
// page keep saying what they said before. Set the ID and redeploy, and the tag
// and both disclosures switch on together, because all three read GA_ENABLED.
//
// WHAT IT MAY NEVER TOUCH, and why each one is a promise already made:
//   - cards. The privacy policy says a visitor's daily code "cannot be used to
//     follow a person between cards", and GA's client id would do exactly that;
//   - the dashboard, sign-in and every signed document (quotes, POs), which
//     are customers' own business;
//   - the Android and iOS apps. The policy says the iOS app has no third-party
//     analytics, and App Store privacy answers depend on it.
// So the rule is an allowlist of marketing paths, not a blocklist: a new
// product route is untracked until somebody decides otherwise.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
export const GA_ENABLED = /^G-[A-Z0-9]{4,}$/.test(GA_MEASUREMENT_ID)

/** The marketing pages. Exact match for '/', prefix match for the rest. */
export const ANALYTICS_PATHS = [
  '/',
  '/features', '/teams', '/pricing', '/nfc', '/network', '/how-it-works',
  '/blog', '/about', '/contact', '/resellers', '/promotions',
  // Where a visit becomes a sign-up, which is the conversion worth counting.
  '/signup',
  '/privacy', '/terms', '/trust', '/paia',
] as const

export function isAnalyticsPath(pathname: string): boolean {
  return ANALYTICS_PATHS.some(p =>
    p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')))
}

/** Where cookies need consent first, and so where GA runs without them:
 *  the European Economic Area, the United Kingdom and Switzerland. */
export const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]
