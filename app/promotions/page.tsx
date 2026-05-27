import { createClient } from '@/lib/supabase/server'
import PromotionsClient from './PromotionsClient'

// Server component: fetches the initial state (founder count + the
// current user's referral code if signed in) and passes to the
// client component. The client then handles the live polling +
// share button interactions.

export const metadata = {
  title: 'Growth Promotions — Cardtly',
  description: 'Win lifetime Pro, a custom website, cash, or a brand new Suzuki Swift. Cardtly is rewarding early adopters across four growing milestones.',
}

export default async function PromotionsPage() {
  const supabase = await createClient() as any

  // Initial founder count - the client will poll for updates
  const { data: counter } = await supabase.from('founder_count').select('*').maybeSingle()
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
