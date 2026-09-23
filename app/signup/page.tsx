import { isIosApp } from '@/lib/app-platform'
import SignupForm from './SignupForm'

// NO metadata export here, deliberately. The title and description live in
// ./layout.tsx, and a page export overrides the layout key by key: this file
// used to export `{ title: 'Sign up' }`, which quietly replaced the layout's
// "Sign Up - Create Your Digital Business Card" with a 17-character tab title
// that told a search result nothing.

// A SERVER COMPONENT WRAPPING THE FORM, for one reason: the paid option quotes
// a price and leads to a checkout, and App Review rejected this product twice
// under Guideline 3.1.1 for exactly that. /signup is not on IOS_BLOCKED_ROUTES
// and must not be - somebody has to be able to make an account in the app - so
// the page has to be reachable while the price is not.
//
// lib/app-platform explains why this cannot be done in the browser: hidden
// markup is still in the page source, still flashes before hydration, and is
// still there for a reviewer who looks. Deciding here means the paid button is
// never sent to the app at all, and iOS signup is byte-for-byte what it was.
export default async function SignupPage() {
  const iosApp = await isIosApp()
  return <SignupForm iosApp={iosApp} />
}
