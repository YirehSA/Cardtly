import { createClient } from '@/lib/supabase/server'
import PromotionsClient from './PromotionsClient'

// Server component: fetches the initial state (founder count + the
// current user's referral code if signed in) and passes to the
// client component. The client then handles the live polling +
// share button interactions.

export const metadata = {
  // No "- Cardtly" suffix here: the root layout's title template
  // already appends "| Cardtly" and doubling reads broken in SERPs.
  title: 'Win Prizes with Your Digital Business Card',
  description: 'Win lifetime Pro, a custom website, cash, and an ultimate grand prize. Cardtly is rewarding early adopters across four growing milestones.',
  alternates: { canonical: '/promotions' },
}

export default async function PromotionsPage() {
  const supabase = await createClient() as any

  // Initial founder count - the client will poll for updates.
  // founder_count() is a function (migration 022); it returns a
  // one-row array.
  const { data: counterData } = await supabase.rpc('founder_count')
  const counter = Array.isArray(counterData) ? counterData[0] : counterData
  const filled = counter?.filled ?? 0
  const remaining = counter?.remaining ?? 100
  const total = counter?.total ?? 100

  // Current user's referral code (if signed in)
  const { data: { user } } = await supabase.auth.getUser()
  let referralCode: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', user.id)
      .maybeSingle()
    referralCode = profile?.referral_code ?? null
  }

  return (
    <PromotionsClient
      initialFilled={filled}
      initialRemaining={remaining}
      total={total}
      referralCode={referralCode}
      isSignedIn={!!user}
    />
  )
}
