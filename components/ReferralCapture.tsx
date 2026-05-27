'use client'

import { useEffect } from 'react'
import { captureReferralCode } from '@/lib/referral'

// Tiny no-render client component. Mounted in the root layout so
// the referral capture runs once per page load. Any URL with a ?ref=
// query param (homepage, public card, /promotions, etc.) ends up
// storing the code in localStorage for later consumption by signup.
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralCode()
  }, [])
  return null
}
