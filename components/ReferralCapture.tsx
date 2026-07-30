'use client'

import { useEffect } from 'react'
import { captureReferralCode } from '@/lib/referral'
import { captureTrialCode } from '@/lib/trial-code-link'

// Tiny no-render client component. Mounted in the root layout so
// the referral capture runs once per page load. Any URL with a ?ref=
// query param (homepage, public card, /promotions, etc.) ends up
// storing the code in localStorage for later consumption by signup.
//
// Also captures ?code= (a trial code), for the same reason and by the same
// route: a rep shares cardtly.com/signup?code=CARDTLY60 and the trial is
// applied at signup without the visitor being shown a field to fill in.
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralCode()
    captureTrialCode()
  }, [])
  return null
}
