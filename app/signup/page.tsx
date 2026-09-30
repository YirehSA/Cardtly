import { isIosApp } from '@/lib/app-platform'
import SignupForm from './SignupForm'

// NO metadata export here, deliberately. The title and description live in
// ./layout.tsx, and a page export overrides the layout key by key: this file
// used to export `{ title: 'Sign up' }`, which quietly replaced the layout's
// "Sign Up - Create Your Digital Business Card" with a 17-character tab title
// that told a search result nothing.

// A SERVER COMPONENT WRAPPING THE FORM, for one reason: the paid option quotes
// a price and leads to a checkout, and App Review rejected this product twice
// under Guideline 3.1.1 for exactly that.
//
// Since 2026-09-30 /signup IS on IOS_BLOCKED_ROUTES: the iOS app serves company
// teams only (lib/app-platform, iosAppAdmits), and this page makes individual
// accounts. Team members get theirs from the invite link at /team/claim, which
// the app still opens. The iosApp prop stays as a second line of defence, so
// if the route is ever unblocked the paid button still never reaches the app.
//
// lib/app-platform explains why this cannot be done in the browser: hidden
// markup is still in the page source, still flashes before hydration, and is
// still there for a reviewer who looks.
export default async function SignupPage() {
  const iosApp = await isIosApp()
  return <SignupForm iosApp={iosApp} />
}
