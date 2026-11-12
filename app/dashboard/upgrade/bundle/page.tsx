import UpgradeScreen from '@/components/upgrade/UpgradeScreen'

// The upgrade page opened on the Pro year + NFC card bundle. Its own address,
// not a query string, because the sign-in redirect keeps only the path: a
// visitor who follows the pricing page link while signed out comes back here
// after signing in. Closed to the iOS app by the '/dashboard/upgrade' prefix.
export const metadata = { title: 'Pro year and NFC card' }

export default function UpgradeBundlePage() {
  return <UpgradeScreen openBundle />
}
