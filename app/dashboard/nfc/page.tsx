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
    // admin, not supabase: nfc_orders has RLS with no policies (migration 079)
    // so the user-scoped client returns an empty list and no error, and this
    // page would show a customer none of their own orders. Scoped by the
    // user_id from the verified session immediately below, which is what
    // makes the service role safe here.
    admin
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

  const cardName = (card as any)?.name || ''
  const ownCards = (card as any)?.slug ? [{ id: (card as any).id, name: cardName || 'Your card', slug: (card as any).slug }] : []
  const staff = (teamCards || []).filter((c: any) => c.slug).map((c: any) => ({ id: c.id, name: c.name || c.slug, title: c.title || null, slug: c.slug }))

  return (
    <>
      <NFCWriteCard cards={ownCards} memoryKey={`card:${(card as any)?.id || 'none'}`}
        heading="Write to your own NFC tag" buttonLabel="Write to NFC tag"
        blurb={`Already have blank NFC tags, stickers or cards? Tap below, then hold one against the back of your phone to put ${cardName ? `${cardName}'s` : 'your'} card on it.`} />
      {/* A team's blank cards, written one after another (NfcWriteSession).
          Shown on a computer too, saying to open it on an Android phone. */}
      {org && staff.length > 0 && (
        <NFCWriteCard cards={staff} memoryKey={`team:${org.id}`} explainWhenUnsupported
          heading="Write your team's NFC cards" buttonLabel={`Write team cards (${staff.length})`}
          blurb="Put each person's card onto a blank NFC card, one after the other. The list remembers which are done, so you can stop and carry on later." />
      )}
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
