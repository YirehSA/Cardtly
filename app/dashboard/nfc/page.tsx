import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import { getManagedDepartments } from '@/lib/department-perms'
import NFCOrderPage from '@/components/nfc/NFCOrderPage'
import NFCWriteCard from '@/components/nfc/NFCWriteCard'
import ProGate from '@/components/card/ProGate'
import NFCSamplesSection from '@/components/nfc/NFCSamplesSection'
import { availableSamples } from '@/lib/nfc-samples'
import { possessive } from '@/lib/possessive'

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

  // A department manager writes the cards in the departments they run
  // (lib/department-perms, sub-departments included). The owner already has
  // the whole team above, so this is only for managers who do not own it.
  const managed = (await getManagedDepartments(admin, user.id)).filter(d => !d.viaOwner)
  const { data: deptCardRows } = managed.length
    ? await admin
        .from('team_cards')
        .select('id, name, title, slug, organization_id')
        .in('department_id', managed.map(d => d.id))
        .eq('is_active', true)
        .order('name')
    : { data: [] }
  const deptCards = (deptCardRows || []).filter((c: any) => c.slug)
  const deptOrgId = deptCards[0]?.organization_id
  const deptName = managed.length === 1 ? managed[0].name : 'your departments'

  // The person's own team card. A team member's card lives in the team, not
  // in cards, so reading only the personal card gave a member no way to write
  // their own tag and an order form that said there was no card to order.
  const { data: myTeamCards } = await admin
    .from('team_cards')
    .select('id, name, title, company, slug')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  const mine = (myTeamCards || []).filter((c: any) => c.slug)

  const cardName = (card as any)?.name || mine[0]?.name || ''
  const ownCards = [
    ...((card as any)?.slug ? [{ id: (card as any).id, name: (card as any).name || 'Your card', slug: (card as any).slug }] : []),
    ...mine.map((c: any) => ({ id: c.id, name: c.name || 'Your team card', title: c.title || null, slug: c.slug })),
  ]
  const staff = (teamCards || []).filter((c: any) => c.slug).map((c: any) => ({ id: c.id, name: c.name || c.slug, title: c.title || null, slug: c.slug }))
  // Cards this person can order: the owner's whole team as before, plus their
  // own team card when it is not already in that list.
  const orderable = [
    ...(teamCards || []),
    ...mine.filter((c: any) => !(teamCards || []).some((t: any) => t.id === c.id)),
  ]

  return (
    <>
      <NFCWriteCard cards={ownCards} memoryKey={`own:${user.id}`}
        heading="Write to your own NFC tag" buttonLabel="Write to NFC tag"
        blurb={`Already have blank NFC tags, stickers or cards? Tap below, then hold one against the back of your phone to put ${cardName ? `${cardName}'s` : 'your'} card on it.`} />
      {/* A team's blank cards, written one after another (NfcWriteSession).
          Shown on a computer too, saying to open it on an Android phone. */}
      {org && staff.length > 0 && (
        <NFCWriteCard cards={staff} memoryKey={`team:${org.id}`} explainWhenUnsupported
          heading="Write your team's NFC cards" buttonLabel={`Write team cards (${staff.length})`}
          blurb="Put each person's card onto a blank NFC card, one after the other. The list remembers which are done, so you can stop and carry on later." />
      )}
      {deptCards.length > 0 && (
        <NFCWriteCard
          cards={deptCards.map((c: any) => ({ id: c.id, name: c.name || c.slug, title: c.title || null, slug: c.slug }))}
          memoryKey={`team:${deptOrgId}`} explainWhenUnsupported
          heading={managed.length === 1 ? `Write ${possessive(deptName)} NFC cards` : "Write your departments' NFC cards"}
          buttonLabel={`Write cards (${deptCards.length})`}
          blurb={`Put each person in ${deptName} onto a blank NFC card, one after the other. The list remembers which are done, so you can stop and carry on later.`} />
      )}
      {/* Above the order form on purpose: seeing what the printing actually
          looks like is what makes someone order, so it comes before the form
          rather than after it. */}
      <NFCSamplesSection samples={availableSamples()} />
      <NFCOrderPage
        card={card as any}
        user={{ id: user.id, email: user.email || '' }}
        previousOrders={orders || []}
        teamCards={orderable}
        samples={availableSamples()}
      />
    </>
  )
}
