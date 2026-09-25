import { isIosApp } from '@/lib/app-platform'
import LoginPageClient from './LoginClient'

// A SERVER COMPONENT WRAPPING THE FORM, the same way /signup does it, so the
// iOS app can be told apart before any markup is sent.
//
// The reason here is App Store Guideline 4.8, not price: the login page offers
// Sign in with Microsoft, and an iOS app with a third-party login must also
// offer Sign in with Apple. Deciding on the server means the Microsoft button
// is never in the app's page at all - not hidden after hydration, not in the
// source for a reviewer to find. lib/app-platform explains why this cannot be
// decided in the browser.
export default async function LoginPage() {
  const iosApp = await isIosApp()
  return <LoginPageClient iosApp={iosApp} />
}
