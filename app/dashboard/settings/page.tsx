import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import SettingsTabs from '@/components/settings/SettingsTabs'

interface CardSummary {
  id: string
  slug: string | null
  name: string | null
}

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan = await getUserPlan(user.id)

  const [{ data: profile }, card] = await Promise.all([
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle(),
    getPrimaryCard<CardSummary>(user.id, 'id, slug, name'),
  ])

  const { data: sub } = await supabase
    .from('whop_subscriptions')
    .select('subscription_tier, status, created_at, whop_user_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <SettingsTabs
      user={{ id: user.id, email: user.email || '' }}
      profile={{ fullName: profile?.name || (card as any)?.name || '' }}
      plan={plan}
      subscription={sub || null}
      card={card || null}
    />
  )
}
