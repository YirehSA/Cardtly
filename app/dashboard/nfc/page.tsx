import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import NFCOrderPage from '@/components/nfc/NFCOrderPage'
import NFCWriteCard from '@/components/nfc/NFCWriteCard'
import ProGate from '@/components/card/ProGate'
import NFCSamplesSection from '@/components/nfc/NFCSamplesSection'
import { availableSamples } from '@/lib/nfc-samples'

export const metadata = { title: 'NFC Cards' }

export default async function NFCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const [plan, card, { data: orders }] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard(user.id, 'id, name, title, company, slug, profile_image_url, company_logo_url, color_theme'),
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

  // Get team cards if user is org admin
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('admin_user_id', user.id)
    .single()

  const { data: teamCards } = org
    ? await admin
        .from('team_cards')
        .select('id, name, title, company, slug')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
    : { data: [] }

  const cardUrl = (card as any)?.slug
    ? `https://cardtly.com/${(card as any).slug}`
    : 'https://cardtly.com'
  const cardName = (card as any)?.name || ''

  return (
    <>
      <NFCWriteCard cardUrl={cardUrl} cardName={cardName} />
      {/* Above the order form on purpose: seeing what the printing actually
          looks like is what makes someone order, so it comes before the form
          rather than after it. */}
      <NFCSamplesSection samples={availableSamples()} />
      <NFCOrderPage
        card={card as any}
        user={{ id: user.id, email: user.email || '' }}
        previousOrders={orders || []}
        teamCards={teamCards || []}
        samples={availableSamples()}
      />
    </>
  )
}
