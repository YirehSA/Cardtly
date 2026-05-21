import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import { redirect } from 'next/navigation'
import QRPage from '@/components/card/QRPage'

interface CardSummary {
  id: string
  slug: string | null
  name: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  color_theme: string | null
}

export const metadata = { title: 'QR Code' }

export default async function QRCodePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [personalCard, plan] = await Promise.all([
    getPrimaryCard<CardSummary>(user.id, 'id, slug, name, profile_image_url, company_logo_url, color_theme'),
    getUserPlan(user.id),
  ])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('admin_user_id', user.id)
    .single()

  const { data: teamCards } = org
    ? await admin
        .from('team_cards')
        .select('id, slug, name, profile_image_url, company_logo_url, color_theme')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
    : { data: [] }

  const allCards = [
    ...(personalCard ? [{ ...personalCard, _label: `${personalCard.name} (My card)` }] : []),
    ...(teamCards || []).map((c: any) => ({ ...c, _label: `${c.name} — Team` })),
  ]

  if (allCards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found. Create your card first.</p>
      </div>
    )
  }

  return (
    <QRPage
      cards={allCards as any}
      defaultCardId={(personalCard?.id as string) || (allCards[0] as any).id}
      plan={plan}
    />
  )
}
