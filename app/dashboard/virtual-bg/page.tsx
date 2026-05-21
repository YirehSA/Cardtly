import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import VirtualBGBuilder from '@/components/virtual-bg/VirtualBGBuilder'
import ProGate from '@/components/card/ProGate'

export const metadata = { title: 'Virtual Background' }

export default async function VirtualBGPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [plan, personalCard] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<Record<string, any>>(user.id, 'id, name, title, company, email, phone, website, profile_image_url, company_logo_url, color_theme, slug'),
  ])

  const isPro = plan.tier === 'pro' && plan.isActive

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

  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('admin_user_id', user.id)
    .single()

  const { data: teamCards } = org
    ? await admin
        .from('team_cards')
        .select('id, name, title, company, email, phone, website, profile_image_url, company_logo_url, color_theme, slug')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
    : { data: [] }

  const allCards = [
    ...(personalCard ? [{ ...personalCard, _type: 'personal', _label: `${personalCard.name} (My card)` }] : []),
    ...(teamCards || []).map(c => ({ ...c, _type: 'team', _label: `${c.name}${c.title ? ` — ${c.title}` : ''}` })),
  ]

  if (allCards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found.</p>
      </div>
    )
  }

  return <VirtualBGBuilder cards={allCards} defaultCardId={personalCard?.id || allCards[0].id} />
}
