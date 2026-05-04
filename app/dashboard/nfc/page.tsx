import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import NFCOrderPage from '@/components/nfc/NFCOrderPage'
import ProGate from '@/components/card/ProGate'

export const metadata = { title: 'NFC Cards' }

export default async function NFCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, { data: card }, { data: orders }] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from('cards')
      .select('id, name, title, company, slug, profile_image_url, company_logo_url, color_theme')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single(),
    supabase
      .from('nfc_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const isPro = plan.tier === 'pro' && plan.isActive

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="NFC Cards" />
      </div>
    )
  }

  return (
    <NFCOrderPage
      card={card}
      user={{ id: user.id, email: user.email || '' }}
      previousOrders={orders || []}
    />
  )
}
