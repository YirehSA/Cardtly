import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import VirtualBGBuilder from '@/components/virtual-bg/VirtualBGBuilder'
import ProGate from '@/components/card/ProGate'

export const metadata = { title: 'Virtual Background' }

export default async function VirtualBGPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const CARD_FIELDS = 'id, name, title, company, email, phone, website, profile_image_url, company_logo_url, color_theme, slug'

  const [plan, personalCard] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<Record<string, any>>(user.id, CARD_FIELDS),
  ])

  // A team member has no personal card, so this page gated them on their own
  // plan and then said "No card found" - locking them out of a background for
  // the card their company pays for. Their claimed team card counts, and it is
  // Pro because the organisation is.
  const memberCard = personalCard
    ? null
    : await getMemberTeamCard<Record<string, any>>(user.id, CARD_FIELDS)

  const isPro = (plan.tier === 'pro' && plan.isActive) || !!memberCard

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Virtual Background" />
      </div>
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Not .single(): an abandoned team checkout can leave a second org row, and
  // .single() then returns nothing, silently dropping every team card here.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('admin_user_id', user.id)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: teamCards } = org
    ? await admin
        .from('team_cards')
        .select('id, name, title, company, email, phone, website, profile_image_url, company_logo_url, color_theme, slug')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
    : { data: [] as Record<string, any>[] }

  const allCards: any[] = [
    ...(personalCard ? [{ ...personalCard, _type: 'personal', _label: `${personalCard.name} (My card)` }] : []),
    ...(memberCard ? [{ ...memberCard, _type: 'team', _label: `${memberCard.name} (My card)` }] : []),
    ...(teamCards || []).map(c => ({ ...c, _type: 'team', _label: `${c.name}${c.title ? ` — ${c.title}` : ''}` })),
  ]

  if (allCards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found.</p>
      </div>
    )
  }

  return <VirtualBGBuilder cards={allCards} defaultCardId={personalCard?.id || memberCard?.id || allCards[0].id} />
}
